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
      communicationPreference: 'EMAIL',
      promotionAllowed: true,
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
        contractTermCode: 'OPEN',
        paymentMethod: 'Direct Debit Via Bank Account',
        billCycleCode: '',
        billDeliveryMethod: 'EMAIL',
      },
    },
  };
}

function cleanPayload(data: TransactionPayload): TransactionPayload {
  const cleaned = structuredClone(data);

  // Ensure transactionDate is full ISO datetime
  if (cleaned.transaction.transactionDate && !cleaned.transaction.transactionDate.includes('T')) {
    cleaned.transaction.transactionDate = `${cleaned.transaction.transactionDate}T00:00:00Z`;
  } else if (cleaned.transaction.transactionDate && !cleaned.transaction.transactionDate.endsWith('Z')) {
    cleaned.transaction.transactionDate = `${cleaned.transaction.transactionDate}:00Z`;
  }

  if (cleaned.customer.customerType === 'RESIDENT') {
    delete cleaned.customer.companyIdentity;
    const ri = cleaned.customer.residentIdentity;
    if (ri) {
      if (!ri.passport?.documentId) delete ri.passport;
      if (!ri.drivingLicense?.documentId) delete ri.drivingLicense;
      if (!ri.medicare?.documentId) delete ri.medicare;
    }
  } else {
    delete cleaned.customer.residentIdentity;
  }

  if (!cleaned.customer.contacts.secondaryContact?.firstName) {
    delete cleaned.customer.contacts.secondaryContact;
  }

  if (cleaned.service.serviceSubType !== 'MOVE IN') {
    delete cleaned.service.serviceStartDate;
  }

  if (!cleaned.service.serviceBilling.concession?.cardType) {
    delete cleaned.service.serviceBilling.concession;
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
    }
  }

  async function handleSubmit() {
    const valid = await methods.trigger();
    if (!valid) return;

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
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string; details?: Array<{ message: string }> } } })
              .response?.data?.details?.map((d) => d.message).join(', ') ||
            (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : 'Submission failed';
      setSubmitResult({ success: false, error: msg || 'Submission failed' });
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
