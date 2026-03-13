const request = require('supertest');
const nock = require('nock');
const jwt = require('jsonwebtoken');

// Mock DB connection before requiring app (used by requireAuth, auth routes, and transactions)
jest.mock('../src/db/connection', () => ({
  query: jest.fn(),
  pool: {},
}));

const { query: mockQuery } = require('../src/db/connection');
const app = require('../src/server').default;
const { clearTokenCache } = require('../src/services/tokenService');

const BASE = 'https://ch2-preprod.api.momentumenergy.com.au';
const API_PATH = '/external-channels-exp-preprod';

const mockToken = () =>
  nock(BASE).post('/oauth/token').reply(200, { access_token: 'mock-token', expires_in: 3600 });

function makeAuthToken(userId = 'user-123') {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long',
    { expiresIn: '1h' }
  );
}

function authHeader() {
  return { Authorization: `Bearer ${makeAuthToken()}` };
}

// Valid transaction matching backend validator structure
function validTransaction() {
  const today = new Date().toISOString().split('T')[0];
  return {
    transaction: {
      transactionReference: `REF-${Date.now()}`,
      transactionChannel: 'TEST CHANNEL',
      transactionDate: `${today}T00:00:00.000Z`,
      transactionSource: 'EXTERNAL',
    },
    customer: {
      customerType: 'RESIDENT',
      customerSubType: 'RESIDENT',
      communicationPreference: 'EMAIL',
      promotionAllowed: true,
      residentIdentity: {
        drivingLicense: {
          documentId: 'DL123456',
          documentExpiryDate: '2028-01-01',
          issuingState: 'VIC',
        },
      },
      contacts: {
        primaryContact: {
          salutation: 'Mr.',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1985-06-15',
          email: 'john.doe@example.com',
          countryOfBirth: 'AUS',
          addresses: [
            {
              streetNumber: '10',
              streetName: 'Test Street',
              suburb: 'Melbourne',
              state: 'VIC',
              postCode: '3000',
            },
          ],
          contactPhones: [{ contactPhoneType: 'MOBILE', phone: '0412345678' }],
        },
      },
    },
    service: {
      serviceType: 'POWER',
      serviceSubType: 'TRANSFER',
      serviceConnectionId: '1234567890',
      servicedAddress: {
        streetNumber: '10',
        streetName: 'Test Street',
        streetTypeCode: 'ST',
        suburb: 'Melbourne',
        state: 'VIC',
        postCode: '3000',
      },
      serviceBilling: {
        offerQuoteDate: `${today}T00:00:00.000Z`,
        serviceOfferCode: 'OFFER123456789012',
        servicePlanCode: 'Bill Boss Electricity',
        contractTermCode: 'OPEN',
        paymentMethod: 'Direct Debit Via Bank Account',
        billCycleCode: 'Monthly',
        billDeliveryMethod: 'EMAIL',
      },
    },
  };
}

beforeEach(() => {
  clearTokenCache();
  nock.cleanAll();
  jest.clearAllMocks();
  process.env.MOMENTUM_AUTH_URL = `${BASE}/oauth/token`;
  process.env.MOMENTUM_BASE_URL = `${BASE}${API_PATH}`;
  process.env.MOMENTUM_CLIENT_ID = 'test-id';
  process.env.MOMENTUM_CLIENT_SECRET = 'test-secret';
  process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
  process.env.NODE_ENV = 'test';
  mockQuery.mockResolvedValue({ rows: [{ id: 'user-123', email: 'test@test.com', name: 'Test User' }] });
});

afterAll(() => nock.cleanAll());

describe('POST /api/transactions', () => {
  test('returns 401 without auth', async () => {
    const response = await request(app)
      .post('/api/transactions')
      .send(validTransaction());
    expect(response.status).toBe(401);
  });

  test('submits a valid transaction successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-123', email: 'test@test.com', name: 'Test User' }] })
      .mockResolvedValueOnce({ rows: [] });

    mockToken();
    nock(BASE)
      .post(`${API_PATH}/echannels/v1/sales-transactions`)
      .reply(200, {
        salesTransactionId: 'SALES-001',
        transactionStatus: 'PENDING',
        correlationId: 'corr-123',
      });

    const response = await request(app)
      .post('/api/transactions')
      .set(authHeader())
      .send(validTransaction())
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.salesTransactionId).toBe('SALES-001');
    expect(response.body.data.transactionStatus).toBe('PENDING');
  });

  test('returns 400 for missing required fields', async () => {
    const response = await request(app)
      .post('/api/transactions')
      .set(authHeader())
      .send({ transaction: { transactionSource: 'EXTERNAL' } })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.details).toBeDefined();
    expect(Array.isArray(response.body.details)).toBe(true);
  });

  test('returns 400 for customer under 18', async () => {
    const payload = validTransaction();
    payload.customer.contacts.primaryContact.dateOfBirth = '2010-01-01';

    const response = await request(app)
      .post('/api/transactions')
      .set(authHeader())
      .send(payload)
      .expect(400);

    expect(response.body.details.some((e) => (e.message || '').includes('18'))).toBe(true);
  });

  test('returns 400 for expired driving license', async () => {
    const payload = validTransaction();
    payload.customer.residentIdentity.drivingLicense.documentExpiryDate = '2020-01-01';

    const response = await request(app)
      .post('/api/transactions')
      .set(authHeader())
      .send(payload)
      .expect(400);

    expect(response.body.details.some((e) => (e.message || '').toLowerCase().includes('expired'))).toBe(true);
  });

  test('returns 400 for wrong bill cycle for GAS', async () => {
    const payload = validTransaction();
    payload.service.serviceType = 'GAS';
    payload.service.serviceConnectionId = '12345678901';
    payload.service.serviceBilling.billCycleCode = 'Monthly';

    const response = await request(app)
      .post('/api/transactions')
      .set(authHeader())
      .send(payload)
      .expect(400);

    expect(response.body.details.some((e) => (e.message || '').includes('Bi-Monthly'))).toBe(true);
  });

  test('handles Momentum API errors gracefully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-123', email: 'test@test.com', name: 'Test User' }] })
      .mockResolvedValueOnce({ rows: [] });

    mockToken();
    nock(BASE)
      .post(`${API_PATH}/echannels/v1/sales-transactions`)
      .reply(400, {
        code: 'OFFER:NOT_FOUND',
        message: 'Offer not found',
      });

    const response = await request(app)
      .post('/api/transactions')
      .set(authHeader())
      .send(validTransaction());

    expect(response.status).toBe(400);
    expect(response.body.momentumError?.code).toBe('OFFER:NOT_FOUND');
  });
});

describe('GET /api/transactions/:salesTransactionId/status', () => {
  test('returns 401 without auth', async () => {
    const response = await request(app).get('/api/transactions/SALES-001/status');
    expect(response.status).toBe(401);
  });

  test('returns transaction status with auth', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'user-123', email: 'test@test.com', name: 'Test User' }] });

    mockToken();
    nock(BASE)
      .get(`${API_PATH}/echannels/v1/sales-transactions/SALES-001`)
      .reply(200, {
        salesTransactionId: 'SALES-001',
        transactionStatus: 'PENDING',
      });

    const response = await request(app)
      .get('/api/transactions/SALES-001/status')
      .set(authHeader())
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.salesTransactionId).toBe('SALES-001');
    expect(response.body.data.transactionStatus).toBe('PENDING');
  });
});

describe('GET /health', () => {
  test('returns 200 OK', async () => {
    const response = await request(app).get('/health').expect(200);
    expect(response.body.status).toBe('ok');
  });
});
