import { body, validationResult } from 'express-validator';

/** Check if date is a weekday (Mon–Fri) */
function isWeekday(d) {
  const day = d.getUTCDay();
  return day >= 1 && day <= 5;
}

/** Add N working days to a date (negative for past) */
function addWorkingDays(fromDate, days) {
  const d = new Date(fromDate);
  d.setUTCHours(0, 0, 0, 0);
  let remaining = Math.abs(days);
  const increment = days >= 0 ? 1 : -1;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + increment);
    if (isWeekday(d)) remaining--;
  }
  return d;
}

/** Parse ISO string to date-only YYYY-MM-DD */
function toDateOnly(isoStr) {
  if (!isoStr) return null;
  const m = String(isoStr).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

// Transaction field validations per CAF spec
const TRANSACTION_REF_REGEX = /^[A-Za-z0-9\-]{1,30}$/;
const TRANSACTION_CHANNEL_REGEX = /^[A-Za-z0-9\s]+$/;
const TRANSACTION_VERIFICATION_REGEX = /^[A-Za-z0-9\-]{1,30}$/;

const transactionValidation = [
  body('transaction.transactionReference')
    .notEmpty()
    .withMessage('transactionReference is required')
    .matches(TRANSACTION_REF_REGEX)
    .withMessage('transactionReference must be 1-30 chars: letters, numbers, hyphen'),

  body('transaction.transactionChannel')
    .notEmpty()
    .withMessage('transactionChannel is required')
    .matches(TRANSACTION_CHANNEL_REGEX)
    .withMessage('transactionChannel must contain letters, numbers and spaces only'),

  body('transaction.transactionDate')
    .notEmpty()
    .withMessage('transactionDate is required')
    .isISO8601()
    .withMessage('transactionDate must be ISO 8601 datetime')
    .custom((value) => {
      const txDate = toDateOnly(value);
      if (!txDate) return true;
      const tx = new Date(txDate + 'T12:00:00Z');
      const today = new Date();
      today.setUTCHours(12, 0, 0, 0);
      const minDate = addWorkingDays(today, -3);
      const maxDate = addWorkingDays(today, 3);
      if (tx < minDate) throw new Error('Transaction date must not be more than 3 working days in the past');
      if (tx > maxDate) throw new Error('Transaction date must not be more than 3 working days in the future');
      return true;
    }),

  body('transaction.transactionVerificationCode')
    .optional({ values: 'falsy' })
    .matches(TRANSACTION_VERIFICATION_REGEX)
    .withMessage('transactionVerificationCode must be 1-30 chars: letters, numbers, hyphen'),

  body('transaction.transactionSource')
    .notEmpty()
    .withMessage('transactionSource is required')
    .equals('EXTERNAL')
    .withMessage('transactionSource must be EXTERNAL'),
];

const RESIDENT_SUB_TYPES = ['RESIDENT'];
const COMPANY_SUB_TYPES = ['Incorporation', 'Limited Company', 'NA', 'Partnership', 'Private', 'Sole Trader', 'Trust', 'C&I', 'SME'];

const customerValidation = [
  body('customer.customerType')
    .isIn(['RESIDENT', 'COMPANY'])
    .withMessage('customerType must be RESIDENT or COMPANY'),

  body('customer.customerSubType')
    .custom((value, { req }) => {
      const type = req.body?.customer?.customerType;
      if (type === 'RESIDENT') {
        if (value !== 'RESIDENT') {
          throw new Error('customerSubType must be RESIDENT when customerType is RESIDENT');
        }
      } else if (type === 'COMPANY') {
        if (!COMPANY_SUB_TYPES.includes(value)) {
          throw new Error(`customerSubType must be one of: ${COMPANY_SUB_TYPES.join(', ')}`);
        }
      }
      return true;
    }),

  body('customer.communicationPreference')
    .isIn(['POST', 'EMAIL'])
    .withMessage('communicationPreference must be POST or EMAIL'),

  body('customer.promotionAllowed')
    .custom((value) => value === true || value === 'true')
    .withMessage('Customer consent must be obtained (promotionAllowed must be true)'),
];

const identityValidation = [
  body('customer.residentIdentity.passport.documentId')
    .optional()
    .matches(/^[A-Za-z0-9-]{1,30}$/),

  body('customer.residentIdentity.passport.documentExpiryDate')
    .optional()
    .isISO8601(),

  body('customer.residentIdentity.passport.issuingCountry')
    .optional()
    .isLength({ min: 3, max: 3 }),

  body('customer.residentIdentity.drivingLicense.documentId')
    .optional()
    .matches(/^[A-Za-z0-9-]{1,30}$/),

  body('customer.residentIdentity.drivingLicense.documentExpiryDate')
    .optional()
    .isISO8601(),

  body('customer.residentIdentity.drivingLicense.issuingState')
    .optional()
    .isIn(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']),

  body('customer.residentIdentity.medicare.documentId')
    .optional()
    .matches(/^[A-Za-z0-9-]{1,30}$/),

  body('customer.residentIdentity.medicare.documentNumber')
    .optional()
    .matches(/^\d{1,30}$/),

  body('customer.residentIdentity.medicare.documentExpiryDate')
    .optional()
    .isISO8601(),
];

// ISO 3166-1 alpha-3 country codes for countryOfBirth
const COUNTRY_CODES = [
  'AFG', 'ALA', 'ALB', 'DZA', 'ASM', 'AND', 'AGO', 'AIA', 'ATA', 'ATG', 'ARG', 'ARM', 'ABW', 'AUS', 'AUT', 'AZE',
  'BHS', 'BHR', 'BGD', 'BRB', 'BLR', 'BEL', 'BLZ', 'BEN', 'BMU', 'BTN', 'BOL', 'BES', 'BIH', 'BWA', 'BVT', 'BRA',
  'IOT', 'UMI', 'VGB', 'VIR', 'BRN', 'BGR', 'BFA', 'BDI', 'KHM', 'CMR', 'CAN', 'CPV', 'CYM', 'CAF', 'TCD', 'CHL',
  'CHN', 'CXR', 'CCK', 'COL', 'COM', 'COG', 'COD', 'COK', 'CRI', 'HRV', 'CUB', 'CUW', 'CYP', 'CZE', 'DNK', 'DJI',
  'DMA', 'DOM', 'ECU', 'EGY', 'SLV', 'GNQ', 'ERI', 'EST', 'ETH', 'FLK', 'FRO', 'FJI', 'FIN', 'FRA', 'GUF', 'PYF',
  'ATF', 'GAB', 'GMB', 'GEO', 'DEU', 'GHA', 'GIB', 'GRC', 'GRL', 'GRD', 'GLP', 'GUM', 'GTM', 'GGY', 'GIN', 'GNB',
  'GUY', 'HTI', 'HMD', 'VAT', 'HND', 'HKG', 'HUN', 'ISL', 'IND', 'IDN', 'CIV', 'IRN', 'IRQ', 'IRL', 'IMN', 'ISR',
  'ITA', 'JAM', 'JPN', 'JEY', 'JOR', 'KAZ', 'KEN', 'KIR', 'KWT', 'KGZ', 'LAO', 'LVA', 'LBN', 'LSO', 'LBR', 'LBY',
  'LIE', 'LTU', 'LUX', 'MAC', 'MKD', 'MDG', 'MWI', 'MYS', 'MDV', 'MLI', 'MLT', 'MHL', 'MTQ', 'MRT', 'MUS', 'MYT',
  'MEX', 'FSM', 'MDA', 'MCO', 'MNG', 'MNE', 'MSR', 'MAR', 'MOZ', 'MMR', 'NAM', 'NRU', 'NPL', 'NLD', 'NCL', 'NZL',
  'NIC', 'NER', 'NGA', 'NIU', 'NFK', 'PRK', 'MNP', 'NOR', 'OMN', 'PAK', 'PLW', 'PSE', 'PAN', 'PNG', 'PRY', 'PER',
  'PHL', 'PCN', 'POL', 'PRT', 'PRI', 'QAT', 'UNK', 'REU', 'ROU', 'RUS', 'RWA', 'BLM', 'SHN', 'KNA', 'LCA', 'MAF',
  'SPM', 'VCT', 'WSM', 'SMR', 'STP', 'SAU', 'SEN', 'SRB', 'SYC', 'SLE', 'SGP', 'SXM', 'SVK', 'SVN', 'SLB', 'SOM',
  'ZAF', 'SGS', 'KOR', 'SSD', 'ESP', 'LKA', 'SDN', 'SUR', 'SJM', 'SWZ', 'SWE', 'CHE', 'SYR', 'TWN', 'TJK', 'TZA',
  'THA', 'TLS', 'TGO', 'TKL', 'TON', 'TTO', 'TUN', 'TUR', 'TKM', 'TCA', 'TUV', 'UGA', 'UKR', 'ARE', 'GBR', 'USA',
  'URY', 'UZB', 'VUT', 'VEN', 'VNM', 'WLF', 'ESH', 'YEM', 'ZMB', 'ZWE',
];

// Contact email: permissive format for primary and secondary
const CONTACT_EMAIL_REGEX = /^[a-zA-Z0-9._|%#~`=?&/$^*!}{+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
const SALUTATIONS = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.'];

const contactValidation = [
  body('customer.contacts.primaryContact.firstName')
    .matches(/^[A-Z][a-zA-Z'-. ]{1,100}$/)
    .withMessage('firstName must start with uppercase letter and be 2-101 chars'),

  body('customer.contacts.primaryContact.middleName')
    .optional()
    .matches(/^[a-zA-Z'-. ]{1,100}$/)
    .withMessage('middleName invalid'),

  body('customer.contacts.primaryContact.lastName')
    .matches(/^[A-Z][a-zA-Z'-. ]{1,100}$/)
    .withMessage('lastName must start with uppercase letter and be 2-101 chars'),

  body('customer.contacts.primaryContact.dateOfBirth')
    .isISO8601()
    .withMessage('dateOfBirth must be ISO 8601'),

  body('customer.contacts.primaryContact.email')
    .matches(CONTACT_EMAIL_REGEX)
    .withMessage('email must be valid format'),

  body('customer.contacts.primaryContact.countryOfBirth')
    .optional()
    .isIn(COUNTRY_CODES)
    .withMessage('countryOfBirth must be a valid ISO 3166-1 alpha-3 country code'),

  // Secondary contact
  body('customer.contacts.secondaryContact.countryOfBirth')
    .optional()
    .isIn(COUNTRY_CODES)
    .withMessage('countryOfBirth must be a valid ISO 3166-1 alpha-3 country code'),

  body('customer.contacts.secondaryContact.dateOfBirth')
    .custom((value, { req }) => {
      const sc = req.body?.customer?.contacts?.secondaryContact;
      if (!sc) return true;
      const hasContact = sc.firstName || sc.lastName;
      if (hasContact && !value) {
        throw new Error('dateOfBirth is required when secondary contact is provided');
      }
      if (value && !/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(value)) {
        throw new Error('dateOfBirth must be ISO 8601');
      }
      return true;
    }),

  body('customer.contacts.secondaryContact.email')
    .optional()
    .matches(CONTACT_EMAIL_REGEX)
    .withMessage('secondary contact email invalid format'),

  body('customer.contacts.secondaryContact')
    .custom((value) => {
      if (!value) return true;
      const hasContact = value.firstName || value.lastName;
      if (hasContact) {
        if (!value.salutation) throw new Error('salutation is required when secondary contact is provided');
        if (!SALUTATIONS.includes(value.salutation)) {
          throw new Error('salutation must be Mr., Ms., Mrs., Dr., or Prof.');
        }
        if (!value.firstName) throw new Error('firstName is required when secondary contact is provided');
        if (!/^[A-Z][a-zA-Z'-]{1,100}$/.test(value.firstName)) {
          throw new Error('firstName must start with uppercase, 2-101 chars');
        }
        if (!value.lastName) throw new Error('lastName is required when secondary contact is provided');
        if (!/^[A-Z][a-zA-Z'-]{1,100}$/.test(value.lastName)) {
          throw new Error('lastName must start with uppercase, 2-101 chars');
        }
      }
      if (value.middleName && !/^[a-zA-Z'-]{1,100}$/.test(value.middleName)) {
        throw new Error('middleName invalid');
      }
      return true;
    }),

  body('customer.contacts.secondaryContact.addresses.*.addressType')
    .optional()
    .matches(/^[A-Za-z]+$/)
    .withMessage('addressType must be letters only'),
];

const addressValidation = [
  body('customer.contacts.primaryContact.addresses.*.addressType')
    .optional()
    .matches(/^[A-Za-z]+$/)
    .withMessage('addressType must be letters only'),

  body('customer.contacts.primaryContact.addresses.*.streetNumber')
    .notEmpty()
    .withMessage('streetNumber is required')
    .matches(/^[A-Za-z0-9-]+$/)
    .withMessage('streetNumber must be letters, numbers, hyphen only'),

  body('customer.contacts.primaryContact.addresses.*.streetName')
    .notEmpty()
    .withMessage('streetName is required')
    .matches(/^[a-zA-Z0-9'.,/()\s-]+$/)
    .withMessage('streetName invalid'),

  body('customer.contacts.primaryContact.addresses.*.unitNumber')
    .optional()
    .matches(/^[a-zA-Z0-9,./&:\s-]+$/)
    .withMessage('unitNumber invalid'),

  body('customer.contacts.primaryContact.addresses.*.suburb')
    .notEmpty()
    .withMessage('suburb is required')
    .matches(/^[A-Za-z0-9 ]+$/)
    .withMessage('suburb invalid'),

  body('customer.contacts.primaryContact.addresses.*.state')
    .isIn(['ACT', 'NT', 'WA', 'SA', 'VIC', 'NSW'])
    .withMessage('state must be ACT, NT, WA, SA, VIC, or NSW'),

  body('customer.contacts.primaryContact.addresses.*.postCode')
    .matches(/^[0-9]{4}$/)
    .withMessage('postCode must be 4 digits'),
];

const phoneValidation = [
  body('customer.contacts.primaryContact.contactPhones.*.contactPhoneType')
    .isIn(['WORK', 'HOME', 'MOBILE'])
    .withMessage('contactPhoneType must be WORK, HOME, or MOBILE'),

  body('customer.contacts.primaryContact.contactPhones.*.phone')
    .matches(/^(0[2378]\d{8}|0\d{9}|13\d{4}|1300\d{6}|1800\d{6})$/)
    .withMessage('phone must be valid Australian number'),
];

const UNIT_TYPES = [
  'APT', 'CTGE', 'DUP', 'F', 'FY', 'HSE', 'KSK', 'MB', 'MSNT', 'OFF', 'PTHS',
  'RM', 'SE', 'SHED', 'SHOP', 'SITE', 'SL', 'STU', 'TNCY', 'TNHS', 'U', 'VLLA', 'WARD', 'WE',
];
const FLOOR_TYPES = ['FLOOR', 'LEVEL', 'GROUND'];
const STREET_NUMBER_SUFFIXES = ['CN', 'E', 'EX', 'LR', 'N', 'NE', 'NW', 'S', 'SE', 'SW', 'UP', 'W'];

const serviceValidation = [
  body('service.serviceType')
    .isIn(['GAS', 'POWER'])
    .withMessage('serviceType must be GAS or POWER'),

  body('service.serviceSubType')
    .isIn(['TRANSFER', 'MOVE IN'])
    .withMessage('serviceSubType must be TRANSFER or MOVE IN'),

  body('service.serviceConnectionId')
    .matches(/^[0-9A-Za-z]+$/)
    .withMessage('serviceConnectionId must be alphanumeric')
    .custom((value, { req }) => {
      const serviceType = req.body?.service?.serviceType;
      if (serviceType === 'POWER' && value.length !== 10) {
        throw new Error('NMI must be 10 characters for POWER service');
      }
      if (serviceType === 'GAS' && value.length !== 11) {
        throw new Error('MIRN must be 11 characters for GAS service');
      }
      return true;
    }),

  body('service.serviceStartDate')
    .optional()
    .isISO8601()
    .withMessage('serviceStartDate must be ISO 8601')
    .custom((value) => {
      if (!value) return true;
      const startDate = toDateOnly(value);
      if (!startDate) return true;
      const today = new Date().toISOString().slice(0, 10);
      if (startDate < today) {
        throw new Error('Move-in date / service start date cannot be in the past');
      }
      return true;
    }),

  body('service.serviceMeterId')
    .optional()
    .matches(/^[a-zA-Z0-9,./&:-]+$/)
    .withMessage('serviceMeterId invalid'),

  // servicedAddress
  body('service.servicedAddress.name')
    .optional()
    .matches(/^[A-Z][a-zA-Z'-]{1,100}$/)
    .withMessage('Property name must start with uppercase, 2-101 chars'),

  body('service.servicedAddress.unitType')
    .optional()
    .isIn(UNIT_TYPES)
    .withMessage(`unitType must be one of: ${UNIT_TYPES.join(', ')}`),

  body('service.servicedAddress.unitNumber')
    .optional()
    .matches(/^[a-zA-Z0-9,./&:\s-]+$/)
    .withMessage('unitNumber invalid'),

  body('service.servicedAddress.floorType')
    .optional()
    .isIn(FLOOR_TYPES)
    .withMessage('floorType must be FLOOR, LEVEL, or GROUND'),

  body('service.servicedAddress.floorNumber')
    .optional()
    .matches(/^[a-zA-Z0-9,./&:\s-]+$/)
    .withMessage('floorNumber invalid'),

  body('service.servicedAddress.streetNumberSuffix')
    .optional()
    .isIn(STREET_NUMBER_SUFFIXES)
    .withMessage(`streetNumberSuffix must be one of: ${STREET_NUMBER_SUFFIXES.join(', ')}`),

  body('service.servicedAddress.streetNameSuffix')
    .optional()
    .matches(/^[A-Za-z- ]+$/)
    .withMessage('streetNameSuffix invalid'),

  body('service.servicedAddress.streetNumber')
    .notEmpty()
    .withMessage('streetNumber is required')
    .matches(/^[A-Za-z0-9-]+$/)
    .withMessage('streetNumber invalid'),

  body('service.servicedAddress.streetName')
    .notEmpty()
    .withMessage('streetName is required')
    .matches(/^[a-zA-Z0-9'.,/()\s-]+$/)
    .withMessage('streetName invalid'),

  body('service.servicedAddress.suburb')
    .notEmpty()
    .withMessage('suburb is required')
    .matches(/^[A-Za-z0-9 ]+$/)
    .withMessage('suburb invalid'),

  body('service.servicedAddress.state')
    .isIn(['ACT', 'NT', 'WA', 'SA', 'VIC', 'NSW'])
    .withMessage('state must be ACT, NT, WA, SA, VIC, or NSW'),

  body('service.servicedAddress.postCode')
    .matches(/^\d{4}$/)
    .withMessage('postCode must be 4 digits'),
];

const billingValidation = [
  body('service.serviceBilling.offerQuoteDate')
    .isISO8601()
    .withMessage('offerQuoteDate must be ISO 8601'),

  body('service.serviceBilling.serviceOfferCode')
    .matches(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/)
    .withMessage('serviceOfferCode must be 15 or 18 alphanumeric chars'),

  body('service.serviceBilling.contractTermCode')
    .isIn(['OPEN', '12MTH', '24MTH', '36MTH'])
    .withMessage('contractTermCode must be OPEN, 12MTH, 24MTH, or 36MTH'),

  body('service.serviceBilling.paymentMethod')
    .isIn(['Direct Debit Via Bank Account', 'Cheque'])
    .withMessage('paymentMethod must be Direct Debit Via Bank Account or Cheque'),

  body('service.serviceBilling.billCycleCode')
    .isIn(['Monthly', 'Bi-Monthly', 'Quarterly'])
    .withMessage('billCycleCode must be Monthly, Bi-Monthly, or Quarterly'),

  body('service.serviceBilling.billDeliveryMethod')
    .isIn(['EMAIL', 'POST'])
    .withMessage('billDeliveryMethod must be EMAIL or POST'),
];

const transactionValidationRules = [
  ...transactionValidation,
  ...customerValidation,
  ...identityValidation,
  ...contactValidation,
  ...addressValidation,
  ...phoneValidation,
  ...serviceValidation,
  ...billingValidation,
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

export {
  transactionValidation,
  customerValidation,
  identityValidation,
  contactValidation,
  addressValidation,
  phoneValidation,
  serviceValidation,
  billingValidation,
  transactionValidationRules,
  validate,
};
