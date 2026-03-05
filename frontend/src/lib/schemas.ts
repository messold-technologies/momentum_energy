import { z } from 'zod';

const contactPhoneSchema = z.object({
  contactPhoneType: z.enum(['WORK', 'HOME', 'MOBILE']),
  phone: z.string().min(8, 'Phone number must be at least 8 digits').max(15),
});

const addressSchema = z.object({
  addressType: z.string().optional(),
  unitNumber: z.string().optional(),
  streetNumber: z.string().min(1, 'Street number is required'),
  streetName: z.string().min(1, 'Street name is required'),
  suburb: z.string().min(1, 'Suburb is required'),
  state: z.enum(['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'], {
    message: 'State is required',
  }),
  postCode: z.string().regex(/^\d{4}$/, 'Postcode must be 4 digits'),
});

// Step 1: Transaction
export const step1Schema = z.object({
  transaction: z.object({
    transactionReference: z
      .string()
      .min(1, 'Transaction reference is required')
      .regex(/^[A-Za-z0-9\-]{1,30}$/, 'Max 30 chars: letters, numbers, hyphens only'),
    transactionChannel: z
      .string()
      .min(1, 'Transaction channel is required')
      .regex(/^[A-Za-z0-9\s]+$/, 'Letters, numbers, and spaces only'),
    transactionDate: z.string().min(1, 'Transaction date is required'),
    transactionVerificationCode: z
      .string()
      .regex(/^[A-Za-z0-9\-]{1,30}$/, 'Max 30 chars: letters, numbers, hyphens only')
      .optional()
      .or(z.literal('')),
    transactionSource: z.literal('EXTERNAL'),
  }),
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

export const step2Schema = z
  .object({
    customer: z.object({
      customerType: z.enum(['RESIDENT', 'COMPANY']),
      customerSubType: z.string().optional(),
      communicationPreference: z.enum(['EMAIL', 'POST']),
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
        firstName: z.string().min(1, 'First name is required'),
        middleName: z.string().optional(),
        lastName: z.string().min(1, 'Last name is required'),
        countryOfBirth: z.string().optional(),
        dateOfBirth: z.string().min(1, 'Date of birth is required'),
        email: z.string().email('Must be a valid email').optional().or(z.literal('')),
        addresses: z.array(addressSchema).min(1, 'At least one address is required'),
        contactPhones: z.array(contactPhoneSchema).min(1, 'At least one phone number is required'),
      }),
      secondaryContact: z
        .object({
          salutation: z.string().optional(),
          firstName: z.string().optional(),
          middleName: z.string().optional(),
          lastName: z.string().optional(),
          countryOfBirth: z.string().optional(),
          dateOfBirth: z.string().optional(),
          email: z.string().email('Must be a valid email').optional().or(z.literal('')),
          addresses: z.array(addressSchema).optional(),
          contactPhones: z.array(contactPhoneSchema).optional(),
        })
        .optional(),
    }),
  }),
});

// Step 4: Service
export const step4Schema = z
  .object({
    service: z.object({
      serviceType: z.enum(['GAS', 'POWER']),
      serviceSubType: z.enum(['TRANSFER', 'MOVE IN']),
      serviceConnectionId: z.string().min(1, 'NMI/MIRN is required'),
      serviceMeterId: z.string().optional(),
      serviceStartDate: z.string().optional(),
      estimatedAnnualKwhs: z.number().optional(),
      lotNumber: z.string().optional(),
      servicedAddress: z.object({
        unitNumber: z.string().optional(),
        streetNumber: z.string().min(1, 'Street number is required'),
        streetName: z.string().min(1, 'Street name is required'),
        streetTypeCode: z.string().min(1, 'Street type is required'),
        suburb: z.string().min(1, 'Suburb is required'),
        state: z.enum(['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'], {
          message: 'State is required',
        }),
        postCode: z.string().regex(/^\d{4}$/, 'Postcode must be 4 digits'),
        accessInstructions: z.string().optional(),
        safetyInstructions: z.string().optional(),
      }),
      serviceBilling: z.object({
        offerQuoteDate: z.string().min(1, 'Quote date is required'),
        serviceOfferCode: z.string().min(1, 'Offer code is required'),
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
