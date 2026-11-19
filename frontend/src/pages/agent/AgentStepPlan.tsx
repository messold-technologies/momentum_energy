import { useCallback, useEffect, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { AlertTriangle, Info, Loader2, Search, Zap } from 'lucide-react';
import moment from 'moment-timezone';

import FormField from '../../components/ui/FormField';
import PlanCard, { type PriceView } from '../../components/plan/PlanCard';
import {
  offersApi as defaultOffersApi,
  NetworkSelectionRequiredError,
  type OffersApi,
  type EnergyType,
  type NetworkOption,
  type OfferCard,
  type OfferCustomerType,
  type OffersResponse,
  type RateCardVersion,
} from '../../lib/offersApi';
import { toSnapshot, type SelectedPlanSnapshot } from '../../lib/agentSalesApi';
import type { TransactionPayload } from '../../lib/types';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const selectClass = `${inputClass} bg-white`;

const PRICE_VIEWS: PriceView[] = ['Monthly', 'Quarterly', 'Annually'];

/** Momentum's serviceType enum calls electricity POWER. */
const SERVICE_TYPE: Record<EnergyType, 'POWER' | 'GAS'> = { ELECTRICITY: 'POWER', GAS: 'GAS' };

/** Electricity supports Monthly/Quarterly; gas only Bi-Monthly. */
const BILL_CYCLES: Record<EnergyType, string[]> = {
  ELECTRICITY: ['Monthly', 'Quarterly'],
  GAS: ['Bi-Monthly'],
};

const CONTRACT_TERM_FROM_PLAN: Record<string, 'OPEN' | '12MTH' | '24MTH' | '36MTH'> = {
  open: 'OPEN',
  'open term': 'OPEN',
  '12 months': '12MTH',
  '24 months': '24MTH',
  '36 months': '36MTH',
};

interface Props {
  selectedPlan: SelectedPlanSnapshot | null;
  onSelectPlan: (plan: SelectedPlanSnapshot) => void;
  /** Lets the passphrase-gated agent portal use its own scoped client. */
  offers?: OffersApi;
  /** The portal hides its own heading, since the page already has one. */
  showHeading?: boolean;
}

export default function AgentStepPlan({
  selectedPlan,
  onSelectPlan,
  offers: offersApi = defaultOffersApi,
  showHeading = true,
}: Props) {
  const { control, setValue } = useFormContext<TransactionPayload>();

  const serviceType = useWatch({ control, name: 'service.serviceType' });

  const [energyType, setEnergyType] = useState<EnergyType>(
    serviceType === 'GAS' ? 'GAS' : 'ELECTRICITY'
  );
  const [customerType, setCustomerType] = useState<OfferCustomerType>('RESIDENTIAL');
  const [postcode, setPostcode] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [hasEV, setHasEV] = useState(false);
  const [view, setView] = useState<PriceView>('Monthly');

  const [networkChoices, setNetworkChoices] = useState<NetworkOption[]>([]);
  const [networkName, setNetworkName] = useState('');
  const [result, setResult] = useState<OffersResponse | null>(null);
  const [version, setVersion] = useState<RateCardVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    offersApi.version().then(setVersion).catch(() => setVersion(null));
  }, [offersApi]);

  const search = useCallback(
    async (overrides?: { networkName?: string }) => {
      const chosenNetwork = overrides?.networkName ?? networkName;
      if (!postcode && !connectionId && !chosenNetwork) {
        setError('Enter a postcode, or the NMI/MIRN, to see plans.');
        return;
      }
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const res = await offersApi.list({
          energyType,
          customerType,
          ...(postcode ? { postcode } : {}),
          ...(connectionId ? { connectionId } : {}),
          ...(chosenNetwork ? { networkName: chosenNetwork } : {}),
          hasEV,
        });
        setResult(res);
        setNetworkChoices([]);
        if (!overrides?.networkName) setNetworkName(res.resolved.networkName);
      } catch (err: unknown) {
        if (err instanceof NetworkSelectionRequiredError) {
          setNetworkChoices(err.networks);
          setError(err.message);
        } else {
          setError(
            (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
              'Could not load plans.'
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [energyType, customerType, postcode, connectionId, hasEV, networkName, offersApi]
  );

  function handleSelect(offer: OfferCard) {
    const quotedAt = moment().tz('Australia/Sydney');

    // The offer code is derived from the selected card, never typed, so the price the
    // customer agrees to and the code submitted to Momentum come from one rate card row.
    setValue('service.serviceType', SERVICE_TYPE[offer.energyType], { shouldValidate: true });
    setValue('service.serviceBilling.serviceOfferCode', offer.offerCode, { shouldValidate: true });
    setValue('service.serviceBilling.servicePlanCode', offer.planCode, { shouldValidate: true });

    // Stamped when the agent quotes, not typed: this is what the 14-day
    // OFFER:QUOTEDATE_INVALID rule measures.
    setValue('service.serviceBilling.offerQuoteDate', quotedAt.format('YYYY-MM-DD'), {
      shouldValidate: true,
    });

    const term = CONTRACT_TERM_FROM_PLAN[(offer.plan.contractTerm ?? '').trim().toLowerCase()];
    if (term) setValue('service.serviceBilling.contractTermCode', term, { shouldValidate: true });

    setValue('service.serviceBilling.billCycleCode', BILL_CYCLES[offer.energyType][0], {
      shouldValidate: true,
    });
    setValue('service.serviceBilling.billDeliveryMethod', 'EMAIL', { shouldValidate: true });

    if (postcode) setValue('service.servicedAddress.postCode', postcode);
    setValue('customer.customerType', offer.customerType === 'COMMERCIAL' ? 'COMPANY' : 'RESIDENT');
    setValue('customer.customerSubType', offer.customerType === 'COMMERCIAL' ? 'SME' : 'RESIDENT');

    onSelectPlan(
      toSnapshot(offer, {
        rateCardVersion: version?.label,
        indicativeOnly: result?.indicativeOnly ?? false,
      })
    );
  }

  return (
    <div className="space-y-6">
      {showHeading && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Choose a plan</h2>
          <p className="text-sm text-gray-500 mt-1">
            Find the customer's plan first. The offer code is set from the plan you select.
          </p>
        </div>
      )}

      {/* ---------------------------------------------------------------- search */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 lg:p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <FormField label="Service postcode" hint="4 digits, e.g. 3000">
              <input
                value={postcode}
                onChange={(e) => setPostcode(e.target.value.replaceAll(/\D/g, '').slice(0, 4))}
                placeholder="3000"
                inputMode="numeric"
                className={inputClass}
              />
            </FormField>
          </div>
          <FormField label="Energy type">
            <select
              value={energyType}
              onChange={(e) => {
                setEnergyType(e.target.value as EnergyType);
                setResult(null);
                setNetworkName('');
              }}
              className={selectClass}
            >
              <option value="ELECTRICITY">Electricity</option>
              <option value="GAS">Gas</option>
            </select>
          </FormField>
          <FormField label="Customer type">
            <select
              value={customerType}
              onChange={(e) => {
                setCustomerType(e.target.value as OfferCustomerType);
                setResult(null);
              }}
              className={selectClass}
            >
              <option value="RESIDENTIAL">Residential</option>
              <option value="COMMERCIAL">Business</option>
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <FormField label="NMI / MIRN" hint="Optional — resolves the network exactly">
            <input
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value.toUpperCase())}
              placeholder="63051234567"
              className={inputClass}
            />
          </FormField>

          <FormField label="Has EV">
            <label className="flex h-10.5 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={hasEV}
                onChange={(e) => setHasEV(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <Zap className="w-4 h-4 text-gray-400" />
              <span>Has an electric vehicle</span>
            </label>
          </FormField>

          <FormField label="View">
            <select
              value={view}
              onChange={(e) => setView(e.target.value as PriceView)}
              className={selectClass}
            >
              {PRICE_VIEWS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="flex flex-wrap items-end gap-4 mt-4">

          <button
            type="button"
            onClick={() => void search()}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Find plans
          </button>
        </div>

      </div>

      {/* ------------------------------------------------- network disambiguation */}
      {networkChoices.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="w-4 h-4" />
            This postcode is served by more than one network. Choose the one for this site.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {networkChoices.map((n) => (
              <button
                key={`${n.networkName}-${n.networkZone ?? ''}`}
                type="button"
                onClick={() => {
                  setNetworkName(n.networkName);
                  setError(null);
                  void search({ networkName: n.networkName });
                }}
                className="px-3 py-1.5 text-sm font-medium text-amber-900 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 cursor-pointer"
              >
                {n.networkName}
                {n.networkZone ? ` · ${n.networkZone}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && networkChoices.length === 0 && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------- plan cards */}
      {result && (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <p className="text-sm text-gray-600">
              Prices below are for the{' '}
              <span className="font-medium text-gray-900">{result.resolved.networkName}</span> network
              {result.resolved.networkZone ? ` (${result.resolved.networkZone})` : ''}
              {postcode ? ` for postcode ${postcode}` : ''}.
            </p>
            <p className="text-sm text-gray-500">{result.count} plans</p>
          </div>

          {result.indicativeOnly && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                These are flat-rate estimates, on the same basis Momentum's own site quotes on.
              </span>
            </div>
          )}

          {result.count === 0 ? (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              No plans available for this combination.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {result.offers.map((offer, idx) => (
                <PlanCard
                  key={offer.offerCode}
                  // a short stagger so the grid cascades instead of appearing at once
                  style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                  offer={offer}
                  view={view}
                  selected={selectedPlan?.offerCode === offer.offerCode}
                  onSelect={handleSelect}
                  indicative={result.indicativeOnly}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------- selected */}
      {selectedPlan && (
        <div className="rounded-xl border border-primary-200 bg-primary-50 p-5">
          <p className="text-sm font-semibold text-primary-900">Selected plan</p>
          <dl className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Plan</dt>
              <dd className="font-medium text-gray-900">{selectedPlan.planCode}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Price quoted</dt>
              <dd className="font-medium text-gray-900">
                {selectedPlan.monthlyCost != null ? `$${selectedPlan.monthlyCost}/mth` : 'Rates only'}
                {selectedPlan.comparisonLabel
                  ? ` · ${selectedPlan.comparisonLabel} ${selectedPlan.benchmarkName}`
                  : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Network / tariff</dt>
              <dd className="font-medium text-gray-900">
                {selectedPlan.networkName} · {selectedPlan.retailTariffCode}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Quoted</dt>
              <dd className="font-medium text-gray-900">
                {new Date(selectedPlan.quotedAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
          {selectedPlan.indicativeOnly && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
              Quoted on flat-rate pricing. Confirm the network tariff.
            </p>
          )}
        </div>
      )}

    </div>
  );
}
