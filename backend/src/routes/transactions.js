import express from 'express';
const router = express.Router();
import { v4 as uuidv4 } from 'uuid';
import { transactionValidationRules, validate } from '../validators/transactionValidator.js';
import { submitSalesTransaction, getSalesTransactionStatus } from '../services/momentumService.js';
import { sanitizeBody } from '../utils/sanitizeBody.js';
import { query } from '../db/connection.js';
import logger from '../config/logger.js';
import moment from 'moment-timezone';

function extractErrorMessage(err) {
  if (err.errorData) {
    if (Array.isArray(err.errorData?.errors) && err.errorData.errors[0]?.errorMessage) {
      return err.errorData.errors[0].errorMessage;
    }
    return err.errorData?.message || JSON.stringify(err.errorData);
  }
  return err.message || 'Submission failed';
}

async function storeSubmission({ userId, correlationId, outcome, salesTransactionId, errorMessage, errorStatus, payloadSnapshot }) {
  await query(
    `INSERT INTO submissions (user_id, correlation_id, outcome, sales_transaction_id, error_message, error_status, payload_snapshot)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      userId,
      correlationId,
      outcome,
      salesTransactionId || null,
      errorMessage || null,
      errorStatus || null,
      payloadSnapshot ? JSON.stringify(payloadSnapshot) : null,
    ]
  );
}

 async function hasSuccessfulSubmissionWithReference(transactionReference) {
  const ref = String(transactionReference || '').trim().toUpperCase();
  if (!ref) return false;
  const { rows } = await query(
    `SELECT 1
     FROM submissions
     WHERE outcome = 'success'
       AND payload_snapshot->'transaction'->>'transactionReference' = $1
     LIMIT 1`,
    [ref]
  );
  return rows.length > 0;
}

async function getLastSuccessfulUhmReference() {
  const { rows } = await query(
    `SELECT
       payload_snapshot->'transaction'->>'transactionReference' AS transaction_reference,
       created_at
     FROM submissions
     WHERE outcome = 'success'
       AND (payload_snapshot->'transaction'->>'transactionReference') ~ '^UHM[0-9]{1,9}$'
     ORDER BY created_at DESC
     LIMIT 1`
  );
  const row = rows[0];
  return row
    ? { transactionReference: row.transaction_reference, createdAt: row.created_at }
    : null;
}

/**
 * POST /api/transactions
 * Submit a new sales transaction to Momentum Energy
 */
router.post(
  '/',
  transactionValidationRules,
  validate,
  async (req, res, next) => {
    const correlationId = req.headers['x-correlation-id'] || req.headers['id-correlation'] || uuidv4();
    const userId = req.user?.id;
    const body = sanitizeBody(req.body);
    const payloadSnapshot = structuredClone(body);
    delete body.portalMeta;
    // Normalize transactionDate to ISO 8601 UTC. Treat timezone-less inputs as Australia/Sydney.
    const txDate = body?.transaction?.transactionDate;
    if (typeof txDate === 'string' && txDate) {
      if (!txDate.endsWith('Z')) {
        const iso = moment.tz(txDate, 'Australia/Sydney').toISOString();
        body.transaction.transactionDate = iso;
        if (payloadSnapshot?.transaction) {
          payloadSnapshot.transaction.transactionDate = iso;
        }
      }
    }

    try {
      const transactionReference = body?.transaction?.transactionReference;
      if (await hasSuccessfulSubmissionWithReference(transactionReference)) {
        const ref = String(transactionReference || '').trim().toUpperCase();
        const last = await getLastSuccessfulUhmReference().catch(() => null);
        const lastMsg = last?.transactionReference
          ? ` Last successful UHM reference: ${last.transactionReference} (${new Date(last.createdAt).toISOString()}).`
          : '';
        logger.warn('Duplicate transaction reference blocked', {
          correlationId,
          userId: userId ?? null,
          transactionReference: ref,
          lastSuccessfulUhmReference: last?.transactionReference ?? null,
          lastSuccessfulUhmCreatedAt: last?.createdAt ?? null,
        });
        return res.status(409).json({
          success: false,
          error: `Transaction reference ${ref} has already been submitted successfully. This sale was not submitted to Momentum. Please use a new reference.${lastMsg}`,
        });
      }

      logger.info('Submitting transaction to Momentum', {
        correlationId,
        reference: req.body.transaction?.transactionReference,
      });

      const result = await submitSalesTransaction(body, { correlationId });

      if (userId) {
        const salesTransactionId =
          result?.salesTransactionId ?? result?.data?.salesTransactionId ?? result?.data?.data?.salesTransactionId ?? null;
        await storeSubmission({
          userId,
          correlationId,
          outcome: 'success',
          salesTransactionId,
          payloadSnapshot,
        }).catch((storeErr) => logger.error('Failed to store submission', { error: storeErr.message }));
      }

      res.status(201).json({
        success: true,
        correlationId,
        data: result?.data ?? result,
      });
    } catch (error) {
      if (userId) {
        const errorMessage = extractErrorMessage(error);
        await storeSubmission({
          userId,
          correlationId,
          outcome: 'error',
          errorMessage,
          errorStatus: error.status || null,
          payloadSnapshot,
        }).catch((storeErr) => logger.error('Failed to store submission', { error: storeErr.message }));
      }
      next(error);
    }
  }
);

/**
 * GET /api/transactions/:salesTransactionId/status
 * Fetch transaction status from Momentum API
 */
router.get('/:salesTransactionId/status', async (req, res, next) => {
  try {
    const { salesTransactionId } = req.params;
    const correlationId = req.headers['x-correlation-id'] || req.headers['id-correlation'] || uuidv4();
    const result = await getSalesTransactionStatus(salesTransactionId, { correlationId });

    // Momentum API returns { status: "SUCCESS", data: { ...status: { saleStatus }, service, transaction } }
    const momentumData = result?.data ?? result;
    const saleStatus = momentumData?.status?.saleStatus ?? result?.transactionStatus ?? momentumData?.transactionStatus;

    res.json({
      success: true,
      data: {
        // Top-level for backwards compat
        salesTransactionId: momentumData?.salesTransactionId ?? salesTransactionId,
        transactionStatus: saleStatus,
        lastChecked: new Date().toISOString(),
        // Full Momentum API response (status + data)
        details: result,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
