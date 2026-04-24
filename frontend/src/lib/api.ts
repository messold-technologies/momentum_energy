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
      const w = globalThis.window;
      if (w && !w.location.pathname.includes('/login') && !w.location.pathname.includes('/register')) {
        w.location.href = '/login';
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
  userName: string;
}

export const submissionsApi = {
  list: async (options?: { limit?: number; from?: string; to?: string; companyId?: 'momentum' | 'first-energy' }) => {
    const limit = options?.limit ?? 100;
    const { data } = await api.get<{ success: boolean; submissions: Submission[] }>('/submissions', {
      params: {
        limit,
        ...(options?.companyId ? { companyId: options.companyId } : {}),
        ...(options?.from ? { from: options.from } : {}),
        ...(options?.to ? { to: options.to } : {}),
      },
    });
    return data;
  },
  delete: async (id: string, options?: { companyId?: 'momentum' | 'first-energy' }) => {
    const { data } = await api.delete<{ success: boolean }>(`/submissions/${id}`, {
      params: {
        ...(options?.companyId ? { companyId: options.companyId } : {}),
      },
    });
    return data;
  },
};

export interface Draft {
  id: string;
  updatedAt: string;
  preview?: string;
  userName?: string;
}

export const draftsApi = {
  list: async (options?: { limit?: number; from?: string; to?: string; companyId?: 'momentum' | 'first-energy' }) => {
    const limit = options?.limit ?? 50;
    const { data } = await api.get<{ success: boolean; drafts: Draft[] }>('/drafts', {
      params: {
        limit,
        ...(options?.companyId ? { companyId: options.companyId } : {}),
        ...(options?.from ? { from: options.from } : {}),
        ...(options?.to ? { to: options.to } : {}),
      },
    });
    return data;
  },
  get: async <TPayload = TransactionPayload>(id: string, options?: { companyId?: 'momentum' | 'first-energy' }) => {
    const { data } = await api.get<{ success: boolean; draft: { id: string; payload: TPayload; updatedAt: string } }>(`/drafts/${id}`, {
      params: {
        ...(options?.companyId ? { companyId: options.companyId } : {}),
      },
    });
    return data;
  },
  save: async <TPayload = TransactionPayload>(payload: TPayload, options?: { companyId?: 'momentum' | 'first-energy' }) => {
    const { data } = await api.post<{ success: boolean; draft: { id: string; payload: TPayload; updatedAt: string } }>('/drafts', {
      payload,
      ...(options?.companyId ? { companyId: options.companyId } : {}),
    });
    return data;
  },
  update: async <TPayload = TransactionPayload>(
    id: string,
    payload: TPayload,
    options?: { companyId?: 'momentum' | 'first-energy' }
  ) => {
    const { data } = await api.put<{ success: boolean; draft: { id: string; payload: TPayload; updatedAt: string } }>(`/drafts/${id}`, {
      payload,
      ...(options?.companyId ? { companyId: options.companyId } : {}),
    });
    return data;
  },
  delete: async (id: string, options?: { companyId?: 'momentum' | 'first-energy' }) => {
    const { data } = await api.delete<{ success: boolean }>(`/drafts/${id}`, {
      params: {
        ...(options?.companyId ? { companyId: options.companyId } : {}),
      },
    });
    return data;
  },
};

export type FirstEnergyCompanyId = 'first-energy';

export type FirstEnergySaleType = { type: string };

export type FirstEnergyAddressSuggestion = Record<string, unknown> & { id?: string; Id?: string };

export const firstEnergyApi = {
  lookups: {
    saleTypes: async () => {
      const { data } = await api.get<{ success: boolean; data: FirstEnergySaleType[] }>('/first-energy/lookups/sale-type');
      return data;
    },
    customerTitles: async () => {
      const { data } = await api.get<{ success: boolean; data: Record<string, string> }>('/first-energy/lookups/customer-titles');
      return data;
    },
    referrers: async () => {
      const { data } = await api.get<{ success: boolean; data: unknown }>('/first-energy/lookups/referrers');
      return data;
    },
    postcode: async (postcode: string) => {
      const { data } = await api.get<{ success: boolean; data: unknown }>(`/first-energy/lookups/postcodes/${encodeURIComponent(postcode)}`);
      return data;
    },
    addressSearch: async (searchTerm: string) => {
      const { data } = await api.get<{ success: boolean; data: unknown[] }>('/first-energy/lookups/address/search', {
        params: { searchTerm },
      });
      return data;
    },
    addressDetails: async (id: string) => {
      const { data } = await api.get<{ success: boolean; data: Record<string, unknown> }>('/first-energy/lookups/address/details', {
        params: { id },
      });
      return data;
    },
  },
  proxy: {
    get: async (path: string, params?: Record<string, unknown>) => {
      const normalized = path.replace(/^\/+/, '');
      const { data } = await api.get<{ success: boolean; data: unknown }>(`/first-energy/proxy/${normalized}`, { params });
      return data;
    },
    post: async (path: string, body?: Record<string, unknown>, params?: Record<string, unknown>) => {
      const normalized = path.replace(/^\/+/, '');
      const { data } = await api.post<{ success: boolean; data: unknown }>(`/first-energy/proxy/${normalized}`, body ?? {}, { params });
      return data;
    },
  },
  accounts: {
    create: async (payload: Record<string, unknown>, options?: { formSnapshot?: Record<string, unknown> }) => {
      const { data } = await api.post<{ success: boolean; data: unknown }>('/first-energy/accounts', {
        payload,
        ...(options?.formSnapshot ? { formSnapshot: options.formSnapshot } : {}),
      });
      return data;
    },
    get: async (accountId: string) => {
      const { data } = await api.get<{ success: boolean; data: unknown }>(`/first-energy/accounts/${encodeURIComponent(accountId)}`);
      return data;
    },
  },
};

export interface User {
  id: string;
  email: string;
  name: string;
  isAdmin?: boolean;
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
