import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, ArrowRight, Send, Save } from 'lucide-react';

import Stepper from '../components/ui/Stepper';
import Step1Transaction from '../components/form-steps/Step1Transaction';
import Step2Customer from '../components/form-steps/Step2Customer';
import Step3Contact from '../components/form-steps/Step3Contact';
import Step4Service from '../components/form-steps/Step4Service';
import { step1Schema, step2Schema, step3Schema, step4Schema, fullSchema } from '../lib/schemas';
import { transactionApi, draftsApi } from '../lib/api';
import type { TransactionPayload } from '../lib/types';

const STEPS = [
  { label: 'Transaction', description: 'Basic info' },
  { label: 'Customer', description: 'Customer details' },
  { label: 'Contact', description: 'Contact info' },
  { label: 'Service', description: 'Service & billing' },
];

const DRAFT_KEY = 'momentum_draft_transaction';

const schemas = [step1Schema, step2Schema, step3Schema, step4Schema];

/** Flatten react-hook-form errors into a single user-friendly message */
function formatValidationErrors(errors: Record<string, unknown>): string {
  const messages: string[] = [];
  function collect(obj: unknown, path = ''): void {
    if (!obj || typeof obj !== 'object') return;
    const record = obj as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message) {
      messages.push(record.message);
      return;
    }
    for (const key of Object.keys(record)) {
      if (key === 'message') continue;
      collect(record[key], path ? `${path}.${key}` : key);
    }
  }
  collect(errors);
  return messages.length ? messages.slice(0, 5).join(' • ') : 'Please fix the errors in the form.';
}

/** Extract user-friendly error message from API error (Momentum API, validation, or generic) */
function extractErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object' || !('response' in err)) return 'Submission failed';
  const data = (err as { response?: { data?: unknown } }).response?.data;
  if (!data || typeof data !== 'object') return 'Submission failed';

  const d = data as {
    momentumError?: {
      errors?: Array<{ errorMessage?: string; errorDescription?: string }>;
      message?: string;
    };
    details?: Array<{ message?: string }>;
    error?: string;
  };

  // Momentum API errors: use errorMessage or errorDescription from each error
  if (d.momentumError?.errors?.length) {
    const messages = d.momentumError.errors
      .map((e) => e.errorMessage || e.errorDescription)
      .filter(Boolean);
    if (messages.length) return messages.join(' • ');
  }

  // Momentum API simple response (e.g. { message: 'Offer not found' })
  if (d.momentumError?.message) return d.momentumError.message;

  // Validation errors (details array)
  if (Array.isArray(d.details) && d.details.length) {
    const msgs = d.details.map((x) => x.message).filter(Boolean);
    if (msgs.length) return msgs.join(' • ');
  }

  return d.error || 'Submission failed';
}

/** Sanitize transaction reference: no dashes, uppercase, max 12 chars */
function sanitizeTransactionRef(ref: string | undefined): string {
  return (ref ?? '').replace(/-/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

function getDefaultValues(): TransactionPayload {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as TransactionPayload;
      if (parsed?.transaction?.transactionReference) {
        parsed.transaction.transactionReference = sanitizeTransactionRef(
          parsed.transaction.transactionReference
        );
      }
      return parsed;
    } catch {
      // ignore
    }
  }
  return {
    transaction: {
      transactionReference: uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase(),
      transactionChannel: 'UtilityHub',
      transactionDate: new Date().toISOString().slice(0, 16),
      transactionSource: 'EXTERNAL',
    },
    customer: {
      customerType: 'RESIDENT',
      customerSubType: 'RESIDENT',
      communicationPreference: 'EMAIL',
      promotionAllowed: false,
      residentIdentity: {
        passport: {},
        drivingLicense: {},
        medicare: {},
      },
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
            {
              streetNumber: '',
              streetName: '',
              streetTypeCode: '',
              suburb: '',
              state: '',
              postCode: '',
            },
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
        offerQuoteDate: new Date().toISOString().split('T')[0],
        servicePlanCode: '',
        contractTermCode: 'OPEN',
        paymentMethod: 'Direct Debit Via Bank Account',
        billCycleCode: '',
        billDeliveryMethod: 'EMAIL',
      },
    },
  };
}

/** Convert date to yyyy-MM-dd (Momentum API expects this format) */
function toDateOnly(value: string): string {
  if (!value) return value;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : value;
}

/** Convert yyyy-MM (from <input type="month">) to yyyy-MM-dd (end of month) */
function monthYearToDateOnly(value: string): string {
  const m = String(value || '').trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) return value;
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  if (!year || month < 1 || month > 12) return value;
  const endOfMonth = new Date(Date.UTC(year, month, 0));
  const yyyy = String(endOfMonth.getUTCFullYear());
  const mm = String(endOfMonth.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(endOfMonth.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Remove key if value is empty/falsy */
function omitIfEmpty(obj: Record<string, unknown>, key: string): void {
  const v = obj[key];
  if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
    delete obj[key];
  }
}

function cleanPayload(data: TransactionPayload): TransactionPayload {
  const cleaned = structuredClone(data);

  // Transaction: Momentum API requires transactionVerificationCode - use placeholder when empty (pattern: A-Za-z0-9-)
  if (!cleaned.transaction.transactionVerificationCode?.trim()) {
    cleaned.transaction.transactionVerificationCode = 'OPTIONAL';
  }

  // Ensure transactionDate is full ISO datetime (YYYY-MM-DDTHH:MM:SS.000Z)
  if (cleaned.transaction.transactionDate) {
    let txDate = cleaned.transaction.transactionDate;
    if (!txDate.includes('T')) {
      txDate = `${txDate}T00:00:00.000Z`;
    } else if (!txDate.endsWith('Z')) {
      txDate = /T\d{2}:\d{2}:\d{2}$/.test(txDate) ? `${txDate}.000Z` : `${txDate}:00.000Z`;
    }
    cleaned.transaction.transactionDate = txDate;
  }

  // Contacts: add contactType (required by Momentum API)
  cleaned.customer.contacts.primaryContact.contactType = 'PRIMARY';
  if (cleaned.customer.contacts.secondaryContact) {
    cleaned.customer.contacts.secondaryContact.contactType = 'SECONDARY';
  }

  // dateOfBirth: Momentum expects yyyy-MM-dd
  const dob = cleaned.customer?.contacts?.primaryContact?.dateOfBirth;
  if (dob) {
    cleaned.customer.contacts.primaryContact.dateOfBirth = toDateOnly(dob);
  }
  const sc = cleaned.customer?.contacts?.secondaryContact;
  const scDob = sc?.dateOfBirth;
  if (sc && scDob) {
    sc.dateOfBirth = toDateOnly(scDob);
  }

  // Omit empty optional contact fields (Momentum rejects empty strings)
  omitIfEmpty(cleaned.customer.contacts.primaryContact as unknown as Record<string, unknown>, 'middleName');
  const scObj = cleaned.customer.contacts.secondaryContact as unknown as Record<string, unknown>;
  if (scObj) omitIfEmpty(scObj, 'middleName');

  // Addresses: set addressType to POSTAL when missing; omit empty unitNumber
  for (const addr of cleaned.customer.contacts.primaryContact.addresses) {
    if (!addr.addressType?.trim()) addr.addressType = 'POSTAL';
    omitIfEmpty(addr as unknown as Record<string, unknown>, 'unitNumber');
  }
  if (cleaned.customer.contacts.secondaryContact?.addresses) {
    for (const addr of cleaned.customer.contacts.secondaryContact.addresses) {
      if (!addr.addressType?.trim()) addr.addressType = 'POSTAL';
      omitIfEmpty(addr as unknown as Record<string, unknown>, 'unitNumber');
    }
  }

  if (cleaned.customer.customerType === 'RESIDENT') {
    delete cleaned.customer.companyIdentity;
    const ri = cleaned.customer.residentIdentity;
    if (ri) {
      if (!ri.passport?.documentId?.trim()) delete ri.passport;
      if (!ri.drivingLicense?.documentId?.trim()) delete ri.drivingLicense;
      // Medicare expiry may come as yyyy-MM from month picker; convert to yyyy-MM-dd for backend
      if (ri.medicare?.documentExpiryDate) {
        ri.medicare.documentExpiryDate = monthYearToDateOnly(ri.medicare.documentExpiryDate);
      }
      if (!ri.medicare?.documentId?.trim()) delete ri.medicare;
    }
  } else {
    delete cleaned.customer.residentIdentity;
    const ci = cleaned.customer.companyIdentity;
    if (ci) {
      omitIfEmpty(ci as unknown as Record<string, unknown>, 'trusteeName');
      if (ci.acn && !ci.acn.documentId?.trim()) delete ci.acn;
    }
  }

  if (!cleaned.customer.contacts.secondaryContact?.firstName?.trim()) {
    delete cleaned.customer.contacts.secondaryContact;
  }

  // Service: omit empty optionals; serviceStartDate as yyyy-MM-dd
  omitIfEmpty(cleaned.service as unknown as Record<string, unknown>, 'serviceMeterId');
  omitIfEmpty(cleaned.service as unknown as Record<string, unknown>, 'lotNumber');
  if (cleaned.service.serviceSubType === 'MOVE IN' && cleaned.service.serviceStartDate) {
    cleaned.service.serviceStartDate = toDateOnly(cleaned.service.serviceStartDate);
  } else if (cleaned.service.serviceSubType !== 'MOVE IN') {
    delete cleaned.service.serviceStartDate;
  }

  // servicedAddress: omit empty optional fields (Momentum rejects empty strings and invalid enums)
  const sa = cleaned.service.servicedAddress as unknown as Record<string, unknown>;
  const optionalAddressKeys = ['name', 'unitType', 'unitNumber', 'floorType', 'floorNumber', 'streetNumberSuffix', 'streetNameSuffix', 'accessInstructions', 'safetyInstructions'];
  for (const key of optionalAddressKeys) {
    omitIfEmpty(sa, key);
  }

  // Service billing: Momentum expects full ISO date-time (yyyy-MM-ddTHH:mm:ss.000Z) for offerQuoteDate/contractDate
  const toDateTime = (v: string) => {
    if (!v) return v;
    const d = toDateOnly(v);
    return d ? `${d}T00:00:00.000Z` : v;
  };
  const sb = cleaned.service.serviceBilling;
  sb.offerQuoteDate = toDateTime(sb.offerQuoteDate);
  if (!sb.contractDate && sb.offerQuoteDate) {
    sb.contractDate = sb.offerQuoteDate;
  } else if (sb.contractDate) {
    sb.contractDate = toDateTime(sb.contractDate);
  }

  // Concession: normalize dates and drop empty optional fields
  const conc = sb.concession as unknown as Record<string, unknown> | undefined;
  if (conc) {
    const start = conc.concessionStartDate as string | undefined;
    const end = conc.concessionEndDate as string | undefined;
    const exp = conc.concessionCardExpiryDate as string | undefined;
    if (start) conc.concessionStartDate = toDateOnly(start);
    if (end) conc.concessionEndDate = toDateOnly(end);
    if (exp) conc.concessionCardExpiryDate = toDateOnly(exp);
    omitIfEmpty(conc, 'concessionCardMiddleName');

    // If the object is present but missing a core required key, drop it entirely
    if (!String(conc.concessionCardType || '').trim()) {
      delete sb.concession;
    }
  }

  return cleaned;
}

export default function NewTransactionPage() {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [saveDraftMessage, setSaveDraftMessage] = useState<string | null>(null);
  const [loadDraftError, setLoadDraftError] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    salesTransactionId?: string;
    error?: string;
  } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const draftId = searchParams.get('draft');
  const isFresh = searchParams.get('fresh') === '1';

  // When arriving via "New Transaction" link (?fresh=1), clear draft so form starts empty
  if (isFresh) {
    localStorage.removeItem(DRAFT_KEY);
  }

  const methods = useForm<TransactionPayload>({
    defaultValues: getDefaultValues(),
    resolver: zodResolver(schemas[step]) as unknown as Resolver<TransactionPayload>,
    mode: 'onTouched',
  });

  const formValues = methods.watch();

  // Load draft from backend when ?draft=:id
  useEffect(() => {
    if (!draftId || isFresh || draftLoaded) return;
    const id = draftId;
    setLoadDraftError(null);
    async function loadDraft() {
      try {
        const res = await draftsApi.get(id);
        const payload = res.draft?.payload;
        if (payload) {
          if (payload.transaction?.transactionReference) {
            payload.transaction.transactionReference = sanitizeTransactionRef(
              payload.transaction.transactionReference
            );
          }
          methods.reset(payload);
          setDraftLoaded(true);
        }
      } catch (err) {
        setLoadDraftError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load draft');
      }
    }
    loadDraft();
  }, [draftId, isFresh, draftLoaded, methods]);

  useEffect(() => {
    if (isFresh) setSearchParams({}, { replace: true });
  }, [isFresh, setSearchParams]);

  useEffect(() => {
    if (searchParams.get('fresh') === '1') {
      localStorage.removeItem(DRAFT_KEY);
      methods.reset(getDefaultValues());
      setStep(0);
      setSubmitResult(null);
      setValidationError(null);
      setDraftLoaded(false);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, methods]);

  // Auto-save to localStorage only when not editing a backend draft
  useEffect(() => {
    if (draftId && draftLoaded) return; // Skip localStorage when using backend draft
    const timeout = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formValues));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [formValues, draftId, draftLoaded]);

  async function handleNext() {
    setValidationError(null);
    const valid = await methods.trigger();
    if (valid) {
      if (step < STEPS.length - 1) {
        setStep(step + 1);
      }
    } else {
      setValidationError(formatValidationErrors(methods.formState.errors as Record<string, unknown>));
    }
  }

  async function handleSubmit() {
    setValidationError(null);
    // Run full-form validation so we catch step 1–3 rules (e.g. DOB 18+, passport expiry) even when on step 4
    const payload = methods.getValues();
    const fullResult = fullSchema.safeParse(payload);
    if (!fullResult.success) {
      const err = fullResult.error;
      const messages: string[] = [];
      for (const issue of err.issues) {
        const path = issue.path.join('.');
        if (path) methods.setError(path as 'transaction' | 'customer' | 'service', { type: 'manual', message: issue.message });
        if (issue.message) messages.push(issue.message);
      }
      setValidationError(messages.join(' • '));
      return;
    }

    setSubmitting(true);
    try {
      const payload = cleanPayload(methods.getValues());
      const result = await transactionApi.submit(payload);
      // Delete backend draft if we submitted from one
      if (draftId) {
        try {
          await draftsApi.delete(draftId);
        } catch {
          // Ignore – draft may already be deleted
        }
      }
      setSubmitResult({
        success: true,
        salesTransactionId: result.data?.data?.salesTransactionId ?? result.data?.salesTransactionId,
      });
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      setSubmitResult({ success: false, error: msg });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveDraft() {
    setSaveDraftMessage(null);
    setSavingDraft(true);
    try {
      const payload = methods.getValues();
      if (draftId) {
        await draftsApi.update(draftId, payload);
        setSaveDraftMessage('Draft saved.');
      } else {
        const res = await draftsApi.save(payload);
        setSearchParams({ draft: res.draft.id }, { replace: true });
        setDraftLoaded(true);
        setSaveDraftMessage('Draft saved.');
      }
      setTimeout(() => setSaveDraftMessage(null), 3000);
    } catch (err) {
      setSaveDraftMessage((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  }

  function handleClearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    if (draftId) {
      setSearchParams({}, { replace: true });
      setDraftLoaded(false);
    }
    methods.reset(getDefaultValues());
    setStep(0);
    setSubmitResult(null);
    setValidationError(null);
  }

  // When loading a backend draft, show loading until fetched
  if (draftId && !draftLoaded && !loadDraftError) {
    return (
      <div className="max-w-6xl mx-auto py-12">
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          Loading draft...
        </div>
      </div>
    );
  }

  if (submitResult) {
    return (
      <div className="max-w-6xl mx-auto">
        <div
          className={`rounded-2xl p-2 text-center ${
            submitResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          <div
            className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-2xl ${
              submitResult.success ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            {submitResult.success ? '✓' : '✕'}
          </div>
          <h2 className={`text-xl font-semibold mb-2 ${submitResult.success ? 'text-green-800' : 'text-red-800'}`}>
            {submitResult.success ? 'Transaction Submitted!' : 'Submission Failed'}
          </h2>
          {submitResult.salesTransactionId && (
            <p className="text-sm text-green-700 mb-4">
              Transaction ID: <span className="font-mono font-semibold">{submitResult.salesTransactionId}</span>
            </p>
          )}
          {submitResult.error && <p className="text-sm text-red-700 mb-4">{submitResult.error}</p>}
          <div className="flex gap-3 justify-center mt-6 flex-wrap">
            {submitResult.success && (
              <>
                <button
                  onClick={() => navigate(`/transactions/${submitResult.salesTransactionId}`)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium cursor-pointer"
                >
                  View Transaction
                </button>
                <button
                  onClick={() => setSubmitResult(null)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 cursor-pointer"
                >
                  Back to form
                </button>
              </>
            )}
            {submitResult.error && (
              <button
                onClick={() => setSubmitResult(null)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium cursor-pointer"
              >
                Edit and resubmit
              </button>
            )}
            <button
              onClick={handleClearDraft}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 cursor-pointer"
            >
              Start new
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 cursor-pointer"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Transaction</h1>
          <p className="text-sm text-gray-500 mt-1">Submit a new sales transaction to Momentum Energy</p>
        </div>
        <div className="flex items-center gap-3">
          {loadDraftError && (
            <span className="text-sm text-red-600">{loadDraftError}</span>
          )}
          {saveDraftMessage && (
            <span className="text-sm text-green-600">{saveDraftMessage}</span>
          )}
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-50 disabled:opacity-50 cursor-pointer"
          >
            {savingDraft ? (
              <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save draft
          </button>
          <button
            onClick={handleClearDraft}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            Clear Draft
          </button>
        </div>
      </div>

      <Stepper steps={STEPS} currentStep={step} />

      <div className="bg-white rounded-xl border border-gray-200 p-6 lg:p-8">
        <FormProvider {...methods}>
          <form onSubmit={(e) => e.preventDefault()}>
            {step === 0 && <Step1Transaction />}
            {step === 1 && <Step2Customer />}
            {step === 2 && <Step3Contact />}
            {step === 3 && <Step4Service />}
          </form>
        </FormProvider>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => {
              setValidationError(null);
              setStep(Math.max(0, step - 1));
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
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 cursor-pointer"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Transaction
                </>
              )}
            </button>
          )}
        </div>

        {validationError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {validationError}
          </div>
        )}
      </div>
    </div>
  );
}
