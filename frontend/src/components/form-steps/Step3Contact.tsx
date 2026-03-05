import { useFormContext, useFieldArray } from 'react-hook-form';
import FormField, { inputClass, selectClass } from '../ui/FormField';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const SALUTATIONS = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'];
const STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
const PHONE_TYPES = ['MOBILE', 'HOME', 'WORK'] as const;

function PhoneFields({ basePath }: { basePath: string }) {
  const { register, control, formState: { errors } } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: `${basePath}.phones` });

  const getNestedError = (index: number, field: string) => {
    const parts = basePath.split('.');
    let err: Record<string, unknown> = errors;
    for (const p of parts) {
      err = err?.[p] as Record<string, unknown>;
      if (!err) return undefined;
    }
    const phones = err?.phones as Array<Record<string, { message?: string }>> | undefined;
    return phones?.[index]?.[field];
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Phone Numbers <span className="text-danger-500">*</span>
        </label>
        <button
          type="button"
          onClick={() => append({ type: 'MOBILE', number: '' })}
          className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add Phone
        </button>
      </div>
      {fields.length === 0 && (
        <p className="text-xs text-danger-500">At least one phone number is required</p>
      )}
      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-2">
          <select
            {...register(`${basePath}.phones.${index}.type`)}
            className={`${selectClass} w-28 shrink-0`}
          >
            {PHONE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="flex-1">
            <input
              {...register(`${basePath}.phones.${index}.number`)}
              className={inputClass}
              placeholder="04XX XXX XXX"
            />
            {getNestedError(index, 'number') && (
              <p className="mt-0.5 text-xs text-danger-500">
                {(getNestedError(index, 'number') as { message?: string })?.message}
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

function AddressFields({ basePath }: { basePath: string }) {
  const { register, formState: { errors } } = useFormContext();

  const getErr = (field: string) => {
    const parts = `${basePath}.${field}`.split('.');
    let err: unknown = errors;
    for (const p of parts) {
      err = (err as Record<string, unknown>)?.[p];
      if (!err) return undefined;
    }
    return err as { message?: string } | undefined;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      <FormField label="Postcode" required error={getErr('postcode')}>
        <input
          {...register(`${basePath}.postcode`)}
          className={inputClass}
          placeholder="3000"
          maxLength={4}
        />
      </FormField>
    </div>
  );
}

export default function Step3Contact() {
  const { register, formState: { errors } } = useFormContext();
  const [showSecondary, setShowSecondary] = useState(false);

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
            error={errors.contacts?.primaryContact?.salutation}
          >
            <select
              {...register('contacts.primaryContact.salutation')}
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
            error={errors.contacts?.primaryContact?.firstName}
          >
            <input
              {...register('contacts.primaryContact.firstName')}
              className={inputClass}
            />
          </FormField>
          <FormField label="Middle Name" error={errors.contacts?.primaryContact?.middleName}>
            <input
              {...register('contacts.primaryContact.middleName')}
              className={inputClass}
              placeholder="Optional"
            />
          </FormField>
          <FormField
            label="Last Name"
            required
            error={errors.contacts?.primaryContact?.lastName}
          >
            <input
              {...register('contacts.primaryContact.lastName')}
              className={inputClass}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField
            label="Date of Birth"
            required
            error={errors.contacts?.primaryContact?.dateOfBirth}
          >
            <input
              type="date"
              {...register('contacts.primaryContact.dateOfBirth')}
              className={inputClass}
            />
          </FormField>
          <FormField label="Email" error={errors.contacts?.primaryContact?.email}>
            <input
              type="email"
              {...register('contacts.primaryContact.email')}
              className={inputClass}
              placeholder="contact@example.com"
            />
          </FormField>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Address</p>
          <AddressFields basePath="contacts.primaryContact.address" />
        </div>

        <PhoneFields basePath="contacts.primaryContact" />
      </div>

      {/* Secondary contact toggle */}
      <div className="border-t pt-5">
        <button
          type="button"
          onClick={() => setShowSecondary(!showSecondary)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 cursor-pointer"
        >
          {showSecondary ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          {showSecondary ? 'Hide' : 'Add'} Secondary Contact
        </button>

        {showSecondary && (
          <div className="mt-4 space-y-5 pl-0 md:pl-4 border-l-2 border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <FormField label="Salutation">
                <select
                  {...register('contacts.secondaryContact.salutation')}
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
              <FormField label="First Name">
                <input
                  {...register('contacts.secondaryContact.firstName')}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Middle Name">
                <input
                  {...register('contacts.secondaryContact.middleName')}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Last Name">
                <input
                  {...register('contacts.secondaryContact.lastName')}
                  className={inputClass}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Date of Birth">
                <input
                  type="date"
                  {...register('contacts.secondaryContact.dateOfBirth')}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Email">
                <input
                  type="email"
                  {...register('contacts.secondaryContact.email')}
                  className={inputClass}
                />
              </FormField>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
