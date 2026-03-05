const nock = require('nock');
const { getAccessToken, clearTokenCache } = require('../src/services/tokenService');

const AUTH_URL = 'https://ch2-preprod.api.momentumenergy.com.au';
const AUTH_PATH = '/oauth/token';

beforeEach(() => {
  clearTokenCache();
  nock.cleanAll();
  process.env.MOMENTUM_CLIENT_ID = 'test-client-id';
  process.env.MOMENTUM_CLIENT_SECRET = 'test-client-secret';
  process.env.MOMENTUM_AUTH_URL = `${AUTH_URL}${AUTH_PATH}`;
});

afterAll(() => nock.cleanAll());

describe('TokenService', () => {
  test('fetches and returns access token', async () => {
    nock(AUTH_URL)
      .post(AUTH_PATH)
      .reply(200, { access_token: 'test-token-123', expires_in: 3600 });

    const token = await getAccessToken();
    expect(token).toBe('test-token-123');
  });

  test('caches token on subsequent calls', async () => {
    nock(AUTH_URL)
      .post(AUTH_PATH)
      .once()
      .reply(200, { access_token: 'cached-token', expires_in: 3600 });

    const token1 = await getAccessToken();
    const token2 = await getAccessToken(); // Should use cache

    expect(token1).toBe('cached-token');
    expect(token2).toBe('cached-token');
    expect(nock.isDone()).toBe(true); // Only one HTTP call made
  });

  test('throws error when auth fails', async () => {
    nock(AUTH_URL)
      .post(AUTH_PATH)
      .reply(401, { error: 'invalid_client' });

    await expect(getAccessToken()).rejects.toThrow('Authentication with Momentum API failed');
  });

  test('clears cache on clearTokenCache()', async () => {
    nock(AUTH_URL)
      .post(AUTH_PATH)
      .twice()
      .reply(200, { access_token: 'new-token', expires_in: 3600 });

    await getAccessToken();
    clearTokenCache();
    await getAccessToken(); // Should make a new call

    expect(nock.isDone()).toBe(true);
  });
});
