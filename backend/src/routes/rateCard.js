/**
 * Rate card administration: upload a new master template, review what landed, and switch
 * between versions.
 *
 * Admin only, and deliberately so. Uploading replaces every price the agent portal quotes
 * and every offer code it submits to Momentum, so this is the most consequential screen
 * in the product.
 *
 *   POST /api/rate-card/preview    parse an upload, write nothing
 *   POST /api/rate-card            import it
 *   GET  /api/rate-card/versions   history
 *   POST /api/rate-card/versions/:id/activate   switch, including rollback
 */
import express from 'express';
import multer from 'multer';

import { query } from '../db/connection.js';
import logger from '../config/logger.js';
import { importRateCard, RateCardImportError } from '../services/rateCardImport.js';

const router = express.Router();

const XLSX_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream', // some browsers send this for .xlsx
];

/** In memory: the workbook is under a megabyte and never needs to touch disk. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const looksRight =
      XLSX_MIME.includes(file.mimetype) || /\.xlsx$/i.test(file.originalname || '');
    cb(null, looksRight);
  },
});

function requireAdmin(req, res, next) {
  if (req.user?.isAdmin !== true) {
    return res.status(403).json({ success: false, error: 'Administrator access required' });
  }
  next();
}

router.use(requireAdmin);

/** Turn multer's own failures into something the screen can show. */
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'That file is larger than 25MB.'
          : 'Could not read the upload.';
      return res.status(400).json({ success: false, error: msg });
    }
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: 'Attach the master template as an .xlsx file.' });
    }
    next();
  });
}

function importError(res, err, context) {
  if (err instanceof RateCardImportError) {
    return res.status(422).json({ success: false, error: err.message, details: err.details });
  }
  logger.error('Rate card import failed', { error: err.message, ...context });
  return res.status(500).json({ success: false, error: 'The import failed. Nothing was changed.' });
}

/* ---------------------------------------------------------------- preview */

router.post('/preview', handleUpload, async (req, res) => {
  try {
    const result = await importRateCard({
      buffer: req.file.buffer,
      label: req.file.originalname,
      dryRun: true,
    });
    res.json({ success: true, data: { ...result, sourceFile: req.file.originalname } });
  } catch (err) {
    return importError(res, err, { userId: req.user?.id });
  }
});

/* ----------------------------------------------------------------- import */

router.post('/', handleUpload, async (req, res) => {
  const label = String(req.body?.label || '').trim() || req.file.originalname.replace(/\.xlsx$/i, '');
  // Default to staging rather than going live, so an admin has to choose to switch over.
  const activate = String(req.body?.activate ?? 'false') === 'true';

  try {
    const result = await importRateCard({
      buffer: req.file.buffer,
      label,
      activate,
      sourceFile: req.file.originalname,
      uploadedBy: req.user?.email ?? req.user?.id ?? null,
    });

    logger.info('Rate card imported', {
      versionId: result.versionId,
      label,
      activate,
      userId: req.user?.id,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    return importError(res, err, { userId: req.user?.id, label });
  }
});

/* --------------------------------------------------------------- versions */

router.get('/versions', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT v.id, v.label, v.source_file, v.is_active, v.imported_at, v.stats,
              (SELECT count(*) FROM offer_rates o WHERE o.version_id = v.id) AS offer_count
       FROM rate_card_versions v
       ORDER BY v.imported_at DESC
       LIMIT 50`
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        label: r.label,
        sourceFile: r.source_file,
        isActive: r.is_active,
        importedAt: r.imported_at,
        offerCount: Number(r.offer_count),
        stats: r.stats,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------------------------------------- activate */

router.post('/versions/:id/activate', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id, label FROM rate_card_versions WHERE id = $1', [
      req.params.id,
    ]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Version not found' });

    // One active version at a time, enforced by a partial unique index as well.
    await query('UPDATE rate_card_versions SET is_active = false WHERE is_active');
    await query('UPDATE rate_card_versions SET is_active = true WHERE id = $1', [req.params.id]);

    logger.info('Rate card version activated', {
      versionId: req.params.id,
      label: rows[0].label,
      userId: req.user?.id,
    });
    res.json({ success: true, data: { id: rows[0].id, label: rows[0].label, isActive: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
