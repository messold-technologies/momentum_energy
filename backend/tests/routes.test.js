const request = require('supertest');
const app = require('../src/server');
const jwt = require('jsonwebtoken');
const { pool } = require('../src/db/connection');

// Mock the database
jest.mock('../src/db/connection', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(() => ({
      query: jest.fn(),
      release: jest.fn(),
    })),
    on: jest.fn(),
    end: jest.fn(),
  }
}));

// Mock Momentum API service
jest.mock('../src/services/momentumApiService', () => ({
  testConnection: jest.fn(),
  submitTransaction: jest.fn(),
  getTransactionStatus: jest.fn(),
}));

// Mock auth service
jest.mock('../src/services/authService', () => ({
  getAccessToken: jest.fn(() => 'mock-token'),
  clearCache: jest.fn(),
}));

// Helper: generate a test JWT
function makeToken(user = { id: 'user-123', email: 'test@test.com', role: 'agent' }) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Health Endpoint', () => {
  beforeEach(() => {
    pool.query.mockResolvedValue({ rows: [{ now: new Date() }] });
  });

  test('GET /api/health returns 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Auth Routes', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@test.com',
    full_name: 'Test User',
    role: 'agent',
    password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewmSPkPzQSGC7rJC', // "password123"
    is_active: true,
  };

  test('POST /api/auth/login - missing credentials returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com' }); // missing password
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login - user not found returns 401', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'notfound@test.com', password: 'password123' });
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me - no token returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me - valid token returns user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockUser] });
    const token = makeToken();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Transaction Routes', () => {
  const mockUser = {
    id: 'user-123',
    email: 'agent@test.com',
    full_name: 'Test Agent',
    role: 'agent',
  };

  beforeEach(() => {
    pool.query.mockReset();
    // Default: return the mock user for auth middleware
    pool.query.mockResolvedValue({ rows: [mockUser] });
  });

  test('GET /api/transactions - requires auth', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(401);
  });

  test('GET /api/transactions - returns list with auth', async () => {
    const token = makeToken(mockUser);
    pool.query
      .mockResolvedValueOnce({ rows: [mockUser] }) // auth middleware
      .mockResolvedValueOnce({ rows: [] }) // transactions query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // count query

    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.transactions).toBeDefined();
    expect(res.body.pagination).toBeDefined();
  });

  test('POST /api/transactions - rejects invalid payload', async () => {
    const token = makeToken(mockUser);
    pool.query.mockResolvedValueOnce({ rows: [mockUser] }); // auth

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerType: 'RESIDENT' }); // Incomplete payload

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  test('GET /api/transactions/:id - returns 404 for unknown id', async () => {
    const token = makeToken(mockUser);
    pool.query
      .mockResolvedValueOnce({ rows: [mockUser] }) // auth
      .mockResolvedValueOnce({ rows: [] }) // transaction query
      .mockResolvedValueOnce({ rows: [] }) // audit query
      .mockResolvedValueOnce({ rows: [] }); // status history query

    const res = await request(app)
      .get('/api/transactions/nonexistent-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

afterAll(async () => {
  // Cleanup
  await new Promise(resolve => setTimeout(resolve, 100));
});
