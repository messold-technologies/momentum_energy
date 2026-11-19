import { useFormContext, useWatch } from 'react-hook-form';
import { AlertTriangle, Info } from 'lucide-react';

import FormField from '../../components/ui/FormField';
import type { SelectedPlanSnapshot } from '../../lib/agentSalesApi';
import type { TransactionPayload } from '../../lib/types';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const selectClass = `${inputClass} bg-white`;

/** Electricity supports Monthly/Quarterly; gas only Bi-Monthly. */
const BILL_CYCLES = {
  ELECTRICITY: ['Monthly', 'Quarterly'],
  GAS: ['Bi-Monthly'],
} as const;

interface Props {
  selectedPlan: SelectedPlanSnapshot | null;
}

export default function AgentStepBilling({ selectedPlan }: Props) {
  const { register, control, formState } = useFormContext<TransactionPayload>();
  const errors = formState.errors.service?.serviceBilling;
  const serviceType = useWatch({ control, name: 'service.serviceType' });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Billing</h2>
        <p className="text-sm text-gray-500 mt-1">
          How the customer is billed for the plan you selected.
        </p>
      </div>

      {/* Reminder of what was quoted, so the agent does not have to go back a step. */}
      {selectedPlan && (
        <div className="rounded-xl border border-primary-200 bg-primary-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
            Selected plan
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-lg font-bold text-gray-900">{selectedPlan.planCode}</p>
            {selectedPlan.monthlyCost != null && (
              <p className="text-base font-semibold text-gray-900">
                ${selectedPlan.monthlyCost}
                <span className="text-sm font-medium text-gray-500">/month</span>
              </p>
            )}
            {selectedPlan.comparisonLabel && (
              <p className="text-sm text-gray-600">
                {selectedPlan.comparisonLabel} {selectedPlan.benchmarkName}
              </p>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-600">
            {selectedPlan.networkName} · {selectedPlan.retailTariffCode} ·{' '}
            {selectedPlan.energyType === 'GAS' ? 'Gas' : 'Electricity'}
          </p>
          {selectedPlan.indicativeOnly && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
              Quoted on flat-rate pricing. Confirm the network tariff.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <FormField
          label="Quote date"
          required
          error={errors?.offerQuoteDate}
          hint="Stamped when you selected the plan; must not be older than 14 days"
        >
          <input
            type="date"
            readOnly
            {...register('service.serviceBilling.offerQuoteDate')}
            className={`${inputClass} bg-gray-50 text-gray-600`}
          />
        </FormField>

        <FormField label="Contract term" required error={errors?.contractTermCode}>
          <select {...register('service.serviceBilling.contractTermCode')} className={selectClass}>
            <option value="OPEN">Open</option>
            <option value="12MTH">12 months</option>
            <option value="24MTH">24 months</option>
            <option value="36MTH">36 months</option>
          </select>
        </FormField>

        <FormField label="Payment method" required error={errors?.paymentMethod}>
          <select {...register('service.serviceBilling.paymentMethod')} className={selectClass}>
            <option value="">Select...</option>
            <option value="Direct Debit Via Bank Account">Direct Debit Via Bank Account</option>
            <option value="Cheque">Cheque</option>
          </select>
        </FormField>

        <FormField
          label="Bill cycle"
          required
          error={errors?.billCycleCode}
          hint={serviceType === 'GAS' ? 'Gas: Bi-Monthly only' : 'Electricity: Monthly or Quarterly'}
        >
          <select {...register('service.serviceBilling.billCycleCode')} className={selectClass}>
            <option value="">Select...</option>
            {(serviceType === 'GAS' ? BILL_CYCLES.GAS : BILL_CYCLES.ELECTRICITY).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Bill delivery"
          required
          error={errors?.billDeliveryMethod}
          hint="Momentum requires EMAIL for external channels"
        >
          <select {...register('service.serviceBilling.billDeliveryMethod')} className={selectClass}>
            <option value="EMAIL">EMAIL</option>
          </select>
        </FormField>
      </div>

      {/*
        The Submit Sales Transaction API takes one `service` object with a single
        serviceType, so electricity and gas cannot share a transaction. Two fuels means
        two sales, each with its own transactionReference.
      */}
      <p className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
        <Info className="w-4 h-4 mt-px shrink-0 text-gray-400" />
        One fuel per sale. If the customer is taking both electricity and gas, finish this
        sale and then create a second one for the other fuel, with its own reference.
      </p>
    </div>
  );
}
