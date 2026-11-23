/**
 * Agent sale helpers: consent tokens and the public-facing projection.
 *
 * The consent page is reachable by anyone holding the link, so what it exposes is
 * deliberately narrow. Everything the customer needs to recognise their own sale and
 * nothing that would be damaging in the wrong hands.
 */
import crypto from 'crypto';

/**
 * Consent statements a customer must agree to before the sale can go to QA.
 *
 * ⚠️ THIS WORDING HAS NOT BEEN APPROVED BY ANYONE. It was drafted to cover the consents
 * Momentum's integration guide requires, and the field each one sets is noted below, but
 * the phrasing is a first pass and not taken from Momentum or from any legal source.
 * Consent wording is a compliance artefact: have it reviewed before this is used with
 * real customers.
 *
 * What the guide actually requires:
 *   promotionAllowed      customer.promotionAllowed must be true -- "all requests most
 *                         have customer consent obtained" (field table, section 3.1)
 *   creditCheck           "Customer must expressly permit a credit check before the
 *                         retailer retrieves or uses credit information" (section 8.3)
 *   directDebit           directDebitConsent must be TRUE when paying by direct debit
 *                         (validation rules, section 8.1.1)
 *
 * identityAndDetails and planAgreement are not required by Momentum. They are here so
 * the customer verifies what the agent captured and agrees to the plan they were quoted.
 */
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
    // Sets customer.promotionAllowed, which Momentum requires to be true.
    key: 'promotionAllowed',
    required: true,
    label: 'I consent to marketing and promotional contact',
    description:
      'Momentum Energy may contact me about this application, my account, and their offers and promotions.',
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
function contactBlock(c) {
  if (!c) return null;
  return {
    salutation: c.salutation ?? null,
    firstName: c.firstName ?? null,
    middleName: c.middleName ?? null,
    lastName: c.lastName ?? null,
    dateOfBirth: c.dateOfBirth ?? null,
    countryOfBirth: c.countryOfBirth ?? null,
    email: c.email ?? null,
    phones: Array.isArray(c.contactPhones)
      ? c.contactPhones.filter((p) => p?.phone).map((p) => ({ type: p.contactPhoneType ?? null, phone: p.phone }))
      : [],
    addresses: Array.isArray(c.addresses)
      ? c.addresses.map((a) => ({ type: a.addressType ?? null, address: formatAddress(a) })).filter((a) => a.address)
      : [],
  };
}

function documentBlock(d) {
  if (!d || !Object.values(d).some(Boolean)) return null;
  return {
    documentId: d.documentId ?? null,
    documentNumber: d.documentNumber ?? null,
    documentExpiryDate: d.documentExpiryDate ?? null,
    issuingState: d.issuingState ?? null,
    issuingCountry: d.issuingCountry ?? null,
  };
}

/**
 * What the customer sees on the public consent page.
 *
 * This is the full record the agent captured, identity document numbers and bank details
 * included, so the customer can check every field before confirming. A typo in a passport
 * number or a BSB fails the sale at Momentum, and the customer is the only person who can
 * catch it.
 *
 * The trade-off: anyone holding the link sees all of it. The link is single use and the
 * stored token is only a hash, but it is still a bearer URL -- if it is forwarded or
 * opened on a shared device, that is full PII exposed. Shortening what is shown here is
 * the lever if that becomes a concern.
 */
/** How many wrong passwords a single link tolerates before it locks. */
export const CONSENT_MAX_ATTEMPTS = 8;

/**
 * The password the customer types to open their consent page: their postcode followed
 * by the two-digit day of their date of birth. Postcode 3121 and a birthday on the 7th
 * gives 312107.
 *
 * Returns every acceptable spelling, because "their postcode" is ambiguous when the
 * property and the postal address differ -- either is accepted, since both are things
 * the customer knows and neither is more secret than the other.
 *
 * ok is false when the payload has no date of birth or no postcode at all. The page
 * then cannot be opened by anyone, which is a dead end for that customer but better
 * than quietly serving their identity documents with no gate.
 */
export function deriveConsentPasswords(payload) {
  const primary = payload?.customer?.contacts?.primaryContact;
  const dob = String(primary?.dateOfBirth ?? '').trim();

  // Stored as YYYY-MM-DD. Take the day, not whatever a Date parse makes of a timezone.
  const dayMatch = dob.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const day = dayMatch ? dayMatch[3] : null;

  const postcodes = new Set();
  const add = (pc) => {
    const digits = String(pc ?? '').replace(/\D/g, '');
    if (digits.length === 4) postcodes.add(digits);
  };
  add(payload?.service?.servicedAddress?.postCode);
  for (const a of primary?.addresses ?? []) add(a?.postCode);

  if (!day || postcodes.size === 0) {
    return { ok: false, values: new Set() };
  }
  return { ok: true, values: new Set([...postcodes].map((pc) => `${pc}${day}`)) };
}

/** Digits only, so spaces or a dash the customer typed do not matter. */
export function consentPasswordMatches(payload, supplied) {
  const given = String(supplied ?? '').replace(/\D/g, '');
  if (given.length !== 6) return false;
  const { ok, values } = deriveConsentPasswords(payload);
  if (!ok) return false;

  // Compare against every acceptable value without returning early, so the time taken
  // does not depend on which one matched.
  let hit = false;
  for (const v of values) {
    if (crypto.timingSafeEqual(Buffer.from(v), Buffer.from(given))) hit = true;
  }
  return hit;
}

export function buildPublicSummary(row) {
  const payload = row.payload || {};
  const customer = payload.customer || {};
  const primary = customer?.contacts?.primaryContact;
  const secondary = customer?.contacts?.secondaryContact;
  const plan = row.selected_plan || {};
  const service = payload.service || {};
  const billing = service.serviceBilling || {};
  const dd = customer.directDebitDetails;
  const ident = customer.residentIdentity || {};
  const company = customer.companyIdentity;
  const concession = billing.concession;

  const usingDirectDebit =
    billing.paymentMethod === 'Direct Debit Via Bank Account' || Boolean(dd?.accountNumber);

  return {
    status: row.status,

    customer: {
      customerType: customer.customerType ?? null,
      customerSubType: customer.customerSubType ?? null,
      communicationPreference: customer.communicationPreference ?? null,
      // Kept flat as well, so the page header can greet them without digging.
      firstName: primary?.firstName ?? null,
      lastName: primary?.lastName ?? null,
      email: primary?.email ?? null,
      phone: primary?.contactPhones?.find((p) => p?.phone)?.phone ?? null,
      postalAddress: formatAddress(primary?.addresses?.[0]),
    },

    primaryContact: contactBlock(primary),
    secondaryContact: contactBlock(secondary),

    identity: {
      passport: documentBlock(ident.passport),
      drivingLicense: documentBlock(ident.drivingLicense),
      medicare: documentBlock(ident.medicare),
    },

    company: company
      ? {
          entityName: company.entityName ?? null,
          tradingName: company.tradingName ?? null,
          trusteeName: company.trusteeName ?? null,
          industry: company.industry ?? null,
          abn: company.abn?.documentId ?? null,
          acn: company.acn?.documentId ?? null,
        }
      : null,

    service: {
      energyType: service.serviceType === 'GAS' ? 'Gas' : 'Electricity',
      serviceSubType: service.serviceSubType ?? null,
      address: formatAddress(service.servicedAddress),
      connectionId: service.serviceConnectionId ?? null,
      meterId: service.serviceMeterId ?? null,
      startDate: service.serviceStartDate ?? null,
      estimatedAnnualKwhs: service.estimatedAnnualKwhs ?? null,
      lotNumber: service.lotNumber ?? null,
      accessInstructions: service.servicedAddress?.accessInstructions ?? null,
      safetyInstructions: service.servicedAddress?.safetyInstructions ?? null,
    },

    plan: {
      planCode: plan.planCode ?? billing.servicePlanCode ?? null,
      networkName: plan.networkName ?? null,
      retailTariffCode: plan.retailTariffCode ?? null,
      monthlyCost: plan.monthlyCost ?? null,
      annualCost: plan.annualCost ?? null,
      comparisonLabel: plan.comparisonLabel ?? null,
      benchmarkName: plan.benchmarkName ?? null,
      factSheetUrl: plan.factSheetUrl ?? null,
      contractTerm: billing.contractTermCode ?? null,
      billCycle: billing.billCycleCode ?? null,
      billDelivery: billing.billDeliveryMethod ?? null,
      paymentMethod: billing.paymentMethod ?? null,
      quoteDate: billing.offerQuoteDate ?? null,
      indicativeOnly: plan.indicativeOnly ?? false,
    },

    concession: concession?.concessionCardNumber
      ? {
          cardType: concession.concessionCardType ?? null,
          cardCode: concession.concessionCardCode ?? null,
          cardNumber: concession.concessionCardNumber ?? null,
          expiryDate: concession.concessionCardExpiryDate ?? null,
          holderName: [concession.concessionCardFirstName, concession.concessionCardLastName]
            .filter(Boolean)
            .join(' ') || null,
        }
      : null,

    directDebit: usingDirectDebit
      ? {
          accountName: dd?.accountName ?? null,
          bsb: dd?.bsb ?? null,
          accountNumber: dd?.accountNumber ?? null,
        }
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
  return { ok: true };
}
