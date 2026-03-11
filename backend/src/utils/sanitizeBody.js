/** Convert date to yyyy-MM-dd (Momentum API expects this format) */
function toDateOnly(value) {
  if (!value) return value;
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : value;
}

/** Remove key if value is empty/falsy */
function omitIfEmpty(obj, key) {
  if (!obj || typeof obj !== 'object') return;
  const v = obj[key];
  if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
    delete obj[key];
  }
}

/**
 * Sanitize request body before forwarding to Momentum API.
 * Ensures structure and optional fields match API expectations.
 * Momentum rejects empty strings for optional fields - omit them entirely.
 */
function sanitizeBody(body) {
  const cleaned = JSON.parse(JSON.stringify(body));

  // Transaction: Momentum requires transactionVerificationCode
  if (!cleaned.transaction?.transactionVerificationCode?.trim()) {
    cleaned.transaction.transactionVerificationCode = 'N/A';
  }

  // Add contactType (required by Momentum API)
  if (cleaned.customer?.contacts?.primaryContact) {
    cleaned.customer.contacts.primaryContact.contactType = 'PRIMARY';
    omitIfEmpty(cleaned.customer.contacts.primaryContact, 'middleName');
    if (cleaned.customer.contacts.primaryContact.dateOfBirth) {
      cleaned.customer.contacts.primaryContact.dateOfBirth = toDateOnly(
        cleaned.customer.contacts.primaryContact.dateOfBirth
      );
    }
  }
  if (cleaned.customer?.contacts?.secondaryContact) {
    cleaned.customer.contacts.secondaryContact.contactType = 'SECONDARY';
    omitIfEmpty(cleaned.customer.contacts.secondaryContact, 'middleName');
    if (cleaned.customer.contacts.secondaryContact.dateOfBirth) {
      cleaned.customer.contacts.secondaryContact.dateOfBirth = toDateOnly(
        cleaned.customer.contacts.secondaryContact.dateOfBirth
      );
    }
  }

  // Addresses: default addressType, omit empty unitNumber
  const processAddresses = (addrs) => {
    if (!Array.isArray(addrs)) return;
    for (const addr of addrs) {
      if (!addr.addressType?.trim()) addr.addressType = 'POSTAL';
      omitIfEmpty(addr, 'unitNumber');
    }
  };
  processAddresses(cleaned.customer?.contacts?.primaryContact?.addresses);
  processAddresses(cleaned.customer?.contacts?.secondaryContact?.addresses);

  // Company: omit empty trusteeName, acn
  const ci = cleaned.customer?.companyIdentity;
  if (ci) {
    omitIfEmpty(ci, 'trusteeName');
    if (ci.acn && !ci.acn?.documentId?.trim()) delete ci.acn;
  }

  // Service: omit empty optionals, dates as yyyy-MM-dd
  omitIfEmpty(cleaned.service, 'serviceMeterId');
  omitIfEmpty(cleaned.service, 'lotNumber');
  if (cleaned.service?.serviceStartDate) {
    cleaned.service.serviceStartDate = toDateOnly(cleaned.service.serviceStartDate);
  }

  // servicedAddress: omit empty optional fields
  const sa = cleaned.service?.servicedAddress;
  if (sa) {
    const optionalKeys = ['name', 'unitType', 'unitNumber', 'floorType', 'floorNumber', 'streetNumberSuffix', 'streetNameSuffix', 'accessInstructions', 'safetyInstructions'];
    for (const key of optionalKeys) omitIfEmpty(sa, key);
  }

  // Service billing: dates as yyyy-MM-dd
  const sb = cleaned.service?.serviceBilling;
  if (sb) {
    if (sb.offerQuoteDate) sb.offerQuoteDate = toDateOnly(sb.offerQuoteDate);
    if (!sb.contractDate && sb.offerQuoteDate) sb.contractDate = sb.offerQuoteDate;
    else if (sb.contractDate) sb.contractDate = toDateOnly(sb.contractDate);
  }

  return cleaned;
}

export { sanitizeBody };
