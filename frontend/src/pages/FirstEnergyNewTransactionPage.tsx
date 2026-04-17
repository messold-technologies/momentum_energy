import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Building2, Eye, Save, Send } from 'lucide-react';
import { draftsApi, firstEnergyApi } from '../lib/api';
import { getApiErrorMessage } from '../lib/errorMessage';
import Stepper from '../components/ui/Stepper';

const COMPANY_ID = 'first-energy' as const;
const DRAFT_KEY = 'first_energy_draft_account';

const formSchema = z
  .object({
  referral_id: z.coerce.number().int().optional().default(0),
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
      trading_name: z.string().optional(),
      trustee_name: z.string().optional(),
      organisation_type_id: z.coerce.number().int().optional(),
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
      if (!org.acn?.trim()) ctx.addIssue({ code: 'custom', message: 'ACN is required', path: ['organisation', 'acn'] });
      if (!org.gst_registered_at?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'GST registered date is required', path: ['organisation', 'gst_registered_at'] });
      }
      if (!org.industry_type_id || org.industry_type_id <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Industry type is required', path: ['organisation', 'industry_type_id'] });
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
  });

type FormValues = z.infer<typeof formSchema>;

function RequiredMark() {
  return <span className="text-red-600 ml-0.5">*</span>;
}

function fieldClass(hasError: boolean) {
  return `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-primary-500 ${
    hasError
      ? 'border-red-300 focus:ring-red-200'
      : 'border-gray-300 focus:ring-primary-500'
  }`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

function defaultValues(): FormValues {
  return {
    referral_id: 0,
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

function toBoolInt(v: boolean) {
  return v ? 1 : 0;
}

function buildAddress(v: FormValues) {
  return {
    BuildingName: null,
    LocationDescription: null,
    LotNumber: null,
    FloorType: null,
    FloorNumber: null,
    ApartmentType: null,
    ApartmentNumber: null,
    StreetNumber: v.address?.StreetNumber ?? null,
    StreetNumberSuffix: null,
    StreetName: v.address?.StreetName ?? null,
    StreetType: v.address?.StreetType ?? null,
    StreetSuffix: null,
    Suburb: v.address?.Suburb ?? null,
    State: v.address?.State ?? null,
    PostCode: v.address?.PostCode ?? null,
    unstructured_line_1: null,
    unstructured_line_2: null,
    unstructured_line_3: null,
    street_address: v.address?.street_address ?? null,
    nmi_id: v.site?.fuel_id === 1 ? v.site.identifier : null,
    mirn: v.site?.fuel_id === 2 ? v.site.identifier : null,
    nmiStatus: null,
  };
}

function buildCustomerIdentifications(v: FormValues): Array<Record<string, unknown>> {
  const items: Array<Record<string, unknown>> = [
    {
      type: v.customer.identification.type,
      expires_on: v.customer.identification.expires_on,
      reference: v.customer.identification.reference,
      country: v.customer.identification.type === 'Passport' ? (v.customer.identification.country?.trim() || null) : null,
      state: v.customer.identification.type === 'DriversLicence' ? (v.customer.identification.state?.trim() || null) : null,
      card_number: v.customer.identification.card_number?.trim() || null,
      card_color: v.customer.identification.type === 'MedicareCard' ? (v.customer.identification.card_color?.trim() || null) : null,
    },
  ];

  if (v.customer.concession?.enabled) {
    items.push({
      type: 'Concession',
      issued_on: v.customer.concession.issued_on || null,
      expires_on: v.customer.concession.expires_on || null,
      reference: v.customer.concession.reference || null,
      concession: v.customer.concession.concession || null,
      first_name: v.customer.concession.first_name || null,
      middle_name: v.customer.concession.middle_name || null,
      last_name: v.customer.concession.last_name || null,
      country: v.customer.concession.country || null,
      state: v.customer.concession.state?.trim() || v.address?.State?.trim() || null,
      card_number: v.customer.concession.card_number || null,
      card_color: v.customer.concession.card_color || null,
    });
  }

  return items;
}

function buildAccountPayload(v: FormValues): Record<string, unknown> {
  const address = buildAddress(v);
  const customerIdentifications = buildCustomerIdentifications(v);

  return {
    promo_code: v.promo_code?.trim() ? v.promo_code.trim() : null,
    terms_accepted: toBoolInt(v.terms_accepted),
    property_type: v.property_type,
    preferred_contact: v.preferred_contact?.trim() ? v.preferred_contact.trim() : '',
    referral_id: v.referral_id ?? 0,
    type: v.type,
    email_invoice: toBoolInt(v.email_invoice),
    email_notice: toBoolInt(v.email_notice),
    signup_payment_method: v.signup_payment_method,
    address,
    directDebit: {
      bsb: v.directDebit?.bsb || null,
      name: v.directDebit?.name || null,
      account_number: v.directDebit?.account_number || null,
      bank_name: v.directDebit?.bank_name || null,
      branch_name: v.directDebit?.branch_name || null,
      bank_code: v.directDebit?.bank_code || null,
      card_expiry: v.directDebit?.card_expiry || null,
      card_type: v.directDebit?.card_type || null,
      masked_card_number: v.directDebit?.masked_card_number || null,
    },
    organisation:
      v.property_type === 'COMPANY'
        ? {
            name: v.organisation?.name || null,
            trading_name: v.organisation?.trading_name || null,
            trustee_name: v.organisation?.trustee_name || null,
            organisation_type_id: v.organisation?.organisation_type_id ?? null,
            organisationType: {},
            abn: v.organisation?.abn || null,
            acn: v.organisation?.acn || null,
            gst_registered_at: v.organisation?.gst_registered_at || null,
            industry_type_id: v.organisation?.industry_type_id ?? null,
            industryType: {},
            identifications: v.organisation?.identification?.type
              ? [
                  {
                    type: v.organisation.identification.type,
                    expires_on: v.organisation.identification.expires_on || null,
                    reference: v.organisation.identification.reference || null,
                    country: v.organisation.identification.country || null,
                    state: v.organisation.identification.state || null,
                    card_number: v.organisation.identification.card_number || null,
                    card_color: v.organisation.identification.card_color || null,
                  },
                ]
              : [],
            phones: v.organisation?.phone_number
              ? [{ type: v.organisation.phone_type || 'Mobile', phone_number: v.organisation.phone_number }]
              : [],
            emails: v.organisation?.email
              ? [{ type: v.organisation.email_type || 'Contact Email', email: v.organisation.email }]
              : [],
          }
        : undefined,
    customers: [
      {
        is_primary: 1,
        title: v.customer.title,
        first_name: v.customer.first_name,
        middle_name: v.customer.middle_name || null,
        last_name: v.customer.last_name,
        date_of_birth: v.customer.date_of_birth,
        customer_number: null,
        allow_marketing: toBoolInt(v.customer.allow_marketing),
        identifications: customerIdentifications,
        phones: [{ type: v.customer.phone_type, phone_number: v.customer.phone_number }],
        emails: [{ type: v.customer.email_type, email: v.customer.email }],
      },
    ],
    sites: [
      {
        bill_frequency: v.site.bill_frequency ?? 'MONTHLY',
        identifier: v.site.identifier,
        fuel_id: v.site.fuel_id,
        move_in_terms_accepted: toBoolInt(v.site.move_in_terms_accepted === true),
        latitude: null,
        longitude: null,
        transfer_instructions: v.site.transfer_instructions || null,
        is_owner: toBoolInt(v.site.is_owner === true),
        usage_start_date: v.site.usage_start_date || null,
        usage_end_date: v.site.usage_end_date || null,
        has_medical_cooling: toBoolInt(v.site.has_medical_cooling),
        siteOffer: {
          offer_id: v.site.offer_id,
          start_date: v.type === 'MoveIn' ? v.site.start_date : undefined,
        },
        address,
        siteMeters: [],
        lifeSupport: {},
        has_solar: toBoolInt(v.site.has_solar),
        has_interest_on_solar: toBoolInt(v.site.has_interest_on_solar === true),
        feed_in_type_id: v.site.feed_in_type_id ?? null,
        selected_greenpower_id: v.site.selected_greenpower_id ?? null,
        selectedGreenpower: {},
        vsi_time: v.site.vsi_time ?? null,
        vsi_method: v.site.vsi_method ?? null,
        existing_account_number: v.site.existing_account_number ?? null,
        has_basic_meter: toBoolInt(v.site.has_basic_meter === true),
        is_mains_switch_off: toBoolInt(v.site.is_mains_switch_off === true),
        is_electricity_disconnected_period: toBoolInt(v.site.is_electricity_disconnected_period === true),
        has_ecoc: toBoolInt(v.site.has_ecoc === true),
        are_any_building_works: toBoolInt(v.site.are_any_building_works === true),
        has_meter_access: toBoolInt(v.site.has_meter_access === true),
      },
    ],
  };
}

const STEPS = [
  { label: 'Sale', description: 'Basic info' },
  { label: 'Customer', description: 'Primary contact' },
  { label: 'Address', description: 'Supply address' },
  { label: 'Site', description: 'NMI/MIRN & offer' },
  { label: 'Review', description: 'Preview & submit' },
];

export default function FirstEnergyNewTransactionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('draft');

  const [step, setStep] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<Record<string, unknown> | null>(null);

  const [loadingLookups, setLoadingLookups] = useState(true);
  const [saleTypes, setSaleTypes] = useState<Array<{ type: string }>>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [addressSuggestions, setAddressSuggestions] = useState<Array<Record<string, unknown>>>([]);
  const [identificationTypes, setIdentificationTypes] = useState<string[]>([]);
  const [suburbOptions, setSuburbOptions] = useState<string[]>([]);
  const [postcodeLoading, setPostcodeLoading] = useState(false);
  const [concessionOptions, setConcessionOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [concessionLoading, setConcessionLoading] = useState(false);
  const [organisationTypes, setOrganisationTypes] = useState<Array<{ id: number; label: string }>>([]);
  const [industryTypes, setIndustryTypes] = useState<Array<{ id: number; label: string }>>([]);
  const [moveInDateOptions, setMoveInDateOptions] = useState<string[]>([]);

  const [promoChecking, setPromoChecking] = useState(false);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [abnChecking, setAbnChecking] = useState(false);
  const [abnMessage, setAbnMessage] = useState<string | null>(null);
  const [acnChecking, setAcnChecking] = useState(false);
  const [acnMessage, setAcnMessage] = useState<string | null>(null);

  const [savingDraft, setSavingDraft] = useState(false);
  const [saveDraftMessage, setSaveDraftMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressSearching, setAddressSearching] = useState(false);

  const methods = useForm<FormValues>({
    defaultValues: defaultValues(),
    resolver: zodResolver(formSchema) as unknown as Resolver<FormValues>,
    mode: 'onTouched',
  });

  const values = methods.watch();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [st, ct, idt, orgTypesRes, industryTypesRes, moveInDatesRes] = await Promise.all([
          firstEnergyApi.lookups.saleTypes(),
          firstEnergyApi.lookups.customerTitles(),
          firstEnergyApi.proxy.get('identification'),
          firstEnergyApi.proxy.get('organisation-types'),
          firstEnergyApi.proxy.get('industry-types'),
          firstEnergyApi.proxy.get('move-in-date'),
        ]);
        if (!mounted) return;
        setSaleTypes(Array.isArray(st.data) ? st.data : []);
        const rawTitles = ct.data && typeof ct.data === 'object' ? Object.keys(ct.data) : [];
        setTitles(rawTitles);
        const rawIdTypes = idt?.data && typeof idt.data === 'object' ? Object.keys(idt.data as Record<string, unknown>) : [];
        setIdentificationTypes(rawIdTypes.length ? rawIdTypes : ['DriversLicence', 'MedicareCard', 'Passport', 'Plus18Card']);

        const normalizeIdLabelArray = (raw: unknown): Array<{ id: number; label: string }> => {
          if (!raw) return [];
          if (Array.isArray(raw)) {
            return raw
              .map((it) => {
                if (it && typeof it === 'object') {
                  const o = it as Record<string, unknown>;
                  const id = Number(o.id ?? o.ID ?? o.type_id ?? o.typeId);
                  const label =
                    (typeof o.name === 'string' && o.name) ||
                    (typeof o.label === 'string' && o.label) ||
                    (typeof o.description === 'string' && o.description) ||
                    String(id);
                  if (!Number.isFinite(id) || id <= 0) return null;
                  return { id, label };
                }
                return null;
              })
              .filter((x): x is { id: number; label: string } => !!x);
          }
          if (typeof raw === 'object') {
            const entries = Object.entries(raw as Record<string, unknown>);
            return entries
              .map(([k, v]) => {
                const id = Number(k);
                if (!Number.isFinite(id) || id <= 0) return null;
                const label = typeof v === 'string' && v ? v : String(id);
                return { id, label };
              })
              .filter((x): x is { id: number; label: string } => !!x);
          }
          return [];
        };

        setOrganisationTypes(normalizeIdLabelArray(orgTypesRes?.data));
        setIndustryTypes(normalizeIdLabelArray(industryTypesRes?.data));
        const moveInRaw = moveInDatesRes?.data;
        if (Array.isArray(moveInRaw)) {
          setMoveInDateOptions(moveInRaw.filter((d): d is string => typeof d === 'string' && d.trim().length > 0));
        }
      } catch (e) {
        if (!mounted) return;
        setError(getApiErrorMessage(e, 'Failed to load lookups'));
      } finally {
        if (mounted) setLoadingLookups(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Postcode -> suburbs lookup
  useEffect(() => {
    const postcode = String(values.address?.PostCode ?? '').trim();
    if (postcode.length < 3) {
      setSuburbOptions([]);
      return;
    }
    let mounted = true;
    const handle = globalThis.setTimeout(async () => {
      setPostcodeLoading(true);
      try {
        const res = await firstEnergyApi.lookups.postcode(postcode);
        const d = res.data as unknown;
        let suburbs: string[] = [];
        if (Array.isArray(d)) suburbs = d.filter((x): x is string => typeof x === 'string');
        else if (d && typeof d === 'object') {
          const o = d as Record<string, unknown>;
          if (Array.isArray(o.suburbs)) suburbs = o.suburbs.filter((x): x is string => typeof x === 'string');
          else if (Array.isArray(o.Suburbs)) suburbs = (o.Suburbs as unknown[]).filter((x): x is string => typeof x === 'string');
        }
        if (!mounted) return;
        setSuburbOptions(suburbs);
        const current = String(methods.getValues('address.Suburb') ?? '').trim();
        if ((!current || !suburbs.includes(current)) && suburbs.length === 1) {
          methods.setValue('address.Suburb', suburbs[0], { shouldDirty: true, shouldTouch: true });
        }
      } catch {
        if (!mounted) return;
        setSuburbOptions([]);
      } finally {
        if (mounted) setPostcodeLoading(false);
      }
    }, 350);
    return () => {
      mounted = false;
      globalThis.clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.address?.PostCode]);

  // Concession types lookup (by State) when concession is enabled
  useEffect(() => {
    const enabled = values.customer?.concession?.enabled === true;
    if (!enabled) {
      setConcessionOptions([]);
      return;
    }
    const state = String(values.address?.State ?? values.customer?.concession?.state ?? '').trim();
    if (!state) return;
    let mounted = true;
    const handle = globalThis.setTimeout(async () => {
      setConcessionLoading(true);
      try {
        const res = await firstEnergyApi.proxy.get('concession', { state });
        const raw = res?.data;
        const opts: Array<{ id: string; label: string }> = [];
        if (Array.isArray(raw)) {
          for (const it of raw) {
            if (typeof it === 'string') opts.push({ id: it, label: it });
            else if (it && typeof it === 'object') {
              const o = it as Record<string, unknown>;
              const id = String(o.id ?? o.code ?? o.type ?? o.name ?? '');
              const label = String(o.name ?? o.label ?? o.description ?? id);
              if (id) opts.push({ id, label });
            }
          }
        } else if (raw && typeof raw === 'object') {
          for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
            const id = k;
            const label = typeof v === 'string' && v ? v : k;
            opts.push({ id, label });
          }
        }
        if (!mounted) return;
        setConcessionOptions(opts);
      } catch {
        if (!mounted) return;
        setConcessionOptions([]);
      } finally {
        if (mounted) setConcessionLoading(false);
      }
    }, 250);
    return () => {
      mounted = false;
      globalThis.clearTimeout(handle);
    };
  }, [values.customer?.concession?.enabled, values.address?.State, values.customer?.concession?.state]);

  async function validatePromoCode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) {
      setPromoMessage(null);
      return;
    }
    setPromoChecking(true);
    setPromoMessage(null);
    try {
      const res =
        (await firstEnergyApi.proxy.get('promo-code/check-code', { code: trimmed })) ||
        (await firstEnergyApi.proxy.get('promo-code/check-code', { promo_code: trimmed })) ||
        (await firstEnergyApi.proxy.get('promo-code/check-code', { promoCode: trimmed }));
      const d = res?.data as unknown;
      const ok =
        (d && typeof d === 'object' && (d as Record<string, unknown>).valid === true) ||
        (d && typeof d === 'object' && (d as Record<string, unknown>).is_valid === true);
      setPromoMessage(ok ? 'Promo code is valid.' : 'Promo code check completed.');
    } catch (e) {
      setPromoMessage(getApiErrorMessage(e, 'Promo code is invalid.'));
    } finally {
      setPromoChecking(false);
    }
  }

  async function validateAbn(abn: string) {
    const trimmed = abn.trim();
    if (!trimmed) {
      setAbnMessage(null);
      return;
    }
    setAbnChecking(true);
    setAbnMessage(null);
    try {
      const res = await firstEnergyApi.proxy.get('abn-lookup/validate-abn', { abn: trimmed });
      const d = res?.data as unknown;
      const ok =
        (d && typeof d === 'object' && (d as Record<string, unknown>).valid === true) ||
        (d && typeof d === 'object' && (d as Record<string, unknown>).is_valid === true);
      setAbnMessage(ok ? 'ABN is valid.' : 'ABN check completed.');
    } catch (e) {
      setAbnMessage(getApiErrorMessage(e, 'ABN validation failed.'));
    } finally {
      setAbnChecking(false);
    }
  }

  async function validateAcn(acn: string) {
    const trimmed = acn.trim();
    if (!trimmed) {
      setAcnMessage(null);
      return;
    }
    setAcnChecking(true);
    setAcnMessage(null);
    try {
      const res = await firstEnergyApi.proxy.get('abn-lookup/validate-acn', { acn: trimmed });
      const d = res?.data as unknown;
      const ok =
        (d && typeof d === 'object' && (d as Record<string, unknown>).valid === true) ||
        (d && typeof d === 'object' && (d as Record<string, unknown>).is_valid === true);
      setAcnMessage(ok ? 'ACN is valid.' : 'ACN check completed.');
    } catch (e) {
      setAcnMessage(getApiErrorMessage(e, 'ACN validation failed.'));
    } finally {
      setAcnChecking(false);
    }
  }

  // Load draft from DB if `?draft=<id>` present, otherwise localStorage.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setError(null);
        if (draftId) {
          const res = await draftsApi.get(draftId, { companyId: COMPANY_ID });
          if (!mounted) return;
          methods.reset(res.draft.payload as unknown as FormValues);
          return;
        }
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as FormValues;
        if (!mounted) return;
        methods.reset(parsed);
      } catch (e) {
        if (!mounted) return;
        setError(getApiErrorMessage(e, 'Failed to load draft'));
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  // Address autocomplete search (debounced).
  useEffect(() => {
    const term = (values.addressSearchTerm ?? '').trim();
    if (!term || term.length < 6) {
      setAddressSuggestions([]);
      setAddressSearching(false);
      return;
    }
    const handle = globalThis.setTimeout(async () => {
      setAddressSearching(true);
      try {
        const res = await firstEnergyApi.lookups.addressSearch(term);
        setAddressSuggestions(Array.isArray(res.data) ? (res.data as Array<Record<string, unknown>>) : []);
      } catch (e) {
        setError(getApiErrorMessage(e, 'Address search failed'));
      } finally {
        setAddressSearching(false);
      }
    }, 300);
    return () => globalThis.clearTimeout(handle);
  }, [values.addressSearchTerm]);

  const suggestionOptions = useMemo((): Array<{ id: string; label: string }> => {
    const items: Array<{ id: string; label: string }> = [];
    for (const s of addressSuggestions) {
      const rawId = s.Id ?? s.id ?? s.ID;
      const id = typeof rawId === 'string' ? rawId : null;
      if (!id) continue;
      const rawLabel = s.address ?? s.Address ?? s.formattedAddress ?? s.FormattedAddress ?? s.text ?? s.Text ?? id;
      const label = typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel : id;
      items.push({ id, label });
    }
    return items;
  }, [addressSuggestions]);

  async function handlePickAddress(id: string) {
    try {
      setError(null);
      const res = await firstEnergyApi.lookups.addressDetails(id);
      const d = res.data ?? {};
      methods.setValue('addressId', id, { shouldDirty: true });
      methods.setValue('address', {
        StreetNumber: (d.StreetNumber as string | undefined) ?? '',
        StreetName: (d.StreetName as string | undefined) ?? '',
        StreetType: (d.StreetType as string | undefined) ?? '',
        Suburb: (d.Suburb as string | undefined) ?? '',
        State: (d.State as string | undefined) ?? '',
        PostCode: (d.PostCode as string | undefined) ?? '',
        street_address: (d.postcode_suburb as string | undefined) ?? (d.street_address as string | undefined) ?? '',
      });
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load address details'));
    }
  }

  async function handleSaveDraft() {
    setSavingDraft(true);
    setSaveDraftMessage(null);
    setError(null);
    try {
      const payload = methods.getValues();
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      const res = await draftsApi.save(payload as unknown as Record<string, unknown>, { companyId: COMPANY_ID });
      setSaveDraftMessage('Draft saved.');
      navigate(`/first-energy/transactions/new?draft=${res.draft.id}`, { replace: true });
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to save draft'));
    } finally {
      setSavingDraft(false);
      globalThis.setTimeout(() => setSaveDraftMessage(null), 2500);
    }
  }

  function handleClearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    navigate('/first-energy/transactions/new', { replace: true });
    methods.reset(defaultValues());
    setAddressSuggestions([]);
    setError(null);
    setSaveDraftMessage(null);
  }

  async function onSubmit(v: FormValues) {
    setSubmitting(true);
    setError(null);
    try {
      if (v.type === 'MoveIn' && !v.site.start_date) {
        setError('MoveIn requires a move-in start date');
        return;
      }
      const payload = buildAccountPayload(v);

      const res = await firstEnergyApi.accounts.create(payload);
      localStorage.removeItem(DRAFT_KEY);
      navigate('/first-energy/form-responses', { replace: true });
      return res;
    } catch (e) {
      setError(getApiErrorMessage(e, 'Account creation failed'));
    } finally {
      setSubmitting(false);
    }
  }

  const stepFields: Array<Array<Parameters<typeof methods.trigger>[0] extends never ? never : string>> = [
    ['type', 'property_type', 'signup_payment_method', 'terms_accepted', 'email_invoice', 'email_notice'],
    [
      'customer.title',
      'customer.first_name',
      'customer.last_name',
      'customer.date_of_birth',
      'customer.phone_type',
      'customer.phone_number',
      'customer.email_type',
      'customer.email',
      'customer.identification.type',
      'customer.identification.reference',
      'customer.identification.expires_on',
    ],
    ['address.StreetNumber', 'address.StreetName', 'address.StreetType', 'address.Suburb', 'address.State', 'address.PostCode'],
    ['site.fuel_id', 'site.identifier', 'site.offer_id', 'site.start_date'],
    [],
  ];

  async function handleNext() {
    setValidationError(null);
    const base = stepFields[step] ?? [];
    const fields =
      step === 2 && methods.getValues().customer?.concession?.enabled
        ? [
            ...base,
            'customer.concession.concession',
            'customer.concession.reference',
            'customer.concession.issued_on',
            'customer.concession.expires_on',
            'customer.concession.first_name',
            'customer.concession.last_name',
          ]
        : base;
    const valid = fields.length ? await methods.trigger(fields as never) : await methods.trigger();
    if (!valid) {
      setValidationError('Please fix the highlighted fields before continuing.');
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handlePrev() {
    setValidationError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  function handlePreview() {
    const payload = buildAccountPayload(methods.getValues());
    setPreviewPayload(payload);
    setPreviewOpen(true);
  }

  async function handleFinalSubmit() {
    setValidationError(null);
    const ok = await methods.trigger();
    if (!ok) {
      setValidationError('Please fix the highlighted fields before submitting.');
      return;
    }
    await onSubmit(methods.getValues());
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New sale</h1>
          <p className="text-sm text-gray-500 mt-1">Create a new 1st Energy account</p>
        </div>
        <div className="flex items-center gap-3">
          {saveDraftMessage && <span className="text-sm text-green-600">{saveDraftMessage}</span>}
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-50 disabled:opacity-50 cursor-pointer"
          >
            {savingDraft ? (
              <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save draft
          </button>
          <button
            type="button"
            onClick={handleClearDraft}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            Clear Draft
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">{error}</div>
      ) : null}
      {validationError ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
          {validationError}
        </div>
      ) : null}

      <Stepper steps={STEPS} currentStep={step} />

      <div className="bg-white rounded-xl border border-gray-200 p-6 lg:p-8">
        <FormProvider {...methods}>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
            {step === 0 ? (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Sale</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="fe_sale_type" className="block text-sm font-medium text-gray-700 mb-1">
                      Sale type <RequiredMark />
                    </label>
                    <select
                      id="fe_sale_type"
                      {...methods.register('type')}
                      disabled={loadingLookups}
                      className={`${fieldClass(!!methods.formState.errors.type)} disabled:opacity-50`}
                    >
                      <option value="">Select…</option>
                      {saleTypes.map((s) => (
                        <option key={s.type} value={s.type}>
                          {s.type}
                        </option>
                      ))}
                    </select>
                    <FieldError message={methods.formState.errors.type?.message as string | undefined} />
                  </div>
                  <div>
                    <label htmlFor="fe_property_type" className="block text-sm font-medium text-gray-700 mb-1">
                      Property type <RequiredMark />
                    </label>
                    <select
                      id="fe_property_type"
                      {...methods.register('property_type')}
                      className={fieldClass(!!methods.formState.errors.property_type)}
                    >
                      <option value="RESIDENT">Resident</option>
                      <option value="COMPANY">Company</option>
                    </select>
                    <FieldError message={methods.formState.errors.property_type?.message as string | undefined} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="fe_payment_method" className="block text-sm font-medium text-gray-700 mb-1">
                      Signup payment method <RequiredMark />
                    </label>
                    <select
                      id="fe_payment_method"
                      {...methods.register('signup_payment_method')}
                      className={fieldClass(!!methods.formState.errors.signup_payment_method)}
                    >
                      <option value="DIRECT">Direct debit</option>
                      <option value="CRDCARD">Credit card</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                    <FieldError message={methods.formState.errors.signup_payment_method?.message as string | undefined} />
                  </div>
                  <div>
                    <label htmlFor="fe_referral_id" className="block text-sm font-medium text-gray-700 mb-1">
                      Referral ID (optional)
                    </label>
                    <input
                      id="fe_referral_id"
                      type="number"
                      {...methods.register('referral_id')}
                      className={fieldClass(!!methods.formState.errors.referral_id)}
                    />
                    <FieldError message={methods.formState.errors.referral_id?.message as string | undefined} />
                  </div>
                  <div>
                    <label htmlFor="fe_promo_code" className="block text-sm font-medium text-gray-700 mb-1">
                      Promo code (optional)
                    </label>
                    <div className="relative">
                      <input
                        id="fe_promo_code"
                        {...methods.register('promo_code', {
                          onBlur: (e) => void validatePromoCode(String(e.target.value ?? '')),
                        })}
                        className={`${fieldClass(!!methods.formState.errors.promo_code)} pr-10`}
                      />
                      {promoChecking ? (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : null}
                    </div>
                    {promoMessage ? <p className="mt-1 text-xs text-gray-600">{promoMessage}</p> : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="fe_preferred_contact" className="block text-sm font-medium text-gray-700 mb-1">
                      Preferred contact (optional)
                    </label>
                    <input
                      id="fe_preferred_contact"
                      {...methods.register('preferred_contact')}
                      className={fieldClass(!!methods.formState.errors.preferred_contact)}
                    />
                  </div>
                </div>

                {methods.watch('signup_payment_method') === 'DIRECT' ? (
                  <div className="pt-2 border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900">Direct debit</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                      <div>
                        <label htmlFor="fe_dd_bsb" className="block text-sm font-medium text-gray-700 mb-1">
                          BSB <RequiredMark />
                        </label>
                        <input
                          id="fe_dd_bsb"
                          {...methods.register('directDebit.bsb')}
                          className={fieldClass(!!methods.formState.errors.directDebit?.bsb)}
                        />
                        <FieldError message={methods.formState.errors.directDebit?.bsb?.message as string | undefined} />
                      </div>
                      <div>
                        <label htmlFor="fe_dd_name" className="block text-sm font-medium text-gray-700 mb-1">
                          Account name <RequiredMark />
                        </label>
                        <input
                          id="fe_dd_name"
                          {...methods.register('directDebit.name')}
                          className={fieldClass(!!methods.formState.errors.directDebit?.name)}
                        />
                        <FieldError message={methods.formState.errors.directDebit?.name?.message as string | undefined} />
                      </div>
                      <div>
                        <label htmlFor="fe_dd_account_number" className="block text-sm font-medium text-gray-700 mb-1">
                          Account number <RequiredMark />
                        </label>
                        <input
                          id="fe_dd_account_number"
                          {...methods.register('directDebit.account_number')}
                          className={fieldClass(!!methods.formState.errors.directDebit?.account_number)}
                        />
                        <FieldError message={methods.formState.errors.directDebit?.account_number?.message as string | undefined} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                      <div>
                        <label htmlFor="fe_dd_bank_name" className="block text-sm font-medium text-gray-700 mb-1">
                          Bank name (optional)
                        </label>
                        <input id="fe_dd_bank_name" {...methods.register('directDebit.bank_name')} className={fieldClass(false)} />
                      </div>
                      <div>
                        <label htmlFor="fe_dd_branch_name" className="block text-sm font-medium text-gray-700 mb-1">
                          Branch name (optional)
                        </label>
                        <input id="fe_dd_branch_name" {...methods.register('directDebit.branch_name')} className={fieldClass(false)} />
                      </div>
                      <div>
                        <label htmlFor="fe_dd_bank_code" className="block text-sm font-medium text-gray-700 mb-1">
                          Bank code (optional)
                        </label>
                        <input id="fe_dd_bank_code" {...methods.register('directDebit.bank_code')} className={fieldClass(false)} />
                      </div>
                    </div>
                  </div>
                ) : null}

                {methods.watch('property_type') === 'COMPANY' ? (
                  <div className="pt-2 border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900">Organisation</h3>
                    <p className="text-sm text-gray-500 mt-1">Required when Property type is Company.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                      <div>
                        <label htmlFor="fe_org_name" className="block text-sm font-medium text-gray-700 mb-1">
                          Name <RequiredMark />
                        </label>
                        <input
                          id="fe_org_name"
                          {...methods.register('organisation.name')}
                          className={fieldClass(!!methods.formState.errors.organisation?.name)}
                        />
                        <FieldError message={methods.formState.errors.organisation?.name?.message as string | undefined} />
                      </div>
                      <div>
                        <label htmlFor="fe_org_trading_name" className="block text-sm font-medium text-gray-700 mb-1">
                          Trading name <RequiredMark />
                        </label>
                        <input
                          id="fe_org_trading_name"
                          {...methods.register('organisation.trading_name')}
                          className={fieldClass(!!methods.formState.errors.organisation?.trading_name)}
                        />
                        <FieldError message={methods.formState.errors.organisation?.trading_name?.message as string | undefined} />
                      </div>
                      <div>
                        <label htmlFor="fe_org_trustee_name" className="block text-sm font-medium text-gray-700 mb-1">
                          Trustee name <RequiredMark />
                        </label>
                        <input
                          id="fe_org_trustee_name"
                          {...methods.register('organisation.trustee_name')}
                          className={fieldClass(!!methods.formState.errors.organisation?.trustee_name)}
                        />
                        <FieldError message={methods.formState.errors.organisation?.trustee_name?.message as string | undefined} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                      <div>
                        <label htmlFor="fe_org_type" className="block text-sm font-medium text-gray-700 mb-1">
                          Organisation type <RequiredMark />
                        </label>
                        <select
                          id="fe_org_type"
                          {...methods.register('organisation.organisation_type_id')}
                          className={fieldClass(!!methods.formState.errors.organisation?.organisation_type_id)}
                          disabled={loadingLookups}
                        >
                          <option value={0}>Select…</option>
                          {organisationTypes.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <FieldError message={methods.formState.errors.organisation?.organisation_type_id?.message as string | undefined} />
                      </div>
                      <div>
                        <label htmlFor="fe_org_industry" className="block text-sm font-medium text-gray-700 mb-1">
                          Industry type <RequiredMark />
                        </label>
                        <select
                          id="fe_org_industry"
                          {...methods.register('organisation.industry_type_id')}
                          className={fieldClass(!!methods.formState.errors.organisation?.industry_type_id)}
                          disabled={loadingLookups}
                        >
                          <option value={0}>Select…</option>
                          {industryTypes.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <FieldError message={methods.formState.errors.organisation?.industry_type_id?.message as string | undefined} />
                      </div>
                      <div>
                        <label htmlFor="fe_org_gst" className="block text-sm font-medium text-gray-700 mb-1">
                          GST registered at <RequiredMark />
                        </label>
                        <input
                          id="fe_org_gst"
                          type="date"
                          {...methods.register('organisation.gst_registered_at')}
                          className={fieldClass(!!methods.formState.errors.organisation?.gst_registered_at)}
                        />
                        <FieldError message={methods.formState.errors.organisation?.gst_registered_at?.message as string | undefined} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                      <div>
                        <label htmlFor="fe_org_abn" className="block text-sm font-medium text-gray-700 mb-1">
                          ABN <RequiredMark />
                        </label>
                        <div className="relative">
                          <input
                            id="fe_org_abn"
                            {...methods.register('organisation.abn', {
                              onBlur: (e) => void validateAbn(String(e.target.value ?? '')),
                            })}
                            className={`${fieldClass(!!methods.formState.errors.organisation?.abn)} pr-10`}
                          />
                          {abnChecking ? (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : null}
                        </div>
                        <FieldError message={methods.formState.errors.organisation?.abn?.message as string | undefined} />
                        {abnMessage ? <p className="mt-1 text-xs text-gray-600">{abnMessage}</p> : null}
                      </div>
                      <div>
                        <label htmlFor="fe_org_acn" className="block text-sm font-medium text-gray-700 mb-1">
                          ACN <RequiredMark />
                        </label>
                        <div className="relative">
                          <input
                            id="fe_org_acn"
                            {...methods.register('organisation.acn', {
                              onBlur: (e) => void validateAcn(String(e.target.value ?? '')),
                            })}
                            className={`${fieldClass(!!methods.formState.errors.organisation?.acn)} pr-10`}
                          />
                          {acnChecking ? (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : null}
                        </div>
                        <FieldError message={methods.formState.errors.organisation?.acn?.message as string | undefined} />
                        {acnMessage ? <p className="mt-1 text-xs text-gray-600">{acnMessage}</p> : null}
                      </div>
                      <div />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                      <div>
                        <label htmlFor="fe_org_phone" className="block text-sm font-medium text-gray-700 mb-1">
                          Phone <RequiredMark />
                        </label>
                        <input
                          id="fe_org_phone"
                          {...methods.register('organisation.phone_number')}
                          className={fieldClass(!!methods.formState.errors.organisation?.phone_number)}
                        />
                        <FieldError message={methods.formState.errors.organisation?.phone_number?.message as string | undefined} />
                      </div>
                      <div>
                        <label htmlFor="fe_org_email" className="block text-sm font-medium text-gray-700 mb-1">
                          Email <RequiredMark />
                        </label>
                        <input
                          id="fe_org_email"
                          type="email"
                          {...methods.register('organisation.email')}
                          className={fieldClass(!!methods.formState.errors.organisation?.email)}
                        />
                        <FieldError message={methods.formState.errors.organisation?.email?.message as string | undefined} />
                      </div>
                      <div />
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-6">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" {...methods.register('email_invoice')} className="rounded border-gray-300" />
                    Email invoice <RequiredMark />
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" {...methods.register('email_notice')} className="rounded border-gray-300" />
                    Email notices <RequiredMark />
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" {...methods.register('terms_accepted')} className="rounded border-gray-300" />
                    Terms accepted <RequiredMark />
                  </label>
                </div>
                <FieldError message={methods.formState.errors.terms_accepted?.message as string | undefined} />
              </section>
            ) : null}

            {step === 1 ? (
              <section className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Primary customer</h2>
                  <p className="text-sm text-gray-500 mt-1">Customer identity and contact details.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="fe_title" className="block text-sm font-medium text-gray-700 mb-1">
                      Title <RequiredMark />
                    </label>
                    <select
                      id="fe_title"
                      {...methods.register('customer.title')}
                      disabled={loadingLookups}
                      className={`${fieldClass(!!methods.formState.errors.customer?.title)} disabled:opacity-50`}
                    >
                      <option value="">Select…</option>
                      {titles.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <FieldError message={methods.formState.errors.customer?.title?.message as string | undefined} />
                  </div>
                  <div>
                    <label htmlFor="fe_first_name" className="block text-sm font-medium text-gray-700 mb-1">
                      First name <RequiredMark />
                    </label>
                    <input
                      id="fe_first_name"
                      {...methods.register('customer.first_name')}
                      className={fieldClass(!!methods.formState.errors.customer?.first_name)}
                    />
                    <FieldError message={methods.formState.errors.customer?.first_name?.message as string | undefined} />
                  </div>
                  <div>
                    <label htmlFor="fe_middle_name" className="block text-sm font-medium text-gray-700 mb-1">
                      Middle name (optional)
                    </label>
                    <input
                      id="fe_middle_name"
                      {...methods.register('customer.middle_name')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="fe_last_name" className="block text-sm font-medium text-gray-700 mb-1">
                      Last name <RequiredMark />
                    </label>
                    <input
                      id="fe_last_name"
                      {...methods.register('customer.last_name')}
                      className={fieldClass(!!methods.formState.errors.customer?.last_name)}
                    />
                    <FieldError message={methods.formState.errors.customer?.last_name?.message as string | undefined} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="fe_dob" className="block text-sm font-medium text-gray-700 mb-1">
                      Date of birth <RequiredMark />
                    </label>
                    <input
                      id="fe_dob"
                      type="date"
                      {...methods.register('customer.date_of_birth')}
                      className={fieldClass(!!methods.formState.errors.customer?.date_of_birth)}
                    />
                    <FieldError message={methods.formState.errors.customer?.date_of_birth?.message as string | undefined} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label htmlFor="fe_phone_type" className="block text-sm font-medium text-gray-700 mb-1">
                        Phone type
                      </label>
                      <select
                        id="fe_phone_type"
                        {...methods.register('customer.phone_type')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="Mobile">Mobile</option>
                        <option value="Landline">Landline</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label htmlFor="fe_phone" className="block text-sm font-medium text-gray-700 mb-1">
                        Phone <RequiredMark />
                      </label>
                      <input
                        id="fe_phone"
                        {...methods.register('customer.phone_number')}
                        className={fieldClass(!!methods.formState.errors.customer?.phone_number)}
                      />
                      <FieldError message={methods.formState.errors.customer?.phone_number?.message as string | undefined} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label htmlFor="fe_email_type" className="block text-sm font-medium text-gray-700 mb-1">
                        Email type
                      </label>
                      <select
                        id="fe_email_type"
                        {...methods.register('customer.email_type')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="Contact Email">Contact</option>
                        <option value="Billing Email">Billing</option>
                        <option value="Business Email">Business</option>
                        <option value="Personal Email">Personal</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label htmlFor="fe_email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email <RequiredMark />
                      </label>
                      <input
                        id="fe_email"
                        type="email"
                        {...methods.register('customer.email')}
                        className={fieldClass(!!methods.formState.errors.customer?.email)}
                      />
                      <FieldError message={methods.formState.errors.customer?.email?.message as string | undefined} />
                    </div>
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" {...methods.register('customer.allow_marketing')} className="rounded border-gray-300" />
                  Allow marketing communications
                </label>

                <div className="pt-2">
                  <h3 className="text-sm font-semibold text-gray-900">Identification</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                    <div>
                      <label htmlFor="fe_id_type" className="block text-sm font-medium text-gray-700 mb-1">
                        Type <RequiredMark />
                      </label>
                      <select
                        id="fe_id_type"
                        {...methods.register('customer.identification.type')}
                        className={fieldClass(!!methods.formState.errors.customer?.identification?.type)}
                      >
                        {(identificationTypes.length
                          ? identificationTypes
                          : ['DriversLicence', 'MedicareCard', 'Passport', 'Plus18Card']
                        ).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <FieldError message={methods.formState.errors.customer?.identification?.type?.message as string | undefined} />
                    </div>
                    <div>
                      <label htmlFor="fe_id_reference" className="block text-sm font-medium text-gray-700 mb-1">
                        Reference / card number <RequiredMark />
                      </label>
                      <input
                        id="fe_id_reference"
                        {...methods.register('customer.identification.reference')}
                        className={fieldClass(!!methods.formState.errors.customer?.identification?.reference)}
                      />
                      <FieldError message={methods.formState.errors.customer?.identification?.reference?.message as string | undefined} />
                    </div>
                    <div>
                      <label htmlFor="fe_id_expiry" className="block text-sm font-medium text-gray-700 mb-1">
                        Expiry <RequiredMark />
                      </label>
                      <input
                        id="fe_id_expiry"
                        type="date"
                        {...methods.register('customer.identification.expires_on')}
                        className={fieldClass(!!methods.formState.errors.customer?.identification?.expires_on)}
                      />
                      <FieldError message={methods.formState.errors.customer?.identification?.expires_on?.message as string | undefined} />
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Supply address</h2>
                <div>
                  <label htmlFor="fe_address_search" className="block text-sm font-medium text-gray-700 mb-1">
                    Search address
                  </label>
                  <div className="relative">
                    <input
                      id="fe_address_search"
                      {...methods.register('addressSearchTerm')}
                      placeholder="Start typing…"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pr-10"
                    />
                    {addressSearching ? (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : null}
                  </div>
                  {suggestionOptions.length > 0 ? (
                    <div className="mt-2 border border-gray-200 rounded-lg divide-y max-h-56 overflow-auto">
                      {suggestionOptions.slice(0, 20).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handlePickAddress(s.id)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                  <div className="sm:col-span-1">
                    <label htmlFor="fe_postcode" className="block text-sm font-medium text-gray-700 mb-1">
                      Postcode <RequiredMark />
                    </label>
                    <input
                      id="fe_postcode"
                      {...methods.register('address.PostCode')}
                      className={fieldClass(!!methods.formState.errors.address?.PostCode)}
                    />
                    <FieldError message={methods.formState.errors.address?.PostCode?.message as string | undefined} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="fe_suburb" className="block text-sm font-medium text-gray-700 mb-1">
                      Suburb <RequiredMark />
                    </label>
                    {suburbOptions.length ? (
                      <div className="relative">
                        <select
                          id="fe_suburb"
                          {...methods.register('address.Suburb')}
                          className={`${fieldClass(!!methods.formState.errors.address?.Suburb)} disabled:opacity-50`}
                          disabled={postcodeLoading}
                        >
                          <option value="">Select…</option>
                          {suburbOptions.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        {postcodeLoading ? (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <input
                        id="fe_suburb"
                        {...methods.register('address.Suburb')}
                        className={fieldClass(!!methods.formState.errors.address?.Suburb)}
                      />
                    )}
                    <FieldError message={methods.formState.errors.address?.Suburb?.message as string | undefined} />
                  </div>
                  <div className="sm:col-span-1">
                    <label htmlFor="fe_state" className="block text-sm font-medium text-gray-700 mb-1">
                      State <RequiredMark />
                    </label>
                    <input
                      id="fe_state"
                      {...methods.register('address.State')}
                      className={fieldClass(!!methods.formState.errors.address?.State)}
                    />
                    <FieldError message={methods.formState.errors.address?.State?.message as string | undefined} />
                  </div>
                  <div className="sm:col-span-1">
                    <label htmlFor="fe_street_no" className="block text-sm font-medium text-gray-700 mb-1">
                      Street no. <RequiredMark />
                    </label>
                    <input
                      id="fe_street_no"
                      {...methods.register('address.StreetNumber')}
                      className={fieldClass(!!methods.formState.errors.address?.StreetNumber)}
                    />
                    <FieldError message={methods.formState.errors.address?.StreetNumber?.message as string | undefined} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="fe_street_name" className="block text-sm font-medium text-gray-700 mb-1">
                      Street name <RequiredMark />
                    </label>
                    <input
                      id="fe_street_name"
                      {...methods.register('address.StreetName')}
                      className={fieldClass(!!methods.formState.errors.address?.StreetName)}
                    />
                    <FieldError message={methods.formState.errors.address?.StreetName?.message as string | undefined} />
                  </div>
                  <div>
                    <label htmlFor="fe_street_type" className="block text-sm font-medium text-gray-700 mb-1">
                      Street type <RequiredMark />
                    </label>
                    <input
                      id="fe_street_type"
                      {...methods.register('address.StreetType')}
                      className={fieldClass(!!methods.formState.errors.address?.StreetType)}
                    />
                    <FieldError message={methods.formState.errors.address?.StreetType?.message as string | undefined} />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Concession</h3>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" {...methods.register('customer.concession.enabled')} className="rounded border-gray-300" />
                      Add concession
                    </label>
                  </div>

                  {methods.watch('customer.concession.enabled') ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="fe_concession_type" className="block text-sm font-medium text-gray-700 mb-1">
                            Concession type <RequiredMark />
                          </label>
                          {concessionOptions.length ? (
                            <div className="relative">
                              <select
                                id="fe_concession_type"
                                {...methods.register('customer.concession.concession')}
                                className={`${fieldClass(
                                  !!methods.formState.errors.customer?.concession?.concession
                                )} disabled:opacity-50`}
                                disabled={concessionLoading}
                              >
                                <option value="">Select…</option>
                                {concessionOptions.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                              {concessionLoading ? (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <input
                              id="fe_concession_type"
                              {...methods.register('customer.concession.concession')}
                              className={fieldClass(!!methods.formState.errors.customer?.concession?.concession)}
                              placeholder={
                                String(methods.watch('address.State') ?? '').trim()
                                  ? 'Loading types… or enter code'
                                  : 'Enter state above first, or type code'
                              }
                            />
                          )}
                          <FieldError
                            message={methods.formState.errors.customer?.concession?.concession?.message as string | undefined}
                          />
                        </div>
                        <div>
                          <label htmlFor="fe_concession_ref" className="block text-sm font-medium text-gray-700 mb-1">
                            Reference <RequiredMark />
                          </label>
                          <input
                            id="fe_concession_ref"
                            {...methods.register('customer.concession.reference')}
                            className={fieldClass(!!methods.formState.errors.customer?.concession?.reference)}
                          />
                          <FieldError
                            message={methods.formState.errors.customer?.concession?.reference?.message as string | undefined}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label htmlFor="fe_concession_issued" className="block text-sm font-medium text-gray-700 mb-1">
                              Issued on <RequiredMark />
                            </label>
                            <input
                              id="fe_concession_issued"
                              type="date"
                              {...methods.register('customer.concession.issued_on')}
                              className={fieldClass(!!methods.formState.errors.customer?.concession?.issued_on)}
                            />
                            <FieldError
                              message={methods.formState.errors.customer?.concession?.issued_on?.message as string | undefined}
                            />
                          </div>
                          <div>
                            <label htmlFor="fe_concession_expiry" className="block text-sm font-medium text-gray-700 mb-1">
                              Expiry <RequiredMark />
                            </label>
                            <input
                              id="fe_concession_expiry"
                              type="date"
                              {...methods.register('customer.concession.expires_on')}
                              className={fieldClass(!!methods.formState.errors.customer?.concession?.expires_on)}
                            />
                            <FieldError
                              message={methods.formState.errors.customer?.concession?.expires_on?.message as string | undefined}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="fe_concession_first" className="block text-sm font-medium text-gray-700 mb-1">
                            First name <RequiredMark />
                          </label>
                          <input
                            id="fe_concession_first"
                            {...methods.register('customer.concession.first_name')}
                            className={fieldClass(!!methods.formState.errors.customer?.concession?.first_name)}
                          />
                          <FieldError
                            message={methods.formState.errors.customer?.concession?.first_name?.message as string | undefined}
                          />
                        </div>
                        <div>
                          <label htmlFor="fe_concession_middle" className="block text-sm font-medium text-gray-700 mb-1">
                            Middle name (optional)
                          </label>
                          <input id="fe_concession_middle" {...methods.register('customer.concession.middle_name')} className={fieldClass(false)} />
                        </div>
                        <div>
                          <label htmlFor="fe_concession_last" className="block text-sm font-medium text-gray-700 mb-1">
                            Last name <RequiredMark />
                          </label>
                          <input
                            id="fe_concession_last"
                            {...methods.register('customer.concession.last_name')}
                            className={fieldClass(!!methods.formState.errors.customer?.concession?.last_name)}
                          />
                          <FieldError
                            message={methods.formState.errors.customer?.concession?.last_name?.message as string | undefined}
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {step === 3 ? (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Site</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="fe_fuel" className="block text-sm font-medium text-gray-700 mb-1">
                      Fuel <RequiredMark />
                    </label>
                    <select
                      id="fe_fuel"
                      {...methods.register('site.fuel_id')}
                      className={fieldClass(!!methods.formState.errors.site?.fuel_id)}
                    >
                      <option value={1}>Electricity</option>
                      <option value={2}>Gas</option>
                    </select>
                    <FieldError message={methods.formState.errors.site?.fuel_id?.message as string | undefined} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="fe_identifier" className="block text-sm font-medium text-gray-700 mb-1">
                      Identifier (NMI/MIRN) <RequiredMark />
                    </label>
                    <input
                      id="fe_identifier"
                      {...methods.register('site.identifier')}
                      className={fieldClass(!!methods.formState.errors.site?.identifier)}
                    />
                    <FieldError message={methods.formState.errors.site?.identifier?.message as string | undefined} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="fe_bill_frequency" className="block text-sm font-medium text-gray-700 mb-1">
                      Bill frequency (optional)
                    </label>
                    <select id="fe_bill_frequency" {...methods.register('site.bill_frequency')} className={fieldClass(!!methods.formState.errors.site?.bill_frequency)}>
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="GAS_MONTHLY">Gas monthly</option>
                      <option value="GAS">Gas</option>
                    </select>
                    <FieldError message={methods.formState.errors.site?.bill_frequency?.message as string | undefined} />
                  </div>
                  <div className="flex items-end gap-6 sm:col-span-2">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" {...methods.register('site.is_owner')} className="rounded border-gray-300" />
                      Property owner
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" {...methods.register('site.has_basic_meter')} className="rounded border-gray-300" />
                      Basic meter
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-3">
                    <label htmlFor="fe_transfer_instructions" className="block text-sm font-medium text-gray-700 mb-1">
                      Transfer instructions (optional)
                    </label>
                    <textarea
                      id="fe_transfer_instructions"
                      rows={3}
                      {...methods.register('site.transfer_instructions')}
                      className={fieldClass(false)}
                      placeholder="Any special instructions for the transfer…"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="fe_usage_start" className="block text-sm font-medium text-gray-700 mb-1">
                      Usage start date (optional)
                    </label>
                    <input id="fe_usage_start" type="date" {...methods.register('site.usage_start_date')} className={fieldClass(false)} />
                  </div>
                  <div>
                    <label htmlFor="fe_usage_end" className="block text-sm font-medium text-gray-700 mb-1">
                      Usage end date (optional)
                    </label>
                    <input id="fe_usage_end" type="date" {...methods.register('site.usage_end_date')} className={fieldClass(false)} />
                  </div>
                  <div>
                    <label htmlFor="fe_existing_account" className="block text-sm font-medium text-gray-700 mb-1">
                      Existing account number (optional)
                    </label>
                    <input id="fe_existing_account" {...methods.register('site.existing_account_number')} className={fieldClass(false)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="fe_offer_id" className="block text-sm font-medium text-gray-700 mb-1">
                      Offer ID <RequiredMark />
                    </label>
                    <input
                      id="fe_offer_id"
                      type="number"
                      {...methods.register('site.offer_id')}
                      className={fieldClass(!!methods.formState.errors.site?.offer_id)}
                    />
                    <FieldError message={methods.formState.errors.site?.offer_id?.message as string | undefined} />
                    <p className="mt-1 text-xs text-gray-500">This is `siteOffer.offer_id` from the 1st Energy pricing APIs.</p>
                  </div>
                  <div className="flex items-end gap-6">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" {...methods.register('site.has_solar')} className="rounded border-gray-300" />
                      Solar
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        {...methods.register('site.has_interest_on_solar')}
                        className="rounded border-gray-300"
                      />
                      Interested in solar
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        {...methods.register('site.has_medical_cooling')}
                        className="rounded border-gray-300"
                      />
                      Medical cooling
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="fe_feed_in_type_id" className="block text-sm font-medium text-gray-700 mb-1">
                      Feed-in type ID (optional)
                    </label>
                    <input id="fe_feed_in_type_id" type="number" {...methods.register('site.feed_in_type_id')} className={fieldClass(false)} />
                  </div>
                  <div>
                    <label htmlFor="fe_greenpower_id" className="block text-sm font-medium text-gray-700 mb-1">
                      Greenpower ID (optional)
                    </label>
                    <input id="fe_greenpower_id" type="number" {...methods.register('site.selected_greenpower_id')} className={fieldClass(false)} />
                  </div>
                  <div>
                    <label htmlFor="fe_vsi_time" className="block text-sm font-medium text-gray-700 mb-1">
                      VSI time (optional)
                    </label>
                    <select id="fe_vsi_time" {...methods.register('site.vsi_time')} className={fieldClass(false)}>
                      <option value="09:00">09:00</option>
                      <option value="10:00">10:00</option>
                      <option value="11:00">11:00</option>
                      <option value="12:00">12:00</option>
                      <option value="13:00">13:00</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="fe_vsi_method" className="block text-sm font-medium text-gray-700 mb-1">
                      VSI method (optional)
                    </label>
                    <input id="fe_vsi_method" {...methods.register('site.vsi_method')} className={fieldClass(false)} placeholder="e.g. customer_on_site" />
                  </div>
                  <div />
                  <div />
                </div>

                {values.type === 'MoveIn' ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                      <label htmlFor="fe_movein_date" className="block text-sm font-medium text-gray-700 mb-1">
                        Move-in start date <RequiredMark />
                      </label>
                      {moveInDateOptions.length ? (
                        <select
                          id="fe_movein_date"
                          {...methods.register('site.start_date')}
                          className={fieldClass(!!methods.formState.errors.site?.start_date)}
                        >
                          <option value="">Select…</option>
                          {moveInDateOptions.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id="fe_movein_date"
                          type="date"
                          {...methods.register('site.start_date')}
                          className={fieldClass(!!methods.formState.errors.site?.start_date)}
                        />
                      )}
                      <FieldError message={methods.formState.errors.site?.start_date?.message as string | undefined} />
                    </div>
                    <div className="flex items-end">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          {...methods.register('site.move_in_terms_accepted')}
                          className="rounded border-gray-300"
                        />
                        Move-in terms accepted
                      </label>
                    </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="flex items-end">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" {...methods.register('site.is_mains_switch_off')} className="rounded border-gray-300" />
                          Mains switch off
                        </label>
                      </div>
                      <div className="flex items-end">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            {...methods.register('site.is_electricity_disconnected_period')}
                            className="rounded border-gray-300"
                          />
                          Disconnected period
                        </label>
                      </div>
                      <div className="flex items-end">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" {...methods.register('site.has_ecoc')} className="rounded border-gray-300" />
                          ECOC available
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="flex items-end">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" {...methods.register('site.are_any_building_works')} className="rounded border-gray-300" />
                          Any building works
                        </label>
                      </div>
                      <div className="flex items-end">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" {...methods.register('site.has_meter_access')} className="rounded border-gray-300" />
                          Meter access
                        </label>
                      </div>
                      <div />
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {step === 4 ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Review</h2>
                    <p className="text-sm text-gray-500 mt-1">Preview the payload that will be submitted to `/accounts`.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePreview}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-700 bg-white border border-primary-200 rounded-lg hover:bg-primary-50 cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                </div>
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto max-h-[420px]">
                  {JSON.stringify(buildAccountPayload(methods.getValues()), null, 2)}
                </pre>
              </section>
            ) : null}
          </form>
        </FormProvider>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handlePrev}
            disabled={step === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 cursor-pointer"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Create account
                </>
              )}
            </button>
          )}
        </div>

        {previewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              onClick={() => setPreviewOpen(false)}
              aria-label="Close preview"
            />
            <div className="relative w-full max-w-5xl max-h-[85vh] overflow-hidden rounded-2xl bg-white border border-gray-200 shadow-xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Payload preview</p>
                    <p className="text-xs text-gray-500">This is what will be submitted to 1st Energy.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => setPreviewOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="p-5 overflow-auto max-h-[calc(85vh-64px)]">
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto">
                  {JSON.stringify(previewPayload ?? buildAccountPayload(methods.getValues()), null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
