import { useFormContext } from 'react-hook-form';
import { Eye } from 'lucide-react';
import type { FormValues } from '../firstEnergyFormSchema';
import { useFirstEnergyWizard } from '../FirstEnergyWizardContext';

export function FirstEnergyStepReview() {
  const methods = useFormContext<FormValues>();
  const w = useFirstEnergyWizard();
  const v = methods.getValues();
  const offer = v.site.offer_id ? w.offers.find((o) => Number(o.id) === Number(v.site.offer_id)) : undefined;
  const offerLabel = offer?.summary || offer?.description || (v.site.offer_id ? `Offer ${v.site.offer_id}` : undefined);
  const dd = v.directDebit;
  const org = v.organisation;
  const conc = v.customer.concession;
  const customerId = v.customer.identification;
  const orgId = org?.identification;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Review</h2>
          <p className="text-sm text-gray-500 mt-1">Preview the payload that will be submitted to `/accounts`.</p>
        </div>
        <button
          type="button"
          onClick={w.handlePreview}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-700 bg-white border border-primary-200 rounded-lg hover:bg-primary-50 cursor-pointer"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Sale</h3>
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Type</dt>
              <dd className="text-gray-900 font-medium">{v.type || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Property</dt>
              <dd className="text-gray-900 font-medium">{v.property_type}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Payment</dt>
              <dd className="text-gray-900 font-medium">{v.signup_payment_method}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Promo</dt>
              <dd className="text-gray-900 font-medium">{v.promo_code?.trim() ? v.promo_code.trim() : '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Referral ID</dt>
              <dd className="text-gray-900 font-medium">{v.referral_id ? String(v.referral_id) : '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Preferred contact</dt>
              <dd className="text-gray-900 font-medium">{v.preferred_contact?.trim() ? v.preferred_contact.trim() : '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Email invoice</dt>
              <dd className="text-gray-900 font-medium">{v.email_invoice ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Email notices</dt>
              <dd className="text-gray-900 font-medium">{v.email_notice ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:col-span-2">
              <dt className="text-gray-500">Terms accepted</dt>
              <dd className="text-gray-900 font-medium">{v.terms_accepted ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Customer</h3>
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Name</dt>
              <dd className="text-gray-900 font-medium">
                {[v.customer.title, v.customer.first_name, v.customer.last_name].filter(Boolean).join(' ') || '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">DOB</dt>
              <dd className="text-gray-900 font-medium">{v.customer.date_of_birth || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Phone</dt>
              <dd className="text-gray-900 font-medium">
                {v.customer.phone_number ? `${v.customer.phone_type}: ${v.customer.phone_number}` : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Email</dt>
              <dd className="text-gray-900 font-medium">{v.customer.email ? `${v.customer.email_type}: ${v.customer.email}` : '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Allow marketing</dt>
              <dd className="text-gray-900 font-medium">{v.customer.allow_marketing ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:col-span-2">
              <dt className="text-gray-500">Identification</dt>
              <dd className="text-gray-900 font-medium">
                {customerId?.type ? `${customerId.type} · ${customerId.reference || '—'} · exp ${customerId.expires_on || '—'}` : '—'}
              </dd>
            </div>
          </dl>
        </div>

        {conc?.enabled ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900">Concession</h3>
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Type</dt>
                <dd className="text-gray-900 font-medium">{conc.concession || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Reference</dt>
                <dd className="text-gray-900 font-medium">{conc.reference || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Issued</dt>
                <dd className="text-gray-900 font-medium">{conc.issued_on || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Expiry</dt>
                <dd className="text-gray-900 font-medium">{conc.expires_on || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:col-span-2">
                <dt className="text-gray-500">Name</dt>
                <dd className="text-gray-900 font-medium">
                  {[conc.first_name, conc.middle_name, conc.last_name].filter((x) => typeof x === 'string' && x.trim()).join(' ') || '—'}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        {v.property_type === 'COMPANY' ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900">Organisation</h3>
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between gap-3 sm:col-span-2">
                <dt className="text-gray-500">Name</dt>
                <dd className="text-gray-900 font-medium">{org?.name || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:col-span-2">
                <dt className="text-gray-500">Trading name</dt>
                <dd className="text-gray-900 font-medium">{org?.trading_name || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:col-span-2">
                <dt className="text-gray-500">Trustee name</dt>
                <dd className="text-gray-900 font-medium">{org?.trustee_name || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">ABN</dt>
                <dd className="text-gray-900 font-medium">{org?.abn || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">ACN</dt>
                <dd className="text-gray-900 font-medium">{org?.acn || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Org type ID</dt>
                <dd className="text-gray-900 font-medium">
                  {org?.organisation_type_id && Number(org.organisation_type_id) > 0 ? String(org.organisation_type_id) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Industry type ID</dt>
                <dd className="text-gray-900 font-medium">
                  {org?.industry_type_id && Number(org.industry_type_id) > 0 ? String(org.industry_type_id) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">GST registered</dt>
                <dd className="text-gray-900 font-medium">{org?.gst_registered_at || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Phone</dt>
                <dd className="text-gray-900 font-medium">{org?.phone_number ? `${org.phone_type || 'Mobile'}: ${org.phone_number}` : '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-900 font-medium">{org?.email ? `${org.email_type || 'Contact Email'}: ${org.email}` : '—'}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:col-span-2">
                <dt className="text-gray-500">Identification</dt>
                <dd className="text-gray-900 font-medium">
                  {orgId?.type ? `${orgId.type} · ${orgId.reference || '—'} · exp ${orgId.expires_on || '—'}` : '—'}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Supply address</h3>
          <p className="mt-3 text-sm text-gray-900 font-medium">
            {[
              v.address?.StreetNumber,
              v.address?.StreetName,
              v.address?.StreetType,
              v.address?.Suburb,
              v.address?.State,
              v.address?.PostCode,
            ]
              .filter((x) => typeof x === 'string' && x.trim())
              .join(' ') || '—'}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Site</h3>
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Fuel</dt>
              <dd className="text-gray-900 font-medium">{Number(v.site.fuel_id) === 2 ? 'Gas' : 'Electricity'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Identifier</dt>
              <dd className="text-gray-900 font-medium">{v.site.identifier || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Offer ID</dt>
              <dd className="text-gray-900 font-medium">{v.site.offer_id ? String(v.site.offer_id) : '—'}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:col-span-2">
              <dt className="text-gray-500">Offer</dt>
              <dd className="text-gray-900 font-medium">{offerLabel || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Bill frequency</dt>
              <dd className="text-gray-900 font-medium">{v.site.bill_frequency || 'MONTHLY'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Solar</dt>
              <dd className="text-gray-900 font-medium">{v.site.has_solar ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Interested in solar</dt>
              <dd className="text-gray-900 font-medium">{v.site.has_interest_on_solar ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Medical cooling</dt>
              <dd className="text-gray-900 font-medium">{v.site.has_medical_cooling ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Owner</dt>
              <dd className="text-gray-900 font-medium">{v.site.is_owner ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:col-span-2">
              <dt className="text-gray-500">Transfer instructions</dt>
              <dd className="text-gray-900 font-medium">{v.site.transfer_instructions?.trim() ? v.site.transfer_instructions.trim() : '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Usage start</dt>
              <dd className="text-gray-900 font-medium">{v.site.usage_start_date || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Usage end</dt>
              <dd className="text-gray-900 font-medium">{v.site.usage_end_date || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Feed-in type</dt>
              <dd className="text-gray-900 font-medium">
                {v.site.feed_in_type_id && Number(v.site.feed_in_type_id) > 0 ? String(v.site.feed_in_type_id) : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Greenpower ID</dt>
              <dd className="text-gray-900 font-medium">
                {v.site.selected_greenpower_id && Number(v.site.selected_greenpower_id) > 0 ? String(v.site.selected_greenpower_id) : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">VSI time</dt>
              <dd className="text-gray-900 font-medium">{v.site.vsi_time || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">VSI method</dt>
              <dd className="text-gray-900 font-medium">{v.site.vsi_method || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Existing account #</dt>
              <dd className="text-gray-900 font-medium">{v.site.existing_account_number?.trim() ? v.site.existing_account_number.trim() : '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Basic meter</dt>
              <dd className="text-gray-900 font-medium">{v.site.has_basic_meter ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
          {v.type === 'MoveIn' ? (
            <p className="mt-2 text-sm text-gray-600">
              Move-in start date: <span className="font-medium text-gray-900">{v.site.start_date || '—'}</span>
            </p>
          ) : null}

          {v.type === 'MoveIn' ? (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Move-in terms accepted</span>
                <span className="text-gray-900 font-medium">{v.site.move_in_terms_accepted ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Mains switch off</span>
                <span className="text-gray-900 font-medium">{v.site.is_mains_switch_off ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Disconnected period</span>
                <span className="text-gray-900 font-medium">{v.site.is_electricity_disconnected_period ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">ECOC available</span>
                <span className="text-gray-900 font-medium">{v.site.has_ecoc ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Any building works</span>
                <span className="text-gray-900 font-medium">{v.site.are_any_building_works ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Meter access</span>
                <span className="text-gray-900 font-medium">{v.site.has_meter_access ? 'Yes' : 'No'}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Payment details</h3>
          {v.signup_payment_method === 'DIRECT' ? (
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">BSB</dt>
                <dd className="text-gray-900 font-medium">{dd?.bsb?.trim() ? dd.bsb.trim() : '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Account name</dt>
                <dd className="text-gray-900 font-medium">{dd?.name?.trim() ? dd.name.trim() : '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Account #</dt>
                <dd className="text-gray-900 font-medium">{dd?.account_number?.trim() ? dd.account_number.trim() : '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Bank name</dt>
                <dd className="text-gray-900 font-medium">{dd?.bank_name?.trim() ? dd.bank_name.trim() : '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Branch name</dt>
                <dd className="text-gray-900 font-medium">{dd?.branch_name?.trim() ? dd.branch_name.trim() : '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Bank code</dt>
                <dd className="text-gray-900 font-medium">{dd?.bank_code?.trim() ? dd.bank_code.trim() : '—'}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-gray-600">No direct debit details required for this payment method.</p>
          )}
        </div>
      </div>

    </section>
  );
}
