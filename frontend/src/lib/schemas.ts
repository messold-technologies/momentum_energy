import { z } from 'zod';
import { COUNTRY_CODES } from './countryCodes';

/** Check if date is a weekday (Mon–Fri) */
function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

/** Add N working days to a date (negative for past) */
function addWorkingDays(fromDate: Date, days: number): Date {
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);
  let remaining = Math.abs(days);
  const increment = days >= 0 ? 1 : -1;
  while (remaining > 0) {
    d.setDate(d.getDate() + increment);
    if (isWeekday(d)) remaining--;
  }
  return d;
}

/** Today's date as YYYY-MM-DD (local timezone) */
function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Transaction field patterns per CAF spec
const TRANSACTION_REF_REGEX = /^[A-Za-z0-9-]{1,30}$/;
const TRANSACTION_CHANNEL_REGEX = /^[A-Za-z0-9\s]+$/;
const TRANSACTION_VERIFICATION_REGEX = /^[A-Za-z0-9-]{1,30}$/;
// Valid ISO 8601 date/time (YYYY-MM-DD or with time)
function isValidISO8601(v: string): boolean {
  if (!v || v.length < 10) return false;
  const parsed = Date.parse(v);
  return !Number.isNaN(parsed);
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
  suburb: z
    .string()
    .min(1, 'Suburb is required')
    .regex(/^[A-Za-z0-9 ]+$/, 'Letters and numbers only'),
  state: z.enum(['ACT', 'NT', 'WA', 'SA', 'VIC', 'NSW'], {
    message: 'State must be ACT, NT, WA, SA, VIC, or NSW',
  }),
  postCode: z.string().regex(/^\d{4}$/, 'Postcode must be 4 digits'),
});

// Step 1: Transaction (per CAF spec)
export const step1Schema = z
  .object({
    transaction: z.object({
      transactionReference: z
        .string()
        .min(1, 'Transaction reference is required')
        .regex(TRANSACTION_REF_REGEX, '1-30 chars: letters, numbers, hyphen only'),
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
        .optional()
        .refine((v) => !v || v === '' || TRANSACTION_VERIFICATION_REGEX.test(v), '1-30 chars: letters, numbers, hyphen only'),
      transactionSource: z.literal('EXTERNAL'),
    }),
  })
  .superRefine((data, ctx) => {
    const txDateStr = data.transaction.transactionDate?.slice(0, 10);
    if (!txDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(txDateStr)) return;
    const txDate = new Date(txDateStr + 'T12:00:00');
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const minDate = addWorkingDays(today, -3);
    const maxDate = addWorkingDays(today, 3);
    if (txDate < minDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Transaction date must be within the last 3 working days', path: ['transaction', 'transactionDate'] });
    }
    if (txDate > maxDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Transaction date must be within the next 3 working days', path: ['transaction', 'transactionDate'] });
    }
  });

// Step 2: Customer
// Only validate document fields when documentId is provided (user chose this document)
const passportSchema = z
  .object({
    documentId: z.string().optional(),
    documentNumber: z.string().optional(),
    documentExpiryDate: z.string().optional(),
    issuingCountry: z.string().optional(),
  })
  .optional();

const drivingLicenseSchema = z
  .object({
    documentId: z.string().optional(),
    documentNumber: z.string().optional(),
    documentExpiryDate: z.string().optional(),
    issuingState: z.string().optional(),
  })
  .optional()
  .refine(
    (d) => {
      if (!d || !String(d.documentId || '').trim()) return true;
      return !!(String(d.documentExpiryDate || '').trim() && String(d.issuingState || '').trim());
    },
    { message: 'Expiry date and issuing state are required when driving license is provided', path: ['documentExpiryDate'] }
  );

const medicareSchema = z
  .object({
    documentId: z.string().optional(),
    documentNumber: z.string().optional(),
    documentExpiryDate: z.string().optional(),
  })
  .optional()
  .refine(
    (m) => {
      if (!m || !String(m.documentId || '').trim()) return true;
      return !!(String(m.documentNumber || '').trim() && String(m.documentExpiryDate || '').trim());
    },
    { message: 'Document number and expiry date are required when medicare card is provided', path: ['documentNumber'] }
  );

const COMPANY_SUB_TYPES = ['Incorporation', 'Limited Company', 'NA', 'Partnership', 'Private', 'Sole Trader', 'Trust', 'C&I', 'SME'] as const;

export const step2Schema = z
  .object({
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
          industry: z.string().optional(),
          entityName: z.string().optional(),
          tradingName: z.string().optional(),
          trusteeName: z.string().optional(),
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

// Step 3: Contacts (nested under customer.contacts)
export const step3Schema = z.object({
  customer: z.object({
    contacts: z.object({
      primaryContact: z.object({
        salutation: z.string().min(1, 'Salutation is required'),
        firstName: z
          .string()
          .min(1, 'First name is required')
          .regex(/^[A-Z][a-zA-Z'-. ]{1,100}$/, 'Must start with uppercase letter, 2-101 chars'),
        middleName: z
          .string()
          .optional()
          .refine((v) => !v || /^[a-zA-Z'-. ]{1,100}$/.test(v), 'Invalid characters'),
        lastName: z
          .string()
          .min(1, 'Last name is required')
          .regex(/^[A-Z][a-zA-Z'-. ]{1,100}$/, 'Must start with uppercase letter, 2-101 chars'),
        countryOfBirth: z
          .string()
          .optional()
          .refine((v) => !v || v === '' || COUNTRY_CODES.includes(v as (typeof COUNTRY_CODES)[number]), 'Invalid ISO country code'),
        dateOfBirth: z.string().min(1, 'Date of birth is required'),
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
            .refine((v) => !v || v === '' || /^[a-zA-Z'-]{1,100}$/.test(v), 'Invalid characters'),
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
            }
          }
        }),
    }),
  }),
});

// Step 4: Service
export const step4Schema = z
  .object({
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
            const startDate = v.slice(0, 10);
            return startDate >= todayLocal();
          },
          { message: 'Move-in date / service start date cannot be in the past' }
        ),
      estimatedAnnualKwhs: z.number().optional(),
      lotNumber: z.string().optional(),
      servicedAddress: z.object({
        name: z
          .string()
          .optional()
          .refine((v) => !v || /^[A-Z][a-zA-Z'-]{1,100}$/.test(v), 'Must start with uppercase, 2-101 chars'),
        unitType: z
          .enum(['APT', 'CTGE', 'DUP', 'F', 'FY', 'HSE', 'KSK', 'MB', 'MSNT', 'OFF', 'PTHS', 'RM', 'SE', 'SHED', 'SHOP', 'SITE', 'SL', 'STU', 'TNCY', 'TNHS', 'U', 'VLLA', 'WARD', 'WE'])
          .optional(),
        unitNumber: z
          .string()
          .optional()
          .refine((v) => !v || /^[a-zA-Z0-9,./&:\s-]+$/.test(v), 'Invalid unit number'),
        floorType: z.enum(['FLOOR', 'LEVEL', 'GROUND']).optional(),
        floorNumber: z
          .string()
          .optional()
          .refine((v) => !v || /^[a-zA-Z0-9,./&:\s-]+$/.test(v), 'Invalid floor number'),
        streetNumberSuffix: z
          .enum(['CN', 'E', 'EX', 'LR', 'N', 'NE', 'NW', 'S', 'SE', 'SW', 'UP', 'W'])
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
        streetTypeCode: z.string().optional(),
        suburb: z.string().min(1, 'Suburb is required').regex(/^[A-Za-z0-9 ]+$/, 'Invalid suburb'),
        state: z.enum(['ACT', 'NT', 'WA', 'SA', 'VIC', 'NSW'], {
          message: 'State must be ACT, NT, WA, SA, VIC, or NSW',
        }),
        postCode: z.string().regex(/^\d{4}$/, 'Postcode must be 4 digits'),
        accessInstructions: z.string().optional(),
        safetyInstructions: z.string().optional(),
      }),
      serviceBilling: z.object({
        offerQuoteDate: z.string().min(1, 'Quote date is required'),
        serviceOfferCode: z
          .string()
          .min(1, 'Offer code is required')
          .regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/, 'Must be 15 or 18 alphanumeric characters'),
        servicePlanCode: z.string().optional(),
        contractTermCode: z.enum(['OPEN', '12MTH', '24MTH', '36MTH']),
        contractDate: z.string().optional(),
        paymentMethod: z.enum(['Direct Debit Via Bank Account', 'Cheque']),
        billCycleCode: z.string().min(1, 'Bill cycle is required'),
        billDeliveryMethod: z.enum(['EMAIL', 'POST']),
        concession: z
          .object({
            cardType: z.string().min(1),
            cardNumber: z.string().min(1),
            startDate: z.string().min(1),
            endDate: z.string().min(1),
            holderName: z.string().min(1),
          })
          .optional(),
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
    if (s.serviceType === 'POWER' && s.serviceConnectionId.length !== 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'NMI must be 10 characters for POWER service',
        path: ['service', 'serviceConnectionId'],
      });
    }
    if (s.serviceType === 'GAS' && s.serviceConnectionId.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MIRN must be 11 characters for GAS service',
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
