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

  firstEnergy: {
    baseUrl: process.env.FIRST_ENERGY_BASE_URL || 'https://firstenergy-stage.uconx.com.au',
  },

  portal: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(','),

    /**
     * Where the customer-facing site actually lives. Consent links are built from this
     * and sent to customers, so it has to be the public address.
     *
     * This used to be allowedOrigins[0], which meant the order of the CORS list decided
     * what customers received: a production .env copied from .env.example lists localhost
     * first, so every consent link pointed at localhost:5173.
     *
     * Set PUBLIC_APP_URL. Failing that, prefer the first origin that is not localhost, so
     * an existing deployment is right without a config change, and fall back to the first
     * origin for local development, where localhost is the correct answer.
     */
    get publicUrl() {
      const explicit = (process.env.PUBLIC_APP_URL || '').trim();
      if (explicit) return explicit.replace(/\/$/, '');

      const origins = this.allowedOrigins.map((o) => o.trim()).filter(Boolean);
      const isLocal = (o) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(o);
      const chosen = origins.find((o) => !isLocal(o)) || origins[0] || '';
      return chosen.replace(/\/$/, '');
    },
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  agentPortal: {
    /**
     * Shared password agents type to enter the portal. There is no per-agent account, so
     * anyone holding this password can read the plan catalogue and create sales that
     * contain customer PII. The default is the company name and therefore guessable:
     * set AGENT_PORTAL_PASSWORD to something non-obvious in any real environment.
     */
    password: process.env.AGENT_PORTAL_PASSWORD || 'utilityhub',
    sessionExpiresIn: process.env.AGENT_PORTAL_SESSION_EXPIRES_IN || '12h',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  auth: {
    allowedRegistrationEmails: [
      'ishu.gupta@utilityhub.com.au',
      'mudit.gupta@utilityhub.com.au',
      'aseem.gupta@utilityhub.com.au',
      'qa@utilityhub.com.au',
      'loans@ezycapital.com.au',
      'bipasha.roy@messold.com'
    ].map((e) => e.toLowerCase()),
    adminEmails: [
      'mudit.gupta@utilityhub.com.au',
      'aseem.gupta@utilityhub.com.au',
      'bipasha.roy@messold.com',
      'ishu.gupta@utilityhub.com.au',
      'loans@ezycapital.com.au',
    ].map((e) => e.toLowerCase()),
    qaAllowedIps: (process.env.QA_ALLOWED_IPS || '').split(',').map((s) => s.trim()).filter(Boolean),
  },
};
