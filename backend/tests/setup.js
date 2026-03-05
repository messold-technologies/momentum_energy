// Load test environment variables
process.env.NODE_ENV = 'test';
process.env.MOMENTUM_ENV = 'sandbox';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_EXPIRES_IN = '1h';
process.env.MOMENTUM_CLIENT_ID = 'test-client-id';
process.env.MOMENTUM_CLIENT_SECRET = 'test-client-secret';
process.env.MOMENTUM_CHANNEL_NAME = 'TEST_CHANNEL';
process.env.MOMENTUM_SANDBOX_BASE_URL = 'https://ch2-preprod.api.momentumenergy.com.au/external-channels-exp-preprod';
process.env.MOMENTUM_SANDBOX_AUTH_URL = 'https://ch2-preprod.api.momentumenergy.com.au/oauth/token';

// Use in-memory SQLite or mock DB for unit tests
// For integration tests, use a real Neon test database
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
