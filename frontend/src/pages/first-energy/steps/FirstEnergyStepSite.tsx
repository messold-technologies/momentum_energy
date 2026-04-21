import { useFormContext } from 'react-hook-form';
import type { FormValues } from '../firstEnergyFormSchema';
import { useFirstEnergyWizard } from '../FirstEnergyWizardContext';
import { FieldError, fieldClass, RequiredMark } from '../firstEnergyFormShared';

export function FirstEnergyStepSite() {
  const methods = useFormContext<FormValues>();
  const w = useFirstEnergyWizard();

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Site</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="fe_fuel" className="block text-sm font-medium text-gray-700 mb-1">
            Fuel <RequiredMark />
          </label>
          <select id="fe_fuel" {...methods.register('site.fuel_id')} className={fieldClass(!!methods.formState.errors.site?.fuel_id)}>
            <option value={1}>Electricity</option>
            <option value={2}>Gas</option>
          </select>
          <FieldError message={methods.formState.errors.site?.fuel_id?.message} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="fe_identifier" className="block text-sm font-medium text-gray-700 mb-1">
            Identifier (NMI/MIRN) <RequiredMark />
          </label>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
            <input
              id="fe_identifier"
              {...methods.register('site.identifier')}
              className={`${fieldClass(!!methods.formState.errors.site?.identifier)} sm:flex-1`}
            />
            <button
              type="button"
              onClick={() => void w.lookupMeterIdentifier()}
              disabled={w.meterLookupLoading}
              className="shrink-0 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {w.meterLookupLoading ? 'Looking up…' : 'Look up'}
            </button>
          </div>
          <FieldError message={methods.formState.errors.site?.identifier?.message} />
          {w.meterLookupMessage ? <p className="mt-1 text-xs text-gray-600">{w.meterLookupMessage}</p> : null}
          <p className="mt-1 text-xs text-gray-500">
            Gas (MIRN) lookup uses the meter id and the state from your address. Complete the address step first if state is missing.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="fe_bill_frequency" className="block text-sm font-medium text-gray-700 mb-1">
            Bill frequency (optional)
          </label>
          <select
            id="fe_bill_frequency"
            {...methods.register('site.bill_frequency')}
            className={fieldClass(!!methods.formState.errors.site?.bill_frequency)}
          >
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="GAS_MONTHLY">Gas monthly</option>
            <option value="GAS">Gas</option>
          </select>
          <FieldError message={methods.formState.errors.site?.bill_frequency?.message} />
        </div>
        <div className="flex items-end gap-6 sm:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...methods.register('site.is_owner')} className="rounded border-gray-300" />
            Property owner
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...methods.register('site.has_basic_meter')} className="rounded border-gray-300" />
            Basic meter
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-3">
          <label htmlFor="fe_transfer_instructions" className="block text-sm font-medium text-gray-700 mb-1">
            Transfer instructions (optional)
          </label>
          <textarea
            id="fe_transfer_instructions"
            rows={3}
            {...methods.register('site.transfer_instructions')}
            className={fieldClass(false)}
            placeholder="Any special instructions for the transfer…"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="fe_usage_start" className="block text-sm font-medium text-gray-700 mb-1">
            Usage start date (optional)
          </label>
          <input id="fe_usage_start" type="date" {...methods.register('site.usage_start_date')} className={fieldClass(false)} />
        </div>
        <div>
          <label htmlFor="fe_usage_end" className="block text-sm font-medium text-gray-700 mb-1">
            Usage end date (optional)
          </label>
          <input id="fe_usage_end" type="date" {...methods.register('site.usage_end_date')} className={fieldClass(false)} />
        </div>
        <div>
          <label htmlFor="fe_existing_account" className="block text-sm font-medium text-gray-700 mb-1">
            Existing account number (optional)
          </label>
          <input id="fe_existing_account" {...methods.register('site.existing_account_number')} className={fieldClass(false)} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="fe_offer_id" className="block text-sm font-medium text-gray-700 mb-1">
            Offer ID <RequiredMark />
          </label>
          <input
            id="fe_offer_id"
            type="number"
            {...methods.register('site.offer_id')}
            className={fieldClass(!!methods.formState.errors.site?.offer_id)}
          />
          <FieldError message={methods.formState.errors.site?.offer_id?.message} />
          <p className="mt-1 text-xs text-gray-500">This is `siteOffer.offer_id` from the 1st Energy pricing APIs.</p>
        </div>
        <div className="flex items-end gap-6">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...methods.register('site.has_solar')} className="rounded border-gray-300" />
            Solar
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...methods.register('site.has_interest_on_solar')} className="rounded border-gray-300" />
            Interested in solar
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...methods.register('site.has_medical_cooling')} className="rounded border-gray-300" />
            Medical cooling
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="fe_feed_in_type_id" className="block text-sm font-medium text-gray-700 mb-1">
            Feed-in type ID (optional)
          </label>
          <input id="fe_feed_in_type_id" type="number" {...methods.register('site.feed_in_type_id')} className={fieldClass(false)} />
        </div>
        <div>
          <label htmlFor="fe_greenpower_id" className="block text-sm font-medium text-gray-700 mb-1">
            Greenpower ID (optional)
          </label>
          <input id="fe_greenpower_id" type="number" {...methods.register('site.selected_greenpower_id')} className={fieldClass(false)} />
        </div>
        <div>
          <label htmlFor="fe_vsi_time" className="block text-sm font-medium text-gray-700 mb-1">
            VSI time (optional)
          </label>
          <select id="fe_vsi_time" {...methods.register('site.vsi_time')} className={fieldClass(false)}>
            <option value="09:00">09:00</option>
            <option value="10:00">10:00</option>
            <option value="11:00">11:00</option>
            <option value="12:00">12:00</option>
            <option value="13:00">13:00</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="fe_vsi_method" className="block text-sm font-medium text-gray-700 mb-1">
            VSI method (optional)
          </label>
          <input
            id="fe_vsi_method"
            {...methods.register('site.vsi_method')}
            className={fieldClass(false)}
            placeholder="e.g. customer_on_site"
          />
        </div>
        <div />
        <div />
      </div>

      {w.values.type === 'MoveIn' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="fe_movein_date" className="block text-sm font-medium text-gray-700 mb-1">
                Move-in start date <RequiredMark />
              </label>
              {w.moveInDateOptions.length ? (
                <select
                  id="fe_movein_date"
                  {...methods.register('site.start_date')}
                  className={fieldClass(!!methods.formState.errors.site?.start_date)}
                >
                  <option value="">Select…</option>
                  {w.moveInDateOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="fe_movein_date"
                  type="date"
                  {...methods.register('site.start_date')}
                  className={fieldClass(!!methods.formState.errors.site?.start_date)}
                />
              )}
              <FieldError message={methods.formState.errors.site?.start_date?.message} />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" {...methods.register('site.move_in_terms_accepted')} className="rounded border-gray-300" />
                Move-in terms accepted
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" {...methods.register('site.is_mains_switch_off')} className="rounded border-gray-300" />
                Mains switch off
              </label>
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" {...methods.register('site.is_electricity_disconnected_period')} className="rounded border-gray-300" />
                Disconnected period
              </label>
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" {...methods.register('site.has_ecoc')} className="rounded border-gray-300" />
                ECOC available
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" {...methods.register('site.are_any_building_works')} className="rounded border-gray-300" />
                Any building works
              </label>
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" {...methods.register('site.has_meter_access')} className="rounded border-gray-300" />
                Meter access
              </label>
            </div>
            <div />
          </div>
        </div>
      ) : null}
    </section>
  );
}
