import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection.js';
import config from '../config/index.js';
import logger from '../config/logger.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user (email, name, password)
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email, name, and password are required',
      });
    }
    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedName = String(name).trim();
    if (!trimmedEmail || !trimmedName || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input. Password must be at least 6 characters.',
      });
    }

    const allowedEmails = config.auth?.allowedRegistrationEmails ?? [];
    if (allowedEmails.length > 0 && !allowedEmails.includes(trimmedEmail)) {
      return res.status(403).json({
        success: false,
        error: 'Registration is restricted. This email is not authorized to create an account.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    const adminEmails = config.auth?.adminEmails ?? [];
    const isAdmin = adminEmails.includes(trimmedEmail);
    await query(
      `INSERT INTO users (id, email, name, password_hash, is_admin) VALUES ($1, $2, $3, $4, $5)`,
      [id, trimmedEmail, trimmedName, passwordHash, isAdmin]
    );

    logger.info('User registered', { email: trimmedEmail, userId: id });
    res.status(201).json({
      success: true,
      user: { id, email: trimmedEmail, name: trimmedName, isAdmin },
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Login with email and password, returns JWT
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    const trimmedEmail = String(email).trim().toLowerCase();

    const result = await query(
      `SELECT id, email, name, password_hash, is_admin FROM users WHERE email = $1`,
      [trimmedEmail]
    );
    if (!result.rows?.length) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === true },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    logger.info('User logged in', { email: user.email, userId: user.id });
    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === true },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Get current user (requires valid JWT in Authorization header)
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

export default router;
