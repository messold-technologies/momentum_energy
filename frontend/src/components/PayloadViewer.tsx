import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

interface PayloadViewerProps {
  payload: Record<string, unknown> | null;
  salesTransactionId?: string | null;
}

function val(v: unknown): string {
  if (v == null || v === '') return '—';
  return String(v);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <h3 className="px-4 py-2.5 bg-gray-50 text-sm font-semibold text-gray-700 border-b border-gray-200">
        {title}
      </h3>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  if (value === '—') return null;
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-right break-all">{value}</span>
    </div>
  );
}

export function PayloadViewer({ payload, salesTransactionId }: PayloadViewerProps) {
  if (!payload) return null;

  const tx = (payload.transaction ?? {}) as Record<string, unknown>;
  const customer = (payload.customer ?? {}) as Record<string, unknown>;
  const service = (payload.service ?? {}) as Record<string, unknown>;
  const contacts = (customer.contacts ?? {}) as Record<string, unknown>;
  const primary = (contacts.primaryContact ?? {}) as Record<string, unknown>;
  const secondary = contacts.secondaryContact as Record<string, unknown> | undefined;
  const servicedAddr = (service.servicedAddress ?? {}) as Record<string, unknown>;
  const billing = (service.serviceBilling ?? {}) as Record<string, unknown>;

  const formatAddr = (addr: Record<string, unknown>) => {
    const parts = [
      addr.unitNumber,
      addr.streetNumber,
      addr.streetName,
      addr.streetTypeCode,
      addr.suburb,
      addr.state,
      addr.postCode,
    ].filter(Boolean);
    return parts.length ? parts.join(' ') : '—';
  };

  const primaryAddrs = (primary.addresses ?? []) as Record<string, unknown>[];
  const primaryPhones = (primary.contactPhones ?? []) as Record<string, unknown>[];

  return (
    <div className="space-y-4">
      <Section title="Transaction">
        <FieldRow label="Transaction Reference" value={val(tx.transactionReference)} />
        <FieldRow label="Channel" value={val(tx.transactionChannel)} />
        <FieldRow label="Transaction Date" value={val(tx.transactionDate)} />
        <FieldRow label="Verification Code" value={val(tx.transactionVerificationCode)} />
        <FieldRow label="Source" value={val(tx.transactionSource)} />
        {salesTransactionId && (
          <div className="pt-2 mt-2 border-t border-gray-100">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">Sales Transaction ID</span>
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

      <Section title="Customer">
        <FieldRow label="Customer Type" value={val(customer.customerType)} />
        <FieldRow label="Customer Sub-Type" value={val(customer.customerSubType)} />
        <FieldRow label="Communication" value={val(customer.communicationPreference)} />
        <div className="pt-2 mt-2 border-t border-gray-100 space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Primary Contact</p>
          <FieldRow
            label="Name"
            value={[primary.salutation, primary.firstName, primary.lastName].filter(Boolean).join(' ')}
          />
          <FieldRow label="Email" value={val(primary.email)} />
          <FieldRow label="Date of Birth" value={val(primary.dateOfBirth)} />
          {primaryPhones.map((p, i) => (
            <FieldRow key={i} label={`Phone (${val(p.contactPhoneType)})`} value={val(p.phone)} />
          ))}
          {primaryAddrs.map((a, i) => (
            <FieldRow key={i} label={`Address ${i + 1}`} value={formatAddr(a as Record<string, unknown>)} />
          ))}
        </div>
        {secondary && Object.keys(secondary).length > 0 && (
          <div className="pt-2 mt-2 border-t border-gray-100 space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Secondary Contact</p>
            <FieldRow
              label="Name"
              value={[secondary.salutation, secondary.firstName, secondary.lastName].filter(Boolean).join(' ')}
            />
            <FieldRow label="Email" value={val(secondary.email)} />
          </div>
        )}
      </Section>

      <Section title="Service">
        <FieldRow label="Service Type" value={val(service.serviceType)} />
        <FieldRow label="Service Sub-Type" value={val(service.serviceSubType)} />
        <FieldRow label="Connection ID" value={val(service.serviceConnectionId)} />
        <FieldRow label="Meter ID" value={val(service.serviceMeterId)} />
        <FieldRow label="Start Date" value={val(service.serviceStartDate)} />
        <div className="pt-2 mt-2 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Serviced Address</p>
          <FieldRow label="Address" value={formatAddr(servicedAddr)} />
        </div>
        <div className="pt-2 mt-2 border-t border-gray-100 space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Billing</p>
          <FieldRow label="Offer Code" value={val(billing.serviceOfferCode)} />
          <FieldRow label="Plan" value={val(billing.servicePlanCode)} />
          <FieldRow label="Payment Method" value={val(billing.paymentMethod)} />
          <FieldRow label="Bill Cycle" value={val(billing.billCycleCode)} />
          <FieldRow label="Bill Delivery" value={val(billing.billDeliveryMethod)} />
        </div>
      </Section>
    </div>
  );
}
