import { body, validationResult } from 'express-validator';
import { STREET_TYPE_CODES, SAFETY_INSTRUCTIONS, SERVICE_PLAN_CODES } from './streetTypeCodes.js';

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

function isISODateOnly(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '').slice(0, 10));
}

function isNotFutureDateOnly(v) {
  const d = toDateOnly(v);
  if (!d) return false;
  const dt = new Date(d + 'T23:59:59Z');
  return dt.getTime() <= Date.now();
}

function isNotPastDateOnly(v) {
  const d = toDateOnly(v);
  if (!d) return false;
  const dt = new Date(d + 'T00:00:00Z');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return dt.getTime() >= today.getTime();
}

// Transaction field validations per CAF spec
const TRANSACTION_REF_REGEX = /^[A-Z0-9]{1,12}$/;
const TRANSACTION_CHANNEL_REGEX = /^[A-Za-z0-9\s]+$/;
const TRANSACTION_VERIFICATION_REGEX = /^[A-Za-z0-9\-]{1,30}$/;

/** Portal-only; must match `frontend/src/lib/centerOptions.ts` */
const PORTAL_CENTER_OPTIONS = [
  'Utility hub India',
  'Utility hub India- Uhub SA',
  'Utility hub SA',
  'Utility hub Fiji',
  'Utility hub Fiji – Uhub India',
  'Utility hub Fiji – Uhub SA',
  'Er Solutions',
  'Er Solutions – Uhub India',
  'Er Solutions– Uhub SA',
  'Connect IQ',
  'Connect IQ– Uhub India',
  'Connect IQ– Uhub SA',
  'T4U– Uhub India',
  'T4U– Uhub SA',
  'CoSauce SA',
  'CoSauce SA– Uhub India',
  'CoSauce SA– Uhub SA',
  'Real Estate',
  'Real Estate– Uhub India',
  'Real Estate– Uhub SA',
];

const PORTAL_DNC_REGEX = /^\d+$/;

const portalMetaValidation = [
  body('portalMeta').optional().isObject().withMessage('portalMeta must be an object'),
  body('portalMeta.center')
    .optional({ values: 'falsy' })
    .isString()
    .isIn(PORTAL_CENTER_OPTIONS)
    .withMessage('Invalid center value'),
  body('portalMeta.dncNumber')
    .optional({ values: 'falsy' })
    .trim()
    .matches(PORTAL_DNC_REGEX)
    .withMessage('DNC number must be digits only'),
  body('portalMeta.agentName')
    .optional({ values: 'falsy' })
    .trim()
    .isString()
    .isLength({ max: 200 })
    .withMessage('Agent name must be at most 200 characters'),
  body('portalMeta.closer')
    .optional({ values: 'falsy' })
    .trim()
    .isString()
    .isLength({ max: 200 })
    .withMessage('Closer must be at most 200 characters'),
  body('portalMeta.auditorName')
    .optional({ values: 'falsy' })
    .trim()
    .isString()
    .isLength({ max: 200 })
    .withMessage('Auditor name must be at most 200 characters'),
];

const transactionValidation = [
  body('transaction.transactionReference')
    .notEmpty()
    .withMessage('transactionReference is required')
    .customSanitizer((v) => (v && typeof v === 'string' ? v.toUpperCase() : v))
    .matches(TRANSACTION_REF_REGEX)
    .withMessage('transactionReference must be 1-12 chars: uppercase letters and numbers only (no dashes)'),

  body('transaction.transactionChannel')
    .notEmpty()
    .withMessage('transactionChannel is required')
    .matches(TRANSACTION_CHANNEL_REGEX)
    .withMessage('transactionChannel must contain letters, numbers and spaces only'),

  body('transaction.transactionDate')
    .notEmpty()
    .withMessage('transactionDate is required')
    .isISO8601()
    .withMessage('transactionDate must be ISO 8601 datetime'),

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

// ISO 3166-1 alpha-3 country codes (CCA3) - used for countryOfBirth, passport issuingCountry
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

const IDENTITY_DOC_REGEX = /^[A-Za-z0-9-]{1,30}$/;
const ISSUING_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

const identityValidation = [
  body('customer.residentIdentity.passport')
    .optional()
    .custom((p) => {
      if (!p) return true;
      const hasDoc = String(p.documentId || '').trim();
      if (!hasDoc) return true;
      if (!p.documentExpiryDate) throw new Error('documentExpiryDate is required when passport is provided');
      if (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(p.documentExpiryDate)) {
        throw new Error('documentExpiryDate must be ISO 8601');
      }
      if (!p.issuingCountry) throw new Error('issuingCountry is required when passport is provided');
      if (!COUNTRY_CODES.includes(p.issuingCountry)) {
        throw new Error('issuingCountry must be a valid CCA3 country code');
      }
      if (p.documentId && !IDENTITY_DOC_REGEX.test(p.documentId)) {
        throw new Error('documentId must be 1-30 chars: letters, numbers, hyphen');
      }
      return true;
    }),

  body('customer.residentIdentity.drivingLicense')
    .optional()
    .custom((d) => {
      if (!d) return true;
      const hasDoc = String(d.documentId || '').trim();
      if (!hasDoc) return true;
      if (!d.documentExpiryDate) throw new Error('documentExpiryDate is required when driving license is provided');
      if (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(d.documentExpiryDate)) {
        throw new Error('documentExpiryDate must be ISO 8601');
      }
      if (!d.issuingState) throw new Error('issuingState is required when driving license is provided');
      if (!ISSUING_STATES.includes(d.issuingState)) {
        throw new Error('issuingState must be NSW, VIC, QLD, WA, SA, TAS, ACT, or NT');
      }
      if (d.documentId && !IDENTITY_DOC_REGEX.test(d.documentId)) {
        throw new Error('documentId must be 1-30 chars: letters, numbers, hyphen');
      }
      return true;
    }),

  body('customer.residentIdentity.medicare')
    .optional()
    .custom((m) => {
      if (!m) return true;
      const hasDoc = String(m.documentId || m.documentNumber || '').trim();
      if (!hasDoc) return true;
      if (!m.documentNumber) throw new Error('documentNumber is required when medicare is provided');
      if (!/^\d{1,30}$/.test(m.documentNumber)) {
        throw new Error('documentNumber must be 1-30 digits');
      }
      if (!m.documentExpiryDate) throw new Error('documentExpiryDate is required when medicare is provided');
      if (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(m.documentExpiryDate)) {
        throw new Error('documentExpiryDate must be ISO 8601');
      }
      if (m.documentId && !IDENTITY_DOC_REGEX.test(m.documentId)) {
        throw new Error('documentId must be 1-30 chars: letters, numbers, hyphen');
      }
      return true;
    }),
];

const INDUSTRIES = [
  'Agriculture', 'Apparel', 'Banking', 'Biotechnology', 'Chemicals', 'Communications',
  'Construction', 'Consulting', 'Education', 'Electronics', 'Energy', 'Engineering',
  'Entertainment', 'Environmental', 'Finance', 'Food & Beverage', 'Government',
  'Healthcare', 'Hospitality', 'Insurance', 'Machinery', 'Manufacturing', 'Media',
  'Not For Profit', 'Other', 'Recreation', 'Retail', 'Shipping', 'Technology',
  'Telecommunications', 'Transportation', 'Utilities',
];
const COMPANY_NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9'&@/()., -]{1,100}$/;

const companyValidation = [
  body('customer.companyIdentity')
    .optional()
    .custom((ci, { req }) => {
      if (!ci) return true;
      const type = req.body?.customer?.customerType;
      if (type !== 'COMPANY') return true;
      if (!ci.industry) throw new Error('industry is required when customerType is COMPANY');
      if (!INDUSTRIES.includes(ci.industry)) {
        throw new Error('industry must be from the allowed list (e.g. Agriculture, Construction, Finance)');
      }
      if (!ci.entityName) throw new Error('entityName is required when customerType is COMPANY');
      if (!COMPANY_NAME_REGEX.test(ci.entityName)) {
        throw new Error('entityName must start with alphanumeric, 2-101 chars');
      }
      if (!ci.tradingName) throw new Error('tradingName is required when customerType is COMPANY');
      if (!COMPANY_NAME_REGEX.test(ci.tradingName)) {
        throw new Error('tradingName must start with alphanumeric, 2-101 chars');
      }
      if (ci.trusteeName && !COMPANY_NAME_REGEX.test(ci.trusteeName)) {
        throw new Error('trusteeName invalid format');
      }
      if (!ci.abn?.documentId) throw new Error('ABN is required when customerType is COMPANY');
      if (!/^\d{11}$/.test(ci.abn.documentId)) {
        throw new Error('ABN must be exactly 11 digits');
      }
      if (ci.acn?.documentId && !/^\d{9}$/.test(ci.acn.documentId)) {
        throw new Error('ACN must be exactly 9 digits');
      }
      return true;
    }),
];

// Contact email: permissive format for primary and secondary
const CONTACT_EMAIL_REGEX = /^[a-zA-Z0-9._|%#~`=?&/$^*!}{+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
const SALUTATIONS = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.'];

const contactValidation = [
  body('customer.contacts.primaryContact.salutation')
    .notEmpty()
    .withMessage('salutation is required')
    .isIn(SALUTATIONS)
    .withMessage('salutation must be Mr., Ms., Mrs., Dr., or Prof.'),

  body('customer.contacts.primaryContact.firstName')
    .matches(/^[A-Z][a-zA-Z'-]{1,100}$/)
    .withMessage('firstName must start with uppercase, 2-101 chars'),

  body('customer.contacts.primaryContact.middleName')
    .optional({ values: 'falsy' })
    .matches(/^[a-zA-Z'\-.\s]{1,100}$/)
    .withMessage('middleName invalid'),

  body('customer.contacts.primaryContact.lastName')
    .matches(/^[A-Z][a-zA-Z'-]{1,100}$/)
    .withMessage('lastName must start with uppercase, 2-101 chars'),

  body('customer.contacts.primaryContact.dateOfBirth')
    .isISO8601()
    .withMessage('dateOfBirth must be ISO 8601'),

  body('customer.contacts.primaryContact.email')
    .matches(CONTACT_EMAIL_REGEX)
    .withMessage('email must be valid format'),

  body('customer.contacts.primaryContact.countryOfBirth')
    .optional({ values: 'falsy' })
    .isIn(COUNTRY_CODES)
    .withMessage('countryOfBirth must be a valid ISO 3166-1 alpha-3 country code'),

  // Secondary contact
  body('customer.contacts.secondaryContact.countryOfBirth')
    .optional({ values: 'falsy' })
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
    .optional({ values: 'falsy' })
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
      if (value.middleName && !/^[a-zA-Z'\-.\s]{1,100}$/.test(value.middleName)) {
        throw new Error('middleName invalid');
      }
      return true;
    }),

  body('customer.contacts.secondaryContact.addresses.*.addressType')
    .optional({ values: 'falsy' })
    .matches(/^[A-Za-z]+$/)
    .withMessage('addressType must be letters only'),
];

const addressValidation = [
  body('customer.contacts.primaryContact.addresses.*.addressType')
    .optional({ values: 'falsy' })
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

  body('customer.contacts.primaryContact.addresses.*.streetTypeCode')
    .notEmpty()
    .withMessage('streetTypeCode is required')
    .isIn(STREET_TYPE_CODES)
    .withMessage('streetTypeCode must be a valid AS 4590 street type'),

  body('customer.contacts.primaryContact.addresses.*.unitNumber')
    .optional({ values: 'falsy' })
    .matches(/^[a-zA-Z0-9,./&:\s-]+$/)
    .withMessage('unitNumber invalid'),

  body('customer.contacts.primaryContact.addresses.*.suburb')
    .notEmpty()
    .withMessage('suburb is required')
    .matches(/^[A-Za-z0-9 ]+$/)
    .withMessage('suburb invalid'),

  body('customer.contacts.primaryContact.addresses.*.state')
    .isIn(['ACT', 'NT', 'WA', 'SA', 'VIC', 'NSW', 'QLD'])
    .withMessage('state must be ACT, NT, WA, SA, VIC, NSW or QLD'),

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
      if (String(value || '').length !== 11) {
        throw new Error('serviceConnectionId must be 11 characters');
      }
      return true;
    }),

  body('service.serviceStartDate')
    .custom((value, { req }) => {
      const subType = req.body?.service?.serviceSubType;
      if (subType === 'MOVE IN') {
        if (!value) throw new Error('serviceStartDate is required for MOVE IN');
      }
      if (value) {
        if (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(value)) {
          throw new Error('serviceStartDate must be ISO 8601');
        }
        const startDate = toDateOnly(value);
        if (startDate) {
          const today = new Date().toISOString().slice(0, 10);
          if (startDate < today) {
            throw new Error('Move-in date / service start date cannot be in the past');
          }
        }
      }
      return true;
    }),

  body('service.serviceMeterId')
    .optional({ values: 'falsy' })
    .matches(/^[a-zA-Z0-9,./&:-]+$/)
    .withMessage('serviceMeterId invalid'),

  body('service.lotNumber')
    .optional({ values: 'falsy' })
    .matches(/^[a-zA-Z0-9,./&:-]+$/)
    .withMessage('lotNumber invalid'),

  body('service.estimatedAnnualKwhs')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) throw new Error('estimatedAnnualKwhs must be a number');
      return true;
    }),

  // servicedAddress
  body('service.servicedAddress.name')
    .optional({ values: 'falsy' })
    .matches(/^[A-Z][a-zA-Z'-]{1,100}$/)
    .withMessage('Property name must start with uppercase, 2-101 chars'),

  body('service.servicedAddress.unitType')
    .optional({ values: 'falsy' })
    .isIn(UNIT_TYPES)
    .withMessage(`unitType must be one of: ${UNIT_TYPES.join(', ')}`),

  body('service.servicedAddress.unitNumber')
    .optional({ values: 'falsy' })
    .matches(/^[a-zA-Z0-9,./&:\s-]+$/)
    .withMessage('unitNumber invalid'),

  body('service.servicedAddress.floorType')
    .optional({ values: 'falsy' })
    .isIn(FLOOR_TYPES)
    .withMessage('floorType must be FLOOR, LEVEL, or GROUND'),

  body('service.servicedAddress.floorNumber')
    .optional({ values: 'falsy' })
    .matches(/^[a-zA-Z0-9,./&:\s-]+$/)
    .withMessage('floorNumber invalid'),

  body('service.servicedAddress.streetNumberSuffix')
    .optional({ values: 'falsy' })
    .isIn(STREET_NUMBER_SUFFIXES)
    .withMessage(`streetNumberSuffix must be one of: ${STREET_NUMBER_SUFFIXES.join(', ')}`),

  body('service.servicedAddress.streetNameSuffix')
    .optional({ values: 'falsy' })
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

  body('service.servicedAddress.streetTypeCode')
    .notEmpty()
    .withMessage('streetTypeCode is required')
    .isIn(STREET_TYPE_CODES)
    .withMessage('streetTypeCode must be a valid AS 4590 street type'),

  body('service.servicedAddress.suburb')
    .notEmpty()
    .withMessage('suburb is required')
    .matches(/^[A-Za-z0-9 ]+$/)
    .withMessage('suburb must be letters and numbers only'),

  body('service.servicedAddress.state')
    .isIn(['ACT', 'NT', 'WA', 'SA', 'VIC', 'NSW' , 'QLD'])
    .withMessage('state must be ACT, NT, WA, SA, VIC, NSW or QLD'),

  body('service.servicedAddress.postCode')
    .matches(/^[0-9]{4}$/)
    .withMessage('postCode must be 4 digits'),

  body('service.servicedAddress.accessInstructions')
    .optional({ values: 'falsy' })
    .matches(/^[A-Za-z\s0-9,.:-]+$/)
    .withMessage('accessInstructions invalid'),

  body('service.servicedAddress.safetyInstructions')
    .optional({ values: 'falsy' })
    .isIn(SAFETY_INSTRUCTIONS)
    .withMessage('safetyInstructions must be NONE, CAUTION, DOG, ELECFENCE, NOTKNOWN, or WORKSONSITE'),
];

const billingValidation = [
  body('service.serviceBilling.offerQuoteDate')
    .notEmpty()
    .withMessage('offerQuoteDate is required')
    .isISO8601()
    .withMessage('offerQuoteDate must be ISO 8601'),

  body('service.serviceBilling.serviceOfferCode')
    .notEmpty()
    .withMessage('serviceOfferCode is required')
    .matches(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/)
    .withMessage('serviceOfferCode must be 15 or 18 alphanumeric chars'),

  body('service.serviceBilling.servicePlanCode')
    .notEmpty()
    .withMessage('servicePlanCode is required')
    .isIn(SERVICE_PLAN_CODES)
    .withMessage('servicePlanCode must be a valid plan'),

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

  body('service.serviceBilling.concession')
    .optional({ values: 'falsy' })
    .custom((c) => {
      if (!c) return true;
      // If concession object exists, enforce required fields
      const requiredBool = ['concessionConsentObtained', 'concessionHasMS', 'concessionInGroupHome'];
      for (const k of requiredBool) {
        if (typeof c[k] !== 'boolean') throw new Error(`${k} must be boolean`);
      }

      if (!c.concessionStartDate) throw new Error('concessionStartDate is required');
      if (!isISODateOnly(c.concessionStartDate)) throw new Error('concessionStartDate must be ISO date-only (YYYY-MM-DD)');
      if (!isNotFutureDateOnly(c.concessionStartDate)) throw new Error('concessionStartDate must not be in the future');

      if (!c.concessionEndDate) throw new Error('concessionEndDate is required');
      if (!isISODateOnly(c.concessionEndDate)) throw new Error('concessionEndDate must be ISO date-only (YYYY-MM-DD)');
      if (!isNotPastDateOnly(c.concessionEndDate)) throw new Error('concessionEndDate must not be in the past');

      const CARD_TYPES = [
        'DVAGV',
        'HCC',
        'PCC',
        'Pensioner Concession Card (PCC)',
        'DVA Gold Card',
        'DVA Pension Concession Card',
        'Health Care Card (HCC)',
        'DVA TPI',
        'Disability Pension (EDA)',
        'DVA War Widow/Widower',
        'ImmiCard',
        'Tasmanian Concession Card',
        'DVA PCC Only',
        'QLD Seniors Card',
        'Low Income Health Care Card (LIHCC)',
        'LIHCC',
      ];
      if (!c.concessionCardType) throw new Error('concessionCardType is required');
      if (!CARD_TYPES.includes(c.concessionCardType)) throw new Error('concessionCardType invalid');

      if (!c.concessionCardCode) throw new Error('concessionCardCode is required');
      if (!/^[A-Za-z0-9-]+$/.test(c.concessionCardCode)) throw new Error('concessionCardCode invalid');

      if (!c.concessionCardNumber) throw new Error('concessionCardNumber is required');
      if (!/^[A-Za-z0-9-]{1,30}$/.test(c.concessionCardNumber)) throw new Error('concessionCardNumber invalid');

      if (!c.concessionCardExpiryDate) throw new Error('concessionCardExpiryDate is required');
      if (!isISODateOnly(c.concessionCardExpiryDate)) throw new Error('concessionCardExpiryDate must be ISO date-only (YYYY-MM-DD)');
      if (!isNotPastDateOnly(c.concessionCardExpiryDate)) throw new Error('concessionCardExpiryDate must not be in the past');


      const NAME = /^[A-Z][a-zA-Z'-.]{0,100}$/;
      if (!c.concessionCardFirstName) throw new Error('concessionCardFirstName is required');
      if (!NAME.test(c.concessionCardFirstName)) throw new Error('concessionCardFirstName invalid');
      if (c.concessionCardMiddleName && !NAME.test(c.concessionCardMiddleName)) throw new Error('concessionCardMiddleName invalid');
      if (!c.concessionCardLastName) throw new Error('concessionCardLastName is required');
      if (!NAME.test(c.concessionCardLastName)) throw new Error('concessionCardLastName invalid');

      return true;
    }),
];

const transactionValidationRules = [
  ...transactionValidation,
  ...portalMetaValidation,
  ...customerValidation,
  ...identityValidation,
  ...companyValidation,
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
  companyValidation,
  contactValidation,
  addressValidation,
  phoneValidation,
  serviceValidation,
  billingValidation,
  transactionValidationRules,
  validate,
};
