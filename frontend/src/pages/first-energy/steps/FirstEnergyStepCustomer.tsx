import { useFormContext } from 'react-hook-form';
import type { FormValues } from '../firstEnergyFormSchema';
import { useFirstEnergyWizard } from '../FirstEnergyWizardContext';
import { FieldError, fieldClass, RequiredMark } from '../firstEnergyFormShared';

export function FirstEnergyStepCustomer() {
  const methods = useFormContext<FormValues>();
  const w = useFirstEnergyWizard();

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Primary customer</h2>
        <p className="text-sm text-gray-500 mt-1">Customer identity and contact details.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div>
          <label htmlFor="fe_title" className="block text-sm font-medium text-gray-700 mb-1">
            Title <RequiredMark />
          </label>
          <select
            id="fe_title"
            {...methods.register('customer.title')}
            disabled={w.loadingLookups}
            className={`${fieldClass(!!methods.formState.errors.customer?.title)} disabled:opacity-50`}
          >
            <option value="">Select…</option>
            {w.titles.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <FieldError message={methods.formState.errors.customer?.title?.message} />
        </div>
        <div>
          <label htmlFor="fe_first_name" className="block text-sm font-medium text-gray-700 mb-1">
            First name <RequiredMark />
          </label>
          <input
            id="fe_first_name"
            {...methods.register('customer.first_name')}
            className={fieldClass(!!methods.formState.errors.customer?.first_name)}
          />
          <FieldError message={methods.formState.errors.customer?.first_name?.message} />
        </div>
        <div>
          <label htmlFor="fe_middle_name" className="block text-sm font-medium text-gray-700 mb-1">
            Middle name (optional)
          </label>
          <input
            id="fe_middle_name"
            {...methods.register('customer.middle_name')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label htmlFor="fe_last_name" className="block text-sm font-medium text-gray-700 mb-1">
            Last name <RequiredMark />
          </label>
          <input
            id="fe_last_name"
            {...methods.register('customer.last_name')}
            className={fieldClass(!!methods.formState.errors.customer?.last_name)}
          />
          <FieldError message={methods.formState.errors.customer?.last_name?.message} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="fe_dob" className="block text-sm font-medium text-gray-700 mb-1">
            Date of birth <RequiredMark />
          </label>
          <input
            id="fe_dob"
            type="date"
            {...methods.register('customer.date_of_birth')}
            className={fieldClass(!!methods.formState.errors.customer?.date_of_birth)}
          />
          <FieldError message={methods.formState.errors.customer?.date_of_birth?.message} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <label htmlFor="fe_phone_type" className="block text-sm font-medium text-gray-700 mb-1">
              Phone type
            </label>
            <select
              id="fe_phone_type"
              {...methods.register('customer.phone_type')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="Mobile">Mobile</option>
              <option value="Landline">Landline</option>
            </select>
          </div>
          <div className="col-span-2">
            <label htmlFor="fe_phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone <RequiredMark />
            </label>
            <input
              id="fe_phone"
              {...methods.register('customer.phone_number')}
              className={fieldClass(!!methods.formState.errors.customer?.phone_number)}
            />
            <FieldError message={methods.formState.errors.customer?.phone_number?.message} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <label htmlFor="fe_email_type" className="block text-sm font-medium text-gray-700 mb-1">
              Email type
            </label>
            <select
              id="fe_email_type"
              {...methods.register('customer.email_type')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="Contact Email">Contact</option>
              <option value="Billing Email">Billing</option>
              <option value="Business Email">Business</option>
              <option value="Personal Email">Personal</option>
            </select>
          </div>
          <div className="col-span-2">
            <label htmlFor="fe_email" className="block text-sm font-medium text-gray-700 mb-1">
              Email <RequiredMark />
            </label>
            <input
              id="fe_email"
              type="email"
              {...methods.register('customer.email')}
              className={fieldClass(!!methods.formState.errors.customer?.email)}
            />
            <FieldError message={methods.formState.errors.customer?.email?.message} />
          </div>
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" {...methods.register('customer.allow_marketing')} className="rounded border-gray-300" />
        Allow marketing communications
      </label>

      <div className="pt-2">
        <h3 className="text-sm font-semibold text-gray-900">Identification</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
          <div>
            <label htmlFor="fe_id_type" className="block text-sm font-medium text-gray-700 mb-1">
              Type <RequiredMark />
            </label>
            <select
              id="fe_id_type"
              {...methods.register('customer.identification.type')}
              className={fieldClass(!!methods.formState.errors.customer?.identification?.type)}
            >
              {(w.identificationTypes.length
                ? w.identificationTypes
                : ['DriversLicence', 'MedicareCard', 'Passport', 'Plus18Card']
              ).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <FieldError message={methods.formState.errors.customer?.identification?.type?.message} />
          </div>
          <div>
            <label htmlFor="fe_id_reference" className="block text-sm font-medium text-gray-700 mb-1">
              Reference / card number <RequiredMark />
            </label>
            <input
              id="fe_id_reference"
              {...methods.register('customer.identification.reference')}
              className={fieldClass(!!methods.formState.errors.customer?.identification?.reference)}
            />
            <FieldError message={methods.formState.errors.customer?.identification?.reference?.message} />
          </div>
          <div>
            <label htmlFor="fe_id_expiry" className="block text-sm font-medium text-gray-700 mb-1">
              Expiry <RequiredMark />
            </label>
            <input
              id="fe_id_expiry"
              type="date"
              {...methods.register('customer.identification.expires_on')}
              className={fieldClass(!!methods.formState.errors.customer?.identification?.expires_on)}
            />
            <FieldError message={methods.formState.errors.customer?.identification?.expires_on?.message} />
          </div>
        </div>
      </div>
    </section>
  );
}
