import axios from 'axios';
import { createOffersApi } from './offersApi';
import type { SelectedPlanSnapshot } from './agentSalesApi';
import type { TransactionPayload } from './types';

const TOKEN_KEY = 'agent_portal_token';

export function getAgentToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAgentToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private browsing */
  }
}

/**
 * Separate client from the staff one on purpose: a different token under a different
 * storage key, and a base path the staff endpoints are not mounted on. An agent session
 * cannot reach submit, drafts, submissions or the QA queue.
 *
 * Kept in sessionStorage rather than localStorage so closing the tab ends the session,
 * which suits a shared machine in a call centre.
 */
const agentClient = axios.create({
  baseURL: '/api/agent-portal',
  headers: { 'Content-Type': 'application/json' },
});

agentClient.interceptors.request.use((cfg) => {
  const token = getAgentToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

/** Signals an expired or missing agent session so the page can show the code prompt again. */
export class AgentSessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'AgentSessionExpiredError';
  }
}

agentClient.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      setAgentToken(null);
      return Promise.reject(new AgentSessionExpiredError());
    }
    return Promise.reject(err);
  }
);

export const agentOffersApi = createOffersApi(agentClient, '/offers');

export interface AgentSaleView {
  id: string;
  status: string;
  customerName: string | null;
  serviceAddress: string | null;
  selectedPlan: SelectedPlanSnapshot | null;
  consentSentAt: string | null;
  consentedAt: string | null;
  createdAt: string;
  updatedAt: string;
  payload: TransactionPayload;
}

export interface AgentConsentLink extends AgentSaleView {
  consentUrl: string;
  expiresAt: string;
}

function unwrap<T>(data: { success: boolean; data: T }): T {
  return data.data;
}

export interface AgentProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
}

const PROFILE_KEY = 'agent_portal_profile';

export function getStoredAgent(): AgentProfile | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as AgentProfile) : null;
  } catch {
    return null;
  }
}

function storeSession(token: string, agent: AgentProfile) {
  setAgentToken(token);
  try {
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(agent));
  } catch {
    /* private browsing */
  }
}

export function clearAgentSession() {
  setAgentToken(null);
  try {
    sessionStorage.removeItem(PROFILE_KEY);
  } catch {
    /* private browsing */
  }
}

export const agentPortalApi = {
  signup: async (input: { name: string; email: string; phone?: string; password: string }) => {
    const { data } = await axios.post('/api/agent-portal/signup', input);
    const { token, agent } = (data as { data: { token: string; agent: AgentProfile } }).data;
    storeSession(token, agent);
    return agent;
  },

  login: async (email: string, password: string) => {
    const { data } = await axios.post('/api/agent-portal/login', { email, password });
    const { token, agent } = (data as { data: { token: string; agent: AgentProfile } }).data;
    storeSession(token, agent);
    return agent;
  },

  me: async () => {
    const { data } = await agentClient.get('/me');
    return unwrap<AgentProfile>(data);
  },

  create: async (payload: TransactionPayload, selectedPlan: SelectedPlanSnapshot | null) => {
    const { data } = await agentClient.post('/sales', { payload, selectedPlan });
    return unwrap<AgentSaleView>(data);
  },

  update: async (id: string, payload: TransactionPayload, selectedPlan: SelectedPlanSnapshot | null) => {
    const { data } = await agentClient.patch(`/sales/${id}`, { payload, selectedPlan });
    return unwrap<AgentSaleView>(data);
  },

  get: async (id: string) => {
    const { data } = await agentClient.get(`/sales/${id}`);
    return unwrap<AgentSaleView>(data);
  },

  consentLink: async (id: string) => {
    const { data } = await agentClient.post(`/sales/${id}/consent-link`);
    return unwrap<AgentConsentLink>(data);
  },
};
