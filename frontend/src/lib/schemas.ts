import { z } from 'zod';

const phoneSchema = z.object({
  type: z.enum(['WORK', 'HOME', 'MOBILE']),
  number: z.string().min(8, 'Phone number must be at least 8 digits').max(15),
});

const addressSchema = z.object({
  unitNumber: z.string().optional(),
  streetNumber: z.string().min(1, 'Street number is required'),
  streetName: z.string().min(1, 'Street name is required'),
  suburb: z.string().min(1, 'Suburb is required'),
  state: z.enum(['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'], {
    required_error: 'State is required',
  }),
  postcode: z.string().regex(/^\d{4}$/, 'Postcode must be 4 digits'),
});

export const step1Schema = z.object({
  transaction: z.object({
    transactionReferenceId: z.string().min(1, 'Transaction reference is required'),
    channelName: z.string().min(1, 'Channel name is required'),
    transactionDate: z.string().min(1, 'Transaction date is required'),
    transactionVerificationCode: z.string().optional(),
    source: z.literal('EXTERNAL'),
  }),
});

const passportSchema = z.object({
  documentId: z.string().min(1, 'Passport number is required'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  countryOfBirth: z.string().min(1, 'Country of birth is required'),
});

const drivingLicenseSchema = z.object({
  documentId: z.string().min(1, 'License number is required'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  issuingState: z.enum(['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'], {
    required_error: 'Issuing state is required',
  }),
});

const medicareCardSchema = z.object({
  documentId: z.string().min(1, 'Medicare card number is required'),
  referenceNumber: z.string().min(1, 'Reference number is required'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
});

export const step2Schema = z
  .object({
    customer: z.object({
      customerType: z.enum(['RESIDENT', 'COMPANY']),
      customerSubType: z.string().optional(),
      communicationPreference: z.enum(['EMAIL', 'POST']),
      promotionConsent: z.literal(true, {
        errorMap: () => ({ message: 'Promotion consent must be accepted' }),
      }),
      passport: passportSchema.optional(),
      drivingLicense: drivingLicenseSchema.optional(),
      medicareCard: medicareCardSchema.optional(),
      industry: z.string().optional(),
      entityName: z.string().optional(),
      tradingName: z.string().optional(),
      trusteeName: z.string().optional(),
      abn: z
        .string()
        .regex(/^\d{11}$/, 'ABN must be 11 digits')
        .optional()
        .or(z.literal('')),
      acn: z
        .string()
        .regex(/^\d{9}$/, 'ACN must be 9 digits')
        .optional()
        .or(z.literal('')),
    }),
  })
  .superRefine((data, ctx) => {
    const c = data.customer;
    if (c.customerType === 'RESIDENT') {
      if (!c.passport && !c.drivingLicense && !c.medicareCard) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one identity document is required for residential customers',
          path: ['customer', 'passport'],
        });
      }
    }
    if (c.customerType === 'COMPANY') {
      if (!c.entityName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Entity name is required for company customers',
          path: ['customer', 'entityName'],
        });
      }
      if (!c.abn) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'ABN is required for company customers',
          path: ['customer', 'abn'],
        });
      }
    }
  });

export const step3Schema = z.object({
  contacts: z.object({
    primaryContact: z.object({
      salutation: z.string().min(1, 'Salutation is required'),
      firstName: z.string().min(1, 'First name is required'),
      middleName: z.string().optional(),
      lastName: z.string().min(1, 'Last name is required'),
      dateOfBirth: z.string().min(1, 'Date of birth is required'),
      email: z.string().email('Must be a valid email').optional().or(z.literal('')),
      address: addressSchema,
      phones: z.array(phoneSchema).min(1, 'At least one phone number is required'),
    }),
    secondaryContact: z
      .object({
        salutation: z.string().optional(),
        firstName: z.string().optional(),
        middleName: z.string().optional(),
        lastName: z.string().optional(),
        dateOfBirth: z.string().optional(),
        email: z.string().email('Must be a valid email').optional().or(z.literal('')),
        address: addressSchema.optional(),
        phones: z.array(phoneSchema).optional(),
      })
      .optional(),
  }),
});

export const step4Schema = z
  .object({
    service: z.object({
      serviceType: z.enum(['GAS', 'POWER']),
      serviceSubType: z.enum(['TRANSFER', 'MOVE_IN']),
      serviceConnectionId: z.string().min(1, 'NMI/MIRN is required'),
      serviceStartDate: z.string().optional(),
      meterId: z.string().optional(),
      lotNumber: z.string().optional(),
      servicedAddress: z.object({
        streetNumber: z.string().min(1, 'Street number is required'),
        streetName: z.string().min(1, 'Street name is required'),
        unitNumber: z.string().optional(),
        suburb: z.string().min(1, 'Suburb is required'),
        state: z.enum(['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'], {
          required_error: 'State is required',
        }),
        postcode: z.string().regex(/^\d{4}$/, 'Postcode must be 4 digits'),
        accessInstructions: z.string().optional(),
        safetyInstructions: z.string().optional(),
      }),
      offer: z.object({
        offerCode: z.string().min(1, 'Offer code is required'),
        quoteDate: z.string().min(1, 'Quote date is required'),
      }),
      billingDetails: z.object({
        servicePlan: z.string().optional(),
        contractTerm: z.enum(['OPEN', '12MTH', '24MTH', '36MTH']),
        contractDate: z.string().optional(),
        paymentMethod: z.enum(['DIRECT_DEBIT', 'CHEQUE']),
        billCycleCode: z.string().min(1, 'Bill cycle is required'),
        billDelivery: z.enum(['EMAIL', 'POST']),
      }),
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
  })
  .superRefine((data, ctx) => {
    const s = data.service;
    if (s.serviceSubType === 'MOVE_IN' && !s.serviceStartDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Service start date is required for Move In',
        path: ['service', 'serviceStartDate'],
      });
    }
    if (s.serviceType === 'GAS' && s.billingDetails.billCycleCode !== 'Bi-Monthly') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GAS service must use Bi-Monthly bill cycle',
        path: ['service', 'billingDetails', 'billCycleCode'],
      });
    }
    if (
      s.serviceType === 'POWER' &&
      !['Monthly', 'Quarterly'].includes(s.billingDetails.billCycleCode)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'POWER service must use Monthly or Quarterly bill cycle',
        path: ['service', 'billingDetails', 'billCycleCode'],
      });
    }
  });
