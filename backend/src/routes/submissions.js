/**
 * GET /api/submissions
 * List form submissions for the authenticated user
 */
import express from 'express';
const router = express.Router();
import { query } from '../db/connection.js';
import logger from '../config/logger.js';

router.get('/', async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const result = await query(
      `SELECT id, correlation_id, outcome, sales_transaction_id,
              error_message, error_status, payload_snapshot, created_at
       FROM submissions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );

    const submissions = result.rows.map((row) => ({
      id: row.id,
      correlationId: row.correlation_id,
      outcome: row.outcome,
      salesTransactionId: row.sales_transaction_id,
      errorMessage: row.error_message,
      errorStatus: row.error_status,
      payloadSnapshot: row.payload_snapshot,
      createdAt: row.created_at,
    }));

    res.json({
      success: true,
      submissions,
    });
  } catch (err) {
    logger.error('Failed to fetch submissions', { error: err.message, userId });
    next(err);
  }
});

export default router;
