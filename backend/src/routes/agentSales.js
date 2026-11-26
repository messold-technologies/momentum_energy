/**
 * Agent sales: capture on the agent portal, customer consent, QA review and submit.
 *
 * Authenticated routes (mounted behind requireAuth):
 *   POST   /api/agent-sales                  create
 *   GET    /api/agent-sales                  queue
 *   GET    /api/agent-sales/:id              detail
 *   PATCH  /api/agent-sales/:id              update while still a draft
 *   POST   /api/agent-sales/:id/consent-link issue a customer consent link
 *   POST   /api/agent-sales/:id/submit       QA submits to Momentum
 *   POST   /api/agent-sales/:id/reject       QA rejects
 *
 * The public consent routes live in routes/consent.js, outside requireAuth.
 */
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import { query } from '../db/connection.js';
import logger from '../config/logger.js';
import config from '../config/index.js';
import { submitSalesTransaction } from '../services/momentumService.js';
import { sanitizeBody } from '../utils/sanitizeBody.js';
import {
  generateConsentToken,
  deriveSummary,
  buildPublicSummary,
} from '../services/agentSaleService.js';

const router = express.Router();


/** Rows an agent may see: their own. Admins and QA see everything. */
function canSeeAll(user) {
  return user?.isAdmin === true;
}

function rowToJson(row, { includePayload = false } = {}) {
  return {
    id: row.id,
    status: row.status,
    companyId: row.company_id,
    createdBy: row.created_by,
    createdByName: row.created_by_name ?? null,
    // The portal is entered with a shared password, so there is no per-agent identity.
    // The name here is whatever the agent typed on the form: self-reported, not verified.
    agentName: row.payload?.portalMeta?.agentName || null,
    agentNameIsSelfReported: Boolean(row.agent_user_id),
    fromAgentPortal: Boolean(row.agent_user_id),
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    serviceAddress: row.service_address,
    transactionReference: row.transaction_reference,
    selectedPlan: row.selected_plan,
    consentSentAt: row.consent_sent_at,
    consentExpiresAt: row.consent_token_expires_at,
    consentedAt: row.consented_at,
    consent: row.consent,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    salesTransactionId: row.sales_transaction_id,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(includePayload ? { payload: row.payload } : {}),
  };
}

async function loadSale(id, user) {
  const { rows } = await query(
    `SELECT a.*, u.name AS created_by_name
     FROM agent_sales a
     LEFT JOIN users u ON u.id = a.created_by
     WHERE a.id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return { error: 'notFound' };
  const ownedByStaff = row.created_by === user.id;
  const fromAgentPortal = row.agent_user_id !== null;
  if (!canSeeAll(user) && !ownedByStaff && !fromAgentPortal) return { error: 'forbidden' };
  return { row };
}

/* ------------------------------------------------------------------- create */

router.post('/', async (req, res, next) => {
  const userId = req.user?.id;
  try {
    const payload = sanitizeBody(req.body?.payload ?? {});
    const selectedPlan = req.body?.selectedPlan ?? null;
    const summary = deriveSummary(payload);

    const { rows } = await query(
      `INSERT INTO agent_sales
         (company_id, status, created_by, payload, selected_plan,
          customer_name, customer_email, service_address, transaction_reference)
       VALUES ('momentum', 'agent_draft', $1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        userId,
        JSON.stringify(payload),
        selectedPlan ? JSON.stringify(selectedPlan) : null,
        summary.customerName,
        summary.customerEmail,
        summary.serviceAddress,
        summary.transactionReference,
      ]
    );
    res.status(201).json({ success: true, data: rowToJson(rows[0], { includePayload: true }) });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------------- queue */

router.get('/', async (req, res, next) => {
  try {
    const statuses = String(req.query.status || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const limitRaw = Number.parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;

    const params = [];
    const where = ["company_id = 'momentum'"];

    if (!canSeeAll(req.user)) {
      // Non-admin staff see sales they captured themselves, plus everything that came in
      // from the agent portal, which is what they are here to review.
      params.push(req.user.id);
      where.push(`(a.created_by = $${params.length} OR a.agent_user_id IS NOT NULL)`);
    }
    if (statuses.length) {
      params.push(statuses);
      where.push(`a.status = ANY($${params.length})`);
    }
    params.push(limit);

    const { rows } = await query(
      `SELECT a.*, u.name AS created_by_name
       FROM agent_sales a
       LEFT JOIN users u ON u.id = a.created_by
       WHERE ${where.join(' AND ')}
       ORDER BY a.created_at DESC
       LIMIT $${params.length}`,
      params
    );
    res.json({ success: true, data: rows.map((r) => rowToJson(r)) });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------- detail */

router.get('/:id', async (req, res, next) => {
  try {
    const { row, error } = await loadSale(req.params.id, req.user);
    if (error === 'notFound') return res.status(404).json({ success: false, error: 'Not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, error: 'Forbidden' });
    res.json({
      success: true,
      data: { ...rowToJson(row, { includePayload: true }), publicSummary: await buildPublicSummary(row) },
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------- update */

router.patch('/:id', async (req, res, next) => {
  try {
    const { row, error } = await loadSale(req.params.id, req.user);
    if (error === 'notFound') return res.status(404).json({ success: false, error: 'Not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, error: 'Forbidden' });

    // Once the customer has consented, the payload they agreed to is frozen. Changing it
    // afterwards would mean submitting something the customer never saw.
    if (!['agent_draft', 'awaiting_consent'].includes(row.status)) {
      return res.status(409).json({
        success: false,
        error: `Cannot edit a sale with status ${row.status}`,
      });
    }

    const payload = sanitizeBody(req.body?.payload ?? row.payload);
    const selectedPlan =
      req.body?.selectedPlan === undefined ? row.selected_plan : req.body.selectedPlan;
    const summary = deriveSummary(payload);

    const { rows } = await query(
      `UPDATE agent_sales
       SET payload = $2, selected_plan = $3, customer_name = $4, customer_email = $5,
           service_address = $6, transaction_reference = $7, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
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
    res.json({ success: true, data: rowToJson(rows[0], { includePayload: true }) });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------- consent link */

router.post('/:id/consent-link', async (req, res, next) => {
  try {
    const { row, error } = await loadSale(req.params.id, req.user);
    if (error === 'notFound') return res.status(404).json({ success: false, error: 'Not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, error: 'Forbidden' });

    if (!['agent_draft', 'awaiting_consent'].includes(row.status)) {
      return res.status(409).json({
        success: false,
        error: `Cannot issue a consent link for a sale with status ${row.status}`,
      });
    }

    // Re-issuing invalidates the previous link, since only the newest hash is stored.
    // No expiry: the link is single-use, and a customer confirming days later should
    // not be turned away. Re-issuing invalidates the previous link.
    const { token, hash } = generateConsentToken();

    const { rows } = await query(
      `UPDATE agent_sales
       SET consent_token_hash = $2, consent_token_expires_at = NULL,
           consent_sent_at = NOW(), status = 'awaiting_consent', updated_at = NOW(),
           -- A new link clears the lock: this is how an agent reopens a page that a
           -- customer locked by mistyping their postcode or birthday.
           consent_attempts = 0, consent_locked_at = NULL
       WHERE id = $1
       RETURNING *`,
      [row.id, hash]
    );

    const base = config.portal.publicUrl;
    logger.info('Consent link issued', { agentSaleId: row.id, userId: req.user?.id });

    res.json({
      success: true,
      data: {
        ...rowToJson(rows[0]),
        // Returned once, here. Only the hash is stored.
        consentUrl: `${base}/consent/${token}`,
        consentToken: token,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------- submit */

function extractErrorMessage(err) {
  if (err?.errorData) {
    if (Array.isArray(err.errorData?.errors) && err.errorData.errors[0]?.errorMessage) {
      return err.errorData.errors[0].errorMessage;
    }
    return err.errorData?.message || JSON.stringify(err.errorData);
  }
  return err?.message || 'Submission failed';
}

router.post('/:id/submit', async (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  try {
    const { row, error } = await loadSale(req.params.id, req.user);
    if (error === 'notFound') return res.status(404).json({ success: false, error: 'Not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, error: 'Forbidden' });

    // A sale reaches Momentum only after the customer has actually consented.
    if (row.status !== 'consented') {
      return res.status(409).json({
        success: false,
        error:
          row.status === 'submitted'
            ? 'This sale has already been submitted'
            : `Cannot submit a sale with status ${row.status}. Customer consent is required first.`,
      });
    }

    const payload = structuredClone(row.payload || {});
    delete payload.portalMeta;

    const reference = row.payload?.transaction?.transactionReference;
    const dup = await query(
      `SELECT 1 FROM submissions
       WHERE outcome = 'success'
         AND payload_snapshot->'transaction'->>'transactionReference' = $1
       LIMIT 1`,
      [String(reference || '').trim().toUpperCase()]
    );
    if (dup.rows.length) {
      return res.status(409).json({
        success: false,
        error: `Transaction reference ${reference} has already been submitted successfully. Use a new reference.`,
      });
    }

    let result;
    try {
      result = await submitSalesTransaction(payload, { correlationId });
    } catch (err) {
      const message = extractErrorMessage(err);
      await query(
        `INSERT INTO submissions (user_id, company_id, correlation_id, outcome, error_message, error_status, payload_snapshot)
         VALUES ($1, 'momentum', $2, 'error', $3, $4, $5)`,
        [req.user.id, correlationId, message, err?.status ?? null, JSON.stringify(row.payload)]
      );
      logger.error('Agent sale submission failed', { agentSaleId: row.id, status: err?.status });
      return res.status(err?.status && err.status < 600 ? err.status : 502).json({
        success: false,
        error: message,
        momentumError: err?.errorData,
      });
    }

    const salesTransactionId = result?.data?.salesTransactionId ?? result?.salesTransactionId ?? null;

    const ins = await query(
      `INSERT INTO submissions (user_id, company_id, correlation_id, outcome, sales_transaction_id, payload_snapshot)
       VALUES ($1, 'momentum', $2, 'success', $3, $4)
       RETURNING id`,
      [req.user.id, correlationId, salesTransactionId, JSON.stringify(row.payload)]
    );

    const { rows } = await query(
      `UPDATE agent_sales
       SET status = 'submitted', sales_transaction_id = $2, submission_id = $3,
           submitted_at = NOW(), reviewed_by = $4, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [row.id, salesTransactionId, ins.rows[0].id, req.user.id]
    );

    logger.info('Agent sale submitted', { agentSaleId: row.id, salesTransactionId });
    res.json({ success: true, data: { ...rowToJson(rows[0]), salesTransactionId } });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------- reject */

router.post('/:id/reject', async (req, res, next) => {
  try {
    const { row, error } = await loadSale(req.params.id, req.user);
    if (error === 'notFound') return res.status(404).json({ success: false, error: 'Not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, error: 'Forbidden' });
    if (row.status === 'submitted') {
      return res.status(409).json({ success: false, error: 'Cannot reject a submitted sale' });
    }

    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ success: false, error: 'A reason is required' });

    const { rows } = await query(
      `UPDATE agent_sales
       SET status = 'rejected', rejection_reason = $2, reviewed_by = $3,
           reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [row.id, reason, req.user.id]
    );
    res.json({ success: true, data: rowToJson(rows[0]) });
  } catch (err) {
    next(err);
  }
});

export default router;
