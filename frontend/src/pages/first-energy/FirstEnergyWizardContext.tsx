import { createContext, useContext, type ReactNode } from 'react';
import type { FormValues } from './firstEnergyFormSchema';

export type BusinessNameHit = { abn: string; name: string; state?: string; postcode?: string };

export type FirstEnergyWizardContextValue = {
  loadingLookups: boolean;
  saleTypes: Array<{ type: string }>;
  industryTypes: Array<{ id: number; label: string }>;
  titles: string[];
  identificationTypes: string[];
  values: FormValues;

  validatePromoCode: (code: string) => Promise<void>;
  promoChecking: boolean;
  promoMessage: string | null;

  businessNameHits: BusinessNameHit[];
  businessNameLoading: boolean;
  orgNameSuggestionsOpen: boolean;
  setOrgNameSuggestionsOpen: (open: boolean) => void;
  organisationTypeDescription: string;
  selectBusinessNameHit: (hit: BusinessNameHit) => void;
  runAbnValidationAndEnrichment: (abn: string) => Promise<void>;
  abnChecking: boolean;
  abnValidated: boolean;
  validateAcn: (acn: string) => Promise<void>;
  acnChecking: boolean;
  acnValidated: boolean;
  abnMessage: string | null;
  acnMessage: string | null;

  addressSearching: boolean;
  suggestionOptions: Array<{ id: string; label: string }>;
  handlePickAddress: (id: string) => Promise<void>;
  suburbOptions: string[];
  postcodeLoading: boolean;
  concessionOptions: Array<{ id: string; label: string }>;
  concessionLoading: boolean;

  identifierLookupLoading: boolean;
  identifierLookupMessage: string | null;
  identifierOptions: string[];

  pricingLoading: boolean;
  pricingMessage: string | null;
  offers: Array<{ id: number; featured?: boolean; description?: string; summary?: string; fuels?: Array<{ fuel_id: number; fuel_description?: string; description?: string; summary?: string }> }>;

  feedInTypesLoading: boolean;
  feedInTypesMessage: string | null;
  feedInTypes: Array<{ id: number; description?: string; state_id?: number }>;

  moveInDateOptions: string[];

  buildAccountPayload: (v: FormValues) => Record<string, unknown>;
  handlePreview: () => void;
};

const Ctx = createContext<FirstEnergyWizardContextValue | null>(null);

export function FirstEnergyWizardProvider({ value, children }: { value: FirstEnergyWizardContextValue; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFirstEnergyWizard(): FirstEnergyWizardContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFirstEnergyWizard must be used within FirstEnergyWizardProvider');
  return v;
}
