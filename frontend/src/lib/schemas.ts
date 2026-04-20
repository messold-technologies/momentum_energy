import { z } from 'zod';
import {
  addBusinessDays,
  differenceInYears,
  endOfDay,
  isBefore,
  isPast,
  isValid,
  parseISO,
  startOfDay,
} from 'date-fns';
import { COUNTRY_CODES } from './countryCodes';
import { STREET_TYPE_CODES } from './streetTypeCodes';
import { CENTER_OPTIONS } from './centerOptions';

/** Preserved on steps 2–4 so Zod does not strip `portalMeta` between wizard steps. */
const portalMetaPassthroughSchema = z
  .object({
    center: z.string().optional(),
    dncNumber: z.string().optional(),
    agentName: z.string().optional(),
    closer: z.string().optional(),
    auditorName: z.string().optional(),
  })
  .optional();

/** True if date string (yyyy-mm-dd) is at least 18 years ago (person is 18+ today) */
function isAtLeast18YearsOld(dateStr: string): boolean {
  if (!dateStr || dateStr.length < 10) return false;
  const birthDate = parseISO(dateStr.slice(0, 10));
  if (!isValid(birthDate)) return false;
  const today = startOfDay(new Date());
  return differenceInYears(today, birthDate) >= 18;
}

/** True if date string (yyyy-mm-dd) is today or in the future (document not expired) */
function isDateNotExpired(dateStr: string): boolean {
  if (!dateStr || dateStr.length < 10) return false;
  const expiryDate = parseISO(dateStr.slice(0, 10));
  if (!isValid(expiryDate)) return false;
  return !isPast(endOfDay(expiryDate));
}

/** True if expiry string is either yyyy-MM-dd (or ISO) OR yyyy-MM and not expired */
function isExpiryNotExpired(v: string): boolean {
  if (!v) return false;
  const s = String(v).trim();
  // Allow HTML month input value: yyyy-MM
  const monthMatch = s.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]); // 1-12
    if (!year || month < 1 || month > 12) return false;
    // Treat expiry as end of month
    const end = endOfDay(new Date(year, month, 0));
    return !isPast(end);
  }
  return isDateNotExpired(s);
}

// Transaction field patterns per CAF spec
const TRANSACTION_CHANNEL_REGEX = /^[A-Za-z0-9\s]+$/;
/** Momentum portal: fixed prefix OWR- plus 1–26 digits (total length ≤ 30). */
const TRANSACTION_VERIFICATION_REGEX = /^OWR-\d+$/
/** Valid ISO 8601 date/time (YYYY-MM-DD or with time) */
function isValidISO8601(v: string): boolean {
  if (!v || v.length < 10) return false;
  return isValid(parseISO(v));
}

const AU_PHONE_REGEX = /^(0[2378]\d{8}|0\d{9}|13\d{4}|1300\d{6}|1800\d{6})$/;
const CONTACT_EMAIL_REGEX = /^[a-zA-Z0-9._|%#~`=?&/$^*!}{+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
const contactPhoneSchema = z.object({
  contactPhoneType: z.enum(['WORK', 'HOME', 'MOBILE']),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(AU_PHONE_REGEX, 'Must be a valid Australian phone number (e.g. 0412345678, 1300123456)'),
});

// Concession (per spec)
const CONCESSION_CARD_TYPES = [
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
] as const;

// Concession card code: uppercase letters only (portal/Momentum mapping).
const CONCESSION_CARD_CODE_LETTERS_REGEX = /^[A-Z]+$/;
// CRN lives in concessionCardNumber; alphanumeric only, no spaces/special chars.
const CONCESSION_CARD_NUMBER_ALNUM_REGEX = /^[A-Z0-9]+$/;
const CENTRELINK_CRN_REGEX = /^\d{9}[A-Z]$/;
const DVA_CRN_REGEX = /^[TVNQSW][A-Z][A-Z0-9]{2}\d{4}[A-Z]?$/; // 8 or 9 chars
const QLD_SENIORS_CRN_REGEX = /^\d{7,9}$/;
const CONCESSION_NAME_REGEX = /^[A-Z][a-zA-Z'-.]{0,100}$/;

function isDateOnlyNotFuture(dateStr: string): boolean {
  if (!dateStr || dateStr.length < 10) return false;
  const d = parseISO(dateStr.slice(0, 10));
  if (!isValid(d)) return false;
  return !isBefore(startOfDay(new Date()), startOfDay(d)); // today >= d
}

function isDateOnlyNotPast(dateStr: string): boolean {
  if (!dateStr || dateStr.length < 10) return false;
  const d = parseISO(dateStr.slice(0, 10));
  if (!isValid(d)) return false;
  return !isPast(endOfDay(d));
}

const concessionSchema = z
  .object({
    concessionConsentObtained: z.boolean(),
    concessionHasMS: z.boolean(),
    concessionInGroupHome: z.boolean(),
    concessionStartDate: z.string().min(1),
    concessionEndDate: z.string().min(1),
    concessionCardType: z.enum(CONCESSION_CARD_TYPES),
    concessionCardCode: z
      .string()
      .min(1, 'Concession card code is required')
      .transform((v) => String(v ?? '').trim().toUpperCase()),
    concessionCardNumber: z
      .string()
      .min(1, 'CRN / concession card number is required')
      .transform((v) => String(v ?? '').trim().toUpperCase()),
    concessionCardExpiryDate: z.string().min(1),
    concessionCardFirstName: z.string().regex(CONCESSION_NAME_REGEX, 'Must start with capital letter (1-101 chars)'),
    concessionCardMiddleName: z.string().optional().refine((v) => !v || v === '' || CONCESSION_NAME_REGEX.test(v), 'Must start with capital letter (1-101 chars)'),
    concessionCardLastName: z.string().regex(CONCESSION_NAME_REGEX, 'Must start with capital letter (1-101 chars)'),
  })
  .optional()
  .superRefine((c, ctx) => {
    if (!c) return;
    if (!/^\d{4}-\d{2}-\d{2}/.test(c.concessionStartDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Start date must be ISO date (YYYY-MM-DD)', path: ['concessionStartDate'] });
    } else if (!isDateOnlyNotFuture(c.concessionStartDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Start date must not be in the future', path: ['concessionStartDate'] });
    }
    if (!/^\d{4}-\d{2}-\d{2}/.test(c.concessionEndDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End date must be ISO date (YYYY-MM-DD)', path: ['concessionEndDate'] });
    } else if (!isDateOnlyNotPast(c.concessionEndDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End date must not be in the past', path: ['concessionEndDate'] });
    }
    if (!/^\d{4}-\d{2}-\d{2}/.test(c.concessionCardExpiryDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Card expiry date must be ISO date (YYYY-MM-DD)', path: ['concessionCardExpiryDate'] });
    } else if (!isDateOnlyNotPast(c.concessionCardExpiryDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Card expiry date must not be in the past', path: ['concessionCardExpiryDate'] });
    }

    const code = c.concessionCardCode;
    if (!CONCESSION_CARD_CODE_LETTERS_REGEX.test(code)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Concession card code must be uppercase letters only (A–Z)',
        path: ['concessionCardCode'],
      });
    }

    const num = c.concessionCardNumber;
    if (!CONCESSION_CARD_NUMBER_ALNUM_REGEX.test(num)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CRN must contain letters/numbers only (no spaces, hyphens, or special characters)',
        path: ['concessionCardNumber'],
      });
    }
    if (num.includes('CRN')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CRN must not include the text "CRN"',
        path: ['concessionCardNumber'],
      });
    }

    // Momentum: CRN format varies by card type (stored in concessionCardNumber).
    const type = c.concessionCardType;
    const isCentrelink =
      type === 'PCC' ||
      type === 'HCC' ||
      type === 'LIHCC' ||
      type === 'Pensioner Concession Card (PCC)' ||
      type === 'Health Care Card (HCC)' ||
      type === 'Low Income Health Care Card (LIHCC)';

    const isDva =
      type === 'DVAGV' ||
      type === 'DVA Gold Card' ||
      type === 'DVA Pension Concession Card' ||
      type === 'DVA PCC Only' ||
      type === 'DVA TPI' ||
      type === 'DVA War Widow/Widower' ||
      type === 'Disability Pension (EDA)';

    const isQldSeniors = type === 'QLD Seniors Card';

    if (isCentrelink && !CENTRELINK_CRN_REGEX.test(num)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CRN must be 9 numbers followed by 1 letter (e.g. 123456789A)',
        path: ['concessionCardNumber'],
      });
    } else if (isDva && !DVA_CRN_REGEX.test(num)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DVA CRN must be 8–9 chars (e.g. NKM12345, VX123456, QSM12345A)',
        path: ['concessionCardNumber'],
      });
    } else if (isQldSeniors && !QLD_SENIORS_CRN_REGEX.test(num)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'QLD Seniors CRN must be 7–9 numbers only (e.g. 1234567)',
        path: ['concessionCardNumber'],
      });
    }
  });

const addressSchema = z.object({
  addressType: z.string().optional().refine((v) => !v || /^[A-Za-z]+$/.test(v), 'addressType must be letters only'),
  unitNumber: z
    .string()
    .optional()
    .refine((v) => !v || v === '' || /^[a-zA-Z0-9,./&:\s-]+$/.test(v), 'unitNumber invalid'),
  streetNumber: z
    .string()
    .min(1, 'Street number is required')
    .regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers, hyphen only'),
  streetName: z
    .string()
    .min(1, 'Street name is required')
    .regex(/^[a-zA-Z0-9'.,/()\s-]+$/, 'Invalid street name'),
  streetTypeCode: z
    .string()
    .min(1, 'Street type is required')
    .refine((v) => STREET_TYPE_CODES.includes(v as (typeof STREET_TYPE_CODES)[number]), 'Street type must be a valid AS 4590 code'),
  suburb: z
    .string()
    .min(1, 'Suburb is required')
    .regex(/^[A-Za-z0-9 ]+$/, 'Letters and numbers only'),
  state: z.enum(['ACT', 'NT', 'WA', 'SA', 'VIC', 'NSW', 'QLD'], {
    message: 'State must be ACT, NT, WA, SA, VIC, NSW, QLD',
  }),
  postCode: z.string().regex(/^\d{4}$/, 'Postcode must be 4 digits'),
});


export const step1Schema = z
  .object({
    transaction: z.object({
      transactionReference: z
        .string()
        .min(1, 'Transaction reference is required')
        .transform((v) => (v ?? '').toUpperCase())
        .refine((v) => /^UHM\d{1,9}$/.test(v), 'Transaction reference must be UHM followed by 1-9 digits'),
      transactionChannel: z
        .string()
        .min(1, 'Transaction channel is required')
        .regex(TRANSACTION_CHANNEL_REGEX, 'Letters, numbers, and spaces only'),
      transactionDate: z
        .string()
        .min(1, 'Transaction date is required')
        .refine(isValidISO8601, 'Transaction date must be ISO 8601 format'),
      transactionVerificationCode: z
        .string()
        .transform((v) => {
          const raw = String(v ?? '').trim().toUpperCase();
          const digits = raw.replace(/^OWR-?/, '').replace(/\D/g, '').slice(0, 26);
          return digits.length ? `OWR-${digits}` : '';
        })
        .refine((v) => TRANSACTION_VERIFICATION_REGEX.test(v), 'Verification code is required (OWR- plus your numbers)'),
      transactionSource: z.literal('EXTERNAL'),
    }),
    portalMeta: z.object({
      center: z
        .string()
        .min(1, 'Center is required')
        .refine((v) => (CENTER_OPTIONS as readonly string[]).includes(v), 'Select a valid center'),
      dncNumber: z
        .string()
        .optional()
        .refine((v) => !v || v.trim() === '' || /^\d+$/.test(v.trim()), 'DNC number must be digits only'),
      agentName: z.string().max(200, 'Max 200 characters').optional(),
      closer: z.string().max(200, 'Max 200 characters').optional(),
      auditorName: z.string().max(200, 'Max 200 characters').optional(),
    }),
  })
  .superRefine((data, ctx) => {
    const txDateStr = data.transaction.transactionDate?.slice(0, 10);
    if (!txDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(txDateStr)) return;
    const txDate = startOfDay(parseISO(txDateStr));
    const today = startOfDay(new Date());
    const minDate = addBusinessDays(today, -3);
    const maxDate = addBusinessDays(today, 3);
    if (txDate < minDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Transaction date must be within the last 3 working days', path: ['transaction', 'transactionDate'] });
    }
    if (txDate > maxDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Transaction date must be within the next 3 working days', path: ['transaction', 'transactionDate'] });
    }
  });

const IDENTITY_DOC_REGEX = /^[A-Za-z0-9-]{1,30}$/;


const passportSchema = z
  .object({
    documentId: z.string().optional().refine((v) => !v || v === '' || IDENTITY_DOC_REGEX.test(v), '1-30 chars: letters, numbers, hyphen'),
    documentNumber: z.string().optional(),
    documentExpiryDate: z.string().optional(),
    issuingCountry: z.string().optional(),
  })
  .optional()
  .superRefine((p, ctx) => {
    if (!p) return;
    const hasDoc = String(p.documentId || '').trim();
    if (!hasDoc) return;
    if (!p.documentExpiryDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Expiry date is required when passport is provided', path: ['documentExpiryDate'] });
    } else if (!isDateNotExpired(p.documentExpiryDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Customer Passport Expiry Date has expired', path: ['documentExpiryDate'] });
    }
    if (!p.issuingCountry) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Issuing country (CCA3) is required when passport is provided', path: ['issuingCountry'] });
    } else if (!COUNTRY_CODES.includes(p.issuingCountry as (typeof COUNTRY_CODES)[number])) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid CCA3 country code', path: ['issuingCountry'] });
    }
  });

const drivingLicenseSchema = z
  .object({
    documentId: z.string().optional().refine((v) => !v || v === '' || IDENTITY_DOC_REGEX.test(v), '1-30 chars: letters, numbers, hyphen'),
    documentNumber: z.string().optional(),
    documentExpiryDate: z.string().optional(),
    issuingState: z.union([z.enum(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']), z.literal('')]).optional(),
  })
  .optional()
  .superRefine((d, ctx) => {
    if (!d) return;
    const hasDoc = String(d.documentId || '').trim();
    if (!hasDoc) return;
    if (!d.documentExpiryDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Expiry date is required when driving license is provided', path: ['documentExpiryDate'] });
    } else if (!isDateNotExpired(d.documentExpiryDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Driving license expiry date has expired', path: ['documentExpiryDate'] });
    }
    if (!d.issuingState) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Issuing state is required when driving license is provided', path: ['issuingState'] });
    }
  });

const medicareSchema = z
  .object({
    documentId: z.string().optional().refine((v) => !v || v === '' || IDENTITY_DOC_REGEX.test(v), '1-30 chars: letters, numbers, hyphen'),
    documentNumber: z.string().optional().refine((v) => !v || v === '' || /^\d{1,30}$/.test(v), '1-30 digits'),
    documentExpiryDate: z.string().optional(),
  })
  .optional()
  .superRefine((m, ctx) => {
    if (!m) return;
    const hasDoc = String(m.documentId || m.documentNumber || '').trim();
    if (!hasDoc) return;
    if (!m.documentNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Document number is required when medicare is provided', path: ['documentNumber'] });
    }
    if (!m.documentExpiryDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Expiry date is required when medicare is provided', path: ['documentExpiryDate'] });
    } else if (!isExpiryNotExpired(m.documentExpiryDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Medicare expiry date has expired', path: ['documentExpiryDate'] });
    }
  });


const COMPANY_SUB_TYPES = ['Incorporation', 'Limited Company', 'NA', 'Partnership', 'Private', 'Sole Trader', 'Trust', 'C&I', 'SME'] as const;

const INDUSTRIES = [
  'Agriculture', 'Apparel', 'Banking', 'Biotechnology', 'Chemicals', 'Communications',
  'Construction', 'Consulting', 'Education', 'Electronics', 'Energy', 'Engineering',
  'Entertainment', 'Environmental', 'Finance', 'Food & Beverage', 'Government',
  'Healthcare', 'Hospitality', 'Insurance', 'Machinery', 'Manufacturing', 'Media',
  'Not For Profit', 'Other', 'Recreation', 'Retail', 'Shipping', 'Technology',
  'Telecommunications', 'Transportation', 'Utilities',
] as const;

const COMPANY_NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9'&@/()., -]{1,100}$/;


export const step3Schema = z
  .object({
    portalMeta: portalMetaPassthroughSchema,
    customer: z.object({
      customerType: z.enum(['RESIDENT', 'COMPANY']),
      customerSubType: z.string().min(1, 'Customer sub-type is required'),
      communicationPreference: z.enum(['POST', 'EMAIL']),
      promotionAllowed: z.literal(true, {
        message: 'Customer consent must be obtained',
      }),
      residentIdentity: z
        .object({
          passport: passportSchema.optional(),
          drivingLicense: drivingLicenseSchema.optional(),
          medicare: medicareSchema.optional(),
        })
        .optional(),
      companyIdentity: z
        .object({
          industry: z.enum(INDUSTRIES as unknown as [string, ...string[]]).optional(),
          entityName: z
            .string()
            .optional()
            .refine((v) => !v || v === '' || COMPANY_NAME_REGEX.test(v), 'Start with alphanumeric, 2-101 chars'),
          tradingName: z
            .string()
            .optional()
            .refine((v) => !v || v === '' || COMPANY_NAME_REGEX.test(v), 'Start with alphanumeric, 2-101 chars'),
          trusteeName: z
            .string()
            .optional()
            .refine((v) => !v || v === '' || COMPANY_NAME_REGEX.test(v), 'Invalid format'),
          abn: z.object({
            documentId: z
              .string()
              .regex(/^\d{11}$/, 'ABN must be 11 digits')
              .optional()
              .or(z.literal('')),
          }).optional(),
          acn: z.object({
            documentId: z
              .string()
              .regex(/^\d{9}$/, 'ACN must be 9 digits')
              .optional()
              .or(z.literal('')),
          }).optional(),
        })
        .optional(),
    }),
  })
  .superRefine((data, ctx) => {
    const c = data.customer;
    if (c.customerType === 'RESIDENT') {
      if (c.customerSubType !== 'RESIDENT') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Customer sub-type must be RESIDENT when customer type is RESIDENT',
          path: ['customer', 'customerSubType'],
        });
      }
      const ri = c.residentIdentity;
      const hasPassport = String(ri?.passport?.documentId || '').trim();
      const hasDL = String(ri?.drivingLicense?.documentId || '').trim();
      const hasMC = String(ri?.medicare?.documentId || '').trim();
      if (!hasPassport && !hasDL && !hasMC) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one identity document is required for residential customers',
          path: ['customer', 'residentIdentity', 'passport'],
        });
      }
    }
    if (c.customerType === 'COMPANY') {
      if (!COMPANY_SUB_TYPES.includes(c.customerSubType as (typeof COMPANY_SUB_TYPES)[number])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Customer sub-type must be one of: ${COMPANY_SUB_TYPES.join(', ')}`,
          path: ['customer', 'customerSubType'],
        });
      }
      const ci = c.companyIdentity;
      if (!ci?.industry) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Industry is required for company customers',
          path: ['customer', 'companyIdentity', 'industry'],
        });
      }
      if (!ci?.entityName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Entity name is required for company customers',
          path: ['customer', 'companyIdentity', 'entityName'],
        });
      }
      if (!ci?.tradingName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Trading name is required for company customers',
          path: ['customer', 'companyIdentity', 'tradingName'],
        });
      }
      if (!ci?.abn?.documentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'ABN is required for company customers',
          path: ['customer', 'companyIdentity', 'abn', 'documentId'],
        });
      }
    }
  });


export const step2Schema = z.object({
  portalMeta: portalMetaPassthroughSchema,
  customer: z.object({
    contacts: z.object({
      primaryContact: z.object({
        salutation: z.enum(['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.'], { message: 'Salutation is required' }),
        firstName: z
          .string()
          .min(1, 'First name is required')
          .regex(/^[A-Z][a-zA-Z'-]{1,100}$/, 'Must start with uppercase, 2-101 chars (letters, apostrophe, hyphen)'),
        middleName: z
          .string()
          .optional()
          .refine((v) => !v || v === '' || /^[a-zA-Z'\-.\s]{1,100}$/.test(v), 'Letters, apostrophe, hyphen, period, space only'),
        lastName: z
          .string()
          .min(1, 'Last name is required')
          .regex(/^[A-Z][a-zA-Z'-]{1,100}$/, 'Must start with uppercase, 2-101 chars (letters, apostrophe, hyphen)'),
        countryOfBirth: z
          .string()
          .optional()
          .refine((v) => !v || v === '' || COUNTRY_CODES.includes(v as (typeof COUNTRY_CODES)[number]), 'Invalid ISO country code'),
        dateOfBirth: z
          .string()
          .min(1, 'Date of birth is required')
          .refine(isAtLeast18YearsOld, 'DOB must be equal or older than 18 years'),
        email: z
          .string()
          .min(1, 'Email is required')
          .regex(CONTACT_EMAIL_REGEX, 'Must be a valid email format'),
        addresses: z.array(addressSchema).min(1, 'At least one address is required'),
        contactPhones: z.array(contactPhoneSchema).min(1, 'At least one phone number is required'),
      }),
      secondaryContact: z
        .object({
          salutation: z.enum(['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.']).optional(),
          firstName: z
            .string()
            .optional()
            .refine((v) => !v || /^[A-Z][a-zA-Z'-]{1,100}$/.test(v), 'Must start with uppercase, 2-101 chars'),
          middleName: z
            .string()
            .optional()
            .refine((v) => !v || v === '' || /^[a-zA-Z'\-.\s]{1,100}$/.test(v), 'Letters, apostrophe, hyphen, period, space only'),
          lastName: z
            .string()
            .optional()
            .refine((v) => !v || /^[A-Z][a-zA-Z'-]{1,100}$/.test(v), 'Must start with uppercase, 2-101 chars'),
          countryOfBirth: z
            .string()
            .optional()
            .refine((v) => !v || v === '' || COUNTRY_CODES.includes(v as (typeof COUNTRY_CODES)[number]), 'Invalid ISO country code'),
          dateOfBirth: z.string().optional(),
          email: z
            .string()
            .optional()
            .refine((v) => !v || v === '' || CONTACT_EMAIL_REGEX.test(v), 'Invalid email format')
            .or(z.literal('')),
          addresses: z.array(addressSchema).optional(),
          contactPhones: z.array(contactPhoneSchema).optional(),
        })
        .optional()
        .superRefine((sc, ctx) => {
          if (!sc) return;
          const hasName = sc.firstName || sc.lastName;
          if (hasName) {
            if (!sc.salutation) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Salutation is required when secondary contact is provided',
                path: ['salutation'],
              });
            }
            if (!sc.firstName) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'First name is required when secondary contact is provided',
                path: ['firstName'],
              });
            }
            if (!sc.lastName) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Last name is required when secondary contact is provided',
                path: ['lastName'],
              });
            }
            if (!sc.dateOfBirth) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Date of birth is required when secondary contact is provided',
                path: ['dateOfBirth'],
              });
            } else if (!isAtLeast18YearsOld(sc.dateOfBirth)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'DOB must be equal or older than 18 years',
                path: ['dateOfBirth'],
              });
            }
          }
        }),
    }),
  }),
});


export const step4Schema = z
  .object({
    portalMeta: portalMetaPassthroughSchema,
    service: z.object({
      serviceType: z.enum(['GAS', 'POWER']),
      serviceSubType: z.enum(['TRANSFER', 'MOVE IN']),
      serviceConnectionId: z
        .string()
        .min(1, 'NMI/MIRN is required')
        .regex(/^[0-9A-Za-z]+$/, 'Alphanumeric only'),
      serviceMeterId: z.string().optional(),
      serviceStartDate: z
        .string()
        .optional()
        .refine(
          (v) => {
            if (!v || !/^\d{4}-\d{2}-\d{2}/.test(v)) return true;
            const start = parseISO(v.slice(0, 10));
            if (!isValid(start)) return true;
            return !isBefore(startOfDay(start), startOfDay(new Date()));
          },
          { message: 'Move-in date / service start date cannot be in the past' }
        ),
      estimatedAnnualKwhs: z.number().optional(),
      lotNumber: z
        .string()
        .optional()
        .refine((v) => !v || v === '' || /^[a-zA-Z0-9,./&:-]+$/.test(v), 'Invalid lot number'),
      servicedAddress: z.object({
        name: z
          .string()
          .optional()
          .refine((v) => !v || /^[A-Z][a-zA-Z'-]{1,100}$/.test(v), 'Must start with uppercase, 2-101 chars'),
        unitType: z
          .union([z.enum(['APT', 'CTGE', 'DUP', 'F', 'FY', 'HSE', 'KSK', 'MB', 'MSNT', 'OFF', 'PTHS', 'RM', 'SE', 'SHED', 'SHOP', 'SITE', 'SL', 'STU', 'TNCY', 'TNHS', 'U', 'VLLA', 'WARD', 'WE']), z.literal('')])
          .optional(),
        unitNumber: z
          .string()
          .optional()
          .refine((v) => !v || /^[a-zA-Z0-9,./&:\s-]+$/.test(v), 'Invalid unit number'),
        floorType: z.union([z.enum(['FLOOR', 'LEVEL', 'GROUND']), z.literal('')]).optional(),
        floorNumber: z
          .string()
          .optional()
          .refine((v) => !v || /^[a-zA-Z0-9,./&:\s-]+$/.test(v), 'Invalid floor number'),
        streetNumberSuffix: z
          .union([z.enum(['CN', 'E', 'EX', 'LR', 'N', 'NE', 'NW', 'S', 'SE', 'SW', 'UP', 'W']), z.literal('')])
          .optional(),
        streetNameSuffix: z.string().optional().refine((v) => !v || /^[A-Za-z- ]+$/.test(v), 'Invalid'),
        streetNumber: z
          .string()
          .min(1, 'Street number is required')
          .regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers, hyphen only'),
        streetName: z
          .string()
          .min(1, 'Street name is required')
          .regex(/^[a-zA-Z0-9'.,/()\s-]+$/, 'Invalid street name'),
        streetTypeCode: z
          .string()
          .min(1, 'Street type is required')
          .refine((v) => STREET_TYPE_CODES.includes(v as (typeof STREET_TYPE_CODES)[number]), 'Invalid street type code'),
        suburb: z.string().min(1, 'Suburb is required').regex(/^[A-Za-z0-9 ]+$/, 'Letters and numbers only'),
        state: z.enum(['ACT', 'NT', 'WA', 'SA', 'VIC', 'NSW' , 'QLD'], {
          message: 'State must be ACT, NT, WA, SA, VIC, NSW or QLD',
        }),
        postCode: z.string().regex(/^\d{4}$/, 'Postcode must be 4 digits'),
        accessInstructions: z
          .string()
          .optional()
          .refine((v) => !v || v === '' || /^[A-Za-z\s0-9,.:-]+$/.test(v), 'Invalid characters'),
        safetyInstructions: z
          .union([z.enum(['NONE', 'CAUTION', 'DOG', 'ELECFENCE', 'NOTKNOWN', 'WORKSONSITE']), z.literal('')])
          .optional(),
      }),
      serviceBilling: z.object({
        offerQuoteDate: z.string().min(1, 'Quote date is required'),
        serviceOfferCode: z
          .string()
          .min(1, 'Offer code is required')
          .regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/, 'Must be 15 or 18 alphanumeric characters'),
        servicePlanCode: z
          .string()
          .min(1, 'Service plan is required')
          .refine(
            (v) =>
              [
                'Bill Boss Electricity',
                'Suit Yourself Electricity',
                'Suit Yourself Gas',
                'Strictly Business',
                'Warm Welcome',
                'Warm Welcome Gas',
                'EV Does It',
              ].includes(v),
            'Invalid service plan'
          ),
        contractTermCode: z.enum(['OPEN', '12MTH', '24MTH', '36MTH']),
        contractDate: z.string().optional(),
        paymentMethod: z
          .union([z.literal(''), z.enum(['Direct Debit Via Bank Account', 'Cheque'])])
          .refine((v) => v !== '', 'Payment method is required'),
        billCycleCode: z.string().min(1, 'Bill cycle is required'),
        billDeliveryMethod: z.enum(['EMAIL', 'POST']),
        concession: concessionSchema,
      }),
    }),
  })
  .superRefine((data, ctx) => {
    const s = data.service;
    if (s.serviceSubType === 'MOVE IN' && !s.serviceStartDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Service start date is required for Move In',
        path: ['service', 'serviceStartDate'],
      });
    }
    if (s.serviceConnectionId.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Service Connection ID must be 11 characters',
        path: ['service', 'serviceConnectionId'],
      });
    }
    if (s.serviceType === 'GAS' && s.serviceBilling.billCycleCode !== 'Bi-Monthly') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GAS service must use Bi-Monthly bill cycle',
        path: ['service', 'serviceBilling', 'billCycleCode'],
      });
    }
    if (
      s.serviceType === 'POWER' &&
      !['Monthly', 'Quarterly'].includes(s.serviceBilling.billCycleCode)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'POWER service must use Monthly or Quarterly bill cycle',
        path: ['service', 'serviceBilling', 'billCycleCode'],
      });
    }
  });

/** Combined schema for full-form validation (e.g. on submit) so all steps are validated */
export const fullSchema = step1Schema.and(step2Schema).and(step3Schema).and(step4Schema);
