const request = require('supertest');
const nock = require('nock');

// Mock DB before requiring app
jest.mock('../src/db', () => ({
  query: jest.fn(),
}));

const db = require('../src/db');
const app = require('../src/server');
const { clearTokenCache } = require('../src/services/tokenService');

const BASE = 'https://ch2-preprod.api.momentumenergy.com.au';
const API_PATH = '/external-channels-exp-preprod';

const mockToken = () =>
  nock(BASE).post('/oauth/token').reply(200, { access_token: 'mock-token', expires_in: 3600 });

// Valid transaction body matching all validation rules
const validTransaction = () => {
  const today = new Date().toISOString().split('T')[0];
  return {
    transaction: {
      transactionReferenceId: `REF-${Date.now()}`,
      channelName: 'TEST_CHANNEL',
      transactionDate: today,
      source: 'EXTERNAL',
    },
    customer: {
      customerType: 'RESIDENT',
      promotionConsent: 'true',
      drivingLicense: {
        licenseNumber: 'DL123456',
        expiryDate: '2028-01-01',
        stateOfIssue: 'VIC',
      },
    },
    contacts: {
      primaryContact: {
        salutation: 'Mr',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1985-06-15',
        email: 'john.doe@example.com',
        phone: [{ type: 'MOBILE', number: '0412345678' }],
        address: {
          streetNumber: '10',
          streetName: 'Test Street',
          suburb: 'Melbourne',
          state: 'VIC',
          postcode: '3000',
        },
      },
    },
    service: {
      serviceType: 'POWER',
      serviceSubType: 'TRANSFER',
      serviceConnectionId: '1234567890123',
      servicedAddress: {
        streetNumber: '10',
        streetName: 'Test Street',
        suburb: 'Melbourne',
        state: 'VIC',
        postcode: '3000',
      },
      offer: {
        offerCode: 'POWER_OFFER_2024',
        planName: 'Basic Power',
        quoteDate: today,
      },
      billingDetails: {
        billCycleCode: 'Monthly',
        communicationPreference: 'EMAIL',
        paymentMethod: { type: 'DirectDebit' },
      },
    },
  };
};

beforeEach(() => {
  clearTokenCache();
  nock.cleanAll();
  jest.clearAllMocks();
  process.env.MOMENTUM_AUTH_URL = `${BASE}/oauth/token`;
  process.env.MOMENTUM_BASE_URL = `${BASE}${API_PATH}`;
  process.env.MOMENTUM_CLIENT_ID = 'test-id';
  process.env.MOMENTUM_CLIENT_SECRET = 'test-secret';
  process.env.PORTAL_API_KEY = '';
  process.env.NODE_ENV = 'test';
});

afterAll(() => nock.cleanAll());

describe('POST /api/transactions', () => {
  test('submits a valid transaction successfully', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'db-uuid-123' }] }) // INSERT
      .mockResolvedValueOnce({ rows: [] }) // UPDATE
      .mockResolvedValueOnce({ rows: [] }); // audit log

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
      .send(validTransaction())
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.salesTransactionId).toBe('SALES-001');
    expect(response.body.data.transactionStatus).toBe('PENDING');
  });

  test('returns 400 for missing required fields', async () => {
    const response = await request(app)
      .post('/api/transactions')
      .send({ transaction: { source: 'EXTERNAL' } }) // Incomplete
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.details).toBeDefined();
    expect(Array.isArray(response.body.details)).toBe(true);
  });

  test('returns 400 for customer under 18', async () => {
    const payload = validTransaction();
    payload.contacts.primaryContact.dateOfBirth = '2010-01-01'; // Under 18

    const response = await request(app)
      .post('/api/transactions')
      .send(payload)
      .expect(400);

    expect(response.body.details.some(e => e.message.includes('18'))).toBe(true);
  });

  test('returns 400 for expired driving license', async () => {
    const payload = validTransaction();
    payload.customer.drivingLicense.expiryDate = '2020-01-01'; // Expired

    const response = await request(app)
      .post('/api/transactions')
      .send(payload)
      .expect(400);

    expect(response.body.details.some(e => e.message.includes('expired'))).toBe(true);
  });

  test('returns 400 for wrong bill cycle for GAS', async () => {
    const payload = validTransaction();
    payload.service.serviceType = 'GAS';
    payload.service.billingDetails.billCycleCode = 'Monthly'; // Invalid for GAS

    const response = await request(app)
      .post('/api/transactions')
      .send(payload)
      .expect(400);

    expect(response.body.details.some(e => e.message.includes('Bi-Monthly'))).toBe(true);
  });

  test('returns 400 for MOVE_IN without start date', async () => {
    const payload = validTransaction();
    payload.service.serviceSubType = 'MOVE_IN';
    delete payload.service.serviceStartDate;

    const response = await request(app)
      .post('/api/transactions')
      .send(payload)
      .expect(400);

    expect(response.body.details.some(e => e.message.includes('start date'))).toBe(true);
  });

  test('handles Momentum API errors gracefully', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'db-uuid-456' }] }); // INSERT
    db.query.mockResolvedValueOnce({ rows: [] }); // UPDATE with error
    db.query.mockResolvedValueOnce({ rows: [] }); // audit log

    mockToken();
    nock(BASE)
      .post(`${API_PATH}/echannels/v1/sales-transactions`)
      .reply(400, {
        code: 'OFFER:NOT_FOUND',
        message: 'Offer not found',
      });

    const response = await request(app)
      .post('/api/transactions')
      .send(validTransaction());

    expect(response.status).toBe(400);
    expect(response.body.momentumError?.code).toBe('OFFER:NOT_FOUND');
  });
});

describe('GET /api/transactions', () => {
  test('lists transactions', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })
      .mockResolvedValueOnce({ rows: [{ id: '1', status: 'PENDING', service_type: 'POWER' }] });

    const response = await request(app)
      .get('/api/transactions')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.pagination).toBeDefined();
  });
});

describe('GET /api/transactions/:reference', () => {
  test('returns 404 for unknown transaction', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .get('/api/transactions/UNKNOWN-REF')
      .expect(404);

    expect(response.body.success).toBe(false);
  });

  test('returns transaction details', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: '1', internal_reference: 'REF-001', status: 'PENDING', service_type: 'POWER' }],
    });

    const response = await request(app)
      .get('/api/transactions/REF-001')
      .expect(200);

    expect(response.body.data.internal_reference).toBe('REF-001');
  });
});

describe('GET /health', () => {
  test('returns 200 OK', async () => {
    const response = await request(app).get('/health').expect(200);
    expect(response.body.status).toBe('ok');
  });
});
