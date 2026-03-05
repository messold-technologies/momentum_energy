import axios from 'axios';
import config from '../config/index.js';
import logger from '../config/logger.js';

// In-memory token cache
let cachedToken = null;
let tokenExpiresAt = null;

async function getAccessToken() {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 60000) {
    logger.debug('Using cached access token');
    return cachedToken;
  }

  logger.info('Fetching new access token from Momentum');

  try {
    const response = await axios.post(
      config.momentum.authUrl,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.momentum.clientId,
        client_secret: config.momentum.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      }
    );

    const { access_token, expires_in } = response.data;
    cachedToken = access_token;
    tokenExpiresAt = Date.now() + expires_in * 1000;

    logger.info('Access token obtained', { expiresIn: expires_in });
    return cachedToken;
  } catch (error) {
    const msg = error.response?.data || error.message;
    logger.error('Failed to obtain access token', { error: msg });
    throw new Error('Authentication with Momentum API failed');
  }
}

function clearTokenCache() {
  cachedToken = null;
  tokenExpiresAt = null;
}

export { getAccessToken, clearTokenCache };
