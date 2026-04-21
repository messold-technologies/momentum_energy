import { useFormContext } from 'react-hook-form';
import type { FormValues } from '../firstEnergyFormSchema';
import { useFirstEnergyWizard } from '../FirstEnergyWizardContext';
import { FieldError, fieldClass, RequiredMark } from '../firstEnergyFormShared';

export function FirstEnergyStepAddress() {
  const methods = useFormContext<FormValues>();
  const w = useFirstEnergyWizard();

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Supply address</h2>
      <div>
        <label htmlFor="fe_address_search" className="block text-sm font-medium text-gray-700 mb-1">
          Search address
        </label>
        <div className="relative">
          <input
            id="fe_address_search"
            {...methods.register('addressSearchTerm')}
            placeholder="Start typing…"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pr-10"
          />
          {w.addressSearching ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : null}
        </div>
        {w.suggestionOptions.length > 0 ? (
          <div className="mt-2 border border-gray-200 rounded-lg divide-y max-h-56 overflow-auto">
            {w.suggestionOptions.slice(0, 20).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => w.handlePickAddress(s.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <div className="sm:col-span-1">
          <label htmlFor="fe_postcode" className="block text-sm font-medium text-gray-700 mb-1">
            Postcode <RequiredMark />
          </label>
          <input
            id="fe_postcode"
            {...methods.register('address.PostCode')}
            className={fieldClass(!!methods.formState.errors.address?.PostCode)}
          />
          <FieldError message={methods.formState.errors.address?.PostCode?.message} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="fe_suburb" className="block text-sm font-medium text-gray-700 mb-1">
            Suburb <RequiredMark />
          </label>
          {w.suburbOptions.length ? (
            <div className="relative">
              <select
                id="fe_suburb"
                {...methods.register('address.Suburb')}
                className={`${fieldClass(!!methods.formState.errors.address?.Suburb)} disabled:opacity-50`}
                disabled={w.postcodeLoading}
              >
                <option value="">Select…</option>
                {w.suburbOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {w.postcodeLoading ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : null}
            </div>
          ) : (
            <input
              id="fe_suburb"
              {...methods.register('address.Suburb')}
              className={fieldClass(!!methods.formState.errors.address?.Suburb)}
            />
          )}
          <FieldError message={methods.formState.errors.address?.Suburb?.message} />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="fe_state" className="block text-sm font-medium text-gray-700 mb-1">
            State <RequiredMark />
          </label>
          <input id="fe_state" {...methods.register('address.State')} className={fieldClass(!!methods.formState.errors.address?.State)} />
          <FieldError message={methods.formState.errors.address?.State?.message} />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="fe_street_no" className="block text-sm font-medium text-gray-700 mb-1">
            Street no. <RequiredMark />
          </label>
          <input
            id="fe_street_no"
            {...methods.register('address.StreetNumber')}
            className={fieldClass(!!methods.formState.errors.address?.StreetNumber)}
          />
          <FieldError message={methods.formState.errors.address?.StreetNumber?.message} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="fe_street_name" className="block text-sm font-medium text-gray-700 mb-1">
            Street name <RequiredMark />
          </label>
          <input
            id="fe_street_name"
            {...methods.register('address.StreetName')}
            className={fieldClass(!!methods.formState.errors.address?.StreetName)}
          />
          <FieldError message={methods.formState.errors.address?.StreetName?.message} />
        </div>
        <div>
          <label htmlFor="fe_street_type" className="block text-sm font-medium text-gray-700 mb-1">
            Street type <RequiredMark />
          </label>
          <input
            id="fe_street_type"
            {...methods.register('address.StreetType')}
            className={fieldClass(!!methods.formState.errors.address?.StreetType)}
          />
          <FieldError message={methods.formState.errors.address?.StreetType?.message} />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Concession</h3>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...methods.register('customer.concession.enabled')} className="rounded border-gray-300" />
            Add concession
          </label>
        </div>

        {methods.watch('customer.concession.enabled') ? (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="fe_concession_type" className="block text-sm font-medium text-gray-700 mb-1">
                  Concession type <RequiredMark />
                </label>
                {w.concessionOptions.length ? (
                  <div className="relative">
                    <select
                      id="fe_concession_type"
                      {...methods.register('customer.concession.concession')}
                      className={`${fieldClass(!!methods.formState.errors.customer?.concession?.concession)} disabled:opacity-50`}
                      disabled={w.concessionLoading}
                    >
                      <option value="">Select…</option>
                      {w.concessionOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {w.concessionLoading ? (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <input
                    id="fe_concession_type"
                    {...methods.register('customer.concession.concession')}
                    className={fieldClass(!!methods.formState.errors.customer?.concession?.concession)}
                    placeholder={
                      String(methods.watch('address.State') ?? '').trim()
                        ? 'Loading types… or enter code'
                        : 'Enter state above first, or type code'
                    }
                  />
                )}
                <FieldError message={methods.formState.errors.customer?.concession?.concession?.message} />
              </div>
              <div>
                <label htmlFor="fe_concession_ref" className="block text-sm font-medium text-gray-700 mb-1">
                  Reference <RequiredMark />
                </label>
                <input
                  id="fe_concession_ref"
                  {...methods.register('customer.concession.reference')}
                  className={fieldClass(!!methods.formState.errors.customer?.concession?.reference)}
                />
                <FieldError message={methods.formState.errors.customer?.concession?.reference?.message} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="fe_concession_issued" className="block text-sm font-medium text-gray-700 mb-1">
                    Issued on <RequiredMark />
                  </label>
                  <input
                    id="fe_concession_issued"
                    type="date"
                    {...methods.register('customer.concession.issued_on')}
                    className={fieldClass(!!methods.formState.errors.customer?.concession?.issued_on)}
                  />
                  <FieldError message={methods.formState.errors.customer?.concession?.issued_on?.message} />
                </div>
                <div>
                  <label htmlFor="fe_concession_expiry" className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry <RequiredMark />
                  </label>
                  <input
                    id="fe_concession_expiry"
                    type="date"
                    {...methods.register('customer.concession.expires_on')}
                    className={fieldClass(!!methods.formState.errors.customer?.concession?.expires_on)}
                  />
                  <FieldError message={methods.formState.errors.customer?.concession?.expires_on?.message} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="fe_concession_first" className="block text-sm font-medium text-gray-700 mb-1">
                  First name <RequiredMark />
                </label>
                <input
                  id="fe_concession_first"
                  {...methods.register('customer.concession.first_name')}
                  className={fieldClass(!!methods.formState.errors.customer?.concession?.first_name)}
                />
                <FieldError message={methods.formState.errors.customer?.concession?.first_name?.message} />
              </div>
              <div>
                <label htmlFor="fe_concession_middle" className="block text-sm font-medium text-gray-700 mb-1">
                  Middle name (optional)
                </label>
                <input
                  id="fe_concession_middle"
                  {...methods.register('customer.concession.middle_name')}
                  className={fieldClass(false)}
                />
              </div>
              <div>
                <label htmlFor="fe_concession_last" className="block text-sm font-medium text-gray-700 mb-1">
                  Last name <RequiredMark />
                </label>
                <input
                  id="fe_concession_last"
                  {...methods.register('customer.concession.last_name')}
                  className={fieldClass(!!methods.formState.errors.customer?.concession?.last_name)}
                />
                <FieldError message={methods.formState.errors.customer?.concession?.last_name?.message} />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
