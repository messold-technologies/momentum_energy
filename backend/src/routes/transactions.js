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
    // Normalize transactionDate to ISO 8601 UTC. Treat timezone-less inputs as Australia/Sydney.
    const txDate = body?.transaction?.transactionDate;
    if (typeof txDate === 'string' && txDate) {
      if (!txDate.endsWith('Z')) {
        body.transaction.transactionDate = moment.tz(txDate, 'Australia/Sydney').toISOString();
      }
    }

    try {
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
          payloadSnapshot: body,
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
          payloadSnapshot: body,
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
