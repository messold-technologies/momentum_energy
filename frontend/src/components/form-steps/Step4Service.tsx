import { useFormContext, useWatch, type FieldErrors } from 'react-hook-form';
import FormField, { inputClass, selectClass } from '../ui/FormField';
import { useState } from 'react';
import type { TransactionPayload } from '../../lib/types';
import {
  UNIT_TYPES,
  FLOOR_TYPES,
  STREET_NUMBER_SUFFIXES,
  SAFETY_INSTRUCTIONS,
  SERVICE_PLAN_CODES,
} from '../../lib/types';
import { STREET_TYPE_CODES } from '../../lib/streetTypeCodes';

// Match backend: ACT, NT, WA, SA, VIC, NSW
const STATES = ['ACT', 'NT', 'WA', 'SA', 'VIC', 'NSW', 'QLD'] as const;

export default function Step4Service() {
  const { register, formState, control } = useFormContext();
  const errors = formState.errors as FieldErrors<TransactionPayload>;

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
            <option value="MOVE IN">Move In</option>
          </select>
        </FormField>

        <FormField
          label={serviceType === 'GAS' ? 'MIRN' : 'NMI'}
          required
          error={errors.service?.serviceConnectionId}
          hint={serviceType === 'GAS' ? '11 characters (MIRN for GAS)' : '10 characters (NMI for POWER)'}
        >
          <input
            {...register('service.serviceConnectionId')}
            className={inputClass}
            placeholder={serviceType === 'GAS' ? '11-digit MIRN' : '10-digit NMI'}
            maxLength={serviceType === 'GAS' ? 11 : 10}
          />
        </FormField>

        {serviceSubType === 'MOVE IN' && (
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

        <FormField label="Service Meter ID" error={errors.service?.serviceMeterId} hint="Optional">
          <input {...register('service.serviceMeterId')} className={inputClass} placeholder="Optional" />
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
          <FormField label="Property Name" error={errors.service?.servicedAddress?.name}>
            <input
              {...register('service.servicedAddress.name')}
              className={inputClass}
              placeholder="Optional - start with uppercase"
            />
          </FormField>
          <FormField label="Unit Type" error={errors.service?.servicedAddress?.unitType}>
            <select {...register('service.servicedAddress.unitType')} className={selectClass}>
              <option value="">None</option>
              {UNIT_TYPES.map((ut) => (
                <option key={ut} value={ut}>
                  {ut}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Unit Number" error={errors.service?.servicedAddress?.unitNumber}>
            <input
              {...register('service.servicedAddress.unitNumber')}
              className={inputClass}
              placeholder="Optional"
            />
          </FormField>
          <FormField label="Floor Type" error={errors.service?.servicedAddress?.floorType}>
            <select {...register('service.servicedAddress.floorType')} className={selectClass}>
              <option value="">None</option>
              {FLOOR_TYPES.map((ft) => (
                <option key={ft} value={ft}>
                  {ft}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Floor Number" error={errors.service?.servicedAddress?.floorNumber}>
            <input
              {...register('service.servicedAddress.floorNumber')}
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
              placeholder="Letters, numbers, hyphen"
            />
          </FormField>
          <FormField label="Street Number Suffix" error={errors.service?.servicedAddress?.streetNumberSuffix}>
            <select {...register('service.servicedAddress.streetNumberSuffix')} className={selectClass}>
              <option value="">None</option>
              {STREET_NUMBER_SUFFIXES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Street Name"
            required
            error={errors.service?.servicedAddress?.streetName}
          >
            <input
              {...register('service.servicedAddress.streetName')}
              className={inputClass}
              placeholder="Letters, numbers, .,/() hyphen"
            />
          </FormField>
          <FormField label="Street Name Suffix" error={errors.service?.servicedAddress?.streetNameSuffix}>
            <input
              {...register('service.servicedAddress.streetNameSuffix')}
              className={inputClass}
              placeholder="Optional - e.g. N, S, E"
            />
          </FormField>
          <FormField
            label="Street Type"
            required
            error={errors.service?.servicedAddress?.streetTypeCode}
          >
            <select {...register('service.servicedAddress.streetTypeCode')} className={selectClass}>
              <option value="">Select...</option>
              {STREET_TYPE_CODES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
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
          <FormField label="Post Code" required error={errors.service?.servicedAddress?.postCode}>
            <input
              {...register('service.servicedAddress.postCode')}
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
          <FormField label="Safety Instructions" error={errors.service?.servicedAddress?.safetyInstructions} hint="Optional">
            <select {...register('service.servicedAddress.safetyInstructions')} className={selectClass}>
              <option value="">None</option>
              {SAFETY_INSTRUCTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </div>

      {/* Billing */}
      <div className="border-t pt-5">
        <p className="text-sm font-medium text-gray-900 mb-4">Billing Details</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField
            label="Offer Code"
            required
            error={errors.service?.serviceBilling?.serviceOfferCode}
            hint="15 or 18 alphanumeric characters"
          >
            <input
              {...register('service.serviceBilling.serviceOfferCode')}
              className={inputClass}
              placeholder="15 or 18 alphanumeric chars"
            />
          </FormField>
          <FormField
            label="Quote Date"
            required
            error={errors.service?.serviceBilling?.offerQuoteDate}
            hint="Must not be older than 14 days"
          >
            <input
              type="date"
              {...register('service.serviceBilling.offerQuoteDate')}
              className={inputClass}
            />
          </FormField>
          <FormField
            label="Service Plan Code"
            required
            error={errors.service?.serviceBilling?.servicePlanCode}
          >
            <select {...register('service.serviceBilling.servicePlanCode')} className={selectClass}>
              <option value="">Select...</option>
              {SERVICE_PLAN_CODES.map((plan) => (
                <option key={plan} value={plan}>
                  {plan}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Contract Term"
            required
            error={errors.service?.serviceBilling?.contractTermCode}
          >
            <select {...register('service.serviceBilling.contractTermCode')} className={selectClass}>
              <option value="OPEN">Open</option>
              <option value="12MTH">12 Months</option>
              <option value="24MTH">24 Months</option>
              <option value="36MTH">36 Months</option>
            </select>
          </FormField>
          <FormField label="Contract Date" error={errors.service?.serviceBilling?.contractDate}>
            <input
              type="date"
              {...register('service.serviceBilling.contractDate')}
              className={inputClass}
            />
          </FormField>
          <FormField
            label="Payment Method"
            required
            error={errors.service?.serviceBilling?.paymentMethod}
          >
            <select {...register('service.serviceBilling.paymentMethod')} className={selectClass}>
              <option value="Direct Debit Via Bank Account">Direct Debit Via Bank Account</option>
              <option value="Cheque">Cheque</option>
            </select>
          </FormField>
          <FormField
            label="Bill Cycle"
            required
            error={errors.service?.serviceBilling?.billCycleCode}
            hint={
              serviceType === 'GAS'
                ? 'GAS only supports Bi-Monthly'
                : 'POWER supports Monthly or Quarterly'
            }
          >
            <select {...register('service.serviceBilling.billCycleCode')} className={selectClass}>
              <option value="">Select...</option>
              {billCycleOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Bill Delivery Method"
            required
            error={errors.service?.serviceBilling?.billDeliveryMethod}
          >
            <select {...register('service.serviceBilling.billDeliveryMethod')} className={selectClass}>
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
            <FormField label="Card Type" required error={errors.service?.serviceBilling?.concession?.cardType}>
              <input
                {...register('service.serviceBilling.concession.cardType')}
                className={inputClass}
                placeholder="e.g. Pensioner"
              />
            </FormField>
            <FormField label="Card Number" required error={errors.service?.serviceBilling?.concession?.cardNumber}>
              <input
                {...register('service.serviceBilling.concession.cardNumber')}
                className={inputClass}
              />
            </FormField>
            <FormField label="Start Date" required error={errors.service?.serviceBilling?.concession?.startDate}>
              <input
                type="date"
                {...register('service.serviceBilling.concession.startDate')}
                className={inputClass}
              />
            </FormField>
            <FormField label="End Date" required error={errors.service?.serviceBilling?.concession?.endDate}>
              <input
                type="date"
                {...register('service.serviceBilling.concession.endDate')}
                className={inputClass}
              />
            </FormField>
            <FormField
              label="Card Holder Name"
              required
              error={errors.service?.serviceBilling?.concession?.holderName}
            >
              <input
                {...register('service.serviceBilling.concession.holderName')}
                className={inputClass}
              />
            </FormField>
          </div>
        )}
      </div>
    </div>
  );
}
