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

export interface AgentChannel {
  id: string;
  name: string;
}

/** What the server did with a text. The number comes back masked. */
export interface SmsResult {
  to: string;
  status: string;
}

export interface AgentSaleView {
  id: string;
  status: string;
  customerName: string | null;
  serviceAddress: string | null;
  selectedPlan: SelectedPlanSnapshot | null;
  consentSentAt: string | null;
  consentedAt: string | null;
  smsSentAt: string | null;
  smsCount: number;
  /** Masked, e.g. +61400****456. */
  smsTo: string | null;
  smsStatus: string | null;
  createdAt: string;
  updatedAt: string;
  payload: TransactionPayload;
}

export interface AgentConsentLink extends AgentSaleView {
  consentUrl: string;
  expiresAt: string;
  sms: SmsResult | null;
}

function unwrap<T>(data: { success: boolean; data: T }): T {
  return data.data;
}

const PROFILE_KEY = 'agent_portal_profile';
const SMS_KEY = 'agent_portal_sms_enabled';

/** Whether this environment can text. False hides the button rather than failing. */
export function isSmsEnabled(): boolean {
  try {
    return sessionStorage.getItem(SMS_KEY) === '1';
  } catch {
    return false;
  }
}

/** The signed-in channel, for showing who is logged in. Decorative only. */
export function getAgentChannel(): AgentChannel | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as AgentChannel) : null;
  } catch {
    return null;
  }
}

export function clearAgentSession() {
  setAgentToken(null);
  try {
    sessionStorage.removeItem(PROFILE_KEY);
    sessionStorage.removeItem(SMS_KEY);
  } catch {
    /* private browsing */
  }
}

export const agentPortalApi = {
  /** Exchanges a channel's password for a short-lived, agent-scoped session. */
  access: async (channel: string, password: string) => {
    const { data } = await axios.post('/api/agent-portal/access', { channel, password });
    const res = (data as {
      data: { token: string; channel: AgentChannel; smsEnabled: boolean };
    }).data;
    setAgentToken(res.token);
    try {
      sessionStorage.setItem(PROFILE_KEY, JSON.stringify(res.channel));
      sessionStorage.setItem(SMS_KEY, res.smsEnabled ? '1' : '0');
    } catch {
      /* private browsing -- the channel is in the token regardless */
    }
    return res;
  },

  /** Sales taken from this portal, newest first. Backs the "My sales" list. */
  list: async () => {
    const { data } = await agentClient.get('/sales');
    return unwrap<AgentSaleView[]>(data);
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

  /**
   * Issues a fresh link, optionally texting it in the same call. It has to be one call:
   * the raw token exists only in this response, since only its hash is stored.
   *
   * On a failed text the server answers 4xx/5xx but still includes the issued link, so
   * the caller can show it to be copied instead.
   */
  consentLink: async (id: string, opts: { sendSms?: boolean } = {}) => {
    const { data } = await agentClient.post(`/sales/${id}/consent-link`, {
      sendSms: opts.sendSms === true,
    });
    return unwrap<AgentConsentLink>(data);
  },
};
