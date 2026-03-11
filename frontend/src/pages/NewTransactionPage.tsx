import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, ArrowRight, Send, Save } from 'lucide-react';

import Stepper from '../components/ui/Stepper';
import Step1Transaction from '../components/form-steps/Step1Transaction';
import Step2Customer from '../components/form-steps/Step2Customer';
import Step3Contact from '../components/form-steps/Step3Contact';
import Step4Service from '../components/form-steps/Step4Service';
import { step1Schema, step2Schema, step3Schema, step4Schema } from '../lib/schemas';
import { transactionApi } from '../lib/api';
import type { TransactionPayload } from '../lib/types';

const STEPS = [
  { label: 'Transaction', description: 'Basic info' },
  { label: 'Customer', description: 'Customer details' },
  { label: 'Contact', description: 'Contact info' },
  { label: 'Service', description: 'Service & billing' },
];

const DRAFT_KEY = 'momentum_draft_transaction';

const schemas = [step1Schema, step2Schema, step3Schema, step4Schema];

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

function getDefaultValues(): TransactionPayload {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // ignore
    }
  }
  return {
    transaction: {
      transactionReference: uuidv4().slice(0, 20).toUpperCase(),
      transactionChannel: '',
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

  if (!sb.concession?.cardType?.trim()) {
    delete sb.concession;
  }

  return cleaned;
}

export default function NewTransactionPage() {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    salesTransactionId?: string;
    error?: string;
  } | null>(null);
  const navigate = useNavigate();

  const methods = useForm<TransactionPayload>({
    defaultValues: getDefaultValues(),
    resolver: zodResolver(schemas[step]) as unknown as Resolver<TransactionPayload>,
    mode: 'onTouched',
  });

  const formValues = methods.watch();

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formValues));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [formValues]);

  async function handleNext() {
    const valid = await methods.trigger();
    if (valid) {
      if (step < STEPS.length - 1) {
        setStep(step + 1);
      }
    } else {
      console.log('Validation failed:', methods.formState.errors);
    }
  }

  async function handleSubmit() {
    const valid = await methods.trigger();
    if (!valid) {
      console.log('Validation failed:', methods.formState.errors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = cleanPayload(methods.getValues());
      const result = await transactionApi.submit(payload);
      localStorage.removeItem(DRAFT_KEY);
      setSubmitResult({
        success: true,
        salesTransactionId: result.data?.salesTransactionId,
      });
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      setSubmitResult({ success: false, error: msg });
    } finally {
      setSubmitting(false);
    }
  }

  function handleClearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    methods.reset(getDefaultValues());
    setStep(0);
    setSubmitResult(null);
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
          <div className="flex gap-3 justify-center mt-6">
            {submitResult.success && (
              <button
                onClick={() => navigate(`/transactions/${submitResult.salesTransactionId}`)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium cursor-pointer"
              >
                View Transaction
              </button>
            )}
            <button
              onClick={handleClearDraft}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 cursor-pointer"
            >
              New Transaction
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Transaction</h1>
          <p className="text-sm text-gray-500 mt-1">Submit a new sales transaction to Momentum Energy</p>
        </div>
        <button
          onClick={handleClearDraft}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          Clear Draft
        </button>
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
            onClick={() => setStep(Math.max(0, step - 1))}
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
      </div>
    </div>
  );
}
