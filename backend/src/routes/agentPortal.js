/**
 * Agent portal: entered with a shared password, then used to submit sales for QA.
 *
 * There is no per-agent account. Everything created here belongs to one shared row in
 * `agent_users`, which is a table separate from staff `users` -- so an agent session can
 * never become a staff session. The token carries scope 'agent' and is accepted only by
 * requireAgentScope, which guards this router alone: an agent cannot reach
 * /api/transactions, /api/submissions, /api/drafts or the QA queue.
 *
 *   POST /api/agent-portal/access           exchange the shared password for a session
 *   POST /api/agent-portal/sales
 *   PATCH/GET /api/agent-portal/sales/:id
 *   POST /api/agent-portal/sales/:id/consent-link
 *   GET  /api/agent-portal/sales
 */
import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';

import { query } from '../db/connection.js';
import config from '../config/index.js';
import logger from '../config/logger.js';
import { sanitizeBody } from '../utils/sanitizeBody.js';
import { requireAgentScope } from '../middleware/requireAgentScope.js';
import { generateConsentToken, deriveSummary } from '../services/agentSaleService.js';

const router = express.Router();

const AGENT_USER_ID = '00000000-0000-0000-0000-00000000a9e7';

/** A shared password is guessable by design, so the gate is rate limited hard. */
const accessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many attempts, please try again later' },
});

/**
 * A bcrypt hash of nothing in particular. Compared against when the channel is unknown,
 * so a wrong channel name costs the same time as a wrong password and the response
 * cannot be used to work out which channels exist.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.uQZbZ0cmaK0rbxafOTzBdLH0FAmrpZi';

/** Channels are fixed in config. Matching is relaxed about case and spacing only. */
function findChannel(supplied) {
  const key = String(supplied ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  if (!key) return null;
  return (
    config.agentPortal.channels.find(
      (c) => c.id.replace(/[\s_-]+/g, '') === key || c.name.toLowerCase().replace(/[\s_-]+/g, '') === key
    ) ?? null
  );
}

/**
 * An env var rotates a channel's password without a deploy; otherwise the bundled hash
 * is used. Both paths are constant time with respect to the supplied password.
 */
async function passwordMatches(channel, supplied) {
  const given = String(supplied ?? '');
  if (!channel) {
    await bcrypt.compare(given, DUMMY_HASH); // keep the timing the same
    return false;
  }

  const override = (process.env[channel.envVar] || '').trim();
  if (override) {
    const a = Buffer.from(override);
    const b = Buffer.from(given);
    if (a.length !== b.length) {
      crypto.timingSafeEqual(a, a);
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  return bcrypt.compare(given, channel.passwordHash);
}

function issueToken(channel) {
  return jwt.sign(
    {
      scope: 'agent',
      agentUserId: AGENT_USER_ID,
      channelId: channel.id,
      channelName: channel.name,
    },
    config.jwt.secret,
    { expiresIn: config.agentPortal.sessionExpiresIn }
  );
}

/* ------------------------------------------------------------------ access */

/** Names only, so the sign-in screen can offer the three. The password is the secret. */
router.get('/channels', (_req, res) => {
  res.json({
    success: true,
    data: config.agentPortal.channels.map((c) => ({ id: c.id, name: c.name })),
  });
});

router.post('/access', accessLimiter, async (req, res, next) => {
  try {
    const channel = findChannel(req.body?.channel);
    const ok = await passwordMatches(channel, req.body?.password);
    if (!ok) {
      // One message for both an unknown channel and a wrong password, so the screen
      // cannot be used to discover which channels exist.
      logger.warn('Agent portal access denied', {
        ip: req.ip,
        channelKnown: Boolean(channel),
      });
      return res
        .status(401)
        .json({ success: false, error: 'That channel and password combination is not recognised' });
    }

    const { rows } = await query('SELECT id, is_active FROM agent_users WHERE id = $1', [
      AGENT_USER_ID,
    ]);
    if (!rows.length) {
      logger.error('Agent portal account missing; run migrations');
      return res
        .status(503)
        .json({ success: false, error: 'Agent portal is not configured. Contact support.' });
    }
    if (!rows[0].is_active) {
      return res.status(403).json({ success: false, error: 'The agent portal is currently closed' });
    }

    await query('UPDATE agent_users SET last_login_at = NOW() WHERE id = $1', [AGENT_USER_ID]);

    logger.info('Agent portal session started', { ip: req.ip, channel: channel.id });
    res.json({
      success: true,
      data: {
        token: issueToken(channel),
        expiresIn: config.agentPortal.sessionExpiresIn,
        channel: { id: channel.id, name: channel.name },
      },
    });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------------------------- everything below: agent */

router.use(requireAgentScope);

/** Every portal sale belongs to the one shared account, and only that account's. */
async function loadOwnSale(id, agentUserId) {
  const { rows } = await query('SELECT * FROM agent_sales WHERE id = $1 AND agent_user_id = $2', [
    id,
    agentUserId,
  ]);
  return rows[0] ?? null;
}

/** Agents never see QA fields: no reviewer, no rejection reason, no submission ids. */
function agentView(row) {
  return {
    id: row.id,
    status: row.status,
    customerName: row.customer_name,
    serviceAddress: row.service_address,
    selectedPlan: row.selected_plan,
    consentSentAt: row.consent_sent_at,
    consentedAt: row.consented_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payload: row.payload,
  };
}

router.get('/sales', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM agent_sales
       WHERE agent_user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.agent.userId]
    );
    res.json({ success: true, data: rows.map(agentView) });
  } catch (err) {
    next(err);
  }
});

/**
 * The channel is taken from the session, not the body, and overwrites whatever was
 * sent. portalMeta is internal: agentSales.js strips it before anything goes to
 * Momentum, so this records who sold it without reaching the external API.
 */
function stampChannel(payload, agent) {
  if (!agent?.channelName) return payload;
  return { ...payload, portalMeta: { ...(payload.portalMeta ?? {}), channel: agent.channelName } };
}

router.post('/sales', async (req, res, next) => {
  try {
    const payload = stampChannel(sanitizeBody(req.body?.payload ?? {}), req.agent);
    const selectedPlan = req.body?.selectedPlan ?? null;
    const summary = deriveSummary(payload);

    const { rows } = await query(
      `INSERT INTO agent_sales
         (company_id, status, agent_user_id, payload, selected_plan,
          customer_name, customer_email, service_address, transaction_reference)
       VALUES ('momentum', 'agent_draft', $1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.agent.userId,
        JSON.stringify(payload),
        selectedPlan ? JSON.stringify(selectedPlan) : null,
        summary.customerName,
        summary.customerEmail,
        summary.serviceAddress,
        summary.transactionReference,
      ]
    );
    res.status(201).json({ success: true, data: agentView(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.get('/sales/:id', async (req, res, next) => {
  try {
    const row = await loadOwnSale(req.params.id, req.agent.userId);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: agentView(row) });
  } catch (err) {
    next(err);
  }
});

router.patch('/sales/:id', async (req, res, next) => {
  try {
    const row = await loadOwnSale(req.params.id, req.agent.userId);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });

    // Once the customer has consented the payload is frozen: changing it would mean
    // submitting something the customer never saw.
    if (!['agent_draft', 'awaiting_consent'].includes(row.status)) {
      return res.status(409).json({ success: false, error: 'This sale can no longer be edited' });
    }

    const payload = stampChannel(sanitizeBody(req.body?.payload ?? row.payload), req.agent);
    const selectedPlan =
      req.body?.selectedPlan === undefined ? row.selected_plan : req.body.selectedPlan;
    const summary = deriveSummary(payload);

    const { rows } = await query(
      `UPDATE agent_sales
       SET payload = $2, selected_plan = $3, customer_name = $4, customer_email = $5,
           service_address = $6, transaction_reference = $7, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        row.id,
        JSON.stringify(payload),
        selectedPlan ? JSON.stringify(selectedPlan) : null,
        summary.customerName,
        summary.customerEmail,
        summary.serviceAddress,
        summary.transactionReference,
      ]
    );
    res.json({ success: true, data: agentView(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.post('/sales/:id/consent-link', async (req, res, next) => {
  try {
    const row = await loadOwnSale(req.params.id, req.agent.userId);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });

    if (!['agent_draft', 'awaiting_consent'].includes(row.status)) {
      return res
        .status(409)
        .json({ success: false, error: 'A consent link cannot be issued for this sale' });
    }

    // No expiry: the link is single-use, and a customer confirming days later should
    // not be turned away. Re-issuing invalidates the previous link.
    const { token, hash } = generateConsentToken();

    const { rows } = await query(
      `UPDATE agent_sales
       SET consent_token_hash = $2, consent_token_expires_at = NULL,
           consent_sent_at = NOW(), status = 'awaiting_consent', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [row.id, hash]
    );

    const base = config.portal.publicUrl;
    logger.info('Consent link issued from agent portal', {
      agentSaleId: row.id,
      agentUserId: req.agent.userId,
    });

    res.json({
      success: true,
      data: {
        ...agentView(rows[0]),
        consentUrl: `${base}/consent/${token}`,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
