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

  /**
   * Twilio, for texting the consent link to a customer. Absent credentials are not an
   * error: isSmsConfigured() goes false, the agent portal hides the button and the
   * endpoint answers 503. Local development and anyone who does not want SMS keep
   * working with the copyable link.
   */
  twilio: {
    /** Overridable so tests can point at a stand-in rather than the real Twilio. */
    baseUrl: process.env.TWILIO_API_BASE || 'https://api.twilio.com/2010-04-01',
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    /** A plain sender number. Ignored when a messaging service is set. */
    from: process.env.TWILIO_FROM_NUMBER || '',
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || '',
    /** How many texts one sale may send, so a stuck agent cannot run up a bill. */
    maxPerSale: Number(process.env.CONSENT_SMS_MAX_PER_SALE || 5),
  },

  agentPortal: {
    /**
     * The channels allowed into the agent portal. Exactly these three -- a channel that
     * is not on this list cannot sign in, whatever it sends.
     *
     * Passwords are held as bcrypt hashes, not plaintext, so this file can live in the
     * repository without carrying the credentials. Set the env var to rotate a channel's
     * password without a deploy; the hash is the fallback.
     *
     * Still a shared password per channel rather than per-agent accounts: anyone holding
     * a channel's password can read the plan catalogue and create sales containing
     * customer PII, and sales are attributed to the channel, not to a person.
     */
    channels: [
      {
        id: 'utility-hub-india',
        name: 'Utility Hub India',
        envVar: 'AGENT_PORTAL_PASSWORD_UTILITY_HUB_INDIA',
        passwordHash: '$2b$12$DCROX/Lb4y0jTWSbFKOI0ejPlxNBUU9JgDEapimhB4bnTlVy7bcbW',
      },
      {
        id: 'ersolution',
        name: 'ERSOLUTION',
        envVar: 'AGENT_PORTAL_PASSWORD_ERSOLUTION',
        passwordHash: '$2b$12$Rhydac4WRlxo5e7Xc3oQ4uOYzzQoxSHRTP8bxC/cYQg7/.4c8D.QC',
      },
      {
        id: 'salesclub',
        name: 'SALESCLUB',
        envVar: 'AGENT_PORTAL_PASSWORD_SALESCLUB',
        passwordHash: '$2b$12$x65G38qdjxe6xaiIy9v8a.8HoN/OcpihC9A2oRq2//DZWwbPZp0aG',
      },
    ],
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
