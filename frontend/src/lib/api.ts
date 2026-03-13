import axios from 'axios';
import type { TransactionPayload } from './types';
import { getAuthToken, clearAuthStorage } from './auth';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      clearAuthStorage();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

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

export interface Submission {
  id: string;
  correlationId: string | null;
  outcome: 'success' | 'error';
  salesTransactionId: string | null;
  errorMessage: string | null;
  errorStatus: number | null;
  payloadSnapshot: Record<string, unknown> | null;
  createdAt: string;
}

export const submissionsApi = {
  list: async () => {
    const { data } = await api.get<{ success: boolean; submissions: Submission[] }>('/submissions');
    return data;
  },
};

export interface User {
  id: string;
  email: string;
  name: string;
}

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post<{ success: boolean; token: string; user: User }>('/auth/login', {
      email,
      password,
    });
    return data;
  },
  register: async (email: string, name: string, password: string) => {
    const { data } = await api.post<{ success: boolean; user: User }>('/auth/register', {
      email,
      name,
      password,
    });
    return data;
  },
  me: async () => {
    const { data } = await api.get<{ success: boolean; user: User }>('/auth/me');
    return data;
  },
};

export default api;
