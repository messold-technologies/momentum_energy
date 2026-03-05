const nock = require('nock');
const { submitSalesTransaction, getSalesTransactionStatus } = require('../src/services/momentumService');
const { clearTokenCache } = require('../src/services/tokenService');

const BASE = 'https://ch2-preprod.api.momentumenergy.com.au';
const API_PATH = '/external-channels-exp-preprod';

const mockToken = () =>
  nock(BASE).post('/oauth/token').reply(200, { access_token: 'mock-token', expires_in: 3600 });

const samplePayload = {
  transaction: {
    transactionReferenceId: 'TEST-REF-001',
    channelName: 'TEST_CHANNEL',
    transactionDate: new Date().toISOString().split('T')[0],
    source: 'EXTERNAL',
  },
  customer: { customerType: 'RESIDENT', promotionConsent: 'true' },
  contacts: {
    primaryContact: {
      firstName: 'John', lastName: 'Doe',
      dateOfBirth: '1990-01-15', email: 'john@example.com',
    },
  },
  service: {
    serviceType: 'POWER', serviceSubType: 'TRANSFER',
    serviceConnectionId: '1234567890',
    offer: { offerCode: 'OFFER123', quoteDate: new Date().toISOString().split('T')[0] },
  },
};

beforeEach(() => {
  clearTokenCache();
  nock.cleanAll();
  process.env.MOMENTUM_AUTH_URL = `${BASE}/oauth/token`;
  process.env.MOMENTUM_BASE_URL = `${BASE}${API_PATH}`;
  process.env.MOMENTUM_CLIENT_ID = 'test-id';
  process.env.MOMENTUM_CLIENT_SECRET = 'test-secret';
});

afterAll(() => nock.cleanAll());

describe('MomentumService - submitSalesTransaction', () => {
  test('submits transaction and returns salesTransactionId', async () => {
    mockToken();
    nock(BASE)
      .post(`${API_PATH}/echannels/v1/sales-transactions`)
      .reply(200, {
        salesTransactionId: 'SALES-TXN-001',
        transactionStatus: 'PENDING',
        correlationId: 'corr-001',
      });

    const result = await submitSalesTransaction(samplePayload);
    expect(result.salesTransactionId).toBe('SALES-TXN-001');
    expect(result.transactionStatus).toBe('PENDING');
  });

  test('throws on API error with error details', async () => {
    mockToken();
    nock(BASE)
      .post(`${API_PATH}/echannels/v1/sales-transactions`)
      .reply(400, {
        code: 'APIKIT:BAD_REQUEST',
        message: 'Validation failed',
        details: [{ field: 'service.serviceType', message: 'Required' }],
      });

    await expect(submitSalesTransaction(samplePayload)).rejects.toMatchObject({
      status: 400,
      errorData: { code: 'APIKIT:BAD_REQUEST' },
    });
  });

  test('retries with fresh token on 401', async () => {
    mockToken(); // Initial token call
    nock(BASE)
      .post(`${API_PATH}/echannels/v1/sales-transactions`)
      .reply(401, { message: 'Unauthorized' }); // First call fails

    mockToken(); // Retry token call
    nock(BASE)
      .post(`${API_PATH}/echannels/v1/sales-transactions`)
      .reply(200, { salesTransactionId: 'RETRY-TXN-001', transactionStatus: 'PENDING' }); // Retry succeeds

    const result = await submitSalesTransaction(samplePayload);
    expect(result.salesTransactionId).toBe('RETRY-TXN-001');
  });
});

describe('MomentumService - getSalesTransactionStatus', () => {
  test('fetches transaction status', async () => {
    mockToken();
    nock(BASE)
      .get(`${API_PATH}/echannels/v1/sales-transactions/SALES-TXN-001`)
      .reply(200, {
        salesTransactionId: 'SALES-TXN-001',
        transactionStatus: 'ACCEPTED',
      });

    const result = await getSalesTransactionStatus('SALES-TXN-001');
    expect(result.transactionStatus).toBe('ACCEPTED');
  });

  test('throws 404 for unknown transaction', async () => {
    mockToken();
    nock(BASE)
      .get(`${API_PATH}/echannels/v1/sales-transactions/UNKNOWN-ID`)
      .reply(404, { message: 'Not found' });

    await expect(getSalesTransactionStatus('UNKNOWN-ID')).rejects.toMatchObject({
      status: 404,
    });
  });
});
