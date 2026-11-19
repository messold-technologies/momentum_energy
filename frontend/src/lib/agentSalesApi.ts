import axios from 'axios';
import api from './api';
import type { TransactionPayload } from './types';
import type { OfferCard } from './offersApi';

export type AgentSaleStatus =
  | 'agent_draft'
  | 'awaiting_consent'
  | 'consented'
  | 'submitted'
  | 'rejected'
  | 'cancelled';

export const STATUS_LABEL: Record<AgentSaleStatus, string> = {
  agent_draft: 'Draft',
  awaiting_consent: 'Awaiting consent',
  consented: 'Ready for QA',
  submitted: 'Submitted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const STATUS_CLASS: Record<AgentSaleStatus, string> = {
  agent_draft: 'bg-gray-100 text-gray-700',
  awaiting_consent: 'bg-amber-100 text-amber-800',
  consented: 'bg-blue-100 text-blue-800',
  submitted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

/** Snapshot of the plan card shown to the customer, stored beside the offer code. */
export interface SelectedPlanSnapshot {
  offerCode: string;
  planCode: string;
  energyType: string;
  networkName: string;
  networkZone: string | null;
  retailTariffCode: string;
  customerType: string;
  annualCost: number | null;
  monthlyCost: number | null;
  comparisonLabel: string | null;
  benchmarkName: string | null;
  cdrPlanId: string | null;
  factSheetUrl: string | null;
  rateCardVersion?: string;
  indicativeOnly: boolean;
  quotedAt: string;
}

export function toSnapshot(
  offer: OfferCard,
  extra: { rateCardVersion?: string; indicativeOnly: boolean }
): SelectedPlanSnapshot {
  return {
    offerCode: offer.offerCode,
    planCode: offer.planCode,
    energyType: offer.energyType,
    networkName: offer.networkName,
    networkZone: offer.networkZone,
    retailTariffCode: offer.retailTariffCode,
    customerType: offer.customerType,
    annualCost: offer.pricing.annualCost,
    monthlyCost: offer.pricing.monthlyCost,
    comparisonLabel: offer.pricing.comparison.label,
    benchmarkName: offer.pricing.benchmark.name,
    cdrPlanId: offer.links.cdrPlanId,
    factSheetUrl: offer.links.factSheetUrl,
    rateCardVersion: extra.rateCardVersion,
    indicativeOnly: extra.indicativeOnly,
    quotedAt: new Date().toISOString(),
  };
}

export interface AgentSale {
  id: string;
  status: AgentSaleStatus;
  companyId: string;
  createdBy: string;
  createdByName: string | null;
  /**
   * Name the agent typed on the form. The portal is entered with a shared password, so
   * this is self-reported and not verified against an account.
   */
  agentName: string | null;
  agentNameIsSelfReported: boolean;
  fromAgentPortal: boolean;
  customerName: string | null;
  customerEmail: string | null;
  serviceAddress: string | null;
  transactionReference: string | null;
  selectedPlan: SelectedPlanSnapshot | null;
  consentSentAt: string | null;
  consentExpiresAt: string | null;
  consentedAt: string | null;
  consent: {
    items: Record<string, boolean>;
    statementsShown: Array<{ key: string; label: string; description: string }>;
    planShown: Record<string, unknown>;
  } | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  salesTransactionId: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  payload?: TransactionPayload;
  publicSummary?: ConsentSummary;
}

export interface ConsentLinkResult extends AgentSale {
  consentUrl: string;
  consentToken: string;
  expiresAt: string;
}

export interface ConsentItem {
  key: string;
  required: boolean;
  label: string;
  description: string;
}

/** The narrow projection the public consent page receives. */
export interface ConsentSummary {
  status: AgentSaleStatus;
  customer: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    postalAddress: string | null;
  };
  service: {
    energyType: string;
    serviceSubType: string | null;
    address: string | null;
    startDate: string | null;
  };
  plan: {
    planCode: string | null;
    networkName: string | null;
    monthlyCost: number | null;
    annualCost: number | null;
    comparisonLabel: string | null;
    benchmarkName: string | null;
    factSheetUrl: string | null;
    contractTerm: string | null;
    billCycle: string | null;
    billDelivery: string | null;
    paymentMethod: string | null;
    indicativeOnly: boolean;
  };
  directDebit: { accountNameInitial: string | null; accountNumberMasked: string | null } | null;
  consentItems: ConsentItem[];
  alreadyConsentedAt: string | null;
}

function unwrap<T>(data: { success: boolean; data: T }): T {
  return data.data;
}

export const agentSalesApi = {
  create: async (payload: TransactionPayload, selectedPlan: SelectedPlanSnapshot | null) => {
    const { data } = await api.post('/agent-sales', { payload, selectedPlan });
    return unwrap<AgentSale>(data);
  },

  update: async (id: string, payload: TransactionPayload, selectedPlan: SelectedPlanSnapshot | null) => {
    const { data } = await api.patch(`/agent-sales/${id}`, { payload, selectedPlan });
    return unwrap<AgentSale>(data);
  },

  list: async (statuses?: AgentSaleStatus[]) => {
    const { data } = await api.get('/agent-sales', {
      params: statuses?.length ? { status: statuses.join(',') } : {},
    });
    return unwrap<AgentSale[]>(data);
  },

  get: async (id: string) => {
    const { data } = await api.get(`/agent-sales/${id}`);
    return unwrap<AgentSale>(data);
  },

  consentLink: async (id: string) => {
    const { data } = await api.post(`/agent-sales/${id}/consent-link`);
    return unwrap<ConsentLinkResult>(data);
  },

  submit: async (id: string) => {
    const { data } = await api.post(`/agent-sales/${id}/submit`);
    return unwrap<AgentSale & { salesTransactionId: string | null }>(data);
  },

  reject: async (id: string, reason: string) => {
    const { data } = await api.post(`/agent-sales/${id}/reject`, { reason });
    return unwrap<AgentSale>(data);
  },
};

/**
 * Public consent endpoints. Uses a bare axios instance, not the app client: the customer
 * is not signed in, and the app client would redirect them to /login on a 401.
 */
const publicApi = axios.create({ baseURL: '/api', headers: { 'Content-Type': 'application/json' } });

export const consentApi = {
  get: async (token: string) => {
    const { data } = await publicApi.get(`/consent/${token}`);
    return unwrap<ConsentSummary>(data);
  },
  submit: async (token: string, consent: Record<string, boolean>) => {
    const { data } = await publicApi.post(`/consent/${token}`, { consent });
    return unwrap<{ consentedAt: string }>(data);
  },
};
