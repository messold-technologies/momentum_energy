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
    const isAdmin = req.user?.isAdmin === true;

    const rawLimit = req.query?.limit;
    const parsed = typeof rawLimit === 'string' ? Number.parseInt(rawLimit, 10) : Number.NaN;
    const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 100;

    const sql = isAdmin
      ? `SELECT s.id, s.correlation_id, s.outcome, s.sales_transaction_id,
                s.error_message, s.error_status, s.payload_snapshot, s.created_at,
                u.name AS user_name
         FROM submissions s
         JOIN users u ON s.user_id = u.id
         ORDER BY s.created_at DESC
         LIMIT $1`
      : `SELECT s.id, s.correlation_id, s.outcome, s.sales_transaction_id,
                s.error_message, s.error_status, s.payload_snapshot, s.created_at,
                u.name AS user_name
         FROM submissions s
         JOIN users u ON s.user_id = u.id
         WHERE s.user_id = $1
         ORDER BY s.created_at DESC
         LIMIT $2`;

    const result = await query(sql, isAdmin ? [limit] : [userId, limit]);

    const defaultUserName = req.user?.name ?? '';

    const submissions = result.rows.map((row) => ({
      id: row.id,
      correlationId: row.correlation_id,
      outcome: row.outcome,
      salesTransactionId: row.sales_transaction_id,
      errorMessage: row.error_message,
      errorStatus: row.error_status,
      payloadSnapshot: row.payload_snapshot,
      createdAt: row.created_at,
      userName: row.user_name ?? defaultUserName,
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
