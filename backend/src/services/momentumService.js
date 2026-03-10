import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import logger from '../config/logger.js';
import { getAccessToken, clearTokenCache } from './tokenService.js';

async function makeRequest(method, path, data = null, options = {}) {
  const token = await getAccessToken();
  const correlationId = options.correlationId || uuidv4();

  const axiosConfig = {
    method,
    url: `${config.momentum.baseUrl}${path}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'id-correlation': correlationId,
      'x-source-system': config.momentum.sourceSystem || 'PowerMarket',
    },
    timeout: 30000,
  };

  if (data) axiosConfig.data = data;

  try {
    const response = await axios(axiosConfig);
    return response.data;
  } catch (error) {
    // If 401, clear token cache and retry once
    if (error.response?.status === 401) {
      logger.warn('Got 401, clearing token cache and retrying...');
      clearTokenCache();
      const freshToken = await getAccessToken();
      axiosConfig.headers.Authorization = `Bearer ${freshToken}`;
      const retryResponse = await axios(axiosConfig);
      return retryResponse.data;
    }
    throw error;
  }
}

async function submitSalesTransaction(transactionPayload, options = {}) {
  logger.info('Submitting sales transaction to Momentum', {
    reference: transactionPayload.transaction?.transactionReference,
    correlationId: options.correlationId,
  });

  try {
    const result = await makeRequest('POST', '/echannels/v1/sales-transactions', transactionPayload, options);
    logger.info('Transaction submitted successfully', {
      salesTransactionId: result.salesTransactionId,
      status: result.transactionStatus,
    });
    return result;
  } catch (error) {
    const status = error.response?.status;
    const errorData = error.response?.data;
    logger.error('Transaction submission failed', { status, errorData });
    throw { status, errorData, originalError: error };
  }
}

async function getSalesTransactionStatus(salesTransactionId, options = {}) {
  logger.info('Fetching transaction status', { salesTransactionId, correlationId: options.correlationId });

  try {
    const result = await makeRequest('GET', `/echannels/v1/sales-transactions/${salesTransactionId}`, null, options);
    return result;
  } catch (error) {
    const status = error.response?.status;
    const errorData = error.response?.data;
    logger.error('Status fetch failed', { salesTransactionId, status, errorData });
    throw { status, errorData, originalError: error };
  }
}

export { submitSalesTransaction, getSalesTransactionStatus };
