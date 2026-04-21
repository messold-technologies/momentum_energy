import { useFormContext } from 'react-hook-form';
import { Check } from 'lucide-react';
import type { FormValues } from '../firstEnergyFormSchema';
import { useFirstEnergyWizard } from '../FirstEnergyWizardContext';
import { FieldError, fieldClass, RequiredMark } from '../firstEnergyFormShared';

export function FirstEnergyStepSale() {
  const methods = useFormContext<FormValues>();
  const w = useFirstEnergyWizard();

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Sale</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="fe_sale_type" className="block text-sm font-medium text-gray-700 mb-1">
            Sale type <RequiredMark />
          </label>
          <select
            id="fe_sale_type"
            {...methods.register('type')}
            disabled={w.loadingLookups}
            className={`${fieldClass(!!methods.formState.errors.type)} disabled:opacity-50`}
          >
            <option value="">Select…</option>
            {w.saleTypes.map((s) => (
              <option key={s.type} value={s.type}>
                {s.type}
              </option>
            ))}
          </select>
          <FieldError message={methods.formState.errors.type?.message} />
        </div>
        <div>
          <label htmlFor="fe_property_type" className="block text-sm font-medium text-gray-700 mb-1">
            Property type <RequiredMark />
          </label>
          <select id="fe_property_type" {...methods.register('property_type')} className={fieldClass(!!methods.formState.errors.property_type)}>
            <option value="RESIDENT">Resident</option>
            <option value="COMPANY">Company</option>
          </select>
          <FieldError message={methods.formState.errors.property_type?.message} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="fe_payment_method" className="block text-sm font-medium text-gray-700 mb-1">
            Signup payment method <RequiredMark />
          </label>
          <select
            id="fe_payment_method"
            {...methods.register('signup_payment_method')}
            className={fieldClass(!!methods.formState.errors.signup_payment_method)}
          >
            <option value="DIRECT">Direct debit</option>
            <option value="CRDCARD">Credit card</option>
            <option value="CHEQUE">Cheque</option>
          </select>
          <FieldError message={methods.formState.errors.signup_payment_method?.message} />
        </div>
        <div>
          <label htmlFor="fe_referral_id" className="block text-sm font-medium text-gray-700 mb-1">
            Referral ID (optional)
          </label>
          <input
            id="fe_referral_id"
            type="number"
            {...methods.register('referral_id')}
            className={fieldClass(!!methods.formState.errors.referral_id)}
          />
          <FieldError message={methods.formState.errors.referral_id?.message} />
        </div>
        <div>
          <label htmlFor="fe_promo_code" className="block text-sm font-medium text-gray-700 mb-1">
            Promo code (optional)
          </label>
          <div className="relative">
            <input
              id="fe_promo_code"
              {...methods.register('promo_code', {
                onBlur: (e) => void w.validatePromoCode(String(e.target.value ?? '')),
              })}
              className={`${fieldClass(!!methods.formState.errors.promo_code)} pr-10`}
            />
            {w.promoChecking ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : null}
          </div>
          {w.promoMessage ? <p className="mt-1 text-xs text-gray-600">{w.promoMessage}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="fe_preferred_contact" className="block text-sm font-medium text-gray-700 mb-1">
            Preferred contact (optional)
          </label>
          <input
            id="fe_preferred_contact"
            {...methods.register('preferred_contact')}
            className={fieldClass(!!methods.formState.errors.preferred_contact)}
          />
        </div>
      </div>

      {methods.watch('signup_payment_method') === 'DIRECT' ? (
        <div className="pt-2 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Direct debit</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
            <div>
              <label htmlFor="fe_dd_bsb" className="block text-sm font-medium text-gray-700 mb-1">
                BSB <RequiredMark />
              </label>
              <input id="fe_dd_bsb" {...methods.register('directDebit.bsb')} className={fieldClass(!!methods.formState.errors.directDebit?.bsb)} />
              <FieldError message={methods.formState.errors.directDebit?.bsb?.message} />
            </div>
            <div>
              <label htmlFor="fe_dd_name" className="block text-sm font-medium text-gray-700 mb-1">
                Account name <RequiredMark />
              </label>
              <input id="fe_dd_name" {...methods.register('directDebit.name')} className={fieldClass(!!methods.formState.errors.directDebit?.name)} />
              <FieldError message={methods.formState.errors.directDebit?.name?.message} />
            </div>
            <div>
              <label htmlFor="fe_dd_account_number" className="block text-sm font-medium text-gray-700 mb-1">
                Account number <RequiredMark />
              </label>
              <input
                id="fe_dd_account_number"
                {...methods.register('directDebit.account_number')}
                className={fieldClass(!!methods.formState.errors.directDebit?.account_number)}
              />
              <FieldError message={methods.formState.errors.directDebit?.account_number?.message} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
            <div>
              <label htmlFor="fe_dd_bank_name" className="block text-sm font-medium text-gray-700 mb-1">
                Bank name (optional)
              </label>
              <input id="fe_dd_bank_name" {...methods.register('directDebit.bank_name')} className={fieldClass(false)} />
            </div>
            <div>
              <label htmlFor="fe_dd_branch_name" className="block text-sm font-medium text-gray-700 mb-1">
                Branch name (optional)
              </label>
              <input id="fe_dd_branch_name" {...methods.register('directDebit.branch_name')} className={fieldClass(false)} />
            </div>
            <div>
              <label htmlFor="fe_dd_bank_code" className="block text-sm font-medium text-gray-700 mb-1">
                Bank code (optional)
              </label>
              <input id="fe_dd_bank_code" {...methods.register('directDebit.bank_code')} className={fieldClass(false)} />
            </div>
          </div>
        </div>
      ) : null}

      {methods.watch('property_type') === 'COMPANY' ? (
        <div className="pt-2 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Organisation</h3>
          <p className="text-sm text-gray-500 mt-1">Required when Property type is Company.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
            <div className="relative">
              <label htmlFor="fe_org_name" className="block text-sm font-medium text-gray-700 mb-1">
                Name <RequiredMark />
              </label>
              <div className="relative">
                <input
                  id="fe_org_name"
                  autoComplete="off"
                  placeholder="Type to search the business register…"
                  {...methods.register('organisation.name')}
                  onFocus={() => w.setOrgNameSuggestionsOpen(true)}
                  onBlur={() => globalThis.setTimeout(() => w.setOrgNameSuggestionsOpen(false), 200)}
                  className={`${fieldClass(!!methods.formState.errors.organisation?.name)} pr-10`}
                />
                {w.businessNameLoading ? (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : null}
              </div>
              {w.orgNameSuggestionsOpen && w.businessNameHits.length > 0 ? (
                <ul className="absolute z-30 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg" role="listbox">
                  {w.businessNameHits.map((hit) => (
                    <li key={`${hit.abn}-${hit.name}`}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          w.selectBusinessNameHit(hit);
                        }}
                      >
                        <span className="font-medium text-gray-900">{hit.name}</span>
                        <span className="block text-xs text-gray-500">
                          ABN {hit.abn}
                          {hit.state ? ` · ${hit.state}` : ''}
                          {hit.postcode ? ` ${hit.postcode}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <FieldError message={methods.formState.errors.organisation?.name?.message} />
              <p className="mt-1 text-xs text-gray-500">Pick a result to fill the ABN, then we validate and load organisation type.</p>
            </div>
            <div>
              <label htmlFor="fe_org_trading_name" className="block text-sm font-medium text-gray-700 mb-1">
                Trading name <RequiredMark />
              </label>
              <input
                id="fe_org_trading_name"
                {...methods.register('organisation.trading_name')}
                className={fieldClass(!!methods.formState.errors.organisation?.trading_name)}
              />
              <FieldError message={methods.formState.errors.organisation?.trading_name?.message} />
            </div>
            <div>
              <label htmlFor="fe_org_trustee_name" className="block text-sm font-medium text-gray-700 mb-1">
                Trustee name <RequiredMark />
              </label>
              <input
                id="fe_org_trustee_name"
                {...methods.register('organisation.trustee_name')}
                className={fieldClass(!!methods.formState.errors.organisation?.trustee_name)}
              />
              <FieldError message={methods.formState.errors.organisation?.trustee_name?.message} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
            <div>
              <label htmlFor="fe_org_type_desc" className="block text-sm font-medium text-gray-700 mb-1">
                Organisation type <RequiredMark />
              </label>
              <input
                id="fe_org_type_desc"
                readOnly
                value={w.organisationTypeDescription}
                placeholder="Filled from ABN search after validation"
                className={`${fieldClass(!!methods.formState.errors.organisation?.organisation_type_id)} bg-gray-50 text-gray-800`}
              />
              <p className="mt-1 text-xs text-gray-600">
                Type id:{' '}
                <span className="font-mono">
                  {methods.watch('organisation.organisation_type_id') && Number(methods.watch('organisation.organisation_type_id')) > 0
                    ? methods.watch('organisation.organisation_type_id')
                    : '—'}
                </span>
              </p>
              <FieldError message={methods.formState.errors.organisation?.organisation_type_id?.message} />
            </div>
            <div>
              <label htmlFor="fe_org_industry" className="block text-sm font-medium text-gray-700 mb-1">
                Industry type (optional)
              </label>
              <select
                id="fe_org_industry"
                {...methods.register('organisation.industry_type_id')}
                className={fieldClass(!!methods.formState.errors.organisation?.industry_type_id)}
                disabled={w.loadingLookups}
              >
                <option value={0}>Select…</option>
                {w.industryTypes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <FieldError message={methods.formState.errors.organisation?.industry_type_id?.message} />
            </div>
            <div>
              <label htmlFor="fe_org_gst" className="block text-sm font-medium text-gray-700 mb-1">
                GST registered at 
              </label>
              <input
                id="fe_org_gst"
                type="date"
                {...methods.register('organisation.gst_registered_at')}
                className={fieldClass(!!methods.formState.errors.organisation?.gst_registered_at)}
              />
              <FieldError message={methods.formState.errors.organisation?.gst_registered_at?.message} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
            <div>
              <label htmlFor="fe_org_abn" className="block text-sm font-medium text-gray-700 mb-1">
                ABN <RequiredMark />
              </label>
              <div className="relative">
                <input
                  id="fe_org_abn"
                  {...methods.register('organisation.abn', {
                    onBlur: (e) => void w.runAbnValidationAndEnrichment(String(e.target.value ?? '')),
                  })}
                  className={`${fieldClass(!!methods.formState.errors.organisation?.abn)} pr-12`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {w.abnChecking ? (
                    <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                  ) : null}
                  {w.abnValidated && !w.abnChecking ? (
                    <Check className="w-5 h-5 text-green-600 shrink-0" strokeWidth={2.5} aria-hidden />
                  ) : null}
                </div>
              </div>
              <FieldError message={methods.formState.errors.organisation?.abn?.message} />
              {w.abnMessage ? <p className="mt-1 text-xs text-gray-600">{w.abnMessage}</p> : null}
            </div>
            <div>
              <label htmlFor="fe_org_acn" className="block text-sm font-medium text-gray-700 mb-1">
                ACN{' '}
                {w.values.organisation?.requires_acn !== false ? (
                  <RequiredMark />
                ) : (
                  <span className="text-gray-500 font-normal text-xs">(optional)</span>
                )}
              </label>
              <div className="relative">
                <input
                  id="fe_org_acn"
                  {...methods.register('organisation.acn', {
                    onBlur: (e) => void w.validateAcn(String(e.target.value ?? '')),
                  })}
                  className={`${fieldClass(!!methods.formState.errors.organisation?.acn)} pr-12`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {w.acnChecking ? (
                    <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                  ) : null}
                  {w.acnValidated && !w.acnChecking ? (
                    <Check className="w-5 h-5 text-green-600 shrink-0" strokeWidth={2.5} aria-hidden />
                  ) : null}
                </div>
              </div>
              <FieldError message={methods.formState.errors.organisation?.acn?.message} />
              {w.values.organisation?.requires_acn === false ? (
                <p className="mt-1 text-xs text-gray-500">ACN is not required for this entity type (from ABN registry).</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">Required when the registry marks this entity as needing an ACN.</p>
              )}
              {w.acnMessage ? <p className="mt-1 text-xs text-gray-600">{w.acnMessage}</p> : null}
            </div>
            <div />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
            <div>
              <label htmlFor="fe_org_phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone <RequiredMark />
              </label>
              <input
                id="fe_org_phone"
                {...methods.register('organisation.phone_number')}
                className={fieldClass(!!methods.formState.errors.organisation?.phone_number)}
              />
              <FieldError message={methods.formState.errors.organisation?.phone_number?.message} />
            </div>
            <div>
              <label htmlFor="fe_org_email" className="block text-sm font-medium text-gray-700 mb-1">
                Email <RequiredMark />
              </label>
              <input
                id="fe_org_email"
                type="email"
                {...methods.register('organisation.email')}
                className={fieldClass(!!methods.formState.errors.organisation?.email)}
              />
              <FieldError message={methods.formState.errors.organisation?.email?.message} />
            </div>
            <div />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-6">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" {...methods.register('email_invoice')} className="rounded border-gray-300" />
          Email invoice <RequiredMark />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" {...methods.register('email_notice')} className="rounded border-gray-300" />
          Email notices <RequiredMark />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" {...methods.register('terms_accepted')} className="rounded border-gray-300" />
          Terms accepted <RequiredMark />
        </label>
      </div>
      <FieldError message={methods.formState.errors.terms_accepted?.message} />
    </section>
  );
}
