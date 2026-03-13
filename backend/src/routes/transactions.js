import express from 'express';
const router = express.Router();
import { v4 as uuidv4 } from 'uuid';
import { transactionValidationRules, validate } from '../validators/transactionValidator.js';
import { submitSalesTransaction, getSalesTransactionStatus } from '../services/momentumService.js';
import { sanitizeBody } from '../utils/sanitizeBody.js';
import { query } from '../db/connection.js';
import logger from '../config/logger.js';

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

    try {
      logger.info('Submitting transaction to Momentum', {
        correlationId,
        reference: req.body.transaction?.transactionReference,
      });

      const result = await submitSalesTransaction(body, { correlationId });

      if (userId) {
        await storeSubmission({
          userId,
          correlationId,
          outcome: 'success',
          salesTransactionId: result.salesTransactionId,
          payloadSnapshot: body,
        }).catch((storeErr) => logger.error('Failed to store submission', { error: storeErr.message }));
      }

      res.status(201).json({
        success: true,
        correlationId,
        data: result,
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

    res.json({
      success: true,
      data: {
        salesTransactionId,
        transactionStatus: result.transactionStatus,
        lastChecked: new Date().toISOString(),
        details: result,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
