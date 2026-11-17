/**
 * Agent portal: agents sign themselves up, log in, and submit sales for QA.
 *
 * Agent accounts live in `agent_users`, separate from staff `users`, so an agent's
 * credentials can never obtain a staff token. Their session token carries scope 'agent'
 * and is accepted only by requireAgentScope, which guards this router alone -- an agent
 * cannot reach /api/transactions, /api/submissions, /api/drafts or the QA queue.
 *
 *   POST /api/agent-portal/signup
 *   POST /api/agent-portal/login
 *   GET  /api/agent-portal/me
 *   POST /api/agent-portal/sales
 *   PATCH/GET /api/agent-portal/sales/:id
 *   POST /api/agent-portal/sales/:id/consent-link
 *   GET  /api/agent-portal/sales            the agent's own sales only
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

import { query } from '../db/connection.js';
import config from '../config/index.js';
import logger from '../config/logger.js';
import { sanitizeBody } from '../utils/sanitizeBody.js';
import { requireAgentScope } from '../middleware/requireAgentScope.js';
import { generateConsentToken, deriveSummary } from '../services/agentSaleService.js';

const router = express.Router();

const CONSENT_LINK_TTL_HOURS = 72;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Credential endpoints are rate limited to blunt guessing and bulk signup. */
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many attempts, please try again later' },
});

function issueToken(agent) {
  return jwt.sign(
    { scope: 'agent', agentUserId: agent.id, agentName: agent.name, agentEmail: agent.email },
    config.jwt.secret,
    { expiresIn: config.agentPortal.sessionExpiresIn }
  );
}

function agentProfile(row) {
  return { id: row.id, email: row.email, name: row.name, phone: row.phone ?? null };
}

/* ------------------------------------------------------------------ signup */

router.post('/signup', credentialLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const name = String(req.body?.name ?? '').trim();
    const phone = String(req.body?.phone ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, error: 'Enter a valid email address' });
    }
    if (name.length < 2) {
      return res.status(400).json({ success: false, error: 'Enter your full name' });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ success: false, error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    let rows;
    try {
      ({ rows } = await query(
        `INSERT INTO agent_users (email, name, phone, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, name, phone`,
        [email, name, phone || null, passwordHash]
      ));
    } catch (err) {
      if (err.code === '23505') {
        return res
          .status(409)
          .json({ success: false, error: 'An account already exists for this email' });
      }
      throw err;
    }

    logger.info('Agent signed up', { agentUserId: rows[0].id, email });
    res.status(201).json({
      success: true,
      data: { token: issueToken(rows[0]), agent: agentProfile(rows[0]) },
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------- login */

router.post('/login', credentialLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const { rows } = await query(
      `SELECT id, email, name, phone, password_hash, is_active
       FROM agent_users WHERE lower(email) = $1`,
      [email]
    );
    const agent = rows[0];

    // Same message whether the account is missing or the password is wrong, so the
    // response does not confirm which emails have accounts.
    const valid = agent && (await bcrypt.compare(password, agent.password_hash));
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    if (!agent.is_active) {
      return res
        .status(403)
        .json({ success: false, error: 'This account has been disabled. Contact your manager.' });
    }

    await query('UPDATE agent_users SET last_login_at = NOW() WHERE id = $1', [agent.id]);

    logger.info('Agent logged in', { agentUserId: agent.id });
    res.json({ success: true, data: { token: issueToken(agent), agent: agentProfile(agent) } });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------------------------- everything below: agent */

router.use(requireAgentScope);

router.get('/me', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, email, name, phone, is_active FROM agent_users WHERE id = $1',
      [req.agent.userId]
    );
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ success: false, error: 'Session no longer valid' });
    }
    res.json({ success: true, data: agentProfile(rows[0]) });
  } catch (err) {
    next(err);
  }
});

/** An agent only ever sees sales they created themselves. */
async function loadOwnSale(id, agentUserId) {
  const { rows } = await query(
    'SELECT * FROM agent_sales WHERE id = $1 AND agent_user_id = $2',
    [id, agentUserId]
  );
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

router.post('/sales', async (req, res, next) => {
  try {
    const payload = sanitizeBody(req.body?.payload ?? {});
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

    const payload = sanitizeBody(req.body?.payload ?? row.payload);
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

    const { token, hash } = generateConsentToken();
    const expires = new Date(Date.now() + CONSENT_LINK_TTL_HOURS * 3600 * 1000);

    const { rows } = await query(
      `UPDATE agent_sales
       SET consent_token_hash = $2, consent_token_expires_at = $3,
           consent_sent_at = NOW(), status = 'awaiting_consent', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [row.id, hash, expires]
    );

    const base = (config.portal.allowedOrigins?.[0] || '').replace(/\/$/, '');
    logger.info('Consent link issued from agent portal', {
      agentSaleId: row.id,
      agentUserId: req.agent.userId,
    });

    res.json({
      success: true,
      data: {
        ...agentView(rows[0]),
        consentUrl: `${base}/consent/${token}`,
        expiresAt: expires.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
