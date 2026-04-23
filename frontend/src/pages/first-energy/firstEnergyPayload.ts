import type { FormValues } from './firstEnergyFormSchema';

export function toBoolInt(v: boolean) {
  return v ? 1 : 0;
}

export function buildAddress(v: FormValues) {
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

export function extractArrayPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const inner =
      (data as Record<string, unknown>).data ??
      (data as Record<string, unknown>).results ??
      (data as Record<string, unknown>).items;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

export function parseBusinessNameResults(data: unknown): Array<{ abn: string; name: string; state?: string; postcode?: string }> {
  const rows = extractArrayPayload(data);
  const out: Array<{ abn: string; name: string; state?: string; postcode?: string }> = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const abnRaw = o.Abn ?? o.abn;
    const nameRaw = o.Name ?? o.name;
    if (typeof abnRaw !== 'string' || typeof nameRaw !== 'string') continue;
    const abn = abnRaw.replace(/\D/g, '');
    if (abn.length < 11) continue;
    const state = typeof o.State === 'string' ? o.State.trim() : undefined;
    const postcode = typeof o.Postcode === 'string' ? o.Postcode.trim() : undefined;
    out.push({ abn, name: nameRaw.trim(), state, postcode });
  }
  return out;
}

export function numOrUndef(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.trunc(v);
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
    const n = Number(v.trim());
    if (n > 0) return n;
  }
  return undefined;
}

export function normalizeIndustryTypes(raw: unknown): Array<{ id: number; label: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => {
      if (it && typeof it === 'object') {
        const o = it as Record<string, unknown>;
        const id = Number(o.id ?? o.ID);
        const label =
          (typeof o.description === 'string' && o.description) ||
          (typeof o.name === 'string' && o.name) ||
          (typeof o.code === 'string' && o.code) ||
          String(id);
        if (!Number.isFinite(id) || id <= 0) return null;
        return { id, label };
      }
      return null;
    })
    .filter((x): x is { id: number; label: string } => !!x);
}

export function pickStr(r: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

export function firstNmiResultRow(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (Array.isArray(data)) {
    const first = data.find((x) => x && typeof x === 'object') as Record<string, unknown> | undefined;
    return first ?? null;
  }
  if (typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const nested = o.results ?? o.data ?? o.items ?? o.nmis ?? o.Nmis;
  if (Array.isArray(nested)) {
    const first = nested.find((x) => x && typeof x === 'object') as Record<string, unknown> | undefined;
    if (first) return first;
  }
  return o;
}

export function pickFirstAbnSearchHit(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (Array.isArray(data)) {
    const first = data.find((x) => x && typeof x === 'object') as Record<string, unknown> | undefined;
    return first ?? null;
  }
  if (typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const nested = o.results ?? o.data ?? o.items;
  if (Array.isArray(nested)) {
    const first = nested.find((x) => x && typeof x === 'object') as Record<string, unknown> | undefined;
    if (first) return first;
  }
  return o;
}

export function parseGstDateToIso(raw: string): string | null {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    return `${m[3]}-${mo}-${d}`;
  }
  const parsed = Date.parse(t);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return null;
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

type PricingQueryLike = {
  latitude?: number;
  longitude?: number;
  nmi_status?: string;
  has_basic_meter?: boolean;
};

export function buildAccountPayload(v: FormValues, pricingQuery?: PricingQueryLike | null): Record<string, unknown> {
  const address = buildAddress(v) as Record<string, unknown>;
  if (pricingQuery?.nmi_status && typeof pricingQuery.nmi_status === 'string') {
    address.nmiStatus = pricingQuery.nmi_status;
  }
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
        ? (() => {
            const orgTypeId = v.organisation?.organisation_type_id;
            const indId = v.organisation?.industry_type_id;
            const orgTypeOk = typeof orgTypeId === 'number' && orgTypeId > 0;
            const indOk = typeof indId === 'number' && indId > 0;
            return {
              name: v.organisation?.name || null,
              trading_name: v.organisation?.trading_name || null,
              trustee_name: v.organisation?.trustee_name || null,
              organisation_type_id: orgTypeOk ? orgTypeId : null,
              organisationType: orgTypeOk ? { id: orgTypeId } : {},
              abn: v.organisation?.abn || null,
              acn: v.organisation?.acn || null,
              gst_registered_at: v.organisation?.gst_registered_at || null,
              industry_type_id: indOk ? indId : null,
              industryType: indOk ? { id: indId } : {},
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
            };
          })()
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
        latitude: typeof pricingQuery?.latitude === 'number' ? pricingQuery.latitude : null,
        longitude: typeof pricingQuery?.longitude === 'number' ? pricingQuery.longitude : null,
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
        feed_in_type_id: typeof v.site.feed_in_type_id === 'number' && v.site.feed_in_type_id > 0 ? v.site.feed_in_type_id : null,
        selected_greenpower_id:
          typeof v.site.selected_greenpower_id === 'number' && v.site.selected_greenpower_id > 0 ? v.site.selected_greenpower_id : null,
        selectedGreenpower: {},
        vsi_time: v.site.vsi_time ?? null,
        vsi_method: v.site.vsi_method ?? null,
        existing_account_number: v.site.existing_account_number ?? null,
        has_basic_meter: toBoolInt((typeof pricingQuery?.has_basic_meter === 'boolean' ? pricingQuery.has_basic_meter : v.site.has_basic_meter) === true),
        is_mains_switch_off: toBoolInt(v.site.is_mains_switch_off === true),
        is_electricity_disconnected_period: toBoolInt(v.site.is_electricity_disconnected_period === true),
        has_ecoc: toBoolInt(v.site.has_ecoc === true),
        are_any_building_works: toBoolInt(v.site.are_any_building_works === true),
        has_meter_access: toBoolInt(v.site.has_meter_access === true),
      },
    ],
  };
}
