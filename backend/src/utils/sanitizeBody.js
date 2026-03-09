/**
 * Sanitize request body before forwarding to Momentum API.
 * Ensures structure and optional fields match API expectations.
 */
function sanitizeBody(body) {
  const cleaned = JSON.parse(JSON.stringify(body));

  // Omit empty optional transaction fields
  if (!cleaned.transaction?.transactionVerificationCode?.trim()) {
    delete cleaned.transaction?.transactionVerificationCode;
  }

  // Add contactType (required by Momentum API)
  if (cleaned.customer?.contacts?.primaryContact) {
    cleaned.customer.contacts.primaryContact.contactType = 'PRIMARY';
  }
  if (cleaned.customer?.contacts?.secondaryContact) {
    cleaned.customer.contacts.secondaryContact.contactType = 'SECONDARY';
  }

  // Default addressType to POSTAL when missing
  const setAddressTypes = (addrs) => {
    if (!Array.isArray(addrs)) return;
    for (const addr of addrs) {
      if (!addr.addressType?.trim()) addr.addressType = 'POSTAL';
    }
  };
  setAddressTypes(cleaned.customer?.contacts?.primaryContact?.addresses);
  setAddressTypes(cleaned.customer?.contacts?.secondaryContact?.addresses);

  // Add contractDate from offerQuoteDate when missing
  const sb = cleaned.service?.serviceBilling;
  if (sb?.offerQuoteDate && !sb.contractDate) {
    sb.contractDate = sb.offerQuoteDate;
  }

  // Omit empty optional serviceBilling fields
  if (sb && !sb.servicePlanCode?.trim()) {
    delete sb.servicePlanCode;
  }

  return cleaned;
}

export { sanitizeBody };
