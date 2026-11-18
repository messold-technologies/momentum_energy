/**
 * Agent sale helpers: consent tokens and the public-facing projection.
 *
 * The consent page is reachable by anyone holding the link, so what it exposes is
 * deliberately narrow. Everything the customer needs to recognise their own sale and
 * nothing that would be damaging in the wrong hands.
 */
import crypto from 'crypto';

/** Consent statements a customer must agree to before the sale can go to QA. */
export const CONSENT_ITEMS = [
  {
    key: 'identityAndDetails',
    required: true,
    label: 'The details shown above are correct',
    description:
      'My name, contact details and service address are accurate, and I am authorised to set up energy at this address.',
  },
  {
    key: 'planAgreement',
    required: true,
    label: 'I agree to the plan and its pricing',
    description:
      'I have seen the plan shown above, including its rates and estimated cost, and I agree to sign up to it.',
  },
  {
    key: 'creditCheck',
    required: true,
    label: 'I consent to a credit check',
    description:
      'I permit Momentum Energy to obtain and use credit information about me to assess this application.',
  },
  {
    key: 'promotionAllowed',
    required: true,
    label: 'I consent to being contacted about this sale',
    description: 'Momentum Energy may contact me regarding this application and my account.',
  },
  {
    key: 'directDebit',
    required: false,
    label: 'I authorise direct debit from my nominated account',
    description:
      'Momentum Energy may debit the bank account provided for amounts due under this plan.',
    onlyWhenDirectDebit: true,
  },
];

export function generateConsentToken() {
  // 32 bytes of entropy; only the hash is persisted.
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashConsentToken(token) };
}

export function hashConsentToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function firstPhone(contact) {
  const phones = contact?.contactPhones;
  if (!Array.isArray(phones)) return null;
  const mobile = phones.find((p) => p?.contactPhoneType === 'MOBILE' && p?.phone);
  return (mobile || phones.find((p) => p?.phone))?.phone ?? null;
}

/** Mask all but the last 3 characters, e.g. 0477222090 -> *******090 */
function maskTail(value, keep = 3) {
  const s = String(value || '');
  if (s.length <= keep) return s ? '*'.repeat(s.length) : null;
  return '*'.repeat(s.length - keep) + s.slice(-keep);
}

export function formatAddress(addr) {
  if (!addr) return null;
  const line = [
    addr.unitNumber ? `${addr.unitNumber}/` : '',
    addr.streetNumber,
    addr.streetName,
    addr.streetTypeCode,
  ]
    .filter(Boolean)
    .join(' ')
    .replace('/ ', '/');
  return [line, addr.suburb, addr.state, addr.postCode].filter(Boolean).join(', ') || null;
}

/** Name and email for the QA queue, derived from the payload. */
export function deriveSummary(payload) {
  const primary = payload?.customer?.contacts?.primaryContact;
  const name =
    payload?.customer?.customerType === 'COMPANY'
      ? payload?.customer?.companyIdentity?.entityName ?? null
      : [primary?.firstName, primary?.lastName].filter(Boolean).join(' ') || null;

  return {
    customerName: name,
    customerEmail: primary?.email ?? null,
    serviceAddress: formatAddress(payload?.service?.servicedAddress),
    transactionReference: payload?.transaction?.transactionReference ?? null,
  };
}

/**
 * What the customer sees on the public consent page.
 *
 * Excluded on purpose: date of birth, identity document numbers and expiries, full bank
 * account number, and anything about the agent or internal references. A direct debit
 * account is acknowledged only as a masked tail so the customer can recognise it.
 */
export function buildPublicSummary(row) {
  const payload = row.payload || {};
  const primary = payload?.customer?.contacts?.primaryContact;
  const plan = row.selected_plan || {};
  const billing = payload?.service?.serviceBilling || {};
  const dd = payload?.customer?.directDebitDetails;

  const usingDirectDebit =
    billing.paymentMethod === 'Direct Debit Via Bank Account' || Boolean(dd?.accountNumber);

  return {
    status: row.status,
    customer: {
      firstName: primary?.firstName ?? null,
      lastName: primary?.lastName ?? null,
      email: primary?.email ?? null,
      phone: firstPhone(primary),
      postalAddress: formatAddress(primary?.addresses?.[0]),
    },
    service: {
      energyType: payload?.service?.serviceType === 'GAS' ? 'Gas' : 'Electricity',
      serviceSubType: payload?.service?.serviceSubType ?? null,
      address: formatAddress(payload?.service?.servicedAddress),
      startDate: payload?.service?.serviceStartDate ?? null,
    },
    plan: {
      planCode: plan.planCode ?? billing.servicePlanCode ?? null,
      networkName: plan.networkName ?? null,
      monthlyCost: plan.monthlyCost ?? null,
      annualCost: plan.annualCost ?? null,
      comparisonLabel: plan.comparisonLabel ?? null,
      benchmarkName: plan.benchmarkName ?? null,
      factSheetUrl: plan.factSheetUrl ?? null,
      contractTerm: billing.contractTermCode ?? null,
      billCycle: billing.billCycleCode ?? null,
      billDelivery: billing.billDeliveryMethod ?? null,
      paymentMethod: billing.paymentMethod ?? null,
      indicativeOnly: plan.indicativeOnly ?? false,
    },
    directDebit: usingDirectDebit
      ? { accountNameInitial: dd?.accountName ? `${String(dd.accountName).trim()[0]}.` : null, accountNumberMasked: maskTail(dd?.accountNumber) }
      : null,
    consentItems: CONSENT_ITEMS.filter((c) => !c.onlyWhenDirectDebit || usingDirectDebit).map(
      ({ key, required, label, description }) => ({ key, required, label, description })
    ),
    alreadyConsentedAt: row.consented_at ?? null,
  };
}

/**
 * Apply the customer's ticks back into the payload, so the booleans Momentum requires
 * carry the consent the customer actually gave rather than an agent-set default.
 */
export function applyConsentToPayload(payload, consent) {
  const next = structuredClone(payload || {});
  next.customer = next.customer || {};

  if (consent.promotionAllowed === true) next.customer.promotionAllowed = true;

  if (consent.directDebit === true && next.customer.directDebitDetails) {
    next.customer.directDebitDetails.directDebitConsent = true;
  }

  return next;
}

export function validateConsent(body, items) {
  const given = body?.consent;
  if (!given || typeof given !== 'object') {
    return { ok: false, error: 'consent is required' };
  }
  const missing = items
    .filter((i) => i.required)
    .filter((i) => given[i.key] !== true)
    .map((i) => i.key);

  if (missing.length) {
    return { ok: false, error: `All required consents must be agreed: ${missing.join(', ')}` };
  }
  if (!body?.confirmedName || String(body.confirmedName).trim().length < 2) {
    return { ok: false, error: 'Please type your full name to confirm' };
  }
  return { ok: true };
}
