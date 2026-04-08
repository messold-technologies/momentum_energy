import { useFormContext, useFieldArray, type FieldError, type FieldErrors } from 'react-hook-form';
import FormField, { inputClass, selectClass } from '../ui/FormField';
import { Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { TransactionPayload } from '../../lib/types';
import { COUNTRY_CODES } from '../../lib/countryCodes';
import { STREET_TYPE_CODES } from '../../lib/streetTypeCodes';

const SALUTATIONS = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.'];
// Must match backend: ACT, NT, WA, SA, VIC, NSW only
const STATES = ['ACT', 'NT', 'WA', 'SA', 'VIC', 'NSW', 'QLD'] as const;
const PHONE_TYPES = ['MOBILE', 'HOME', 'WORK'] as const;

function PhoneFields({ basePath }: Readonly<{ basePath: string }>) {
  const { register, control, formState } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: `${basePath}.contactPhones` });

  const getNestedError = (index: number, field: string) => {
    const parts = basePath.split('.');
    let err: Record<string, unknown> = formState.errors;
    for (const p of parts) {
      err = err?.[p] as Record<string, unknown>;
      if (!err) return undefined;
    }
    const phones = err?.contactPhones as Array<Record<string, { message?: string }>> | undefined;
    return phones?.[index]?.[field];
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700" htmlFor={`${basePath}.contactPhones.0.phone`}>
          Phone Numbers <span className="text-danger-500">*</span>
        </label>
        <button
          type="button"
          onClick={() => append({ contactPhoneType: 'MOBILE', phone: '' })}
          className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add Phone
        </button>
      </div>
      {fields.length === 0 && (
        <p className="text-xs text-danger-500">At least one phone number is required.</p>
      )}
      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-2 items-start">
          <select
            {...register(`${basePath}.contactPhones.${index}.contactPhoneType`)}
            className="w-24 shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
          >
            {PHONE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="flex-1 min-w-0">
            <input
              id={`${basePath}.contactPhones.${index}.phone`}
              {...register(`${basePath}.contactPhones.${index}.phone`)}
              className={inputClass}
              placeholder="04XX XXX XXX"
            />
            {getNestedError(index, 'phone') && (
              <p className="mt-0.5 text-xs text-danger-500">
                {(getNestedError(index, 'phone') as { message?: string })?.message}
              </p>
            )}
          </div>
          {fields.length > 1 && (
            <button
              type="button"
              onClick={() => remove(index)}
              className="text-gray-400 hover:text-danger-500 p-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function AddressFields({ basePath }: Readonly<{ basePath: string }>) {
  const { register, formState } = useFormContext();

  const getErr = (field: string): FieldError | undefined => {
    const parts = `${basePath}.${field}`.split('.');
    let err: unknown = formState.errors;
    for (const p of parts) {
      err = (err as Record<string, unknown>)?.[p];
      if (!err) return undefined;
    }
    const e = err as { message?: string } | undefined;
    if (!e?.message) return undefined;
    return { type: 'validation', message: e.message };
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <FormField label="Address Type" error={getErr('addressType')}>
        <input
          {...register(`${basePath}.addressType`)}
          className={inputClass}
          placeholder="Optional - letters only"
        />
      </FormField>
      <FormField label="Unit Number" error={getErr('unitNumber')}>
        <input
          {...register(`${basePath}.unitNumber`)}
          className={inputClass}
          placeholder="Optional"
        />
      </FormField>
      <FormField label="Street Number" required error={getErr('streetNumber')}>
        <input
          {...register(`${basePath}.streetNumber`)}
          className={inputClass}
          placeholder="123"
        />
      </FormField>
      <FormField label="Street Name" required error={getErr('streetName')}>
        <input
          {...register(`${basePath}.streetName`)}
          className={inputClass}
          placeholder="Main Street"
        />
      </FormField>
      <FormField label="Street Type" required error={getErr('streetTypeCode')}>
        <select {...register(`${basePath}.streetTypeCode`)} className={selectClass}>
          <option value="">Select...</option>
          {STREET_TYPE_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Suburb" required error={getErr('suburb')}>
        <input {...register(`${basePath}.suburb`)} className={inputClass} placeholder="Melbourne" />
      </FormField>
      <FormField label="State" required error={getErr('state')}>
        <select {...register(`${basePath}.state`)} className={selectClass}>
          <option value="">Select...</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Post Code" required error={getErr('postCode')}>
        <input
          {...register(`${basePath}.postCode`)}
          className={inputClass}
          placeholder="3000"
          maxLength={4}
        />
      </FormField>
    </div>
  );
}

export default function Step3Contact() {
  const { register, formState, unregister, clearErrors, getValues, setValue } = useFormContext();
  const errors = formState.errors as FieldErrors<TransactionPayload>;
  const [showSecondary, setShowSecondary] = useState(false);
  const secondaryCacheRef = useRef<TransactionPayload['customer']['contacts']['secondaryContact'] | undefined>(undefined);

  const toggleSecondary = (checked: boolean) => {
    setShowSecondary(checked);
    if (!checked) {
      secondaryCacheRef.current = getValues('customer.contacts.secondaryContact');
      unregister('customer.contacts.secondaryContact');
      clearErrors('customer.contacts.secondaryContact');
    } else if (secondaryCacheRef.current) {
      setValue('customer.contacts.secondaryContact', secondaryCacheRef.current, { shouldDirty: false, shouldValidate: false });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Contact Details</h2>
        <p className="text-sm text-gray-500 mt-1">Primary and optional secondary contact.</p>
      </div>

      {/* Primary contact */}
      <div className="space-y-5">
        <p className="text-sm font-medium text-gray-900">Primary Contact</p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <FormField
            label="Salutation"
            required
            error={errors.customer?.contacts?.primaryContact?.salutation}
          >
            <select
              {...register('customer.contacts.primaryContact.salutation')}
              className={selectClass}
            >
              <option value="">Select...</option>
              {SALUTATIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="First Name"
            required
            error={errors.customer?.contacts?.primaryContact?.firstName}
          >
            <input
              {...register('customer.contacts.primaryContact.firstName')}
              className={inputClass}
            />
          </FormField>
          <FormField label="Middle Name" error={errors.customer?.contacts?.primaryContact?.middleName}>
            <input
              {...register('customer.contacts.primaryContact.middleName')}
              className={inputClass}
              placeholder="Optional"
            />
          </FormField>
          <FormField
            label="Last Name"
            required
            error={errors.customer?.contacts?.primaryContact?.lastName}
          >
            <input
              {...register('customer.contacts.primaryContact.lastName')}
              className={inputClass}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <FormField
            label="Date of Birth"
            required
            error={errors.customer?.contacts?.primaryContact?.dateOfBirth}
          >
            <input
              type="date"
              {...register('customer.contacts.primaryContact.dateOfBirth')}
              className={inputClass}
            />
          </FormField>
          <FormField label="Email" required error={errors.customer?.contacts?.primaryContact?.email}>
            <input
              type="email"
              {...register('customer.contacts.primaryContact.email')}
              className={inputClass}
              placeholder="contact@example.com"
            />
          </FormField>
          <FormField label="Country of Birth" error={errors.customer?.contacts?.primaryContact?.countryOfBirth}>
            <select
              {...register('customer.contacts.primaryContact.countryOfBirth')}
              className={selectClass}
            >
              <option value="">Select...</option>
              {COUNTRY_CODES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Address</p>
          <AddressFields basePath="customer.contacts.primaryContact.addresses.0" />
        </div>

        <PhoneFields basePath="customer.contacts.primaryContact" />
      </div>

      {/* Secondary contact toggle */}
      <div className="border-t pt-5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showSecondary}
            onChange={(e) => toggleSecondary(e.target.checked)}
            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-gray-700">Secondary Contact</span>
        </label>

        {showSecondary && (
          <div className="mt-4 space-y-5 pl-0 md:pl-4 border-l-2 border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <FormField
                label="Salutation"
                required
                error={errors.customer?.contacts?.secondaryContact?.salutation}
              >
                <select
                  {...register('customer.contacts.secondaryContact.salutation', {
                    setValueAs: (v) => (v === '' ? undefined : v),
                  })}
                  className={selectClass}
                >
                  <option value="">Select...</option>
                  {SALUTATIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                label="First Name"
                required
                error={errors.customer?.contacts?.secondaryContact?.firstName}
              >
                <input
                  {...register('customer.contacts.secondaryContact.firstName')}
                  className={inputClass}
                  placeholder="Start with uppercase"
                />
              </FormField>
              <FormField label="Middle Name" error={errors.customer?.contacts?.secondaryContact?.middleName}>
                <input
                  {...register('customer.contacts.secondaryContact.middleName')}
                  className={inputClass}
                  placeholder="Optional"
                />
              </FormField>
              <FormField
                label="Last Name"
                required
                error={errors.customer?.contacts?.secondaryContact?.lastName}
              >
                <input
                  {...register('customer.contacts.secondaryContact.lastName')}
                  className={inputClass}
                  placeholder="Start with uppercase"
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FormField
                label="Country of Birth"
                error={errors.customer?.contacts?.secondaryContact?.countryOfBirth}
              >
                <select
                  {...register('customer.contacts.secondaryContact.countryOfBirth')}
                  className={selectClass}
                >
                  <option value="">Select...</option>
                  {COUNTRY_CODES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                label="Date of Birth"
                required
                error={errors.customer?.contacts?.secondaryContact?.dateOfBirth}
              >
                <input
                  type="date"
                  {...register('customer.contacts.secondaryContact.dateOfBirth')}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Email" error={errors.customer?.contacts?.secondaryContact?.email}>
                <input
                  type="email"
                  {...register('customer.contacts.secondaryContact.email')}
                  className={inputClass}
                  placeholder="Optional"
                />
              </FormField>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
