/**
 * Validates an Australian Business Number (ABN)
 * @param {string} abn - 11 digit ABN
 */
function isValidABN(abn) {
  return /^\d{11}$/.test(abn);
}

/**
 * Validates a National Metering Identifier (NMI) - 10 or 11 digits
 */
function isValidNMI(nmi) {
  return /^\d{10,11}$/.test(nmi);
}

/**
 * Validates a Meter Installation Registration Number (MIRN) - 10 or 11 digits
 */
function isValidMIRN(mirn) {
  return /^\d{10,11}$/.test(mirn);
}

/**
 * Validates Australian postcode - 4 digits
 */
function isValidPostcode(postcode) {
  return /^\d{4}$/.test(postcode);
}

/**
 * Validates Australian state code
 */
function isValidState(state) {
  return ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'].includes(state);
}

/**
 * Checks if a date string is in the past
 */
function isDateExpired(dateStr) {
  return new Date(dateStr) < new Date();
}

/**
 * Checks if date is more than N days in the past
 */
function isOlderThanDays(dateStr, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(dateStr) < cutoff;
}

/**
 * Checks if a person is at least 18 years old
 */
function isAtLeast18(dobStr) {
  const dob = new Date(dobStr);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return dob <= cutoff;
}

module.exports = {
  isValidABN,
  isValidNMI,
  isValidMIRN,
  isValidPostcode,
  isValidState,
  isDateExpired,
  isOlderThanDays,
  isAtLeast18,
};
