/**
 * Public customer consent. NOT behind requireAuth: the customer holds only a link.
 *
 * Safeguards, because anyone with the URL reaches this:
 *   - the token is 32 random bytes and only its SHA-256 hash is stored, so a database
 *     leak does not yield a working link
 *   - links are single-use: the hash is cleared the moment consent is recorded, so a
 *     link cannot be replayed. There is deliberately no expiry -- a customer who opens
 *     it days later should still be able to confirm rather than hit a dead end
 *   - the response is a narrow projection: no date of birth, no identity document
 *     numbers, no full bank account, nothing about the agent or internal references
 *   - lookups are by token hash only; the sale id is never accepted from the client
 *   - its own stricter rate limit on top of the app-wide one
 */
import express from 'express';
import rateLimit from 'express-rate-limit';

import { query } from '../db/connection.js';
import logger from '../config/logger.js';
import {
  hashConsentToken,
  buildPublicSummary,
  applyConsentToPayload,
  validateConsent,
  CONSENT_ITEMS,
} from '../services/agentSaleService.js';

const router = express.Router();

const consentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many requests, please try again later' },
});

router.use(consentLimiter);

const TOKEN_RE = /^[a-f0-9]{64}$/;

async function findByToken(token) {
  if (!TOKEN_RE.test(String(token || ''))) return null;
  const { rows } = await query(
    `SELECT * FROM agent_sales WHERE consent_token_hash = $1 LIMIT 1`,
    [hashConsentToken(token)]
  );
  return rows[0] || null;
}

/** Same wording for missing, expired and wrong-status, so the link reveals nothing. */
function gone(res) {
  return res.status(404).json({
    success: false,
    error: 'This link is no longer valid. Please contact the person who sent it to you.',
  });
}

router.get('/:token', async (req, res, next) => {
  try {
    const row = await findByToken(req.params.token);
    if (!row) return gone(res);

    if (!['awaiting_consent', 'consented'].includes(row.status)) return gone(res);

    res.json({ success: true, data: buildPublicSummary(row) });
  } catch (err) {
    next(err);
  }
});

router.post('/:token', async (req, res, next) => {
  try {
    const row = await findByToken(req.params.token);
    if (!row) return gone(res);

    if (row.status === 'consented') {
      return res.status(409).json({
        success: false,
        error: 'Consent has already been recorded for this sale. Thank you.',
      });
    }
    if (row.status !== 'awaiting_consent') return gone(res);

    const summary = buildPublicSummary(row);
    const check = validateConsent(req.body, summary.consentItems);
    if (!check.ok) return res.status(400).json({ success: false, error: check.error });

    const given = req.body.consent;
    const recorded = {
      items: Object.fromEntries(
        summary.consentItems.map((i) => [i.key, given[i.key] === true])
      ),
      confirmedName: String(req.body.confirmedName).trim().slice(0, 300),
      statementsShown: CONSENT_ITEMS.map((i) => ({ key: i.key, label: i.label, description: i.description })),
      planShown: summary.plan,
    };

    const payload = applyConsentToPayload(row.payload, recorded.items);

    const ip =
      (req.headers['x-forwarded-for']?.split(',')[0] || '').trim() || req.ip || null;

    await query(
      `UPDATE agent_sales
       SET status = 'consented', consent = $2, consented_at = NOW(),
           consent_ip = $3, consent_user_agent = $4, payload = $5,
           consent_token_hash = NULL, updated_at = NOW()
       WHERE id = $1`,
      [
        row.id,
        JSON.stringify(recorded),
        ip ? String(ip).slice(0, 100) : null,
        String(req.headers['user-agent'] || '').slice(0, 1000) || null,
        JSON.stringify(payload),
      ]
    );

    // The token hash is cleared above, so the link cannot be replayed.
    logger.info('Customer consent recorded', { agentSaleId: row.id });

    res.json({
      success: true,
      data: { consentedAt: new Date().toISOString() },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
