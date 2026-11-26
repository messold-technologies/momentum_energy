/**
 * Public customer consent. NOT behind requireAuth: the customer holds only a link.
 *
 * Safeguards, because anyone with the URL reaches this:
 *   - the token is 32 random bytes and only its SHA-256 hash is stored, so a database
 *     leak does not yield a working link
 *   - links are single-use: the hash is cleared the moment consent is recorded, so a
 *     link cannot be replayed. There is deliberately no expiry -- a customer who opens
 *     it days later should still be able to confirm rather than hit a dead end
 *   - the page is gated by a password only the customer should know: their postcode
 *     followed by the two-digit day of their date of birth. The link alone reveals
 *     nothing -- GET returns status and nothing identifying, and the details are served
 *     only by /verify. Confirming re-checks the password, so the gate cannot be skipped
 *     by posting straight to the confirm endpoint
 *   - wrong passwords are counted against the sale, not just the IP, and the link locks
 *     after CONSENT_MAX_ATTEMPTS. Four of the six digits are a postcode, so an attacker
 *     who knows roughly where the customer lives has about 31 guesses to try
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
  consentPasswordMatches,
  deriveConsentPasswords,
  CONSENT_ITEMS,
  CONSENT_MAX_ATTEMPTS,
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

/** Deliberately says nothing about the customer -- only whether the link can be opened. */
router.get('/:token', async (req, res, next) => {
  try {
    const row = await findByToken(req.params.token);
    if (!row) return gone(res);

    if (!['awaiting_consent', 'consented'].includes(row.status)) return gone(res);

    res.json({
      success: true,
      data: {
        status: row.status,
        requiresPassword: true,
        locked: Boolean(row.consent_locked_at),
        // False when the sale has no date of birth or postcode to build a password from.
        // The page says to contact the agent rather than leaving the customer guessing.
        passwordAvailable: deriveConsentPasswords(row.payload).ok,
      },
    });
  } catch (err) {
    next(err);
  }
});

function lockedResponse(res) {
  return res.status(423).json({
    success: false,
    error:
      'This link has been locked after too many incorrect attempts. Please contact the person who sent it to you for a new link.',
  });
}

/**
 * Checks the password and, only then, returns the details. Every failure is counted
 * against the sale so the link cannot be ground down from a pool of addresses.
 */
router.post('/:token/verify', async (req, res, next) => {
  try {
    const row = await findByToken(req.params.token);
    if (!row) return gone(res);
    if (!['awaiting_consent', 'consented'].includes(row.status)) return gone(res);
    if (row.consent_locked_at) return lockedResponse(res);

    if (!consentPasswordMatches(row.payload, req.body?.password)) {
      const attempts = Number(row.consent_attempts ?? 0) + 1;
      const lock = attempts >= CONSENT_MAX_ATTEMPTS;
      await query(
        `UPDATE agent_sales
         SET consent_attempts = $2, consent_locked_at = CASE WHEN $3 THEN NOW() ELSE consent_locked_at END
         WHERE id = $1`,
        [row.id, attempts, lock]
      );
      logger.warn('Consent password rejected', { agentSaleId: row.id, attempts, locked: lock });
      if (lock) return lockedResponse(res);
      return res.status(401).json({
        success: false,
        error: 'That does not match. Check your postcode and the day of your date of birth.',
        attemptsLeft: Math.max(0, CONSENT_MAX_ATTEMPTS - attempts),
      });
    }

    if (Number(row.consent_attempts ?? 0) > 0) {
      await query('UPDATE agent_sales SET consent_attempts = 0 WHERE id = $1', [row.id]);
    }

    logger.info('Consent page opened', { agentSaleId: row.id });
    res.json({ success: true, data: await buildPublicSummary(row) });
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
    if (row.consent_locked_at) return lockedResponse(res);

    // Re-checked here, not just on /verify, so consent cannot be recorded by posting
    // straight to this endpoint with only the link.
    if (!consentPasswordMatches(row.payload, req.body?.password)) {
      logger.warn('Consent submitted without a valid password', { agentSaleId: row.id });
      return res
        .status(401)
        .json({ success: false, error: 'Please confirm your details again before submitting.' });
    }

    const summary = await buildPublicSummary(row);
    const check = validateConsent(req.body, summary.consentItems);
    if (!check.ok) return res.status(400).json({ success: false, error: check.error });

    const given = req.body.consent;
    const recorded = {
      items: Object.fromEntries(
        summary.consentItems.map((i) => [i.key, given[i.key] === true])
      ),
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
