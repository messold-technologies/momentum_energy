import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Check, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';

import { consentApi, type ConsentSummary } from '../lib/agentSalesApi';

/**
 * Public page the customer opens from their consent link. No sign-in, and it is served
 * a deliberately narrow projection of the sale: enough to recognise and verify, with no
 * date of birth, identity document numbers or full bank details.
 *
 * Layout: a single column on a phone, where the customer scrolls plan -> details ->
 * confirm. From lg it becomes two columns -- what they are signing up to on the left,
 * what they need to check and tick on the right -- so the whole thing is visible at once
 * on a desktop rather than buried below a tall plan card.
 */
export default function ConsentPage() {
  const { token } = useParams();

  const [summary, setSummary] = useState<ConsentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    consentApi
      .get(token)
      .then(setSummary)
      .catch((err) => {
        setLoadError(
          (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
            'We could not open this link.'
        );
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit() {
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await consentApi.submit(token, ticks);
      setDone(true);
    } catch (err) {
      setSubmitError(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
          'We could not record your consent. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const required = summary?.consentItems.filter((i) => i.required) ?? [];
  const canSubmit = required.every((i) => ticks[i.key] === true) && !submitting;

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading...
        </div>
      </Shell>
    );
  }

  if (loadError || !summary) {
    return (
      <Shell narrow>
        <div className="py-12 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
          <h1 className="mt-4 text-lg font-semibold text-gray-900">Link unavailable</h1>
          <p className="mt-2 text-sm text-gray-600">{loadError}</p>
        </div>
      </Shell>
    );
  }

  if (done || summary.alreadyConsentedAt) {
    return (
      <Shell narrow>
        <div className="py-12 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-green-100 flex items-center justify-center">
            <Check className="w-6 h-6 text-green-700" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-gray-900">Thank you</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your consent has been recorded. We will be in touch about your{' '}
            {summary.service.energyType.toLowerCase()} connection.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="mb-6 lg:mb-8">
        <h1 className="text-xl lg:text-2xl font-semibold text-gray-900">
          {summary.customer.firstName ? `Hi ${summary.customer.firstName},` : 'Hello,'}
        </h1>
        <p className="mt-1 text-sm lg:text-base text-gray-600">
          Please check the details below and confirm you would like to go ahead.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 lg:gap-6 items-start">
        {/* ------------------------------------------------- what they are signing up to */}
        <section className="lg:col-span-3 rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="bg-primary-50 px-5 lg:px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
              Your {summary.service.energyType.toLowerCase()} plan
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="text-xl lg:text-2xl font-bold text-gray-900">
                {summary.plan.planCode ?? '—'}
              </p>
              {summary.plan.monthlyCost != null && (
                <p className="text-2xl lg:text-3xl font-bold text-gray-900">
                  ${summary.plan.monthlyCost}
                  <span className="text-base font-medium text-gray-500">/month</span>
                </p>
              )}
            </div>
            {summary.plan.comparisonLabel && (
              <p className="mt-1 text-sm text-gray-700">
                <span className="font-semibold">{summary.plan.comparisonLabel}</span>{' '}
                {summary.plan.benchmarkName}
              </p>
            )}
            {summary.plan.annualCost != null && (
              <p className="mt-2 text-xs text-gray-500">
                GST included. Estimated ${summary.plan.annualCost} per year based on average
                usage in the {summary.plan.networkName} network. Your actual bill depends on how
                much energy you use.
              </p>
            )}
            {summary.plan.indicativeOnly && (
              <p className="mt-2 text-xs text-gray-600">
                This is an estimate based on a standard tariff. Your final rates are confirmed on
                your welcome pack.
              </p>
            )}
          </div>

          <dl className="divide-y divide-gray-100 text-sm">
            <Row label="Service address" value={summary.service.address} />
            <Row label="Contract" value={summary.plan.contractTerm} />
            <Row label="Billing cycle" value={summary.plan.billCycle} />
            <Row label="Bills sent by" value={summary.plan.billDelivery} />
            <Row label="Payment method" value={summary.plan.paymentMethod} />
            {summary.directDebit && (
              <Row
                label="Direct debit account"
                value={`${summary.directDebit.accountNameInitial ?? ''} ${
                  summary.directDebit.accountNumberMasked ?? ''
                }`.trim()}
              />
            )}
          </dl>

          {summary.plan.factSheetUrl && (
            <div className="px-5 lg:px-6 py-3 bg-gray-50 border-t border-gray-100">
              <a
                href={summary.plan.factSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline"
              >
                Read the energy fact sheet for this plan
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          <div className="px-5 lg:px-6 py-4 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Your details
            </p>
            <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 text-sm">
              <InlineRow
                label="Name"
                value={[summary.customer.firstName, summary.customer.lastName]
                  .filter(Boolean)
                  .join(' ')}
              />
              <InlineRow label="Email" value={summary.customer.email} />
              <InlineRow label="Phone" value={summary.customer.phone} />
              <InlineRow label="Postal address" value={summary.customer.postalAddress} />
            </dl>
            <p className="mt-3 text-xs text-gray-500">
              If anything above is wrong, please contact the person who sent you this link before
              confirming.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------------ confirm */}
        <section className="lg:col-span-2 lg:sticky lg:top-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 lg:p-6">
            <h2 className="text-sm font-semibold text-gray-900">Please confirm</h2>

            <div className="mt-4 space-y-3">
              {summary.consentItems.map((item) => {
                const checked = ticks[item.key] === true;
                return (
                  <label
                    key={item.key}
                    className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                      checked
                        ? 'border-primary-300 bg-primary-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setTicks((t) => ({ ...t, [item.key]: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">
                        {item.label}
                        {item.required && <span className="text-red-500"> *</span>}
                      </span>
                      <span className="block mt-0.5 text-xs text-gray-600">{item.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            {submitError && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {submitError}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              className="mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirm and continue
            </button>

            <p className="mt-3 flex items-start gap-1.5 text-xs text-gray-500">
              <ShieldCheck className="w-3.5 h-3.5 mt-px shrink-0 text-gray-400" />
              By confirming you agree to the items ticked above. We record the date and time as
              evidence of your consent.
            </p>
          </div>
        </section>
      </div>
    </Shell>
  );
}

/** Stacked label/value, for the detail list. */
function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 px-5 lg:px-6 py-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{value}</dd>
    </div>
  );
}

/** Two-up on wider screens, so "your details" does not run to a tall list. */
function InlineRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="py-1.5">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900 break-words">{value}</dd>
    </div>
  );
}

function Shell({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="min-h-screen bg-gray-50 py-6 lg:py-10 px-4 lg:px-6">
      <div className={narrow ? 'max-w-md mx-auto' : 'max-w-5xl mx-auto'}>
        {narrow ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:p-8">{children}</div>
        ) : (
          children
        )}
        <p className="mt-5 text-center text-xs text-gray-400">
          Secure confirmation page. This link can be used once.
        </p>
      </div>
    </div>
  );
}
