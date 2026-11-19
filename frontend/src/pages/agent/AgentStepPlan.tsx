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
  type NetworkTariffOption,
  type OffersResponse,
  type RateCardVersion,
} from '../../lib/offersApi';
import { toSnapshot, type SelectedPlanSnapshot } from '../../lib/agentSalesApi';
import type { TransactionPayload } from '../../lib/types';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const selectClass = `${inputClass} bg-white`;

const PRICE_VIEWS: PriceView[] = ['Monthly', 'Quarterly', 'Annually'];

/** Gas networks repeat across zones, so the select is keyed on both. */
function networkKeyOf(name: string, zone: string | null | undefined): string {
  return zone ? `${name}::${zone}` : name;
}

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
  const [tariffKey, setTariffKey] = useState('');
  const [hasEV, setHasEV] = useState(false);
  const [view, setView] = useState<PriceView>('Monthly');

  const [networkOptions, setNetworkOptions] = useState<NetworkOption[]>([]);
  const [networkName, setNetworkName] = useState('');
  const [networkZone, setNetworkZone] = useState<string | null>(null);
  const [resolvingNetwork, setResolvingNetwork] = useState(false);
  const [result, setResult] = useState<OffersResponse | null>(null);
  const [tariffOptions, setTariffOptions] = useState<NetworkTariffOption[]>([]);
  const [version, setVersion] = useState<RateCardVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    offersApi.version().then(setVersion).catch(() => setVersion(null));
  }, [offersApi]);

  /*
   * Resolve the network as soon as there is enough to go on, rather than waiting for a
   * search. The tariff list depends on the network, so deferring this left the tariff
   * field empty until after the first "Find plans" -- by which point the agent had
   * already searched without it.
   */
  useEffect(() => {
    const hasPostcode = postcode.length === 4;
    const hasConnection = connectionId.length >= 2;
    if (!hasPostcode && !hasConnection) {
      setNetworkOptions([]);
      setNetworkName('');
      setNetworkZone(null);
      return;
    }

    let cancelled = false;
    setResolvingNetwork(true);
    const t = setTimeout(() => {
      offersApi
        .networks({
          energyType,
          ...(hasPostcode ? { postcode } : {}),
          ...(hasConnection ? { connectionId } : {}),
        })
        .then((res) => {
          if (cancelled) return;
          // A NMI pins the network exactly; a postcode may offer several.
          const fromNmi = res.fromConnectionId
            ? [{ networkName: res.fromConnectionId.networkName, networkZone: null, isDefault: true }]
            : [];
          const opts = fromNmi.length ? fromNmi : res.networks;
          setNetworkOptions(opts);

          // Fall back to the first option rather than leaving the select empty. Gas
          // postcodes carry no default flag, so an ambiguous one would otherwise resolve
          // to nothing and the search would 409 asking for a network the agent can see
          // perfectly well in the dropdown.
          const current = opts.find((n) => n.networkName === networkName);
          const pick = current ?? opts.find((n) => n.isDefault) ?? opts[0] ?? null;
          setNetworkName(pick?.networkName ?? '');
          setNetworkZone(pick?.networkZone ?? null);
        })
        .catch(() => {
          if (!cancelled) setNetworkOptions([]);
        })
        .finally(() => {
          if (!cancelled) setResolvingNetwork(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // networkName is deliberately excluded: it is an output of this effect, not an input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [energyType, postcode, connectionId, offersApi]);

  /*
   * Tariffs follow the network. Gas has no tariff field -- its retail tariff comes from
   * the network zone, which the network picker already sets.
   */
  useEffect(() => {
    if (energyType === 'GAS' || !networkName) {
      setTariffOptions([]);
      return;
    }
    let cancelled = false;
    offersApi
      .networkTariffs({ energyType, networkName, customerType })
      .then((opts) => !cancelled && setTariffOptions(opts))
      .catch(() => !cancelled && setTariffOptions([]));
    return () => {
      cancelled = true;
    };
  }, [energyType, networkName, customerType, offersApi]);

  const search = useCallback(async () => {
    if (!postcode && !connectionId && !networkName) {
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
        ...(networkName ? { networkName } : {}),
        ...(networkZone ? { networkZone } : {}),
        ...(tariffKey ? { tariffCombinationKey: tariffKey } : {}),
        hasEV,
      });
      setResult(res);
    } catch (err: unknown) {
      if (err instanceof NetworkSelectionRequiredError) {
        setNetworkOptions(err.networks);
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
  }, [energyType, customerType, postcode, connectionId, networkName, networkZone, tariffKey, hasEV, offersApi]);

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
                setTariffOptions([]);
                setTariffKey('');
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
                setTariffOptions([]);
                setTariffKey('');
              }}
              className={selectClass}
            >
              <option value="RESIDENTIAL">Residential</option>
              <option value="COMMERCIAL">Business</option>
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
          <FormField label="NMI / MIRN" hint="Optional — resolves the network exactly">
            <input
              value={connectionId}
              onChange={(e) => {
                const v = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
                setConnectionId(v);
                // Same value the Service step asks for, so fill it in now rather than
                // making the agent type the NMI twice.
                setValue('service.serviceConnectionId', v, { shouldValidate: false });
              }}
              placeholder="63051234567"
              className={inputClass}
            />
          </FormField>
          <FormField
            label="Network"
            hint={
              resolvingNetwork
                ? 'Resolving…'
                : networkOptions.length > 1
                  ? `${networkOptions.length} serve this postcode — pick the right one`
                  : networkOptions.length === 1
                    ? 'Resolved from the postcode'
                    : 'Enter a postcode or NMI first'
            }
          >
            <select
              value={networkKeyOf(networkName, networkZone)}
              onChange={(e) => {
                const hit = networkOptions.find(
                  (n) => networkKeyOf(n.networkName, n.networkZone) === e.target.value
                );
                setNetworkName(hit?.networkName ?? '');
                setNetworkZone(hit?.networkZone ?? null);
                setResult(null);
              }}
              disabled={!networkOptions.length}
              className={`${selectClass} disabled:bg-gray-100 disabled:text-gray-400`}
            >
              {!networkOptions.length && <option value="">—</option>}
              {networkOptions.map((n) => (
                <option
                  key={networkKeyOf(n.networkName, n.networkZone)}
                  value={networkKeyOf(n.networkName, n.networkZone)}
                >
                  {n.networkName}
                  {n.networkZone ? ` · ${n.networkZone}` : ''}
                </option>
              ))}
            </select>
          </FormField>

          {/*
            Electricity only. Gas resolves its retail tariff from the network zone, which
            the network picker above already sets, so there is nothing for the agent to
            enter and an empty box would just look broken.
          */}
          {energyType === 'ELECTRICITY' && (
            <FormField
              label="Network tariff"
              hint={
                tariffOptions.length
                  ? `From the customer's bill — ${tariffOptions.length} on this network. Type to filter.`
                  : networkName
                    ? 'No tariffs for this network and customer type'
                    : 'Pick a network first'
              }
            >
              <input
                value={tariffKey}
                onChange={(e) => setTariffKey(e.target.value.toUpperCase().trim())}
                placeholder={tariffOptions.length ? 'Start typing, e.g. C1R' : 'e.g. EA010'}
                list="network-tariff-options"
                disabled={!tariffOptions.length}
                className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-400`}
              />
              {/* Datalist rather than a select: some networks carry 170+ tariffs. */}
              <datalist id="network-tariff-options">
                {tariffOptions.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.retailTariffCode}
                    {t.solarApplicable ? ' · solar' : ''}
                  </option>
                ))}
              </datalist>
            </FormField>
          )}

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

      {error && (
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
