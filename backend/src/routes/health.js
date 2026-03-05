import express from 'express';
const router = express.Router();
import { getAccessToken } from '../services/tokenService.js';
import config from '../config/index.js';

/**
 * GET /health
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    message: 'Momentum Energy External Channels Backend is running',
  });
});

/**
 * GET /health/detailed
 * Check Momentum API connectivity
 */
router.get('/detailed', async (req, res) => {
  const checks = { momentumAuth: 'unknown' };
  let overallStatus = 'ok';

  try {
    await getAccessToken();
    checks.momentumAuth = 'ok';
  } catch (err) {
    checks.momentumAuth = `error: ${err.message}`;
    overallStatus = 'degraded';
  }

  res.status(overallStatus === 'ok' ? 200 : 503).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
    message: 'Momentum Energy External Channels Backend is running',
  });
});

export default router;
