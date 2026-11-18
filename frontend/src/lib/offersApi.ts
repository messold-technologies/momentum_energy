import type { AxiosInstance } from 'axios';
import api from './api';

export type EnergyType = 'ELECTRICITY' | 'GAS';
export type OfferCustomerType = 'RESIDENTIAL' | 'COMMERCIAL';

export interface NetworkOption {
  networkName: string;
  networkZone: string | null;
  isDefault: boolean;
}

export interface NetworksResponse {
  fromConnectionId: { prefix: string; networkName: string } | null;
  networks: NetworkOption[];
  defaultNetwork: string | null;
  /** Postcode spans several networks with no default (all 24 ambiguous gas postcodes). */
  requiresSelection: boolean;
}

export interface RateBlock {
  block: number;
  limit?: number;
  rate?: number;
}

export interface OfferCard {
  offerCode: string;
  offerWithRateNumber: string | null;
  offerNumber: string | null;
  planCode: string;

  energyType: EnergyType;
  state: string;
  networkName: string;
  networkZone: string | null;
  retailTariffCode: string;
  customerType: OfferCustomerType;
  tariffCategory: string | null;
  isFlatRate: boolean;

  effectiveStart: string | null;
  effectiveEnd: string | null;

  pricing: {
    currency: string;
    gstInclusive: boolean;
    dailyChargeCents: number | null;
    rates: {
      peak?: RateBlock[];
      shoulder?: RateBlock[];
      offpeak?: RateBlock[];
      controlledload1?: RateBlock[];
      controlledload2?: RateBlock[];
      peakSeason2?: number;
    } | null;
    /** Precomputed, GST-inclusive, includes credits. Null for gas. */
    annualCost: number | null;
    monthlyCost: number | null;
    basis: 'rate-card-benchmark' | 'unavailable';
    benchmark: {
      name: string;
      tariffType: string | null;
      kwh: number | null;
      cost: number | null;
    };
    comparison: {
      differenceDollar: number | null;
      differencePercent: number | null;
      label: string | null;
    };
    usageEstimate: {
      annualUsage: number;
      annualCost: number;
      monthlyCost: number;
      excludesCreditsAndDiscounts: true;
    } | null;
  };

  plan: {
    features: Array<{ heading: string | null; text: string | null }>;
    contractTerm: string | null;
    customerEligibility: string | null;
    terminationFee: string | null;
    dishonouredPaymentFee: string | null;
    creditCardPaymentFee: string | null;
    billingOptions: string | null;
    paymentOptions: string | null;
    greenOptions: string | null;
    termsAndConditions: string | null;
    stateAvailability: string[];
    extras: Record<string, string | null>;
  };

  links: {
    factSheetUrl: string | null;
    cdrPlanCode: string | null;
    cdrPlanId: string | null;
  };
}

export interface OffersResponse {
  resolved: {
    energyType: EnergyType;
    customerType: OfferCustomerType;
    networkName: string;
    networkZone: string | null;
    retailTariffCode: string | null;
    resolvedVia: 'explicit' | 'connectionId' | 'postcodeDefault' | null;
  };
  /**
   * True when no retail tariff code was known, so prices are the flat-rate benchmark
   * figures and the offer code must be re-confirmed once the site's network tariff is known.
   */
  indicativeOnly: boolean;
  count: number;
  offers: OfferCard[];
}

export interface RateCardVersion {
  id: string;
  label: string;
  sourceFile: string;
  importedAt: string;
  stats: Record<string, unknown> | null;
}

export interface OfferQuery {
  energyType: EnergyType;
  customerType: OfferCustomerType;
  postcode?: string;
  networkName?: string;
  networkZone?: string;
  connectionId?: string;
  retailTariffCode?: string;
  tariffCombinationKey?: string;
  planCode?: string;
  annualUsage?: number;
  flatRateOnly?: boolean;
  hasEV?: boolean;
}

/** Thrown when a postcode maps to several networks and none is flagged default. */
export class NetworkSelectionRequiredError extends Error {
  networks: NetworkOption[];
  constructor(message: string, networks: NetworkOption[]) {
    super(message);
    this.name = 'NetworkSelectionRequiredError';
    this.networks = networks;
  }
}

function unwrap<T>(data: { success: boolean; data: T }): T {
  return data.data;
}

/**
 * Built as a factory so the staff portal and the passphrase-gated agent portal can share
 * one implementation while talking to different mount points with different credentials.
 */
export function createOffersApi(client: AxiosInstance, base = '/offers') {
  return {
    version: async (): Promise<RateCardVersion> => {
      const { data } = await client.get(`${base}/version`);
      return unwrap<RateCardVersion>(data);
    },

    networks: async (params: {
      energyType: EnergyType;
      postcode?: string;
      connectionId?: string;
    }): Promise<NetworksResponse> => {
      const { data } = await client.get(`${base}/networks`, { params });
      return unwrap<NetworksResponse>(data);
    },

    list: async (params: OfferQuery): Promise<OffersResponse> => {
      try {
        const { data } = await client.get(base, { params });
        return unwrap<OffersResponse>(data);
      } catch (err: unknown) {
        const res = (
          err as { response?: { status?: number; data?: { error?: string; data?: { networks?: NetworkOption[] } } } }
        ).response;
        if (res?.status === 409) {
          throw new NetworkSelectionRequiredError(
            res.data?.error || 'Select a distribution network',
            res.data?.data?.networks ?? []
          );
        }
        throw err;
      }
    },

    byCode: async (offerCode: string): Promise<OfferCard> => {
      const { data } = await client.get(`${base}/${offerCode}`);
      return unwrap<OfferCard>(data);
    },
  };
}

export type OffersApi = ReturnType<typeof createOffersApi>;

export const offersApi = createOffersApi(api);
