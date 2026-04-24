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
          <div className="relative">
            <input
              id="fe_identifier"
              list="fe_identifier_list"
              {...methods.register('site.identifier')}
              className={`${fieldClass(!!methods.formState.errors.site?.identifier)} pr-10`}
              placeholder={Number(w.values.site?.fuel_id) === 2 ? 'Type MIRN or pick from list…' : 'Type NMI or pick from list…'}
            />
            {w.identifierLookupLoading ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : null}
            <datalist id="fe_identifier_list">
              {w.identifierOptions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
          <FieldError message={methods.formState.errors.site?.identifier?.message} />
          {w.identifierLookupMessage ? <p className="mt-1 text-xs text-gray-600">{w.identifierLookupMessage}</p> : null}
          <p className="mt-1 text-xs text-gray-500">
            We’ll auto-suggest identifiers from your supply address. You can also type the full number to validate / refine the list.
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
          {w.offers.length ? (
            <select
              id="fe_offer_id"
              {...methods.register('site.offer_id')}
              className={`${fieldClass(!!methods.formState.errors.site?.offer_id)} disabled:opacity-50`}
              disabled={w.pricingLoading}
            >
              <option value={0}>Select…</option>
              {w.offers.map((o) => {
                const id = Number(o.id);
                const label =
                  (typeof o.summary === 'string' && o.summary.trim()) ||
                  (typeof o.description === 'string' && o.description.trim()) ||
                  `Offer ${id}`;
                const featured = o.featured ? ' ★' : '';
                return (
                  <option key={id} value={id}>
                    {label} ({id})
                    {featured}
                  </option>
                );
              })}
            </select>
          ) : (
            <input
              id="fe_offer_id"
              type="number"
              {...methods.register('site.offer_id')}
              className={fieldClass(!!methods.formState.errors.site?.offer_id)}
              placeholder={w.pricingLoading ? 'Loading offers…' : 'Offer id'}
            />
          )}
          <FieldError message={methods.formState.errors.site?.offer_id?.message} />
          {w.pricingMessage ? <p className="mt-1 text-xs text-gray-600">{w.pricingMessage}</p> : null}
          <p className="mt-1 text-xs text-gray-500">Offer list comes from the 1st Energy pricing API using your NMI/MIRN.</p>
        </div>
        <div className="sm:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:pt-7">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" {...methods.register('site.has_solar')} className="h-4 w-4 rounded border-gray-300" />
              Solar
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                {...methods.register('site.has_interest_on_solar')}
                className="h-4 w-4 rounded border-gray-300"
              />
              Interested in solar
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" {...methods.register('site.has_medical_cooling')} className="h-4 w-4 rounded border-gray-300" />
              Medical cooling
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="fe_feed_in_type_id" className="block text-sm font-medium text-gray-700 mb-1">
            Feed-in type{' '}
            {Number(w.values.site?.fuel_id) === 1 && methods.watch('site.has_solar') ? <RequiredMark /> : <span className="text-gray-500 font-normal text-xs">(optional)</span>}
          </label>
          {Number(w.values.site?.fuel_id) === 1 && methods.watch('site.has_solar') ? (
            <>
              <select
                id="fe_feed_in_type_id"
                {...methods.register('site.feed_in_type_id', { valueAsNumber: true })}
                className={`${fieldClass(false)} disabled:opacity-50`}
                disabled={w.feedInTypesLoading}
              >
                <option value={0}>Select…</option>
                {w.feedInTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {(t.description && String(t.description)) || `Feed-in type ${t.id}`} ({t.id})
                  </option>
                ))}
              </select>
              {w.feedInTypesMessage ? <p className="mt-1 text-xs text-gray-600">{w.feedInTypesMessage}</p> : null}
            </>
          ) : (
            <input
              id="fe_feed_in_type_id"
              type="number"
              {...methods.register('site.feed_in_type_id', { valueAsNumber: true })}
              className={fieldClass(false)}
              placeholder="Only needed for electricity + solar"
            />
          )}
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
          <select id="fe_vsi_method" {...methods.register('site.vsi_method')} className={fieldClass(false)}>
            <option value="">Select…</option>
            <option value="customer_on_site">customer_on_site</option>
            <option value="keys_letter_box">keys_letter_box</option>
            <option value="keys_meter_box">keys_meter_box</option>
          </select>
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
            <div className="sm:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:pt-7">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" {...methods.register('site.move_in_terms_accepted')} className="h-4 w-4 rounded border-gray-300" />
                  Move-in terms accepted
                </label>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" {...methods.register('site.is_mains_switch_off')} className="h-4 w-4 rounded border-gray-300" />
              Mains switch off
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                {...methods.register('site.is_electricity_disconnected_period')}
                className="h-4 w-4 rounded border-gray-300"
              />
              Disconnected period
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" {...methods.register('site.has_ecoc')} className="h-4 w-4 rounded border-gray-300" />
              ECOC available
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" {...methods.register('site.are_any_building_works')} className="h-4 w-4 rounded border-gray-300" />
              Any building works
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" {...methods.register('site.has_meter_access')} className="h-4 w-4 rounded border-gray-300" />
              Meter access
            </label>
            <div />
          </div>
        </div>
      ) : null}
    </section>
  );
}
