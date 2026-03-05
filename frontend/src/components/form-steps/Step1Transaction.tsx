import { useFormContext } from 'react-hook-form';
import FormField, { inputClass } from '../ui/FormField';
import { v4 as uuidv4 } from 'uuid';

export default function Step1Transaction() {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext();

  function generateRef() {
    setValue('transaction.transactionReferenceId', uuidv4().slice(0, 20).toUpperCase());
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
          error={errors.transaction?.transactionReferenceId}
        >
          <div className="flex gap-2">
            <input
              {...register('transaction.transactionReferenceId')}
              className={`${inputClass} flex-1`}
              placeholder="e.g. TXN-2026-001"
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

        <FormField label="Channel Name" required error={errors.transaction?.channelName}>
          <input
            {...register('transaction.channelName')}
            className={inputClass}
            placeholder="e.g. Residential Connections"
          />
        </FormField>

        <FormField label="Transaction Date" required error={errors.transaction?.transactionDate}>
          <input
            type="date"
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

        <FormField label="Source" required>
          <input
            {...register('transaction.source')}
            className={`${inputClass} bg-gray-50`}
            readOnly
            value="EXTERNAL"
          />
        </FormField>
      </div>
    </div>
  );
}
