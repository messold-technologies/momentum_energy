import { Check, ExternalLink, Info } from 'lucide-react';
import type { OfferCard } from '../../lib/offersApi';

export type PriceView = 'Monthly' | 'Quarterly' | 'Annually';

const DIVISOR: Record<PriceView, number> = { Monthly: 12, Quarterly: 4, Annually: 1 };
const SUFFIX: Record<PriceView, string> = {
  Monthly: '/month',
  Quarterly: '/quarter',
  Annually: '/year',
};

/** Colour accent per plan, loosely mirroring Momentum's own plan cards. */
const ACCENT: Record<string, { band: string; body: string; text: string }> = {
  'Warm Welcome': { band: 'bg-sky-200', body: 'bg-sky-50', text: 'text-sky-900' },
  'Warm Welcome Gas': { band: 'bg-sky-200', body: 'bg-sky-50', text: 'text-sky-900' },
  'Bill Boss Electricity': { band: 'bg-indigo-200', body: 'bg-indigo-50', text: 'text-indigo-900' },
  'Suit Yourself Electricity': { band: 'bg-amber-200', body: 'bg-amber-50', text: 'text-amber-900' },
  'Suit Yourself Gas': { band: 'bg-amber-200', body: 'bg-amber-50', text: 'text-amber-900' },
  'EV Does It': { band: 'bg-emerald-200', body: 'bg-emerald-50', text: 'text-emerald-900' },
  'Strictly Business': { band: 'bg-slate-200', body: 'bg-slate-50', text: 'text-slate-900' },
};
const DEFAULT_ACCENT = { band: 'bg-gray-200', body: 'bg-gray-50', text: 'text-gray-900' };

function formatPrice(annual: number, view: PriceView): string {
  return (annual / DIVISOR[view]).toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  });
}

function rateLine(label: string, blocks?: Array<{ rate?: number }>): string | null {
  const rate = blocks?.[0]?.rate;
  return rate === undefined || rate === null ? null : `${label} ${rate}c`;
}

interface Props {
  offer: OfferCard;
  view: PriceView;
  selected: boolean;
  onSelect: (offer: OfferCard) => void;
  /** Prices are flat-rate benchmark figures because the site's network tariff is unknown. */
  indicative?: boolean;
}

export default function PlanCard({ offer, view, selected, onSelect, indicative }: Props) {
  const accent = ACCENT[offer.planCode] ?? DEFAULT_ACCENT;
  const { pricing, plan } = offer;
  const hasPrice = pricing.annualCost !== null;

  const rateSummary = [
    rateLine('Peak', pricing.rates?.peak),
    rateLine('Shoulder', pricing.rates?.shoulder),
    rateLine('Off-peak', pricing.rates?.offpeak),
  ].filter(Boolean) as string[];

  return (
    <div
      className={`flex flex-col rounded-xl border overflow-hidden transition-shadow ${
        selected ? 'border-primary-600 ring-2 ring-primary-600 shadow-md' : 'border-gray-200 hover:shadow-sm'
      }`}
    >
      {/* Eligibility / promo band */}
      <div className={`${accent.band} ${accent.text} px-4 py-2 text-xs font-semibold text-center`}>
        {plan.customerEligibility ?? offer.tariffCategory ?? ' '}
      </div>

      <div className={`${accent.body} px-4 pt-5 pb-4 text-center`}>
        {/*
          No subtitle here. The Offers sheet's Feature_Heading_1 was used for this, but
          those are section headings for a marketing block ("Why choose Momentum?"), not
          plan taglines, so they read as nonsense under a plan name.
        */}
        <h3 className="text-lg font-bold text-gray-900">{offer.planCode}</h3>
      </div>

      <div className="flex-1 px-4 py-4 bg-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {offer.energyType === 'GAS' ? 'Gas' : 'Electricity'}
        </p>

        {hasPrice ? (
          <>
            {pricing.comparison.label && (
              <p className="mt-2 text-sm">
                <span className="font-semibold text-gray-900">{pricing.comparison.label}</span>{' '}
                <span className="text-gray-600">{pricing.benchmark.name}</span>
              </p>
            )}
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {formatPrice(pricing.annualCost as number, view)}
              <span className="text-base font-medium text-gray-500">{SUFFIX[view]}</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              GST incl. Estimated {pricing.benchmark.tariffType ? `for a ${pricing.benchmark.tariffType.toLowerCase()}` : 'price'}
              {pricing.benchmark.kwh ? ` using ${pricing.benchmark.kwh.toLocaleString()}kWh per year` : ''} in the{' '}
              {offer.networkName} network.{' '}
              <span className="font-semibold text-gray-700">
                {formatPrice(pricing.annualCost as number, 'Annually')}/year
              </span>
            </p>
          </>
        ) : (
          /* Gas carries no Default Offer columns in the rate card, so no annual figure. */
          <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="flex items-start gap-1.5 text-xs text-amber-900">
              <Info className="w-3.5 h-3.5 mt-px shrink-0" />
              No estimated annual price published for gas. Quote from the rates below.
            </p>
          </div>
        )}

        <dl className="mt-3 space-y-1 text-xs text-gray-600">
          {pricing.dailyChargeCents !== null && (
            <div className="flex justify-between gap-2">
              <dt>Daily supply</dt>
              <dd className="font-medium text-gray-900">{pricing.dailyChargeCents}c/day</dd>
            </div>
          )}
          {rateSummary.length > 0 && (
            <div className="flex justify-between gap-2">
              <dt>Usage</dt>
              <dd className="font-medium text-gray-900 text-right">{rateSummary.join(' · ')}</dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt>Contract</dt>
            <dd className="font-medium text-gray-900">{plan.contractTerm ?? '—'}</dd>
          </div>
          {plan.terminationFee && (
            <div className="flex justify-between gap-2">
              <dt>Exit fee</dt>
              <dd className="font-medium text-gray-900">{plan.terminationFee}</dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt>Tariff</dt>
            <dd className="font-mono text-[11px] text-gray-700">{offer.retailTariffCode}</dd>
          </div>
        </dl>

        {indicative && (
          <p className="mt-3 rounded bg-gray-50 border border-gray-200 px-2 py-1.5 text-[11px] text-gray-600">
            Indicative: flat-rate pricing. Confirm the site's network tariff before submitting.
          </p>
        )}

        {offer.links.factSheetUrl && (
          <a
            href={offer.links.factSheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-primary-700 hover:underline"
          >
            Energy fact sheet
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="px-4 pb-4 bg-white">
        <button
          type="button"
          onClick={() => onSelect(offer)}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
            selected
              ? 'bg-primary-600 text-white hover:bg-primary-700'
              : 'bg-white text-primary-700 border border-primary-300 hover:bg-primary-50'
          }`}
        >
          {selected ? (
            <>
              <Check className="w-4 h-4" />
              Selected
            </>
          ) : (
            'Select plan'
          )}
        </button>
      </div>
    </div>
  );
}
