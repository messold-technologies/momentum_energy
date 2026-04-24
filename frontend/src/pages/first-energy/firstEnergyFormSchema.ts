import { z } from 'zod';

export const FIRST_ENERGY_WIZARD_STEPS = [
  { label: 'Sale', description: 'Basic info' },
  { label: 'Customer', description: 'Primary contact' },
  { label: 'Address', description: 'Supply address' },
  { label: 'Site', description: 'NMI/MIRN & offer' },
  { label: 'Review', description: 'Preview & submit' },
  { label: 'Submit', description: 'Final sale submission' },
] as const;

export const formSchema = z
  .object({
    referral_id: z.coerce.number().int().optional(),
    type: z.string().min(1, 'Sale type is required'),
    property_type: z.enum(['RESIDENT', 'COMPANY']),
    terms_accepted: z.boolean().refine((v) => v === true, 'You must accept the terms'),
    email_invoice: z.boolean(),
    email_notice: z.boolean(),
    signup_payment_method: z.enum(['DIRECT', 'CRDCARD', 'CHEQUE']),
    promo_code: z.string().optional(),
    preferred_contact: z.string().optional(),

    customer: z.object({
      title: z.string().min(1, 'Title is required'),
      first_name: z.string().min(1, 'First name is required'),
      middle_name: z.string().optional(),
      last_name: z.string().min(1, 'Last name is required'),
      date_of_birth: z.string().min(1, 'Date of birth is required'),
      allow_marketing: z.boolean().default(false),
      phone_type: z.enum(['Mobile', 'Landline']).default('Mobile'),
      phone_number: z.string().min(6, 'Phone number is required'),
      email_type: z.enum(['Contact Email', 'Billing Email', 'Business Email', 'Personal Email']).default('Contact Email'),
      email: z.string().email('Valid email is required'),
      identification: z.object({
        type: z.enum(['DriversLicence', 'MedicareCard', 'Passport', 'Plus18Card']),
        reference: z.string().min(1, 'ID reference is required'),
        expires_on: z.string().min(1, 'ID expiry date is required'),
        country: z.string().optional(),
        state: z.string().optional(),
        card_number: z.string().optional(),
        card_color: z.string().optional(),
      }),
      concession: z
        .object({
          enabled: z.boolean().default(false),
          issued_on: z.string().optional(),
          expires_on: z.string().optional(),
          reference: z.string().optional(),
          concession: z.string().optional(),
          first_name: z.string().optional(),
          middle_name: z.string().optional(),
          last_name: z.string().optional(),
          country: z.string().optional(),
          state: z.string().optional(),
          card_number: z.string().optional(),
          card_color: z.string().optional(),
        })
        .default({ enabled: false }),
    }),

    directDebit: z
      .object({
        bsb: z.string().optional(),
        name: z.string().optional(),
        account_number: z.string().optional(),
        bank_name: z.string().optional(),
        branch_name: z.string().optional(),
        bank_code: z.string().optional(),
        card_expiry: z.string().optional(),
        card_type: z.string().optional(),
        masked_card_number: z.string().optional(),
      })
      .optional(),

    organisation: z
      .object({
        name: z.string().optional(),
        trading_name: z.string().max(100).optional(),
        trustee_name: z.string().max(100).optional(),
        organisation_type_id: z.coerce.number().int().optional(),
        requires_acn: z.boolean().optional(),
        abn: z.string().optional(),
        acn: z.string().optional(),
        gst_registered_at: z.string().optional(),
        industry_type_id: z.coerce.number().int().optional(),
        identification: z
          .object({
            type: z.enum(['DriversLicence', 'MedicareCard', 'Passport', 'Plus18Card']).optional(),
            expires_on: z.string().optional(),
            reference: z.string().optional(),
            country: z.string().optional(),
            state: z.string().optional(),
            card_number: z.string().optional(),
            card_color: z.string().optional(),
          })
          .optional(),
        phone_type: z.enum(['Mobile', 'Landline']).optional(),
        phone_number: z.string().optional(),
        email_type: z.enum(['Contact Email', 'Billing Email', 'Business Email', 'Personal Email']).optional(),
        email: z.string().optional(),
      })
      .optional(),

    site: z.object({
      fuel_id: z.coerce.number().int().refine((n) => n === 1 || n === 2, 'Fuel is required'),
      identifier: z.string().min(10, 'NMI/MIRN must be at least 10 characters'),
      offer_id: z.coerce.number().int().positive('Offer ID is required'),
      bill_frequency: z.enum(['MONTHLY', 'QUARTERLY', 'GAS_MONTHLY', 'GAS']).optional(),
      has_medical_cooling: z.boolean().default(false),
      has_solar: z.boolean().default(false),
      start_date: z.string().optional(),
      move_in_terms_accepted: z.boolean().optional(),
      transfer_instructions: z.string().optional(),
      is_owner: z.boolean().optional(),
      usage_start_date: z.string().optional(),
      usage_end_date: z.string().optional(),
      has_interest_on_solar: z.boolean().optional(),
      feed_in_type_id: z.coerce.number().int().optional(),
      selected_greenpower_id: z.coerce.number().int().optional(),
      vsi_time: z.enum(['09:00', '10:00', '11:00', '12:00', '13:00']).optional(),
      vsi_method: z.enum(['customer_on_site', 'keys_letter_box', 'keys_meter_box']).optional(),
      existing_account_number: z.string().optional(),
      has_basic_meter: z.boolean().optional(),
      is_mains_switch_off: z.boolean().optional(),
      is_electricity_disconnected_period: z.boolean().optional(),
      has_ecoc: z.boolean().optional(),
      are_any_building_works: z.boolean().optional(),
      has_meter_access: z.boolean().optional(),
    }),

    addressSearchTerm: z.string().optional(),
    addressId: z.string().optional(),
    address: z.object({
      StreetNumber: z.string().optional(),
      StreetName: z.string().optional(),
      StreetType: z.string().optional(),
      Suburb: z.string().optional(),
      State: z.string().optional(),
      PostCode: z.string().optional(),
      street_address: z.string().optional(),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.signup_payment_method === 'DIRECT') {
      const dd = v.directDebit ?? {};
      if (!dd.bsb?.trim()) ctx.addIssue({ code: 'custom', message: 'BSB is required for Direct Debit', path: ['directDebit', 'bsb'] });
      if (!dd.name?.trim()) ctx.addIssue({ code: 'custom', message: 'Account name is required for Direct Debit', path: ['directDebit', 'name'] });
      if (!dd.account_number?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Account number is required for Direct Debit', path: ['directDebit', 'account_number'] });
      }
    }

    if (v.property_type === 'COMPANY') {
      const org = v.organisation ?? {};
      if (!org.name?.trim()) ctx.addIssue({ code: 'custom', message: 'Organisation name is required', path: ['organisation', 'name'] });
      if (!org.trading_name?.trim()) ctx.addIssue({ code: 'custom', message: 'Trading name is required', path: ['organisation', 'trading_name'] });
      if (!org.trustee_name?.trim()) ctx.addIssue({ code: 'custom', message: 'Trustee name is required', path: ['organisation', 'trustee_name'] });
      if (!org.organisation_type_id || org.organisation_type_id <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Organisation type is required', path: ['organisation', 'organisation_type_id'] });
      }
      if (!org.abn?.trim()) ctx.addIssue({ code: 'custom', message: 'ABN is required', path: ['organisation', 'abn'] });
      if (org.requires_acn !== false && !org.acn?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'ACN is required', path: ['organisation', 'acn'] });
      }
      if (!org.gst_registered_at?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'GST registered date is required', path: ['organisation', 'gst_registered_at'] });
      }
      if (!org.phone_number?.trim()) ctx.addIssue({ code: 'custom', message: 'Organisation phone is required', path: ['organisation', 'phone_number'] });
      if (!org.email?.trim()) ctx.addIssue({ code: 'custom', message: 'Organisation email is required', path: ['organisation', 'email'] });
    }

    if (v.customer.concession?.enabled) {
      const c = v.customer.concession;
      if (!c.concession?.trim()) ctx.addIssue({ code: 'custom', message: 'Concession type is required', path: ['customer', 'concession', 'concession'] });
      if (!c.reference?.trim()) ctx.addIssue({ code: 'custom', message: 'Concession reference is required', path: ['customer', 'concession', 'reference'] });
      if (!c.issued_on?.trim()) ctx.addIssue({ code: 'custom', message: 'Issued on is required', path: ['customer', 'concession', 'issued_on'] });
      if (!c.expires_on?.trim()) ctx.addIssue({ code: 'custom', message: 'Expiry is required', path: ['customer', 'concession', 'expires_on'] });
      if (!c.first_name?.trim()) ctx.addIssue({ code: 'custom', message: 'First name is required', path: ['customer', 'concession', 'first_name'] });
      if (!c.last_name?.trim()) ctx.addIssue({ code: 'custom', message: 'Last name is required', path: ['customer', 'concession', 'last_name'] });
    }

    // Electricity + solar requires feed-in type.
    if (v.site?.fuel_id === 1 && v.site?.has_solar === true) {
      const fit = Number(v.site.feed_in_type_id ?? 0);
      if (!Number.isFinite(fit) || fit <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Feed-in type is required when Solar is enabled', path: ['site', 'feed_in_type_id'] });
      }
    }
  });

export type FormValues = z.infer<typeof formSchema>;

export function defaultValues(): FormValues {
  return {
    referral_id: undefined,
    type: '',
    property_type: 'RESIDENT',
    terms_accepted: false,
    email_invoice: true,
    email_notice: true,
    signup_payment_method: 'CRDCARD',
    promo_code: '',
    preferred_contact: '',
    customer: {
      title: '',
      first_name: '',
      middle_name: '',
      last_name: '',
      date_of_birth: '',
      allow_marketing: false,
      phone_type: 'Mobile',
      phone_number: '',
      email_type: 'Contact Email',
      email: '',
      identification: {
        type: 'DriversLicence',
        reference: '',
        expires_on: '',
        country: '',
        state: '',
        card_number: '',
        card_color: '',
      },
      concession: {
        enabled: false,
        issued_on: '',
        expires_on: '',
        reference: '',
        concession: '',
        first_name: '',
        middle_name: '',
        last_name: '',
        country: '',
        state: '',
        card_number: '',
        card_color: '',
      },
    },
    directDebit: {
      bsb: '',
      name: '',
      account_number: '',
      bank_name: '',
      branch_name: '',
      bank_code: '',
      card_expiry: '',
      card_type: '',
      masked_card_number: '',
    },
    organisation: {
      name: '',
      trading_name: '',
      trustee_name: '',
      organisation_type_id: 0,
      requires_acn: true,
      abn: '',
      acn: '',
      gst_registered_at: '',
      industry_type_id: 0,
      identification: {
        type: 'DriversLicence',
        expires_on: '',
        reference: '',
        country: '',
        state: '',
        card_number: '',
        card_color: '',
      },
      phone_type: 'Mobile',
      phone_number: '',
      email_type: 'Contact Email',
      email: '',
    },
    site: {
      fuel_id: 1,
      identifier: '',
      offer_id: 0,
      bill_frequency: 'MONTHLY',
      has_medical_cooling: false,
      has_solar: false,
      start_date: '',
      move_in_terms_accepted: false,
      transfer_instructions: '',
      is_owner: false,
      usage_start_date: '',
      usage_end_date: '',
      has_interest_on_solar: false,
      feed_in_type_id: 0,
      selected_greenpower_id: 0,
      vsi_time: '09:00',
      vsi_method: 'customer_on_site',
      existing_account_number: '',
      has_basic_meter: false,
      is_mains_switch_off: false,
      is_electricity_disconnected_period: false,
      has_ecoc: false,
      are_any_building_works: false,
      has_meter_access: false,
    },
    addressSearchTerm: '',
    addressId: '',
    address: {},
  };
}
