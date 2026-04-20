import { useFormContext, type FieldErrors } from 'react-hook-form';
import FormField, { inputClass, selectClass } from '../ui/FormField';
import type { TransactionPayload } from '../../lib/types';
import { CENTER_OPTIONS } from '../../lib/centerOptions';

export default function Step1Transaction() {
  const { register, setValue, formState, watch } = useFormContext();
  const errors = formState.errors as FieldErrors<TransactionPayload>;

  function handleDigitsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = (e.target.value ?? '').replaceAll(/\D/g, '').slice(0, 9);
    setValue('transaction.transactionReference', `UHM${digits}`, { shouldDirty: true, shouldTouch: true });
  }

  function handleVerificationDigitsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = (e.target.value ?? '').replaceAll(/\D/g, '');
    setValue('transaction.transactionVerificationCode', `OWR-${digits}`, { shouldDirty: true, shouldTouch: true });
  }

  const currentRef = String(watch('transaction.transactionReference') ?? '');
  const currentDigits = currentRef.toUpperCase().replace(/^UHM/, '').replaceAll(/\D/g, '').slice(0, 9);

  const currentVerification = String(watch('transaction.transactionVerificationCode') ?? '');
  const verificationDigits = currentVerification
    .toUpperCase()
    .replace(/^OWR-?/, '')
    .replaceAll(/\D/g, '')

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
          <div className="flex">
            <span className="inline-flex items-center px-3 py-2 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-sm font-mono text-gray-700">
              UHM
            </span>
            <input
              inputMode="numeric"
              autoComplete="off"
              aria-label="Transaction reference digits"
              onChange={handleDigitsChange}
              value={currentDigits}
              className={`${inputClass} rounded-l-none font-mono`}
              placeholder="Enter digits"
              maxLength={9}
            />
            <input
              type="hidden"
              {...register('transaction.transactionReference', {
                setValueAs: (v) => {
                  const raw = String(v ?? '').toUpperCase();
                  const digits = raw.replace(/^UHM/, '').replaceAll(/\D/g, '').slice(0, 9);
                  return `UHM${digits}`;
                },
              })}
            />
          </div>
        </FormField>

        <FormField label="Transaction Channel" required error={errors.transaction?.transactionChannel}>
          <input
            {...register('transaction.transactionChannel')}
            className={inputClass}
            placeholder="e.g. Utilityhub"
          />
        </FormField>

        <FormField label="Center" required error={errors.portalMeta?.center}>
          <select {...register('portalMeta.center')} className={selectClass}>
            <option value="" disabled>
              Select center…
            </option>
            {CENTER_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="DNC number" error={errors.portalMeta?.dncNumber} hint="Digits only">
          <input
            inputMode="numeric"
            autoComplete="off"
            {...register('portalMeta.dncNumber', {
              setValueAs: (v) => String(v ?? '').replaceAll(/\D/g, ''),
            })}
            className={inputClass}
            placeholder="Optional"
          />
        </FormField>

        <FormField label="Agent name" error={errors.portalMeta?.agentName}>
          <input {...register('portalMeta.agentName')} className={inputClass} placeholder="Optional" autoComplete="off" />
        </FormField>

        <FormField label="Closer" error={errors.portalMeta?.closer}>
          <input {...register('portalMeta.closer')} className={inputClass} placeholder="Optional" autoComplete="off" />
        </FormField>

        <FormField label="Auditor name" error={errors.portalMeta?.auditorName}>
          <input {...register('portalMeta.auditorName')} className={inputClass} placeholder="Optional" autoComplete="off" />
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
          required
          error={errors.transaction?.transactionVerificationCode}
          hint="Fixed prefix OWR-; enter the numeric part only"
        >
          <div className="flex">
            <span className="inline-flex items-center px-3 py-2 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-sm font-mono text-gray-700">
              OWR-
            </span>
            <input
              inputMode="numeric"
              autoComplete="off"
              aria-label="Verification code digits"
              onChange={handleVerificationDigitsChange}
              value={verificationDigits}
              className={`${inputClass} rounded-l-none font-mono`}
              placeholder="Enter digits"
              maxLength={26}
            />
            <input
              type="hidden"
              {...register('transaction.transactionVerificationCode', {
                setValueAs: (v) => {
                  const raw = String(v ?? '').toUpperCase();
                  const digits = raw.replace(/^OWR-?/, '').replaceAll(/\D/g, '').slice(0, 26);
                  return digits.length ? `OWR-${digits}` : '';
                },
              })}
            />
          </div>
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
