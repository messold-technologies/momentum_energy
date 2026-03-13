import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import logger from '../config/logger.js';


export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const userId = decoded.userId || decoded.id || decoded.sub;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    req.user = {
      id: userId,
      email: decoded.email,
      name: decoded.name,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    logger.error('requireAuth error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Authentication failed' });
  }
}
