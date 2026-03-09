import { useEffect } from 'react';
import { useFormContext, useWatch, type FieldErrors } from 'react-hook-form';
import FormField, { inputClass, selectClass } from '../ui/FormField';
import type { TransactionPayload } from '../../lib/types';

// RESIDENT customerType: subType must be RESIDENT. COMPANY: one of Incorporation, Limited Company, NA, etc.
const RESIDENT_SUB_TYPES = ['RESIDENT'] as const;
const COMPANY_SUB_TYPES = ['Incorporation', 'Limited Company', 'NA', 'Partnership', 'Private', 'Sole Trader', 'Trust', 'C&I', 'SME'] as const;
const INDUSTRIES = [
  'Agriculture',
  'Construction',
  'Education',
  'Finance',
  'Healthcare',
  'Hospitality',
  'Manufacturing',
  'Mining',
  'Retail',
  'Technology',
  'Utilities',
  'Other',
];
const STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

export default function Step2Customer() {
  const { register, formState, control, setValue } = useFormContext();
  const errors = formState.errors as FieldErrors<TransactionPayload>;

  const customerType = useWatch({ control, name: 'customer.customerType' });
  const customerSubType = useWatch({ control, name: 'customer.customerSubType' });
  const hasPassport = useWatch({ control, name: 'customer.residentIdentity.passport.documentId' });

  useEffect(() => {
    if (customerType === 'RESIDENT' && customerSubType !== 'RESIDENT' && customerSubType !== '') {
      setValue('customer.customerSubType', 'RESIDENT');
    } else if (customerType === 'COMPANY' && customerSubType === 'RESIDENT') {
      setValue('customer.customerSubType', '');
    }
  }, [customerType, customerSubType, setValue]);
  const hasDL = useWatch({ control, name: 'customer.residentIdentity.drivingLicense.documentId' });
  const hasMC = useWatch({ control, name: 'customer.residentIdentity.medicare.documentId' });

  function clearIdentitySection(section: 'passport' | 'drivingLicense' | 'medicare') {
    const base = `customer.residentIdentity.${section}`;
    const fields =
      section === 'passport'
        ? ['documentId', 'documentNumber', 'documentExpiryDate', 'issuingCountry']
        : section === 'drivingLicense'
          ? ['documentId', 'documentNumber', 'documentExpiryDate', 'issuingState']
          : ['documentId', 'documentNumber', 'documentExpiryDate'];
    fields.forEach((f) => setValue(`${base}.${f}`, ''));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Customer Information</h2>
        <p className="text-sm text-gray-500 mt-1">
          Details about the customer requesting the service.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormField label="Customer Type" required error={errors.customer?.customerType}>
          <div className="flex gap-3">
            {(['RESIDENT', 'COMPANY'] as const).map((type) => (
              <label
                key={type}
                className={`flex-1 flex items-center justify-center px-4 py-2.5 border rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                  customerType === type
                    ? 'bg-primary-50 border-primary-600 text-primary-700'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  {...register('customer.customerType')}
                  value={type}
                  className="sr-only"
                />
                {type === 'RESIDENT' ? 'Residential' : 'Company'}
              </label>
            ))}
          </div>
        </FormField>

        <FormField label="Customer Sub-Type" required error={errors.customer?.customerSubType}>
          <select {...register('customer.customerSubType')} className={selectClass}>
            <option value="">Select...</option>
            {(customerType === 'COMPANY' ? COMPANY_SUB_TYPES : RESIDENT_SUB_TYPES).map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Communication Preference"
          required
          error={errors.customer?.communicationPreference}
        >
          <select {...register('customer.communicationPreference')} className={selectClass}>
            <option value="">Select...</option>
            <option value="POST">Post</option>
            <option value="EMAIL">Email</option>
          </select>
        </FormField>

        <FormField label="Promotion Consent" required error={errors.customer?.promotionAllowed}>
          <label className="flex items-center gap-2 mt-1 cursor-pointer">
            <input
              type="checkbox"
              {...register('customer.promotionAllowed', {
                setValueAs: (v) => v === true || v === 'on',
              })}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Customer agrees to receive promotions</span>
          </label>
        </FormField>
      </div>

      {/* Resident identity */}
      {customerType === 'RESIDENT' && (
        <div className="space-y-5 border-t pt-5">
          <p className="text-sm font-medium text-gray-900">
            Identity Documents{' '}
            <span className="text-gray-500 font-normal">(at least one required)</span>
          </p>
          {errors.customer?.residentIdentity?.passport?.message &&
            !hasPassport &&
            !hasDL &&
            !hasMC && (
              <p className="text-xs text-danger-500">
                {errors.customer.residentIdentity.passport.message as string}
              </p>
            )}

          {/* Passport */}
          <details className="group border rounded-lg" open={!!hasPassport}>
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
              Passport
              {hasPassport && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    clearIdentitySection('passport');
                  }}
                  className="text-xs text-gray-500 hover:text-danger-500 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </summary>
            <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Document ID" error={errors.customer?.residentIdentity?.passport?.documentId}>
                <input
                  {...register('customer.residentIdentity.passport.documentId')}
                  className={inputClass}
                  placeholder="Passport number"
                />
              </FormField>
              <FormField label="Document Number" error={errors.customer?.residentIdentity?.passport?.documentNumber} hint="Optional">
                <input
                  {...register('customer.residentIdentity.passport.documentNumber')}
                  className={inputClass}
                  placeholder="Optional"
                />
              </FormField>
              <FormField label="Expiry Date" error={errors.customer?.residentIdentity?.passport?.documentExpiryDate}>
                <input
                  type="date"
                  {...register('customer.residentIdentity.passport.documentExpiryDate')}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Issuing Country" error={errors.customer?.residentIdentity?.passport?.issuingCountry}>
                <input
                  {...register('customer.residentIdentity.passport.issuingCountry')}
                  className={inputClass}
                  placeholder="e.g. Australia"
                />
              </FormField>
            </div>
          </details>

          {/* Driving License */}
          <details className="group border rounded-lg" open={!!hasDL}>
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
              Driving License
              {hasDL && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    clearIdentitySection('drivingLicense');
                  }}
                  className="text-xs text-gray-500 hover:text-danger-500 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </summary>
            <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Document ID" error={errors.customer?.residentIdentity?.drivingLicense?.documentId}>
                <input
                  {...register('customer.residentIdentity.drivingLicense.documentId')}
                  className={inputClass}
                  placeholder="License number"
                />
              </FormField>
              <FormField label="Document Number" error={errors.customer?.residentIdentity?.drivingLicense?.documentNumber} hint="Optional">
                <input
                  {...register('customer.residentIdentity.drivingLicense.documentNumber')}
                  className={inputClass}
                  placeholder="Optional"
                />
              </FormField>
              <FormField label="Expiry Date" error={errors.customer?.residentIdentity?.drivingLicense?.documentExpiryDate}>
                <input
                  type="date"
                  {...register('customer.residentIdentity.drivingLicense.documentExpiryDate')}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Issuing State" error={errors.customer?.residentIdentity?.drivingLicense?.issuingState}>
                <select
                  {...register('customer.residentIdentity.drivingLicense.issuingState')}
                  className={selectClass}
                >
                  <option value="">Select...</option>
                  {STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </details>

          {/* Medicare */}
          <details className="group border rounded-lg" open={!!hasMC}>
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
              Medicare Card
              {hasMC && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    clearIdentitySection('medicare');
                  }}
                  className="text-xs text-gray-500 hover:text-danger-500 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </summary>
            <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Document ID" error={errors.customer?.residentIdentity?.medicare?.documentId}>
                <input
                  {...register('customer.residentIdentity.medicare.documentId')}
                  className={inputClass}
                  placeholder="Card number"
                />
              </FormField>
              <FormField label="Document Number" error={errors.customer?.residentIdentity?.medicare?.documentNumber}>
                <input
                  {...register('customer.residentIdentity.medicare.documentNumber')}
                  className={inputClass}
                  placeholder="Reference number"
                />
              </FormField>
              <FormField label="Expiry Date" error={errors.customer?.residentIdentity?.medicare?.documentExpiryDate}>
                <input
                  type="date"
                  {...register('customer.residentIdentity.medicare.documentExpiryDate')}
                  className={inputClass}
                />
              </FormField>
            </div>
          </details>
        </div>
      )}

      {/* Company identity */}
      {customerType === 'COMPANY' && (
        <div className="space-y-5 border-t pt-5">
          <p className="text-sm font-medium text-gray-900">Company Details</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Industry" error={errors.customer?.companyIdentity?.industry}>
              <select {...register('customer.companyIdentity.industry')} className={selectClass}>
                <option value="">Select industry...</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Entity Name" required error={errors.customer?.companyIdentity?.entityName}>
              <input
                {...register('customer.companyIdentity.entityName')}
                className={inputClass}
                placeholder="Legal entity name"
              />
            </FormField>

            <FormField label="Trading Name" required error={errors.customer?.companyIdentity?.tradingName}>
              <input
                {...register('customer.companyIdentity.tradingName')}
                className={inputClass}
                placeholder="Trading name"
              />
            </FormField>

            <FormField label="Trustee Name" error={errors.customer?.companyIdentity?.trusteeName}>
              <input
                {...register('customer.companyIdentity.trusteeName')}
                className={inputClass}
                placeholder="Optional"
              />
            </FormField>

            <FormField label="ABN" required error={errors.customer?.companyIdentity?.abn?.documentId} hint="11 digits">
              <input
                {...register('customer.companyIdentity.abn.documentId')}
                className={inputClass}
                placeholder="12345678901"
                maxLength={11}
              />
            </FormField>

            <FormField label="ACN" error={errors.customer?.companyIdentity?.acn?.documentId} hint="9 digits (optional)">
              <input
                {...register('customer.companyIdentity.acn.documentId')}
                className={inputClass}
                placeholder="123456789"
                maxLength={9}
              />
            </FormField>
          </div>
        </div>
      )}
    </div>
  );
}
