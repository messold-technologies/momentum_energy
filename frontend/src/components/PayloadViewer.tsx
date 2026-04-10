import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

type PayloadViewerProps = Readonly<{
  payload: Record<string, unknown> | null;
  salesTransactionId?: string | null;
}>;

function val(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return '—';
    }
  }
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '—';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'symbol') return v.toString();
  if (typeof v === 'function') return '—';
  return '—';
}

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <h3 className="px-5 py-3 bg-linear-to-r from-gray-50 to-white text-sm font-semibold text-gray-800 border-b border-gray-200 flex items-center justify-between">
        {title}
      </h3>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldRow({ label, value }: Readonly<{ label: string; value: string }>) {
  if (value === '—') return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-1 sm:gap-4 py-2">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className="text-sm text-gray-900 wrap-break-word sm:text-right">{value}</span>
    </div>
  );
}

function FieldList({ title, items }: Readonly<{ title: string; items: Array<{ label: string; value: unknown }> }>) {
  const shown = items
    .map((x) => ({ label: x.label, value: val(x.value) }))
    .filter((x) => x.value !== '—');
  if (shown.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</p>
      </div>
      <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50/60 divide-y divide-gray-100 px-4">
        {shown.map((x) => (
          <FieldRow key={x.label} label={x.label} value={x.value} />
        ))}
      </div>
    </div>
  );
}

export function PayloadViewer({ payload, salesTransactionId }: PayloadViewerProps) {
  if (!payload) return null;

  const tx = (payload.transaction ?? {}) as Record<string, unknown>;
  const portalMeta = (payload.portalMeta ?? {}) as Record<string, unknown>;
  const customer = (payload.customer ?? {}) as Record<string, unknown>;
  const service = (payload.service ?? {}) as Record<string, unknown>;
  const contacts = (customer.contacts ?? {}) as Record<string, unknown>;
  const primary = (contacts.primaryContact ?? {}) as Record<string, unknown>;
  const secondary = contacts.secondaryContact as Record<string, unknown> | undefined;
  const servicedAddr = (service.servicedAddress ?? {}) as Record<string, unknown>;
  const billing = (service.serviceBilling ?? {}) as Record<string, unknown>;
  const concession = (billing.concession ?? {}) as Record<string, unknown>;
  const residentIdentity = (customer.residentIdentity ?? {}) as Record<string, unknown>;
  const companyIdentity = (customer.companyIdentity ?? {}) as Record<string, unknown>;

  const renderAddress = (addr: Record<string, unknown>, title: string) => (
    <FieldList
      title={title}
      items={[
        { label: 'Address Type', value: addr.addressType },
        { label: 'Unit Number', value: addr.unitNumber },
        { label: 'Street Number', value: addr.streetNumber },
        { label: 'Street Name', value: addr.streetName },
        { label: 'Street Type', value: addr.streetTypeCode },
        { label: 'Suburb', value: addr.suburb },
        { label: 'State', value: addr.state },
        { label: 'Post Code', value: addr.postCode },
      ]}
    />
  );

  const primaryAddrs = (primary.addresses ?? []) as Record<string, unknown>[];
  const primaryPhones = (primary.contactPhones ?? []) as Record<string, unknown>[];
  const secondaryAddrs = ((secondary?.addresses ?? []) as Record<string, unknown>[]) || [];
  const secondaryPhones = ((secondary?.contactPhones ?? []) as Record<string, unknown>[]) || [];

  return (
    <div className="space-y-5">
      <Section title="Transaction">
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 divide-y divide-gray-100 px-4">
          <FieldRow label="Transaction Reference" value={val(tx.transactionReference)} />
          <FieldRow label="Channel" value={val(tx.transactionChannel)} />
          <FieldRow label="Center" value={val(portalMeta.center)} />
          <FieldRow label="DNC number" value={val(portalMeta.dncNumber)} />
          <FieldRow label="Agent name" value={val(portalMeta.agentName)} />
          <FieldRow label="Closer" value={val(portalMeta.closer)} />
          <FieldRow label="Auditor name" value={val(portalMeta.auditorName)} />
          <FieldRow label="Transaction Date" value={val(tx.transactionDate)} />
          <FieldRow label="Verification Code" value={val(tx.transactionVerificationCode)} />
          <FieldRow label="Source" value={val(tx.transactionSource)} />
        </div>
        {salesTransactionId && (
          <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50/40 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-primary-800 uppercase tracking-wide">Sales Transaction ID</span>
              <Link
                to={`/transactions/${salesTransactionId}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                {salesTransactionId}
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </Section>

      <Section title="Contact">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Primary Contact</p>
            <div className="divide-y divide-gray-100">
              <FieldRow label="Name" value={[primary.salutation, primary.firstName, primary.middleName, primary.lastName].filter(Boolean).join(' ')} />
              <FieldRow label="Email" value={val(primary.email)} />
              <FieldRow label="Date of Birth" value={val(primary.dateOfBirth)} />
              <FieldRow label="Country of Birth" value={val(primary.countryOfBirth)} />
              {primaryPhones.map((p) => (
                <FieldRow
                  key={`${val(p.contactPhoneType)}-${val(p.phone)}`}
                  label={`Phone (${val(p.contactPhoneType)})`}
                  value={val(p.phone)}
                />
              ))}
            </div>
            {primaryAddrs.map((a, i) => (
              <div key={`addr-${i}-${val(a.addressType)}-${val(a.streetNumber)}-${val(a.streetName)}-${val(a.postCode)}`}>
                {renderAddress(a, `Address ${i + 1}`)}
              </div>
            ))}
          </div>

          {secondary && Object.keys(secondary).length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Secondary Contact</p>
              <div className="divide-y divide-gray-100">
                <FieldRow
                  label="Name"
                  value={[secondary.salutation, secondary.firstName, secondary.middleName, secondary.lastName].filter(Boolean).join(' ')}
                />
                <FieldRow label="Email" value={val(secondary.email)} />
                <FieldRow label="Date of Birth" value={val(secondary.dateOfBirth)} />
                <FieldRow label="Country of Birth" value={val(secondary.countryOfBirth)} />
                {secondaryPhones.map((p) => (
                  <FieldRow
                    key={`${val(p.contactPhoneType)}-${val(p.phone)}`}
                    label={`Phone (${val(p.contactPhoneType)})`}
                    value={val(p.phone)}
                  />
                ))}
              </div>
              {secondaryAddrs.map((a, i) => (
                <div key={`addr-${i}-${val(a.addressType)}-${val(a.streetNumber)}-${val(a.streetName)}-${val(a.postCode)}`}>
                  {renderAddress(a, `Address ${i + 1}`)}
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section title="Customer">
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 divide-y divide-gray-100 px-4">
          <FieldRow label="Customer Type" value={val(customer.customerType)} />
          <FieldRow label="Customer Sub-Type" value={val(customer.customerSubType)} />
          <FieldRow label="Communication" value={val(customer.communicationPreference)} />
          <FieldRow label="Promotion Allowed" value={val(customer.promotionAllowed)} />
        </div>

        <FieldList
          title="Resident Identity"
          items={[
            { label: 'Driving Licence ID', value: (residentIdentity.drivingLicense as Record<string, unknown> | undefined)?.documentId },
            { label: 'Driving Licence State', value: (residentIdentity.drivingLicense as Record<string, unknown> | undefined)?.issuingState },
            { label: 'Driving Licence Number', value: (residentIdentity.drivingLicense as Record<string, unknown> | undefined)?.documentNumber },
            { label: 'Driving Licence Expiry', value: (residentIdentity.drivingLicense as Record<string, unknown> | undefined)?.documentExpiryDate },
            { label: 'Passport Number', value: (residentIdentity.passport as Record<string, unknown> | undefined)?.documentId },
            { label: 'Passport Country of Issue', value: (residentIdentity.passport as Record<string, unknown> | undefined)?.issuingCountry },
            { label: 'Passport Expiry', value: (residentIdentity.passport as Record<string, unknown> | undefined)?.documentExpiryDate },
            { label: 'Medicare Number', value: (residentIdentity.medicare as Record<string, unknown> | undefined)?.documentId },
            { label: 'Medicare Individual Reference', value: (residentIdentity.medicare as Record<string, unknown> | undefined)?.documentNumber },
            { label: 'Medicare Expiry', value: (residentIdentity.medicare as Record<string, unknown> | undefined)?.documentExpiryDate },
          ]}
        />

        <FieldList
          title="Company Identity"
          items={[
            { label: 'Entity Name', value: companyIdentity.entityName },
            { label: 'Trading Name', value: companyIdentity.tradingName },
            { label: 'ABN', value: (companyIdentity.abn as Record<string, unknown> | undefined)?.documentId },
          ]}
        />
      </Section>

      <Section title="Service">
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 divide-y divide-gray-100 px-4">
          <FieldRow label="Service Type" value={val(service.serviceType)} />
          <FieldRow label="Service Sub-Type" value={val(service.serviceSubType)} />
          <FieldRow label="Connection ID" value={val(service.serviceConnectionId)} />
          <FieldRow label="Meter ID" value={val(service.serviceMeterId)} />
          <FieldRow label="Estimated Annual Usage (kWh)" value={val(service.estimatedAnnualKwhs)} />
          <FieldRow label="Lot Number" value={val(service.lotNumber)} />
          <FieldRow label="Start Date" value={val(service.serviceStartDate)} />
        </div>

        <div className="mt-4">
          {renderAddress(servicedAddr, 'Serviced Address')}
        </div>

        <FieldList
          title="Billing"
          items={[
            { label: 'Offer Code', value: billing.serviceOfferCode },
            { label: 'Plan', value: billing.servicePlanCode },
            { label: 'Offer Quote Date', value: billing.offerQuoteDate },
            { label: 'Contract Date', value: billing.contractDate },
            { label: 'Contract Term', value: billing.contractTermCode },
            { label: 'Payment Method', value: billing.paymentMethod },
            { label: 'Bill Cycle', value: billing.billCycleCode },
            { label: 'Bill Delivery', value: billing.billDeliveryMethod },
          ]}
        />

        {Object.keys(concession).length > 0 && (
          <FieldList
            title="Concession"
            items={[
              { label: 'Consent Obtained', value: concession.concessionConsentObtained },
              { label: 'Has MS', value: concession.concessionHasMS },
              { label: 'In Group Home', value: concession.concessionInGroupHome },
              { label: 'Start Date', value: concession.concessionStartDate },
              { label: 'End Date', value: concession.concessionEndDate },
              { label: 'Card Type', value: concession.concessionCardType },
              { label: 'Card Code', value: concession.concessionCardCode },
              { label: 'CRN (Card Number)', value: concession.concessionCardNumber },
              { label: 'Card Expiry Date', value: concession.concessionCardExpiryDate },
              { label: 'First Name', value: concession.concessionCardFirstName },
              { label: 'Middle Name', value: concession.concessionCardMiddleName },
              { label: 'Last Name', value: concession.concessionCardLastName },
            ]}
          />
        )}
      </Section>
    </div>
  );
}
