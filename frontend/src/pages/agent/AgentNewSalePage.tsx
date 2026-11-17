import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Check, Copy, Link2, Loader2, Save } from 'lucide-react';
import moment from 'moment-timezone';

import Stepper from '../../components/ui/Stepper';
import Step1Transaction from '../../components/form-steps/Step1Transaction';
import StepContact from '../../components/form-steps/Step2Contact';
import StepCustomer from '../../components/form-steps/Step3Customer';
import StepService from '../../components/form-steps/Step4Service';
import AgentStepPlan from './AgentStepPlan';
import { step1Schema, step2Schema, step3Schema, step4Schema } from '../../lib/schemas';
import {
  agentSalesApi,
  type AgentSale,
  type SelectedPlanSnapshot,
} from '../../lib/agentSalesApi';
import type { TransactionPayload } from '../../lib/types';

const STEPS = [
  { label: 'Plan', description: 'Plan & billing' },
  { label: 'Transaction', description: 'Sale info' },
  { label: 'Contact', description: 'Contact details' },
  { label: 'Customer', description: 'Identity' },
  { label: 'Service', description: 'Site & service' },
  { label: 'Consent', description: 'Send to customer' },
];

/**
 * Step 0 validates only what the plan picker sets. The remaining steps reuse the
 * existing submit-wizard schemas unchanged, so the agent portal and QA enforce exactly
 * the same rules.
 */
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

/** Consent step has nothing of its own to validate. */
const consentStepSchema = z.object({}).passthrough();

const stepSchemas = [
  planStepSchema,
  step1Schema,
  step2Schema,
  step3Schema,
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

export default function AgentNewSalePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [sale, setSale] = useState<AgentSale | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlanSnapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(id));

  const methods = useForm<TransactionPayload>({
    defaultValues: defaultValues(),
    resolver: zodResolver(stepSchemas[step]) as unknown as Resolver<TransactionPayload>,
    mode: 'onChange',
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    agentSalesApi
      .get(id)
      .then((s) => {
        setSale(s);
        setSelectedPlan(s.selectedPlan);
        if (s.payload) methods.reset(s.payload);
      })
      .catch((err) => setError(apiError(err, 'Could not load this sale')))
      .finally(() => setLoading(false));
    // methods is stable from useForm
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const readOnly = useMemo(
    () => Boolean(sale && !['agent_draft', 'awaiting_consent'].includes(sale.status)),
    [sale]
  );

  async function persist(): Promise<AgentSale | null> {
    setError(null);
    setSaving(true);
    try {
      const payload = methods.getValues();
      const saved = sale
        ? await agentSalesApi.update(sale.id, payload, selectedPlan)
        : await agentSalesApi.create(payload, selectedPlan);
      setSale(saved);
      if (!id) navigate(`/momentum/agent/sales/${saved.id}`, { replace: true });
      return saved;
    } catch (err) {
      setError(apiError(err, 'Could not save this sale'));
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
    await persist();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function handleIssueConsentLink() {
    setError(null);
    const saved = await persist();
    if (!saved) return;
    setIssuing(true);
    try {
      const res = await agentSalesApi.consentLink(saved.id);
      setConsentUrl(res.consentUrl);
      setSale(res);
    } catch (err) {
      setError(apiError(err, 'Could not create the consent link'));
    } finally {
      setIssuing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading sale...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {sale ? 'Agent sale' : 'New agent sale'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Capture the sale, then send the customer a consent link. QA submits it to Momentum.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {sale && (
            <span className="text-xs text-gray-500">
              Ref <span className="font-mono">{sale.id.slice(0, 8)}</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => void persist()}
            disabled={saving || readOnly}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>

      {readOnly && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          This sale is {sale?.status === 'consented' ? 'awaiting QA review' : sale?.status} and can no
          longer be edited. The customer consented to exactly what is recorded here.
        </div>
      )}

      <Stepper steps={STEPS} currentStep={step} />

      <div className="bg-white rounded-xl border border-gray-200 p-6 lg:p-8">
        <FormProvider {...methods}>
          <form onSubmit={(e) => e.preventDefault()}>
            {step === 0 && (
              <AgentStepPlan selectedPlan={selectedPlan} onSelectPlan={setSelectedPlan} />
            )}
            {step === 1 && <Step1Transaction />}
            {step === 2 && <StepContact />}
            {step === 3 && <StepCustomer />}
            {step === 4 && <StepService />}
            {step === 5 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Customer consent</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Send the customer a link to confirm their details and agree to the plan. The
                    sale only reaches QA once they have consented.
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
                    <p className="font-mono text-xs text-gray-500 mt-1">{selectedPlan.offerCode}</p>
                  </div>
                )}

                {sale?.consentedAt ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                    <p className="flex items-center gap-2 font-medium">
                      <Check className="w-4 h-4" />
                      Customer consented on {new Date(sale.consentedAt).toLocaleString()}
                    </p>
                    {sale.consent?.confirmedName && (
                      <p className="mt-1 text-green-800">
                        Confirmed by typing: <strong>{sale.consent.confirmedName}</strong>
                      </p>
                    )}
                    <p className="mt-2 text-green-800">This sale is now in the QA queue.</p>
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
                      {sale?.consentSentAt ? 'Create a new consent link' : 'Create consent link'}
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
                          Valid for 72 hours and usable once. Creating a new link invalidates this one.
                        </p>
                      </div>
                    )}

                    {sale?.consentSentAt && !consentUrl && (
                      <p className="text-sm text-gray-500">
                        A consent link was sent {new Date(sale.consentSentAt).toLocaleString()} and
                        has not been used yet. The link itself is not stored, so create a new one if
                        the customer needs it again.
                      </p>
                    )}
                  </>
                )}
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

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => void handleNext()}
              disabled={saving || readOnly}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/momentum/agent/sales')}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              Done
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
    </div>
  );
}
