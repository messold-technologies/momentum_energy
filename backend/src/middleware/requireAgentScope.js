import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import logger from '../config/logger.js';

/**
 * Guards the agent portal.
 *
 * Agent tokens carry scope 'agent' and an agentUserId from `agent_users`, a table
 * separate from staff `users`. requireAuth rejects them because they carry no `userId`,
 * so an agent token cannot reach the submit, drafts, submissions or QA endpoints -- it
 * only works on what is mounted under /api/agent-portal.
 *
 * The reverse also holds: a normal staff token has no 'agent' scope and is rejected here,
 * so the two surfaces cannot be confused for one another.
 */
export function requireAgentScope(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Agent access required' });
  }

  try {
    const decoded = jwt.verify(authHeader.slice(7), config.jwt.secret);
    if (decoded.scope !== 'agent' || !decoded.agentUserId) {
      return res.status(403).json({ success: false, error: 'Not an agent session' });
    }

    req.agent = {
      userId: decoded.agentUserId,
      name: decoded.agentName ?? null,
      email: decoded.agentEmail ?? null,
      // Which channel signed in. Comes from the signed token, never from the request
      // body, so a sale cannot be attributed to a channel the session did not use.
      channelId: decoded.channelId ?? null,
      channelName: decoded.channelName ?? null,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Session expired, please sign in again' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }
    logger.error('requireAgentScope error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Authentication failed' });
  }
}

export default requireAgentScope;
