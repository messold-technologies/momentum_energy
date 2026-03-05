import axios from 'axios';
import type { TransactionPayload } from './types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export const transactionApi = {
  submit: async (payload: TransactionPayload) => {
    const { data } = await api.post('/transactions', payload);
    return data;
  },
  refreshStatus: async (salesTransactionId: string) => {
    const { data } = await api.get(`/transactions/${salesTransactionId}/status`);
    return data;
  },
};

export default api;
