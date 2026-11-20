import { useEffect, useState } from 'react';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Copy,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  LogOut,
  Plus,
} from 'lucide-react';
import moment from 'moment-timezone';

import Stepper from '../../components/ui/Stepper';
import Step1Transaction from '../../components/form-steps/Step1Transaction';
import StepContact from '../../components/form-steps/Step2Contact';
import StepCustomer from '../../components/form-steps/Step3Customer';
import StepService from '../../components/form-steps/Step4Service';
import AgentStepPlan from '../agent/AgentStepPlan';
import AgentStepBilling from '../agent/AgentStepBilling';
import AgentSalesList from './AgentSalesList';
import { step1Schema, step2Schema, step3Schema, step4Schema } from '../../lib/schemas';
import {
  agentPortalApi,
  agentOffersApi,
  getAgentToken,
  clearAgentSession,
  AgentSessionExpiredError,
  type AgentSaleView,
} from '../../lib/agentPortalApi';
import type { SelectedPlanSnapshot } from '../../lib/agentSalesApi';
import type { TransactionPayload } from '../../lib/types';

const STEPS = [
  { label: 'Plan', description: 'Choose a plan' },
  { label: 'Billing', description: 'How they pay' },
  { label: 'Transaction', description: 'Sale info' },
  { label: 'Contact', description: 'Contact details' },
  { label: 'Customer', description: 'Identity' },
  { label: 'Service', description: 'Site & service' },
  { label: 'Consent', description: 'Send to customer' },
];

const planStepSchema = z
  .object({
    service: z
      .object({
        serviceBilling: z
          .object({
            serviceOfferCode: z
              .string()
              .min(1, 'Select a plan to set the offer code')
              .regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/, 'Must be 15 or 18 alphanumeric characters'),
            servicePlanCode: z.string().min(1, 'Select a plan'),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

const billingStepSchema = z
  .object({
    service: z
      .object({
        serviceBilling: z
          .object({
            offerQuoteDate: z.string().min(1, 'Quote date is required'),
            contractTermCode: z.enum(['OPEN', '12MTH', '24MTH', '36MTH']),
            paymentMethod: z
              .union([z.literal(''), z.enum(['Direct Debit Via Bank Account', 'Cheque'])])
              .refine((v) => v !== '', 'Payment method is required'),
            billCycleCode: z.string().min(1, 'Bill cycle is required'),
            billDeliveryMethod: z.enum(['EMAIL', 'POST']),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

const consentStepSchema = z.object({}).passthrough();

/*
 * The agent never ticks promotion consent: the customer gives it themselves on the
 * consent page, and recording it here would be a consent that was never given. The
 * shared step3Schema requires it, so validate against a copy with it forced true. This
 * only affects the value the resolver checks -- the form still holds false until the
 * customer consents, and the sale is persisted from getValues().
 */
// Cast because z.preprocess widens the input to unknown, which zodResolver's generic
// rejects; the runtime shape is identical to step3Schema.
const agentCustomerStepSchema = z.preprocess((val) => {
  const v = (val ?? {}) as TransactionPayload;
  return { ...v, customer: { ...v.customer, promotionAllowed: true } };
}, step3Schema) as unknown as typeof step3Schema;

const stepSchemas = [
  planStepSchema,
  billingStepSchema,
  step1Schema,
  step2Schema,
  agentCustomerStepSchema,
  step4Schema,
  consentStepSchema,
];

function formatValidationErrors(errors: Record<string, unknown>): string {
  const messages: string[] = [];
  function collect(obj: unknown): void {
    if (!obj || typeof obj !== 'object') return;
    const record = obj as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message) {
      messages.push(record.message);
      return;
    }
    for (const key of Object.keys(record)) {
      if (key === 'message') continue;
      collect(record[key]);
    }
  }
  collect(errors);
  return messages.length ? messages.slice(0, 5).join(' • ') : 'Please fix the errors in the form.';
}

function apiError(err: unknown, fallback: string): string {
  const d = (err as { response?: { data?: { error?: string; details?: Array<{ message?: string }> } } })
    .response?.data;
  if (Array.isArray(d?.details) && d.details.length) {
    return d.details.map((x) => x.message).filter(Boolean).join(' • ');
  }
  return d?.error ?? fallback;
}

function defaultValues(): TransactionPayload {
  return {
    transaction: {
      transactionReference: 'UHM',
      transactionChannel: 'UtilityHub',
      transactionDate: moment().tz('Australia/Sydney').format('YYYY-MM-DDTHH:mm'),
      transactionVerificationCode: '',
      transactionSource: 'EXTERNAL',
    },
    portalMeta: { center: '', dncNumber: '', agentName: '', closer: '', auditorName: '' },
    customer: {
      customerType: 'RESIDENT',
      customerSubType: 'RESIDENT',
      communicationPreference: 'EMAIL',
      promotionAllowed: false,
      residentIdentity: { passport: {}, drivingLicense: {}, medicare: {} },
      contacts: {
        primaryContact: {
          salutation: '',
          firstName: '',
          middleName: '',
          lastName: '',
          countryOfBirth: '',
          dateOfBirth: '',
          email: '',
          addresses: [
            { streetNumber: '', streetName: '', streetTypeCode: '', suburb: '', state: '', postCode: '' },
          ],
          contactPhones: [{ contactPhoneType: 'MOBILE', phone: '' }],
        },
      },
    } as TransactionPayload['customer'],
    service: {
      serviceType: 'POWER',
      serviceSubType: 'TRANSFER',
      serviceConnectionId: '',
      servicedAddress: {
        streetNumber: '',
        streetName: '',
        streetTypeCode: '',
        suburb: '',
        state: '',
        postCode: '',
      },
      serviceBilling: {
        serviceOfferCode: '',
        offerQuoteDate: '',
        servicePlanCode: '',
        contractTermCode: 'OPEN',
        paymentMethod: '',
        billCycleCode: '',
        billDeliveryMethod: 'EMAIL',
      },
    },
  };
}

export default function AgentPortalPage() {
  const [unlocked, setUnlocked] = useState(Boolean(getAgentToken()));
  const [view, setView] = useState<'form' | 'sales'>('form');
  // Remounting SaleForm is what makes "New sale" start genuinely empty.
  const [formKey, setFormKey] = useState(0);

  function signOut() {
    clearAgentSession();
    setUnlocked(false);
    setView('form');
  }

  if (!unlocked) return <AccessGate onUnlocked={() => setUnlocked(true)} />;

  if (view === 'sales') {
    return (
      <AgentSalesList
        onNewSale={() => {
          setFormKey((k) => k + 1);
          setView('form');
        }}
        onSessionLost={signOut}
      />
    );
  }

  return <SaleForm key={formKey} onSessionLost={signOut} onShowSales={() => setView('sales')} />;
}

/* ------------------------------------------------------------------- gate */

function AccessGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await agentPortalApi.access(password);
      onUnlocked();
    } catch (err) {
      setError(apiError(err, 'That password is not recognised'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-8">
        <img src="/utility-hub-logo.png" alt="Utility Hub" className="h-9 mx-auto" />
        <h1 className="mt-5 text-lg font-semibold text-gray-900 text-center">Agent access</h1>
        <p className="mt-1 text-sm text-gray-500 text-center">
          Enter the password to start a sale.
        </p>

        <div className="mt-6 relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="off"
            placeholder="Password"
            className="w-full px-3 py-2.5 pr-11 border border-gray-300 rounded-lg text-sm text-center tracking-wide focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700 text-center">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-40 cursor-pointer"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Continue
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------- form */

function SaleForm({
  onSessionLost,
  onShowSales,
}: {
  onSessionLost: () => void;
  onShowSales: () => void;
}) {
  const [step, setStep] = useState(0);
  const [sale, setSale] = useState<AgentSaleView | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlanSnapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const methods = useForm<TransactionPayload>({
    defaultValues: defaultValues(),
    resolver: zodResolver(stepSchemas[step]) as unknown as Resolver<TransactionPayload>,
    mode: 'onChange',
  });

  useEffect(() => {
    if (!sale?.id) return;
    const t = setInterval(async () => {
      try {
        const fresh = await agentPortalApi.get(sale.id);
        if (fresh.consentedAt) setSale(fresh);
      } catch {
        /* polling is best effort */
      }
    }, 15000);
    return () => clearInterval(t);
  }, [sale?.id]);

  function handleError(err: unknown, fallback: string) {
    if (err instanceof AgentSessionExpiredError) {
      onSessionLost();
      return;
    }
    setError(apiError(err, fallback));
  }

  async function persist(): Promise<AgentSaleView | null> {
    setError(null);
    setSaving(true);
    try {
      const payload = methods.getValues();
      const saved = sale
        ? await agentPortalApi.update(sale.id, payload, selectedPlan)
        : await agentPortalApi.create(payload, selectedPlan);
      setSale(saved);
      return saved;
    } catch (err) {
      handleError(err, 'Could not save this sale');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    setError(null);
    const valid = await methods.trigger();
    if (!valid) {
      setError(formatValidationErrors(methods.formState.errors as Record<string, unknown>));
      return;
    }
    if (step === 0 && !selectedPlan) {
      setError('Select a plan before continuing.');
      return;
    }
    const saved = await persist();
    if (!saved) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function handleIssueConsentLink() {
    const saved = await persist();
    if (!saved) return;
    setIssuing(true);
    try {
      const res = await agentPortalApi.consentLink(saved.id);
      setConsentUrl(res.consentUrl);
      setSale(res);
    } catch (err) {
      handleError(err, 'Could not create the consent link');
    } finally {
      setIssuing(false);
    }
  }

  function startAnother() {
    methods.reset(defaultValues());
    setSale(null);
    setSelectedPlan(null);
    setConsentUrl(null);
    setError(null);
    setStep(0);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="w-full px-6 lg:px-8 py-3 flex items-center justify-between">
          <img src="/utility-hub-logo.png" alt="Utility Hub" className="h-8" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onShowSales}
              className="inline-flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100 cursor-pointer"
            >
              <ClipboardList className="w-4 h-4" />
              My sales
            </button>
            <button
              type="button"
              onClick={onSessionLost}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Exit
            </button>
          </div>
        </div>
      </header>

      <main className="w-full px-6 lg:px-8 py-6 lg:py-8">
        <Stepper steps={STEPS} currentStep={step} />

        <div className="bg-white rounded-xl border border-gray-200 p-6 lg:p-8">
          <FormProvider {...methods}>
            {/* key on the step so the animation replays on every stage change */}
            <form key={step} onSubmit={(e) => e.preventDefault()} className="step-enter">
              {step === 0 && (
                <AgentStepPlan
                  selectedPlan={selectedPlan}
                  onSelectPlan={setSelectedPlan}
                  offers={agentOffersApi}
                />
              )}
              {step === 1 && <AgentStepBilling selectedPlan={selectedPlan} />}
              {step === 2 && <Step1Transaction />}
              {step === 3 && <StepContact />}
              {step === 4 && <StepCustomer hidePromotionConsent />}
              {step === 5 && <StepService />}
              {step === 6 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Customer consent</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Send the customer this link so they can confirm their details and agree to
                      the plan.
                    </p>
                  </div>

                  {selectedPlan && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
                      <p className="font-medium text-gray-900">{selectedPlan.planCode}</p>
                      <p className="text-gray-600 mt-0.5">
                        {selectedPlan.monthlyCost != null
                          ? `$${selectedPlan.monthlyCost}/month`
                          : 'Rates only'}
                        {selectedPlan.comparisonLabel
                          ? ` · ${selectedPlan.comparisonLabel} ${selectedPlan.benchmarkName}`
                          : ''}
                      </p>
                    </div>
                  )}

                  {sale?.consentedAt ? (
                    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-900">
                      <p className="flex items-center gap-2 font-medium">
                        <Check className="w-4 h-4" />
                        Customer consented on {new Date(sale.consentedAt).toLocaleString()}
                      </p>
                      <p className="mt-1 text-green-800">
                        Nothing more to do — this sale has gone through for checking.
                      </p>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleIssueConsentLink()}
                        disabled={issuing || saving || !selectedPlan}
                        className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 cursor-pointer"
                      >
                        {issuing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Link2 className="w-4 h-4" />
                        )}
                        {consentUrl ? 'Create a new link' : 'Create consent link'}
                      </button>

                      {consentUrl && (
                        <div className="rounded-lg border border-primary-200 bg-primary-50 p-4">
                          <p className="text-sm font-medium text-primary-900">
                            Send this link to the customer
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              readOnly
                              value={consentUrl}
                              className="flex-1 px-3 py-2 text-sm font-mono bg-white border border-primary-200 rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(consentUrl);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-700 bg-white border border-primary-300 rounded-lg hover:bg-primary-100 cursor-pointer"
                            >
                              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              {copied ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <p className="mt-2 text-xs text-primary-800">
                            Usable once. This page updates once the customer confirms.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={startAnother}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Start another sale
                  </button>
                </div>
              )}
            </form>
          </FormProvider>

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep((s) => Math.max(0, s - 1));
              }}
              disabled={step === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>

            {step < STEPS.length - 1 && (
              <button
                type="button"
                onClick={() => void handleNext()}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 cursor-pointer"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
