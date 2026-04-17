/**
 * GET /api/submissions
 * List form submissions for the authenticated user (or all for admin)
 *
 * Optional query: from, to as YYYY-MM-DD (UTC day bounds), limit (max 500)
 */
import express from 'express';
const router = express.Router();
import { query } from '../db/connection.js';
import logger from '../config/logger.js';

/** YYYY-MM-DD -> start of that day UTC */
function startOfUtcDayIso(dateStr) {
  return `${dateStr}T00:00:00.000Z`;
}

/** YYYY-MM-DD -> instant at start of next day UTC (exclusive upper bound) */
function endOfUtcDayExclusive(dateStr) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

const DATE_ONLY_RE = /^(\d{4}-\d{2}-\d{2})/;

function parseDateOnlyQuery(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const m = DATE_ONLY_RE.exec(value.trim());
  return m ? m[1] : null;
}

function parseCompanyId(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v ? v : null;
}

router.get('/', async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const isAdmin = req.user?.isAdmin === true;
    const companyId = parseCompanyId(req.query?.companyId) ?? 'momentum';

    const rawLimit = req.query?.limit;
    const parsed = typeof rawLimit === 'string' ? Number.parseInt(rawLimit, 10) : Number.NaN;
    const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 100;

    const fromDate = parseDateOnlyQuery(req.query?.from);
    const toDate = parseDateOnlyQuery(req.query?.to);

    const params = [];
    let idx = 1;

    if (!isAdmin) {
      params.push(userId);
      idx = 2;
    }

    const companyPlaceholder = `$${idx}`;
    params.push(companyId);
    idx += 1;

    const dateParts = [];
    if (fromDate) {
      dateParts.push(`s.created_at >= $${idx}`);
      params.push(startOfUtcDayIso(fromDate));
      idx += 1;
    }
    if (toDate) {
      dateParts.push(`s.created_at < $${idx}`);
      params.push(endOfUtcDayExclusive(toDate));
      idx += 1;
    }
    const dateSql = dateParts.length ? ` AND ${dateParts.join(' AND ')}` : '';

    params.push(limit);
    const limitPlaceholder = `$${idx}`;

    const baseSelect = `SELECT s.id, s.correlation_id, s.outcome, s.sales_transaction_id,
                s.error_message, s.error_status, s.payload_snapshot, s.created_at,
                u.name AS user_name
         FROM submissions s
         JOIN users u ON s.user_id = u.id`;

    const sql = isAdmin
      ? `${baseSelect}
         WHERE s.company_id = ${companyPlaceholder}${dateSql}
         ORDER BY s.created_at DESC
         LIMIT ${limitPlaceholder}`
      : `${baseSelect}
         WHERE s.user_id = $1 AND s.company_id = ${companyPlaceholder}${dateSql}
         ORDER BY s.created_at DESC
         LIMIT ${limitPlaceholder}`;

    const result = await query(sql, params);

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

router.delete('/:id', async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const { id } = req.params;
  const companyId = parseCompanyId(req.query?.companyId) ?? 'momentum';

  try {
    const isAdmin = req.user?.isAdmin === true;
    const sql = isAdmin
      ? `DELETE FROM submissions WHERE id = $1 AND company_id = $2 RETURNING id`
      : `DELETE FROM submissions WHERE id = $1 AND company_id = $2 AND user_id = $3 RETURNING id`;

    const result = await query(sql, isAdmin ? [id, companyId] : [id, companyId, userId]);
    if (!result.rows?.length) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to delete submission', { error: err.message, id, userId });
    next(err);
  }
});

export default router;
