import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Check, ExternalLink, Loader2, Lock, ShieldCheck } from 'lucide-react';

import PlanCard from '../components/plan/PlanCard';
import {
  consentApi,
  type ConsentContact,
  type ConsentGate,
  type ConsentDocument,
  type ConsentSummary,
} from '../lib/agentSalesApi';
import type { OfferCard } from '../lib/offersApi';

/**
 * Public page the customer opens from their consent link. No sign-in, but not open
 * either: it shows everything the agent filled in, identity documents included, so the
 * link on its own is not enough. The customer first enters their postcode followed by
 * the day of their date of birth, and the server sends nothing about them until that is
 * right -- the details are never in the browser behind a hidden element.
 *
 * Layout: a single column on a phone, where the customer scrolls plan -> details ->
 * confirm. From lg it becomes two columns -- what they are signing up to on the left,
 * what they need to check and tick on the right -- so the whole thing is visible at once
 * on a desktop rather than buried below a tall plan card.
 */
export default function ConsentPage() {
  const { token } = useParams();

  const [summary, setSummary] = useState<ConsentSummary | null>(null);
  const [gate, setGate] = useState<ConsentGate | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Held for the whole session: the confirm call sends it again, because the server
  // re-checks it rather than trusting that /verify happened.
  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    consentApi
      .gate(token)
      .then((g) => {
        setGate(g);
        setLocked(g.locked);
      })
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
      await consentApi.submit(token, password, ticks);
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

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      setSummary(await consentApi.verify(token, password));
    } catch (err) {
      const res = (err as { response?: { status?: number; data?: { error?: string } } }).response;
      if (res?.status === 423) setLocked(true);
      setUnlockError(res?.data?.error ?? 'We could not open this link.');
    } finally {
      setUnlocking(false);
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

  if (loadError || !gate) {
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

  if (locked) {
    return (
      <Shell narrow>
        <div className="py-12 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto text-red-500" />
          <h1 className="mt-4 text-lg font-semibold text-gray-900">Link locked</h1>
          <p className="mt-2 text-sm text-gray-600">
            {unlockError ??
              'This link has been locked after too many incorrect attempts. Please contact the person who sent it to you for a new link.'}
          </p>
        </div>
      </Shell>
    );
  }

  // The sale has no date of birth or postcode, so no password can be formed. Say so
  // plainly instead of letting them try combinations that cannot work.
  if (!gate.passwordAvailable) {
    return (
      <Shell narrow>
        <div className="py-12 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
          <h1 className="mt-4 text-lg font-semibold text-gray-900">Link unavailable</h1>
          <p className="mt-2 text-sm text-gray-600">
            We cannot open this link. Please contact the person who sent it to you.
          </p>
        </div>
      </Shell>
    );
  }

  /* The details are not in the browser until this passes -- the server sends nothing
     about the customer until the password is right. */
  if (!summary) {
    return (
      <Shell narrow>
        <form onSubmit={handleUnlock} className="py-10 max-w-sm mx-auto">
          <div className="w-12 h-12 mx-auto rounded-full bg-primary-50 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary-700" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-gray-900 text-center">
            Confirm it is you
          </h1>
          <p className="mt-2 text-sm text-gray-600 text-center">
            To protect your details, enter your <strong>postcode</strong> followed by the{' '}
            <strong>day</strong> of your date of birth.
          </p>
          <p className="mt-3 text-xs text-gray-500 text-center">
            Postcode 3121, born on the 7th of any month → <span className="font-mono">312107</span>
          </p>

          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoFocus
            placeholder="######"
            aria-label="Postcode followed by the day of your date of birth"
            className="mt-5 w-full px-3 py-3 border border-gray-300 rounded-lg text-center text-lg font-mono tracking-[0.3em] focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />

          {unlockError && (
            <p role="alert" className="mt-3 text-sm text-red-700 text-center">
              {unlockError}
            </p>
          )}

          <button
            type="submit"
            disabled={password.length !== 6 || unlocking}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-40 cursor-pointer"
          >
            {unlocking && <Loader2 className="w-4 h-4 animate-spin" />}
            Continue
          </button>
        </form>
      </Shell>
    );
  }

  if (done || summary.alreadyConsentedAt) {
    return (
      <Shell narrow>
        <div className="py-10 lg:py-12">
          <div className="w-12 h-12 mx-auto rounded-full bg-green-100 flex items-center justify-center">
            <Check className="w-6 h-6 text-green-700" />
          </div>

          <h1 className="mt-5 text-lg lg:text-xl font-semibold text-gray-900 text-center">
            Thank you for choosing Momentum Energy!
          </h1>

          {/* Left aligned on purpose: centred paragraphs of this length are hard to read. */}
          <div className="mt-5 space-y-4 text-sm leading-relaxed text-gray-700">
            <p>
              Your digital sign-up has been successfully submitted with the assistance of
              Utility Hub.
            </p>
            <p>
              We appreciate your trust in our services. Momentum Energy will process your
              application and provide further confirmation regarding your new energy account.
            </p>
            <p>
              If you have any questions or require assistance, please feel free to contact
              Utility Hub, an authorised sales partner of Momentum Energy.
            </p>
            <p>
              Kind regards,
              <br />
              <span className="font-medium text-gray-900">Utility Hub Team</span>
            </p>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-200 space-y-2 text-sm">
            <p className="text-gray-700">
              <span className="text-gray-500">Phone: </span>
              <a href="tel:+61386267715" className="text-primary-700 hover:underline">
                (03) 8626 7715
              </a>
              <span className="text-gray-400"> | </span>
              <a href="tel:1800835328" className="text-primary-700 hover:underline">
                1800 835 328
              </a>
            </p>
            <p className="text-gray-700">
              <span className="text-gray-500">Email: </span>
              <a
                href="mailto:info@utilityhub.com.au"
                className="text-primary-700 hover:underline break-all"
              >
                info@utilityhub.com.au
              </a>
            </p>
            <p className="text-gray-700">
              <span className="text-gray-500">Website: </span>
              <a
                href="https://www.utilityhub.com.au"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary-700 hover:underline"
              >
                www.utilityhub.com.au
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </p>
          </div>
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
          <div className="px-5 lg:px-6 py-5 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700 mb-4">
              Your {summary.service.energyType.toLowerCase()} plan
            </p>
            <div className="max-w-md">
              <PlanCard
                offer={toConsentOffer(summary)}
                view="Monthly"
                selected={false}
                onSelect={() => {}}
                indicative={summary.plan.indicativeOnly}
                showAction={false}
                showIndicativeNote={false}
              />
            </div>
          </div>

          <dl className="divide-y divide-gray-100 text-sm">
            <Row label="Service address" value={summary.service.address} />
            <Row label="Service type" value={summary.service.serviceSubType} />
            <Row label="NMI / MIRN" value={summary.service.connectionId} />
            <Row label="Meter number" value={summary.service.meterId} />
            <Row label="Lot number" value={summary.service.lotNumber} />
            <Row label="Service start date" value={summary.service.startDate} />
            <Row
              label="Estimated annual usage"
              value={summary.service.estimatedAnnualKwhs != null ? `${summary.service.estimatedAnnualKwhs} kWh` : null}
            />
            <Row label="Access instructions" value={summary.service.accessInstructions} />
            <Row label="Safety instructions" value={summary.service.safetyInstructions} />
            <Row label="Network / tariff" value={[summary.plan.networkName, summary.plan.retailTariffCode].filter(Boolean).join(' · ') || null} />
            <Row label="Contract" value={summary.plan.contractTerm} />
            <Row label="Billing cycle" value={summary.plan.billCycle} />
            <Row label="Bills sent by" value={summary.plan.billDelivery} />
            <Row label="Payment method" value={summary.plan.paymentMethod} />
            <Row label="Quote date" value={summary.plan.quoteDate} />
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

          {/* Everything the agent captured, so the customer can check it before confirming. */}
          <Block title="Your details">
            <ContactGrid contact={summary.primaryContact} />
            <InlineRow label="Customer type" value={summary.customer.customerType} />
            <InlineRow label="Customer sub-type" value={summary.customer.customerSubType} />
            <InlineRow label="Contact preference" value={summary.customer.communicationPreference} />
          </Block>

          {summary.secondaryContact && (
            <Block title="Second contact">
              <ContactGrid contact={summary.secondaryContact} />
            </Block>
          )}

          {summary.company && (
            <Block title="Business details">
              <InlineRow label="Entity name" value={summary.company.entityName} />
              <InlineRow label="Trading name" value={summary.company.tradingName} />
              <InlineRow label="Trustee" value={summary.company.trusteeName} />
              <InlineRow label="Industry" value={summary.company.industry} />
              <InlineRow label="ABN" value={summary.company.abn} />
              <InlineRow label="ACN" value={summary.company.acn} />
            </Block>
          )}

          {(summary.identity.passport || summary.identity.drivingLicense || summary.identity.medicare) && (
            <Block title="Identity documents">
              <DocumentRows label="Passport" doc={summary.identity.passport} />
              <DocumentRows label="Driving licence" doc={summary.identity.drivingLicense} />
              <DocumentRows label="Medicare" doc={summary.identity.medicare} />
            </Block>
          )}

          {summary.concession && (
            <Block title="Concession card">
              <InlineRow label="Card type" value={summary.concession.cardType} />
              <InlineRow label="Card code" value={summary.concession.cardCode} />
              <InlineRow label="Card number" value={summary.concession.cardNumber} />
              <InlineRow label="Expiry" value={summary.concession.expiryDate} />
              <InlineRow label="Name on card" value={summary.concession.holderName} />
            </Block>
          )}

          {summary.directDebit && (
            <Block title="Direct debit account">
              <InlineRow label="Account name" value={summary.directDebit.accountName} />
              <InlineRow label="BSB" value={summary.directDebit.bsb} />
              <InlineRow label="Account number" value={summary.directDebit.accountNumber} />
            </Block>
          )}

          <p className="px-5 lg:px-6 py-4 text-xs text-gray-500 border-t border-gray-100">
            If anything above is wrong, please contact the person who sent you this link before
            confirming. A wrong document or account number will hold up your connection.
          </p>
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

/** A labelled group inside the left column. */
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 lg:px-6 py-4 border-t border-gray-100">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 text-sm">{children}</dl>
    </div>
  );
}

function ContactGrid({ contact }: { contact: ConsentContact | null }) {
  if (!contact) return null;
  return (
    <>
      <InlineRow
        label="Name"
        value={[contact.salutation, contact.firstName, contact.middleName, contact.lastName]
          .filter(Boolean)
          .join(' ')}
      />
      <InlineRow label="Date of birth" value={contact.dateOfBirth} />
      <InlineRow label="Country of birth" value={contact.countryOfBirth} />
      <InlineRow label="Email" value={contact.email} />
      {contact.phones.map((p, i) => (
        <InlineRow key={i} label={p.type ? `${p.type.toLowerCase()} phone` : 'Phone'} value={p.phone} />
      ))}
      {contact.addresses.map((a, i) => (
        <InlineRow key={i} label={a.type ? `${a.type.toLowerCase()} address` : 'Address'} value={a.address} />
      ))}
    </>
  );
}

function toConsentOffer(summary: ConsentSummary): OfferCard {
  return {
    offerCode: summary.plan.planCode ?? 'consent-plan',
    offerWithRateNumber: null,
    offerNumber: null,
    planCode: summary.plan.planCode ?? 'Selected plan',
    energyType: String(summary.service.energyType || '').toUpperCase() === 'GAS' ? 'GAS' : 'ELECTRICITY',
    state: '',
    networkName: summary.plan.networkName ?? '',
    networkZone: null,
    retailTariffCode: summary.plan.retailTariffCode ?? '',
    customerType: summary.customer.customerType === 'COMPANY' ? 'COMMERCIAL' : 'RESIDENTIAL',
    tariffCategory: summary.plan.tariffCategory,
    isFlatRate: summary.plan.indicativeOnly,
    effectiveStart: null,
    effectiveEnd: null,
    pricing: {
      currency: 'AUD',
      gstInclusive: true,
      dailyChargeCents: summary.plan.dailyChargeCents,
      rates: summary.plan.rates,
      annualCost: summary.plan.annualCost,
      monthlyCost: summary.plan.monthlyCost,
      basis: summary.plan.annualCost != null ? 'rate-card-benchmark' : 'unavailable',
      benchmark: {
        name: summary.plan.benchmarkName ?? '',
        tariffType: summary.plan.benchmarkTariffType,
        kwh: summary.plan.benchmarkKwh,
        cost: summary.plan.annualCost,
      },
      comparison: {
        differenceDollar: null,
        differencePercent: null,
        label: summary.plan.comparisonLabel,
      },
      usageEstimate: null,
    },
    plan: {
      features: summary.plan.featureHeading ? [{ heading: summary.plan.featureHeading, text: null }] : [],
      contractTerm: summary.plan.contractTerm,
      customerEligibility: summary.plan.customerEligibility,
      terminationFee: summary.plan.terminationFee,
      dishonouredPaymentFee: null,
      creditCardPaymentFee: null,
      billingOptions: null,
      paymentOptions: null,
      greenOptions: null,
      termsAndConditions: null,
      stateAvailability: [],
      extras: {},
    },
    links: {
      factSheetUrl: summary.plan.factSheetUrl,
      cdrPlanCode: null,
      cdrPlanId: null,
    },
  };
}

function DocumentRows({ label, doc }: { label: string; doc: ConsentDocument | null }) {
  if (!doc) return null;
  const extra = [doc.issuingState, doc.issuingCountry].filter(Boolean).join(', ');
  return (
    <>
      <InlineRow label={`${label} number`} value={doc.documentId} />
      {doc.documentNumber && <InlineRow label={`${label} card number`} value={doc.documentNumber} />}
      <InlineRow label={`${label} expiry`} value={doc.documentExpiryDate} />
      {extra && <InlineRow label={`${label} issued`} value={extra} />}
    </>
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
      <dd className="font-medium text-gray-900 wrap-break-word">{value}</dd>
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
