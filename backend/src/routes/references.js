import express from 'express';
const router = express.Router();
import { query } from '../db/connection.js';

/**
 * GET /api/references/transaction-reference/next
 * Returns the next unique transaction reference string (e.g. UHM1300).
 */
router.get('/transaction-reference/next', async (req, res, next) => {
  try {
    const result = await query(`SELECT nextval('transaction_reference_seq') AS n`);
    const n = result.rows?.[0]?.n;
    const num = typeof n === 'string' ? Number.parseInt(n, 10) : Number(n);
    if (!Number.isFinite(num)) {
      return res.status(500).json({ success: false, error: 'Failed to generate transaction reference' });
    }
    const reference = `UHM${num}`;
    res.json({ success: true, reference });
  } catch (err) {
    next(err);
  }
});

export default router;

