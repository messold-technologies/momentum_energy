import { useFormContext, useWatch } from 'react-hook-form';
import FormField, { inputClass, selectClass } from '../ui/FormField';
import { useState } from 'react';

const STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

export default function Step4Service() {
  const {
    register,
    formState: { errors },
    control,
  } = useFormContext();

  const serviceType = useWatch({ control, name: 'service.serviceType' });
  const serviceSubType = useWatch({ control, name: 'service.serviceSubType' });
  const [showConcession, setShowConcession] = useState(false);

  const billCycleOptions =
    serviceType === 'GAS'
      ? [{ value: 'Bi-Monthly', label: 'Bi-Monthly' }]
      : [
          { value: 'Monthly', label: 'Monthly' },
          { value: 'Quarterly', label: 'Quarterly' },
        ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Service & Billing</h2>
        <p className="text-sm text-gray-500 mt-1">Service details, offer, and billing configuration.</p>
      </div>

      {/* Service type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormField label="Service Type" required error={errors.service?.serviceType}>
          <div className="flex gap-3">
            {(['GAS', 'POWER'] as const).map((t) => (
              <label
                key={t}
                className={`flex-1 flex items-center justify-center px-4 py-2.5 border rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                  serviceType === t
                    ? 'bg-primary-50 border-primary-600 text-primary-700'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  {...register('service.serviceType')}
                  value={t}
                  className="sr-only"
                />
                {t}
              </label>
            ))}
          </div>
        </FormField>

        <FormField label="Service Sub-Type" required error={errors.service?.serviceSubType}>
          <select {...register('service.serviceSubType')} className={selectClass}>
            <option value="">Select...</option>
            <option value="TRANSFER">Transfer</option>
            <option value="MOVE_IN">Move In</option>
          </select>
        </FormField>

        <FormField
          label={serviceType === 'GAS' ? 'MIRN' : 'NMI'}
          required
          error={errors.service?.serviceConnectionId}
          hint="10 or 11 digit connection identifier"
        >
          <input
            {...register('service.serviceConnectionId')}
            className={inputClass}
            placeholder="Enter NMI/MIRN"
          />
        </FormField>

        {serviceSubType === 'MOVE_IN' && (
          <FormField
            label="Service Start Date"
            required
            error={errors.service?.serviceStartDate}
          >
            <input
              type="date"
              {...register('service.serviceStartDate')}
              className={inputClass}
            />
          </FormField>
        )}

        <FormField label="Meter ID" error={errors.service?.meterId} hint="Optional">
          <input {...register('service.meterId')} className={inputClass} placeholder="Optional" />
        </FormField>

        <FormField label="Lot Number" error={errors.service?.lotNumber} hint="Optional">
          <input
            {...register('service.lotNumber')}
            className={inputClass}
            placeholder="Optional"
          />
        </FormField>
      </div>

      {/* Serviced address */}
      <div className="border-t pt-5">
        <p className="text-sm font-medium text-gray-900 mb-4">Service Address</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Unit" error={errors.service?.servicedAddress?.unitNumber}>
            <input
              {...register('service.servicedAddress.unitNumber')}
              className={inputClass}
              placeholder="Optional"
            />
          </FormField>
          <FormField
            label="Street Number"
            required
            error={errors.service?.servicedAddress?.streetNumber}
          >
            <input
              {...register('service.servicedAddress.streetNumber')}
              className={inputClass}
            />
          </FormField>
          <FormField
            label="Street Name"
            required
            error={errors.service?.servicedAddress?.streetName}
          >
            <input {...register('service.servicedAddress.streetName')} className={inputClass} />
          </FormField>
          <FormField label="Suburb" required error={errors.service?.servicedAddress?.suburb}>
            <input {...register('service.servicedAddress.suburb')} className={inputClass} />
          </FormField>
          <FormField label="State" required error={errors.service?.servicedAddress?.state}>
            <select {...register('service.servicedAddress.state')} className={selectClass}>
              <option value="">Select...</option>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Postcode" required error={errors.service?.servicedAddress?.postcode}>
            <input
              {...register('service.servicedAddress.postcode')}
              className={inputClass}
              maxLength={4}
            />
          </FormField>
          <FormField label="Access Instructions" error={errors.service?.servicedAddress?.accessInstructions}>
            <input
              {...register('service.servicedAddress.accessInstructions')}
              className={inputClass}
              placeholder="Optional"
            />
          </FormField>
          <FormField label="Safety Instructions" error={errors.service?.servicedAddress?.safetyInstructions}>
            <input
              {...register('service.servicedAddress.safetyInstructions')}
              className={inputClass}
              placeholder="Optional"
            />
          </FormField>
        </div>
      </div>

      {/* Offer */}
      <div className="border-t pt-5">
        <p className="text-sm font-medium text-gray-900 mb-4">Offer Details</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField label="Offer Code" required error={errors.service?.offer?.offerCode}>
            <input
              {...register('service.offer.offerCode')}
              className={inputClass}
              placeholder="e.g. OFFER-2026-VIC"
            />
          </FormField>
          <FormField
            label="Quote Date"
            required
            error={errors.service?.offer?.quoteDate}
            hint="Must not be older than 14 days"
          >
            <input
              type="date"
              {...register('service.offer.quoteDate')}
              className={inputClass}
            />
          </FormField>
        </div>
      </div>

      {/* Billing */}
      <div className="border-t pt-5">
        <p className="text-sm font-medium text-gray-900 mb-4">Billing Details</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField label="Service Plan" error={errors.service?.billingDetails?.servicePlan}>
            <input
              {...register('service.billingDetails.servicePlan')}
              className={inputClass}
              placeholder="Optional"
            />
          </FormField>
          <FormField
            label="Contract Term"
            required
            error={errors.service?.billingDetails?.contractTerm}
          >
            <select {...register('service.billingDetails.contractTerm')} className={selectClass}>
              <option value="OPEN">Open</option>
              <option value="12MTH">12 Months</option>
              <option value="24MTH">24 Months</option>
              <option value="36MTH">36 Months</option>
            </select>
          </FormField>
          <FormField label="Contract Date" error={errors.service?.billingDetails?.contractDate}>
            <input
              type="date"
              {...register('service.billingDetails.contractDate')}
              className={inputClass}
            />
          </FormField>
          <FormField
            label="Payment Method"
            required
            error={errors.service?.billingDetails?.paymentMethod}
          >
            <select {...register('service.billingDetails.paymentMethod')} className={selectClass}>
              <option value="DIRECT_DEBIT">Direct Debit</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </FormField>
          <FormField
            label="Bill Cycle"
            required
            error={errors.service?.billingDetails?.billCycleCode}
            hint={
              serviceType === 'GAS'
                ? 'GAS only supports Bi-Monthly'
                : 'POWER supports Monthly or Quarterly'
            }
          >
            <select {...register('service.billingDetails.billCycleCode')} className={selectClass}>
              <option value="">Select...</option>
              {billCycleOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Bill Delivery"
            required
            error={errors.service?.billingDetails?.billDelivery}
          >
            <select {...register('service.billingDetails.billDelivery')} className={selectClass}>
              <option value="EMAIL">Email</option>
              <option value="POST">Post</option>
            </select>
          </FormField>
        </div>
      </div>

      {/* Concession */}
      <div className="border-t pt-5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showConcession}
            onChange={(e) => setShowConcession(e.target.checked)}
            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-gray-700">Add Concession Details</span>
        </label>

        {showConcession && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Card Type" required error={errors.service?.concession?.cardType}>
              <input
                {...register('service.concession.cardType')}
                className={inputClass}
                placeholder="e.g. Pensioner"
              />
            </FormField>
            <FormField label="Card Number" required error={errors.service?.concession?.cardNumber}>
              <input
                {...register('service.concession.cardNumber')}
                className={inputClass}
              />
            </FormField>
            <FormField label="Start Date" required error={errors.service?.concession?.startDate}>
              <input
                type="date"
                {...register('service.concession.startDate')}
                className={inputClass}
              />
            </FormField>
            <FormField label="End Date" required error={errors.service?.concession?.endDate}>
              <input
                type="date"
                {...register('service.concession.endDate')}
                className={inputClass}
              />
            </FormField>
            <FormField
              label="Card Holder Name"
              required
              error={errors.service?.concession?.holderName}
            >
              <input
                {...register('service.concession.holderName')}
                className={inputClass}
              />
            </FormField>
          </div>
        )}
      </div>
    </div>
  );
}
