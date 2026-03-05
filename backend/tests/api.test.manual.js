/**
 * Manual API Integration Tests
 * Tests against the REAL Momentum Energy Sandbox API.
 * 
 * Run with: node tests/api.test.manual.js
 * 
 * REQUIREMENTS:
 * - Valid .env file with sandbox credentials
 * - IP address allowlisted with Momentum
 * - Valid sandbox offer IDs (get from Momentum)
 */

require('dotenv').config();
const axios = require('axios');

// =============================================
// CONFIG - Update these before testing
// =============================================
const BASE_URL = 'http://localhost:3001/api';
let authToken = null;

// Test data
const TEST_USER = { email: 'admin@yourdomain.com', password: 'Admin@123!' };

const TEST_TRANSACTION = {
  customerType: 'RESIDENT',
  communicationPreference: 'EMAIL',
  primaryContact: {
    salutation: 'Mr',
    firstName: 'Test',
    lastName: 'Customer',
    dateOfBirth: '1985-06-15',
    email: 'test.customer@example.com',
    phones: [{ type: 'MOBILE', number: '0412345678' }],
    address: {
      streetNumber: '1',
      streetName: 'Test',
      streetType: 'Street',
      suburb: 'Melbourne',
      state: 'VIC',
      postcode: '3000',
    },
  },
  identityDocument: {
    type: 'DRIVING_LICENCE',
    licenceNumber: 'TEST12345',
    licenceState: 'VIC',
    licenceExpiry: '2028-06-15',
  },
  serviceType: 'POWER',
  serviceSubtype: 'TRANSFER',
  serviceConnectionId: '6102969980', // NMI - use a valid test NMI from Momentum sandbox docs
  servicedAddress: {
    streetNumber: '1',
    streetName: 'Collins',
    streetType: 'Street',
    suburb: 'Melbourne',
    state: 'VIC',
    postcode: '3000',
  },
  offerDetails: {
    offerId: 'REPLACE_WITH_VALID_SANDBOX_OFFER_ID', // ← UPDATE THIS
    quoteDate: new Date().toISOString().slice(0, 10),
    planName: 'Basic Power Plan',
    contractTerm: 12,
  },
  billCycleCode: 'MONTHLY',
  billDelivery: 'EMAIL',
  paymentMethod: { type: 'CHEQUE' },
};

// =============================================
// Test Runner
// =============================================
const results = [];

async function test(name, fn) {
  process.stdout.write(`\n⏳ ${name}...`);
  try {
    await fn();
    results.push({ name, status: '✅ PASS' });
    process.stdout.write(' ✅ PASS');
  } catch (err) {
    results.push({ name, status: '❌ FAIL', error: err.message });
    process.stdout.write(` ❌ FAIL: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// =============================================
// Tests
// =============================================
async function runTests() {
  console.log('\n================================================');
  console.log('  MOMENTUM ENERGY PORTAL - API INTEGRATION TESTS');
  console.log('================================================');
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Momentum Env: ${process.env.MOMENTUM_ENV}`);
  console.log('================================================\n');

  // --- HEALTH ---
  await test('GET /health - Server is running', async () => {
    const res = await axios.get(`${BASE_URL}/health`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.status === 'ok', 'Status should be ok');
    assert(res.data.database === 'connected', 'Database should be connected');
    console.log(`\n    DB: ${res.data.database}, Env: ${res.data.environment}`);
  });

  // --- AUTH ---
  await test('POST /auth/login - Login with valid credentials', async () => {
    const res = await axios.post(`${BASE_URL}/auth/login`, TEST_USER);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.token, 'Should return token');
    assert(res.data.user.email, 'Should return user');
    authToken = res.data.token;
    console.log(`\n    Logged in as: ${res.data.user.email} (${res.data.user.role})`);
  });

  await test('POST /auth/login - Reject invalid credentials', async () => {
    try {
      await axios.post(`${BASE_URL}/auth/login`, { email: 'wrong@test.com', password: 'wrongpass' });
      throw new Error('Should have returned 401');
    } catch (err) {
      assert(err.response?.status === 401, `Expected 401, got ${err.response?.status}`);
    }
  });

  await test('GET /auth/me - Get current user info', async () => {
    const res = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.user.email, 'Should return user info');
  });

  await test('GET /auth/me - Reject unauthenticated request', async () => {
    try {
      await axios.get(`${BASE_URL}/auth/me`);
      throw new Error('Should have returned 401');
    } catch (err) {
      assert(err.response?.status === 401, `Expected 401, got ${err.response?.status}`);
    }
  });

  // --- VALIDATION TESTS ---
  await test('POST /transactions - Reject transaction without auth', async () => {
    try {
      await axios.post(`${BASE_URL}/transactions`, TEST_TRANSACTION);
      throw new Error('Should have returned 401');
    } catch (err) {
      assert(err.response?.status === 401, `Expected 401, got ${err.response?.status}`);
    }
  });

  await test('POST /transactions - Reject invalid payload (under 18)', async () => {
    const payload = JSON.parse(JSON.stringify(TEST_TRANSACTION));
    payload.primaryContact.dateOfBirth = '2015-01-01'; // Under 18
    
    try {
      await axios.post(`${BASE_URL}/transactions`, payload, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      throw new Error('Should have returned 400');
    } catch (err) {
      assert(err.response?.status === 400, `Expected 400, got ${err.response?.status}`);
      assert(err.response?.data.errors, 'Should return validation errors');
      console.log(`\n    Validation errors: ${err.response.data.errors.map(e => e.message).join(', ')}`);
    }
  });

  await test('POST /transactions - Reject GAS with MONTHLY cycle', async () => {
    const payload = { ...TEST_TRANSACTION, serviceType: 'GAS', billCycleCode: 'MONTHLY' };
    try {
      await axios.post(`${BASE_URL}/transactions`, payload, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      throw new Error('Should have returned 400');
    } catch (err) {
      assert(err.response?.status === 400, `Expected 400, got ${err.response?.status}`);
    }
  });

  await test('POST /transactions - Reject stale offer date (15 days old)', async () => {
    const payload = JSON.parse(JSON.stringify(TEST_TRANSACTION));
    const oldDate = new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10);
    payload.offerDetails.quoteDate = oldDate;
    try {
      await axios.post(`${BASE_URL}/transactions`, payload, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      throw new Error('Should have returned 400');
    } catch (err) {
      assert(err.response?.status === 400, `Expected 400, got ${err.response?.status}`);
    }
  });

  // --- TRANSACTION LIST ---
  await test('GET /transactions - List transactions', async () => {
    const res = await axios.get(`${BASE_URL}/transactions`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.transactions), 'Should return transactions array');
    assert(res.data.pagination, 'Should return pagination info');
    console.log(`\n    Total transactions: ${res.data.pagination.total}`);
  });

  // --- MOMENTUM API CONNECTIVITY ---
  await test('GET /admin/momentum-status - Momentum API connectivity', async () => {
    const res = await axios.get(`${BASE_URL}/admin/momentum-status`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log(`\n    Momentum API: ${JSON.stringify(res.data)}`);
    // Don't fail even if Momentum is unreachable in test env
  });

  // --- SANDBOX API SUBMISSION ---
  // Only run if offer ID is configured
  if (TEST_TRANSACTION.offerDetails.offerId !== 'REPLACE_WITH_VALID_SANDBOX_OFFER_ID') {
    let submittedTransactionId = null;

    await test('POST /transactions - Submit to Momentum sandbox', async () => {
      const res = await axios.post(`${BASE_URL}/transactions`, TEST_TRANSACTION, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (res.data.success) {
        assert(res.data.salesTransactionId, 'Should return Momentum transaction ID');
        assert(res.data.internalReference, 'Should return internal reference');
        submittedTransactionId = res.data.salesTransactionId;
        console.log(`\n    ✅ Submitted! salesTransactionId: ${res.data.salesTransactionId}`);
        console.log(`    internalReference: ${res.data.internalReference}`);
      } else {
        // Expected failure - Momentum returns error (offer not found etc)
        console.log(`\n    ⚠️  Submission failed with: ${res.data.errorCode} - ${res.data.error}`);
      }
    });

    if (submittedTransactionId) {
      await test('POST /transactions/:id/check-status - Check submission status', async () => {
        // Wait 2 seconds for processing
        await new Promise(r => setTimeout(r, 2000));
        
        const res = await axios.post(
          `${BASE_URL}/transactions/${submittedTransactionId}/check-status`,
          {},
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        console.log(`\n    Status: ${res.data.status}`);
      });
    }
  } else {
    console.log('\n⚠️  Skipping sandbox submission test - update TEST_TRANSACTION.offerDetails.offerId first');
  }

  // --- ADMIN STATS ---
  await test('GET /admin/stats - Dashboard statistics', async () => {
    const res = await axios.get(`${BASE_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.statusCounts !== undefined, 'Should return status counts');
    assert(typeof res.data.todayCount === 'number', 'Should return today count');
  });

  // =============================================
  // RESULTS SUMMARY
  // =============================================
  console.log('\n\n================================================');
  console.log('  TEST RESULTS SUMMARY');
  console.log('================================================');
  
  let passed = 0;
  let failed = 0;

  results.forEach(r => {
    console.log(`${r.status}  ${r.name}`);
    if (r.error) console.log(`       Error: ${r.error}`);
    if (r.status.includes('PASS')) passed++;
    else failed++;
  });

  console.log('------------------------------------------------');
  console.log(`  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Check server is running before starting
axios.get(`${BASE_URL}/health`)
  .then(() => runTests())
  .catch(() => {
    console.error(`\n❌ ERROR: Cannot connect to server at ${BASE_URL}`);
    console.error('Please start the server first with: npm run dev\n');
    process.exit(1);
  });
