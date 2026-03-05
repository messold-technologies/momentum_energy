import axios from 'axios';
import type { TransactionPayload, TransactionRecord } from './types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const apiKey = import.meta.env.VITE_API_KEY;
  if (apiKey) {
    config.headers['x-api-key'] = apiKey;
  }
  return config;
});

export const transactionApi = {
  submit: async (payload: TransactionPayload) => {
    const { data } = await api.post('/transactions', payload);
    return data;
  },
  list: async (params: {
    page?: number;
    limit?: number;
    status?: string;
    serviceType?: string;
    from?: string;
    to?: string;
  }) => {
    const { data } = await api.get('/transactions', { params });
    return data as {
      success: boolean;
      data: TransactionRecord[];
      pagination: { page: number; limit: number; total: number; pages: number };
    };
  },
  getByReference: async (reference: string) => {
    const { data } = await api.get(`/transactions/${reference}`);
    return data as { success: boolean; data: TransactionRecord };
  },
  refreshStatus: async (salesTransactionId: string) => {
    const { data } = await api.get(`/transactions/${salesTransactionId}/status`);
    return data;
  },
};

export const adminApi = {
  stats: async () => {
    const { data } = await api.get('/admin/stats');
    return data;
  },
};

export default api;
