import { useFormContext, type FieldErrors } from 'react-hook-form';
import FormField, { inputClass } from '../ui/FormField';
import { v4 as uuidv4 } from 'uuid';
import type { TransactionPayload } from '../../lib/types';

export default function Step1Transaction() {
  const { register, setValue, formState } = useFormContext();
  const errors = formState.errors as FieldErrors<TransactionPayload>;

  function generateRef() {
    setValue('transaction.transactionReference', uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase());
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Transaction Information</h2>
        <p className="text-sm text-gray-500 mt-1">Basic details about this sales transaction.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormField
          label="Transaction Reference"
          required
          error={errors.transaction?.transactionReference}
        >
          <div className="flex gap-2">
            <input
              {...register('transaction.transactionReference', {
                setValueAs: (v) => (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),
              })}
              className={`${inputClass} flex-1 uppercase`}
              placeholder="e.g. TEST001"
            />
            <button
              type="button"
              onClick={generateRef}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              Generate
            </button>
          </div>
        </FormField>

        <FormField label="Transaction Channel" required error={errors.transaction?.transactionChannel}>
          <input
            {...register('transaction.transactionChannel')}
            className={inputClass}
            placeholder="e.g. UtilityHub"
          />
        </FormField>

        <FormField label="Transaction Date" required error={errors.transaction?.transactionDate}>
          <input
            type="datetime-local"
            {...register('transaction.transactionDate')}
            className={inputClass}
          />
        </FormField>

        <FormField
          label="Verification Code"
          error={errors.transaction?.transactionVerificationCode}
          hint="Optional verification code"
        >
          <input
            {...register('transaction.transactionVerificationCode')}
            className={inputClass}
            placeholder="Optional"
          />
        </FormField>

        <FormField label="Transaction Source" required>
          <input
            {...register('transaction.transactionSource')}
            className={`${inputClass} bg-gray-50`}
            readOnly
            value="EXTERNAL"
          />
        </FormField>
      </div>
    </div>
  );
}
