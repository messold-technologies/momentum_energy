import express from 'express';
const router = express.Router();
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection.js';
import logger from '../config/logger.js';
import {
  createAccount,
  getAccount,
  lookupSaleTypes,
  lookupPostcode,
  lookupCustomerTitles,
  lookupIdentificationTypes,
  addressSearch,
  addressGetDetails,
  proxyRequest,
} from '../services/firstEnergyService.js';
import { sanitizeFirstEnergyAccountPayload } from '../utils/sanitizeFirstEnergyPayload.js';

async function storeSubmission({
  userId,
  correlationId,
  outcome,
  externalId,
  errorMessage,
  errorStatus,
  payloadSnapshot,
}) {
  await query(
    `INSERT INTO submissions (user_id, company_id, correlation_id, outcome, sales_transaction_id, error_message, error_status, payload_snapshot)
     VALUES ($1, 'first-energy', $2, $3, $4, $5, $6, $7)`,
    [
      userId,
      correlationId,
      outcome,
      externalId || null,
      errorMessage || null,
      errorStatus || null,
      payloadSnapshot ? JSON.stringify(payloadSnapshot) : null,
    ]
  );
}

router.get('/lookups/sale-type', async (_req, res, next) => {
  try {
    const data = await lookupSaleTypes();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/lookups/customer-titles', async (_req, res, next) => {
  try {
    const data = await lookupCustomerTitles();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/lookups/identification', async (req, res, next) => {
  try {
    const state = typeof req.query?.state === 'string' ? req.query.state : undefined;
    const data = await lookupIdentificationTypes(state);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/lookups/postcodes/:postcode', async (req, res, next) => {
  try {
    const data = await lookupPostcode(req.params.postcode);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/lookups/address/search', async (req, res, next) => {
  try {
    const searchTerm = typeof req.query?.searchTerm === 'string' ? req.query.searchTerm : '';
    if (!searchTerm.trim()) return res.status(400).json({ success: false, error: 'searchTerm is required' });
    const data = await addressSearch(searchTerm.trim());
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/lookups/address/details', async (req, res, next) => {
  try {
    const id = typeof req.query?.id === 'string' ? req.query.id : '';
    if (!id.trim()) return res.status(400).json({ success: false, error: 'id is required' });
    const data = await addressGetDetails(id.trim());
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/first-energy/accounts/:accountId
 * View a 1st Energy account by id (used by Form Responses to fetch latest details).
 */
router.get('/accounts/:accountId', async (req, res, next) => {
  try {
    const data = await getAccount(req.params.accountId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * Generic proxy for any lookup/validation endpoint from the PDF.
 * - GET /api/first-energy/proxy/<path>?<query>
 * - POST /api/first-energy/proxy/<path>
 *
 * Examples:
 * - GET /api/first-energy/proxy/concession?state=VIC
 * - GET /api/first-energy/proxy/promo-code/check-code?code=SAVE10
 * - POST /api/first-energy/proxy/concession/validate?account_id=...&hash=...
 */
router.all('/proxy/*', async (req, res, next) => {
  try {
    const raw = String(req.params[0] ?? '');
    const path = `/${raw.replace(/^\/+/, '')}`;
    const method = req.method.toUpperCase();
    const params = req.query && typeof req.query === 'object' ? req.query : undefined;
    const body = req.body && typeof req.body === 'object' ? req.body : undefined;

    const data = await proxyRequest(method, path, { params, data: body });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/first-energy/accounts
 * Create a 1st Energy account (Tally Acquire API).
 */
router.post('/accounts', async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const correlationId = (req.headers['x-correlation-id'] || uuidv4()).toString();
  const payload = req.body?.payload;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ success: false, error: 'payload is required' });
  }

  const payloadSnapshot = structuredClone(payload);
  const sanitizedPayload = sanitizeFirstEnergyAccountPayload(structuredClone(payload));

  try {
    const result = await createAccount(sanitizedPayload);
    const externalId = result?.id || result?.account_id || result?.accountId || result?.reference || null;
    await storeSubmission({
      userId,
      correlationId,
      outcome: 'success',
      externalId,
      payloadSnapshot,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    const status = err.response?.status ?? err.status ?? 500;
    const errorMessage =
      err.response?.data?.message ||
      err.response?.data?.error ||
      (typeof err.response?.data === 'string' ? err.response.data : null) ||
      err.message ||
      'Account creation failed';

    logger.error('1st Energy account creation failed', { status, errorMessage, correlationId, userId });
    await storeSubmission({
      userId,
      correlationId,
      outcome: 'error',
      externalId: null,
      errorMessage,
      errorStatus: status,
      payloadSnapshot,
    }).catch(() => {});

    res.status(status).json({ success: false, error: errorMessage, details: err.response?.data ?? null });
  }
});

export default router;

