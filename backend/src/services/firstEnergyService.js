import axios from 'axios';
import config from '../config/index.js';

function buildHeaders(extra = {}) {
  const apiKey = config.firstEnergy?.apiKey;
  return {
    accept: 'application/json',
    'Content-Type': 'application/json',
    ...(apiKey ? { 'x-api-key': apiKey } : {}),
    ...extra,
  };
}

async function firstEnergyRequest(method, path, { data, params } = {}) {
  const url = `${config.firstEnergy.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await axios.request({
    method,
    url,
    headers: buildHeaders(),
    data,
    params,
    timeout: 30000,
  });
  return res.data;
}

export async function createAccount(accountPayload) {
  // The spec defines the Account create endpoint under the Account tag.
  // We keep the path in one place so it’s easy to adjust if the spec changes.
  return await firstEnergyRequest('POST', '/accounts', { data: accountPayload });
}

export async function getAccount(accountId) {
  return await firstEnergyRequest('GET', `/accounts/${encodeURIComponent(String(accountId))}`);
}

export async function lookupSaleTypes() {
  return await firstEnergyRequest('GET', '/sale-type');
}

export async function lookupPostcode(postcode) {
  return await firstEnergyRequest('GET', `/postcodes/${postcode}`);
}

export async function lookupCustomerTitles() {
  return await firstEnergyRequest('GET', '/customer-titles');
}

export async function lookupIdentificationTypes(state) {
  return await firstEnergyRequest('GET', '/identification', { params: state ? { state } : undefined });
}

export async function addressSearch(searchTerm) {
  return await firstEnergyRequest('GET', '/address-autocomplete/search', { params: { searchTerm } });
}

export async function addressGetDetails(id) {
  return await firstEnergyRequest('GET', '/address-autocomplete/get-details', { params: { id } });
}

export async function proxyRequest(method, path, { data, params } = {}) {
  // Generic passthrough for *all* endpoints in the spec (lookups + validations included).
  // `path` should be a /v2-relative path like `/concession`, `/promo-code/check-code`, etc.
  return await firstEnergyRequest(method, path, { data, params });
}

