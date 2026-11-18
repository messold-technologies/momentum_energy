import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Check, ExternalLink, Loader2 } from 'lucide-react';

import { consentApi, type ConsentSummary } from '../lib/agentSalesApi';

/**
 * Public page the customer opens from their consent link. No sign-in, and it is served
 * a deliberately narrow projection of the sale: enough to recognise and verify, with no
 * date of birth, identity document numbers or full bank details.
 */
export default function ConsentPage() {
  const { token } = useParams();

  const [summary, setSummary] = useState<ConsentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    consentApi
      .get(token)
      .then(setSummary)
      .catch((err) => {
        const msg =
          (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
          'We could not open this link.';
        setLoadError(msg);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit() {
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await consentApi.submit(token, ticks, name.trim());
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
  const allRequiredTicked = required.every((i) => ticks[i.key] === true);
  const canSubmit = allRequiredTicked && name.trim().length >= 2 && !submitting;

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading...
        </div>
      </Shell>
    );
  }

  if (loadError || !summary) {
    return (
      <Shell>
        <div className="py-10 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
          <h1 className="mt-4 text-lg font-semibold text-gray-900">Link unavailable</h1>
          <p className="mt-2 text-sm text-gray-600">{loadError}</p>
        </div>
      </Shell>
    );
  }

  if (done || summary.alreadyConsentedAt) {
    return (
      <Shell>
        <div className="py-10 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-green-100 flex items-center justify-center">
            <Check className="w-6 h-6 text-green-700" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-gray-900">Thank you</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your consent has been recorded. We will be in touch about your {summary.service.energyType.toLowerCase()}{' '}
            connection.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-semibold text-gray-900">
        {summary.customer.firstName ? `Hi ${summary.customer.firstName},` : 'Hello,'}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Please check the details below and confirm you would like to go ahead.
      </p>

      {/* ------------------------------------------------------------------ plan */}
      <section className="mt-6 rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-primary-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
            Your {summary.service.energyType.toLowerCase()} plan
          </p>
          <p className="mt-1 text-lg font-bold text-gray-900">{summary.plan.planCode ?? '—'}</p>
          {summary.plan.monthlyCost != null && (
            <p className="mt-1 text-2xl font-bold text-gray-900">
              ${summary.plan.monthlyCost}
              <span className="text-base font-medium text-gray-500">/month</span>
            </p>
          )}
          {summary.plan.comparisonLabel && (
            <p className="mt-1 text-sm text-gray-700">
              <span className="font-semibold">{summary.plan.comparisonLabel}</span>{' '}
              {summary.plan.benchmarkName}
            </p>
          )}
          {summary.plan.annualCost != null && (
            <p className="mt-1 text-xs text-gray-500">
              GST included. Estimated ${summary.plan.annualCost} per year based on average usage in
              the {summary.plan.networkName} network. Your actual bill depends on how much energy you use.
            </p>
          )}
          {summary.plan.indicativeOnly && (
            <p className="mt-2 text-xs text-gray-600">
              This is an estimate based on a standard tariff. Your final rates are confirmed on your
              welcome pack.
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
              value={`${summary.directDebit.accountNameInitial ?? ''} ${summary.directDebit.accountNumberMasked ?? ''}`.trim()}
            />
          )}
        </dl>

        {summary.plan.factSheetUrl && (
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
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
      </section>

      {/* -------------------------------------------------------------- your details */}
      <section className="mt-5 rounded-xl border border-gray-200 overflow-hidden">
        <p className="bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Your details
        </p>
        <dl className="divide-y divide-gray-100 text-sm">
          <Row
            label="Name"
            value={[summary.customer.firstName, summary.customer.lastName].filter(Boolean).join(' ')}
          />
          <Row label="Email" value={summary.customer.email} />
          <Row label="Phone" value={summary.customer.phone} />
          <Row label="Postal address" value={summary.customer.postalAddress} />
        </dl>
        <p className="px-5 py-3 text-xs text-gray-500 bg-gray-50 border-t border-gray-100">
          If anything above is wrong, please contact the person who sent you this link before
          confirming.
        </p>
      </section>

      {/* ---------------------------------------------------------------- consent */}
      <section className="mt-5">
        <p className="text-sm font-semibold text-gray-900">Please confirm</p>
        <div className="mt-3 space-y-3">
          {summary.consentItems.map((item) => (
            <label
              key={item.key}
              className="flex items-start gap-3 rounded-lg border border-gray-200 p-4 cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={ticks[item.key] === true}
                onChange={(e) => setTicks((t) => ({ ...t, [item.key]: e.target.checked }))}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">
                  {item.label}
                  {item.required && <span className="text-red-500"> *</span>}
                </span>
                <span className="block mt-0.5 text-xs text-gray-600">{item.description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-4">
          <label htmlFor="confirmName" className="block text-sm font-medium text-gray-900">
            Type your full name to confirm <span className="text-red-500">*</span>
          </label>
          <input
            id="confirmName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="mt-1.5 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {submitError && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
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

        <p className="mt-3 text-center text-xs text-gray-500">
          By confirming you agree to the items ticked above. We record the date, time and your
          confirmation as evidence of your consent.
        </p>
      </section>
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 px-5 py-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:p-8">{children}</div>
        <p className="mt-4 text-center text-xs text-gray-400">
          Secure confirmation page. This link is valid for a limited time and can be used once.
        </p>
      </div>
    </div>
  );
}
