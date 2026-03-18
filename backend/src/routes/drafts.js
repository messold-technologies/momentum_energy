/**
 * Drafts API: save and resume transaction form drafts
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
      `SELECT id, payload, updated_at
       FROM drafts
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 50`,
      [userId]
    );

    const drafts = result.rows.map((row) => {
      const preview = row.payload?.transaction?.transactionReference?.trim() || 'Untitled';
      return {
        id: row.id,
        updatedAt: row.updated_at,
        preview,
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
  try {
    const result = await query(
      `SELECT id, payload, updated_at FROM drafts WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
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

  try {
    const result = await query(
      `UPDATE drafts SET payload = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, payload, updated_at`,
      [JSON.stringify(payload), id, userId]
    );
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
  try {
    const result = await query(
      `DELETE FROM drafts WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );
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
