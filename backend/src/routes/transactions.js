import express from 'express';
const router = express.Router();
import { v4 as uuidv4 } from 'uuid';
import { transactionValidationRules, validate } from '../validators/transactionValidator.js';
import { submitSalesTransaction, getSalesTransactionStatus } from '../services/momentumService.js';
import { sanitizeBody } from '../utils/sanitizeBody.js';
import logger from '../config/logger.js';

/**
 * POST /api/transactions
 * Submit a new sales transaction to Momentum Energy
 */
router.post(
  '/',
  transactionValidationRules,
  validate,
  async (req, res, next) => {
    const correlationId = req.headers['x-correlation-id'] || uuidv4();

    try {
      logger.info('Submitting transaction to Momentum', {
        correlationId,
        reference: req.body.transaction?.transactionReference,
      });

      const body = sanitizeBody(req.body);
      const result = await submitSalesTransaction(body);

      res.status(201).json({
        success: true,
        correlationId,
        data: result,
      });
    } catch (error) {
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
    const result = await getSalesTransactionStatus(salesTransactionId);

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
