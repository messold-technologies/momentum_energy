import { useFormContext, useWatch } from 'react-hook-form';
import FormField, { inputClass, selectClass } from '../ui/FormField';

const RESIDENT_SUB_TYPES = ['OWNER_OCCUPIER', 'TENANT', 'PROPERTY_MANAGER'];
const COMPANY_SUB_TYPES = ['SOLE_TRADER', 'PARTNERSHIP', 'TRUST', 'COMPANY'];
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
  'Transport',
  'Other',
];
const STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

export default function Step2Customer() {
  const {
    register,
    formState: { errors },
    control,
    setValue,
  } = useFormContext();

  const customerType = useWatch({ control, name: 'customer.customerType' });
  const hasPassport = useWatch({ control, name: 'customer.passport.documentId' });
  const hasDL = useWatch({ control, name: 'customer.drivingLicense.documentId' });
  const hasMC = useWatch({ control, name: 'customer.medicareCard.documentId' });

  function clearIdentitySection(section: 'passport' | 'drivingLicense' | 'medicareCard') {
    const fields =
      section === 'passport'
        ? ['documentId', 'expiryDate', 'countryOfBirth']
        : section === 'drivingLicense'
          ? ['documentId', 'expiryDate', 'issuingState']
          : ['documentId', 'referenceNumber', 'expiryDate'];
    fields.forEach((f) => setValue(`customer.${section}.${f}`, ''));
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

        <FormField label="Customer Sub-Type" error={errors.customer?.customerSubType}>
          <select {...register('customer.customerSubType')} className={selectClass}>
            <option value="">Select...</option>
            {(customerType === 'COMPANY' ? COMPANY_SUB_TYPES : RESIDENT_SUB_TYPES).map((st) => (
              <option key={st} value={st}>
                {st.replace(/_/g, ' ')}
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
            <option value="EMAIL">Email</option>
            <option value="POST">Post</option>
          </select>
        </FormField>

        <FormField label="Promotion Consent" required error={errors.customer?.promotionConsent}>
          <label className="flex items-center gap-2 mt-1 cursor-pointer">
            <input
              type="checkbox"
              {...register('customer.promotionConsent')}
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
          {errors.customer?.passport?.message &&
            !hasPassport &&
            !hasDL &&
            !hasMC && (
              <p className="text-xs text-danger-500">
                {errors.customer.passport.message as string}
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
            <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Document ID" error={errors.customer?.passport?.documentId}>
                <input
                  {...register('customer.passport.documentId')}
                  className={inputClass}
                  placeholder="Passport number"
                />
              </FormField>
              <FormField label="Expiry Date" error={errors.customer?.passport?.expiryDate}>
                <input
                  type="date"
                  {...register('customer.passport.expiryDate')}
                  className={inputClass}
                />
              </FormField>
              <FormField
                label="Country of Birth"
                error={errors.customer?.passport?.countryOfBirth}
              >
                <input
                  {...register('customer.passport.countryOfBirth')}
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
            <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Document ID" error={errors.customer?.drivingLicense?.documentId}>
                <input
                  {...register('customer.drivingLicense.documentId')}
                  className={inputClass}
                  placeholder="License number"
                />
              </FormField>
              <FormField label="Expiry Date" error={errors.customer?.drivingLicense?.expiryDate}>
                <input
                  type="date"
                  {...register('customer.drivingLicense.expiryDate')}
                  className={inputClass}
                />
              </FormField>
              <FormField
                label="Issuing State"
                error={errors.customer?.drivingLicense?.issuingState}
              >
                <select
                  {...register('customer.drivingLicense.issuingState')}
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

          {/* Medicare Card */}
          <details className="group border rounded-lg" open={!!hasMC}>
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
              Medicare Card
              {hasMC && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    clearIdentitySection('medicareCard');
                  }}
                  className="text-xs text-gray-500 hover:text-danger-500 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </summary>
            <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Document ID" error={errors.customer?.medicareCard?.documentId}>
                <input
                  {...register('customer.medicareCard.documentId')}
                  className={inputClass}
                  placeholder="Card number"
                />
              </FormField>
              <FormField
                label="Reference Number"
                error={errors.customer?.medicareCard?.referenceNumber}
              >
                <input
                  {...register('customer.medicareCard.referenceNumber')}
                  className={inputClass}
                  placeholder="Reference number"
                />
              </FormField>
              <FormField label="Expiry Date" error={errors.customer?.medicareCard?.expiryDate}>
                <input
                  type="date"
                  {...register('customer.medicareCard.expiryDate')}
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
            <FormField label="Industry" error={errors.customer?.industry}>
              <select {...register('customer.industry')} className={selectClass}>
                <option value="">Select industry...</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Entity Name" required error={errors.customer?.entityName}>
              <input
                {...register('customer.entityName')}
                className={inputClass}
                placeholder="Legal entity name"
              />
            </FormField>

            <FormField label="Trading Name" error={errors.customer?.tradingName}>
              <input
                {...register('customer.tradingName')}
                className={inputClass}
                placeholder="Optional"
              />
            </FormField>

            <FormField label="Trustee Name" error={errors.customer?.trusteeName}>
              <input
                {...register('customer.trusteeName')}
                className={inputClass}
                placeholder="Optional"
              />
            </FormField>

            <FormField label="ABN" required error={errors.customer?.abn} hint="11 digits">
              <input
                {...register('customer.abn')}
                className={inputClass}
                placeholder="12345678901"
                maxLength={11}
              />
            </FormField>

            <FormField label="ACN" error={errors.customer?.acn} hint="9 digits (optional)">
              <input
                {...register('customer.acn')}
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
