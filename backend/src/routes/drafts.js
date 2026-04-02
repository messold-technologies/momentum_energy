/**
 * Drafts API: save and resume transaction form drafts
 *
 * Optional query on GET /: from, to as YYYY-MM-DD (UTC) on updated_at; limit max 500
 * Admins: list/get/delete any user's draft
 */
import express from 'express';
const router = express.Router();
import { query } from '../db/connection.js';
import logger from '../config/logger.js';

function startOfUtcDayIso(dateStr) {
  return `${dateStr}T00:00:00.000Z`;
}

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

router.get('/', async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const isAdmin = req.user?.isAdmin === true;

    const rawLimit = req.query?.limit;
    const parsed = typeof rawLimit === 'string' ? Number.parseInt(rawLimit, 10) : Number.NaN;
    const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 50;

    const fromDate = parseDateOnlyQuery(req.query?.from);
    const toDate = parseDateOnlyQuery(req.query?.to);

    const params = [];
    let idx = 1;

    if (!isAdmin) {
      params.push(userId);
      idx = 2;
    }

    const dateParts = [];
    if (fromDate) {
      dateParts.push(`d.updated_at >= $${idx}`);
      params.push(startOfUtcDayIso(fromDate));
      idx += 1;
    }
    if (toDate) {
      dateParts.push(`d.updated_at < $${idx}`);
      params.push(endOfUtcDayExclusive(toDate));
      idx += 1;
    }
    const dateSql = dateParts.length ? ` AND ${dateParts.join(' AND ')}` : '';

    params.push(limit);
    const limitPlaceholder = `$${idx}`;

    const selectCols = `d.id, d.payload, d.updated_at, u.name AS user_name`;

    const fromJoin = `FROM drafts d JOIN users u ON d.user_id = u.id`;

    const sql = isAdmin
      ? `SELECT ${selectCols} ${fromJoin} WHERE 1=1${dateSql} ORDER BY d.updated_at DESC LIMIT ${limitPlaceholder}`
      : `SELECT ${selectCols} ${fromJoin} WHERE d.user_id = $1${dateSql} ORDER BY d.updated_at DESC LIMIT ${limitPlaceholder}`;

    const result = await query(sql, params);

    const drafts = result.rows.map((row) => {
      const preview = row.payload?.transaction?.transactionReference?.trim() || 'Untitled';
      return {
        id: row.id,
        updatedAt: row.updated_at,
        preview,
        userName: row.user_name ?? '',
      };
    });

    res.json({ success: true, drafts });
  } catch (err) {
    logger.error('Failed to fetch drafts', { error: err.message, userId });
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const { id } = req.params;
  const isAdmin = req.user?.isAdmin === true;

  try {
    const sql = isAdmin
      ? `SELECT d.id, d.payload, d.updated_at FROM drafts d WHERE d.id = $1`
      : `SELECT d.id, d.payload, d.updated_at FROM drafts d WHERE d.id = $1 AND d.user_id = $2`;

    const result = await query(sql, isAdmin ? [id] : [id, userId]);
    if (!result.rows?.length) {
      return res.status(404).json({ success: false, error: 'Draft not found' });
    }
    res.json({
      success: true,
      draft: {
        id: result.rows[0].id,
        payload: result.rows[0].payload,
        updatedAt: result.rows[0].updated_at,
      },
    });
  } catch (err) {
    logger.error('Failed to fetch draft', { error: err.message, id });
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const payload = req.body?.payload;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ success: false, error: 'payload is required' });
  }

  try {
    const result = await query(
      `INSERT INTO drafts (user_id, payload) VALUES ($1, $2)
       RETURNING id, payload, updated_at`,
      [userId, JSON.stringify(payload)]
    );
    const row = result.rows[0];
    res.status(201).json({
      success: true,
      draft: {
        id: row.id,
        payload: row.payload,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    logger.error('Failed to create draft', { error: err.message, userId });
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const { id } = req.params;
  const payload = req.body?.payload;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ success: false, error: 'payload is required' });
  }

  const isAdmin = req.user?.isAdmin === true;

  try {
    const sql = isAdmin
      ? `UPDATE drafts SET payload = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, payload, updated_at`
      : `UPDATE drafts SET payload = $1, updated_at = NOW()
         WHERE id = $2 AND user_id = $3
         RETURNING id, payload, updated_at`;

    const result = await query(sql, isAdmin ? [JSON.stringify(payload), id] : [JSON.stringify(payload), id, userId]);
    if (!result.rows?.length) {
      return res.status(404).json({ success: false, error: 'Draft not found' });
    }
    const row = result.rows[0];
    res.json({
      success: true,
      draft: {
        id: row.id,
        payload: row.payload,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    logger.error('Failed to update draft', { error: err.message, id });
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const { id } = req.params;
  const isAdmin = req.user?.isAdmin === true;

  try {
    const sql = isAdmin
      ? `DELETE FROM drafts WHERE id = $1 RETURNING id`
      : `DELETE FROM drafts WHERE id = $1 AND user_id = $2 RETURNING id`;

    const result = await query(sql, isAdmin ? [id] : [id, userId]);
    if (!result.rows?.length) {
      return res.status(404).json({ success: false, error: 'Draft not found' });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to delete draft', { error: err.message, id });
    next(err);
  }
});

export default router;
