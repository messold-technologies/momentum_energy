import pg from 'pg';
import config from '../config/index.js';
import logger from '../config/logger.js';

const { Pool } = pg;

const pool = config.database?.url
  ? new Pool({ connectionString: config.database.url, ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: true } : false })
  : null;

export async function query(text, params) {
  if (!pool) {
    throw new Error('Database not configured: DATABASE_URL is required');
  }
  return pool.query(text, params);
}

export async function getClient() {
  if (!pool) {
    throw new Error('Database not configured: DATABASE_URL is required');
  }
  return pool.connect();
}

export async function healthCheck() {
  if (!pool) return { connected: false, error: 'DATABASE_URL not set' };
  try {
    const res = await pool.query('SELECT 1');
    return { connected: !!res.rows?.[0], error: null };
  } catch (err) {
    logger.error('DB health check failed', { error: err.message });
    return { connected: false, error: err.message };
  }
}

export { pool };
