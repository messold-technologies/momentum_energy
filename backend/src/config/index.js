import dotenv from 'dotenv';
dotenv.config();

export default {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  momentum: {
    baseUrl: process.env.MOMENTUM_BASE_URL || 'https://ch2-preprod.api.momentumenergy.com.au/external-channels-exp-preprod',
    authUrl: process.env.MOMENTUM_AUTH_URL || 'https://ch2-preprod.api.momentumenergy.com.au/oauth/token',
    clientId: process.env.MOMENTUM_CLIENT_ID,
    clientSecret: process.env.MOMENTUM_CLIENT_SECRET,
    /** System name for x-source-system header (e.g. PowerMarket, PowerMarket-Web, PowerMarket-Batch) */
    sourceSystem: process.env.MOMENTUM_SOURCE_SYSTEM || 'PowerMarket',
  },

  portal: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(','),
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
};
