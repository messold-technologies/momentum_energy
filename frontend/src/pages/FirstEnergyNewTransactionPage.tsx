import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FormProvider, useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Building2, Save, Send } from 'lucide-react';
import { draftsApi, firstEnergyApi } from '../lib/api';
import { getApiErrorMessage } from '../lib/errorMessage';
import Stepper from '../components/ui/Stepper';
import {
  FIRST_ENERGY_WIZARD_STEPS,
  formSchema,
  defaultValues,
  type FormValues,
} from './first-energy/firstEnergyFormSchema';
import {
  buildAccountPayload,
  normalizeIndustryTypes,
  parseBusinessNameResults,
  numOrUndef,
  pickFirstAbnSearchHit,
  pickStr,
  firstNmiResultRow,
  parseGstDateToIso,
} from './first-energy/firstEnergyPayload';
import { FirstEnergyWizardProvider, type FirstEnergyWizardContextValue } from './first-energy/FirstEnergyWizardContext';
import { FirstEnergyStepSale } from './first-energy/steps/FirstEnergyStepSale';
import { FirstEnergyStepCustomer } from './first-energy/steps/FirstEnergyStepCustomer';
import { FirstEnergyStepAddress } from './first-energy/steps/FirstEnergyStepAddress';
import { FirstEnergyStepSite } from './first-energy/steps/FirstEnergyStepSite';
import { FirstEnergyStepReview } from './first-energy/steps/FirstEnergyStepReview';

const COMPANY_ID = 'first-energy' as const;
const DRAFT_KEY = 'first_energy_draft_account';


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
  const [businessNameHits, setBusinessNameHits] = useState<Array<{ abn: string; name: string; state?: string; postcode?: string }>>([]);
  const [businessNameLoading, setBusinessNameLoading] = useState(false);
  const [orgNameSuggestionsOpen, setOrgNameSuggestionsOpen] = useState(false);
  const [organisationTypeDescription, setOrganisationTypeDescription] = useState('');
  const [abnValidated, setAbnValidated] = useState(false);
  const [acnValidated, setAcnValidated] = useState(false);
  const [industryTypes, setIndustryTypes] = useState<Array<{ id: number; label: string }>>([]);
  const [meterLookupLoading, setMeterLookupLoading] = useState(false);
  const [meterLookupMessage, setMeterLookupMessage] = useState<string | null>(null);
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
        const [st, ct, idt, industryTypesRes, moveInDatesRes] = await Promise.all([
          firstEnergyApi.lookups.saleTypes(),
          firstEnergyApi.lookups.customerTitles(),
          firstEnergyApi.proxy.get('identification'),
          firstEnergyApi.proxy.get('industry-types'),
          firstEnergyApi.proxy.get('move-in-date'),
        ]);
        if (!mounted) return;
        setSaleTypes(Array.isArray(st.data) ? st.data : []);
        const rawTitles = ct.data && typeof ct.data === 'object' ? Object.keys(ct.data) : [];
        setTitles(rawTitles);
        const rawIdTypes = idt?.data && typeof idt.data === 'object' ? Object.keys(idt.data as Record<string, unknown>) : [];
        setIdentificationTypes(rawIdTypes.length ? rawIdTypes : ['DriversLicence', 'MedicareCard', 'Passport', 'Plus18Card']);

        setIndustryTypes(normalizeIndustryTypes(industryTypesRes?.data));
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

  // Organisation name → ABN register search (debounced)
  useEffect(() => {
    const name = String(values.organisation?.name ?? '').trim();
    if (values.property_type !== 'COMPANY' || name.length < 2) {
      setBusinessNameHits([]);
      return;
    }
    let cancelled = false;
    const t = globalThis.setTimeout(async () => {
      setBusinessNameLoading(true);
      try {
        const res = await firstEnergyApi.proxy.get('abn-lookup/search-business-name', { term: name });
        if (cancelled) return;
        setBusinessNameHits(parseBusinessNameResults(res?.data));
      } catch {
        if (!cancelled) setBusinessNameHits([]);
      } finally {
        if (!cancelled) setBusinessNameLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(t);
    };
  }, [values.organisation?.name, values.property_type]);

  useEffect(() => {
    if (values.property_type !== 'COMPANY') {
      setBusinessNameHits([]);
      setOrgNameSuggestionsOpen(false);
      setOrganisationTypeDescription('');
      setAbnValidated(false);
      setAcnValidated(false);
      methods.setValue('organisation.requires_acn', true, { shouldDirty: false });
    }
  }, [values.property_type]);

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

  function applySearchAbnHit(hit: Record<string, unknown>) {
    const desc =
      (typeof hit.OrganisationTypeDescription === 'string' && hit.OrganisationTypeDescription.trim()) ||
      (typeof hit.organisationTypeDescription === 'string' && hit.organisationTypeDescription.trim()) ||
      '';
    setOrganisationTypeDescription(desc);

    const typeId = numOrUndef(hit.OrganisationTypeId ?? hit.organisationTypeId ?? hit.organisation_type_id);
    if (typeId) {
      methods.setValue('organisation.organisation_type_id', typeId, { shouldValidate: true, shouldDirty: true });
    } else {
      methods.setValue('organisation.organisation_type_id', 0, { shouldValidate: true, shouldDirty: true });
    }

    if (typeof hit.RequiresAcn === 'boolean') {
      methods.setValue('organisation.requires_acn', hit.RequiresAcn, { shouldValidate: true, shouldDirty: true });
    } else if (typeof hit.requiresAcn === 'boolean') {
      methods.setValue('organisation.requires_acn', hit.requiresAcn, { shouldValidate: true, shouldDirty: true });
    }

    const acnRaw = hit.Acn ?? hit.ACN ?? hit.acn;
    if (typeof acnRaw === 'string') {
      const acnDigits = acnRaw.replace(/\D/g, '');
      if (acnDigits.length === 9) {
        methods.setValue('organisation.acn', acnDigits, { shouldValidate: true, shouldDirty: true });
        void validateAcn(acnDigits);
      }
    }

    const gstRaw = hit.Gst ?? hit.GST ?? hit.gst_registered_at ?? hit.GstRegisteredAt;
    if (typeof gstRaw === 'string' && gstRaw.trim()) {
      const iso = parseGstDateToIso(gstRaw);
      if (iso) methods.setValue('organisation.gst_registered_at', iso, { shouldValidate: true, shouldDirty: true });
    }

    const entity =
      (typeof hit.EntityName === 'string' && hit.EntityName.trim()) ||
      (typeof hit.entityName === 'string' && hit.entityName.trim()) ||
      '';
    if (entity) {
      methods.setValue('organisation.trading_name', entity, { shouldValidate: true, shouldDirty: true });
    } else {
      methods.setValue('organisation.trading_name', '', { shouldValidate: true, shouldDirty: true });
    }

    void methods.trigger('organisation.acn');
  }

  async function runAbnValidationAndEnrichment(abnInput: string) {
    const term = abnInput.replace(/\D/g, '');
    if (!term) {
      setAbnValidated(false);
      setAbnMessage(null);
      setOrganisationTypeDescription('');
      methods.setValue('organisation.requires_acn', true, { shouldDirty: true });
      methods.setValue('organisation.organisation_type_id', 0, { shouldDirty: true });
      methods.setValue('organisation.trading_name', '', { shouldDirty: true });
      return;
    }
    setAbnChecking(true);
    setAbnMessage(null);
    setAbnValidated(false);
    try {
      const valRes = await firstEnergyApi.proxy.get('abn-lookup/validate-abn', { abn: term });
      const d = valRes?.data as Record<string, unknown> | undefined;
      const valid = d?.valid === true || d?.is_valid === true;
      if (!valid) {
        setAbnMessage(typeof d?.message === 'string' && d.message.trim() ? d.message : 'ABN is not valid.');
        setOrganisationTypeDescription('');
        methods.setValue('organisation.requires_acn', true, { shouldDirty: true });
        methods.setValue('organisation.organisation_type_id', 0, { shouldDirty: true });
        methods.setValue('organisation.trading_name', '', { shouldDirty: true });
        return;
      }
      setAbnValidated(true);
      setAbnMessage('ABN validated.');

      const searchRes = await firstEnergyApi.proxy.get('abn-lookup/search-abn', { term }).catch(() => null);
      const hit = searchRes ? pickFirstAbnSearchHit(searchRes.data) : null;
      if (hit && typeof hit === 'object') applySearchAbnHit(hit as Record<string, unknown>);
      else {
        setOrganisationTypeDescription('');
        methods.setValue('organisation.requires_acn', true, { shouldDirty: true });
        methods.setValue('organisation.organisation_type_id', 0, { shouldDirty: true });
        methods.setValue('organisation.trading_name', '', { shouldValidate: true, shouldDirty: true });
      }
    } catch (e) {
      setAbnValidated(false);
      methods.setValue('organisation.requires_acn', true, { shouldDirty: true });
      setAbnMessage(getApiErrorMessage(e, 'ABN validation failed.'));
    } finally {
      setAbnChecking(false);
    }
  }

  function selectBusinessNameHit(hit: { abn: string; name: string }) {
    methods.setValue('organisation.trading_name', '', { shouldDirty: true, shouldValidate: true });
    methods.setValue('organisation.name', hit.name, { shouldDirty: true, shouldValidate: true });
    methods.setValue('organisation.abn', hit.abn, { shouldDirty: true, shouldValidate: true });
    setBusinessNameHits([]);
    setOrgNameSuggestionsOpen(false);
    void runAbnValidationAndEnrichment(hit.abn);
  }

  async function validateAcn(acn: string) {
    const trimmed = acn.trim();
    if (!trimmed) {
      setAcnMessage(null);
      setAcnValidated(false);
      return;
    }
    const term = trimmed.replace(/\D/g, '');
    setAcnChecking(true);
    setAcnMessage(null);
    setAcnValidated(false);
    try {
      const valRes = await firstEnergyApi.proxy.get('abn-lookup/validate-acn', { acn: term || trimmed });
      const d = valRes?.data as Record<string, unknown> | undefined;
      const ok = d?.valid === true || d?.is_valid === true;
      setAcnValidated(!!ok);
      setAcnMessage(
        ok ? 'ACN validated.' : typeof d?.message === 'string' && d.message.trim() ? d.message : 'ACN could not be validated.'
      );
    } catch (e) {
      setAcnValidated(false);
      setAcnMessage(getApiErrorMessage(e, 'ACN validation failed.'));
    } finally {
      setAcnChecking(false);
    }
  }

  async function lookupMeterIdentifier() {
    const fuelId = Number(methods.getValues('site.fuel_id'));
    const idRaw = String(methods.getValues('site.identifier') ?? '').trim();
    const state = String(methods.getValues('address.State') ?? '').trim();
    setMeterLookupMessage(null);
    if (!idRaw) {
      setMeterLookupMessage('Enter the NMI or MIRN first.');
      return;
    }
    if (fuelId === 2 && !state) {
      setMeterLookupMessage('Add the site state on the Address step (or enter State) — it is required for MIRN lookup.');
      return;
    }
    const cleaned = idRaw.replace(/\s+/g, '');
    setMeterLookupLoading(true);
    try {
      const params: Record<string, string> =
        fuelId === 2
          ? { Meter: cleaned, State: state }
          : { nmi: cleaned, ...(state ? { State: state } : {}) };
      const res = await firstEnergyApi.proxy.get('nmi-lookup', params);
      const row = firstNmiResultRow(res?.data);
      if (!row) {
        setMeterLookupMessage('No results for that identifier.');
        return;
      }
      const sn = pickStr(row, 'StreetNumber', 'streetNumber', 'street_number');
      const snSuffix = pickStr(row, 'StreetNumberSuffix', 'streetNumberSuffix');
      const name = pickStr(row, 'StreetName', 'streetName', 'street_name');
      const typ = pickStr(row, 'StreetType', 'streetType', 'street_type');
      const suburb = pickStr(row, 'Suburb', 'suburb', 'Locality', 'locality');
      const st = pickStr(row, 'State', 'state');
      const pc = pickStr(row, 'PostCode', 'postCode', 'postcode', 'Postcode');
      const line = pickStr(row, 'street_address', 'StreetAddress', 'formattedAddress', 'addressLine', 'AddressLine1');
      if (sn) methods.setValue('address.StreetNumber', snSuffix ? `${sn}${snSuffix}` : sn, { shouldDirty: true });
      else if (snSuffix) methods.setValue('address.StreetNumber', snSuffix, { shouldDirty: true });
      if (name) methods.setValue('address.StreetName', name, { shouldDirty: true });
      if (typ) methods.setValue('address.StreetType', typ, { shouldDirty: true });
      if (suburb) methods.setValue('address.Suburb', suburb, { shouldDirty: true });
      if (st) methods.setValue('address.State', st, { shouldDirty: true });
      if (pc) methods.setValue('address.PostCode', pc, { shouldDirty: true });
      if (line) methods.setValue('address.street_address', line, { shouldDirty: true });
      const basicRaw = row.hasBasicMeter ?? row.has_basic_meter ?? row.BasicMeter ?? row.basicMeter;
      if (typeof basicRaw === 'boolean') methods.setValue('site.has_basic_meter', basicRaw, { shouldDirty: true });
      setMeterLookupMessage('Lookup succeeded — address fields were updated where the API returned them. Review the Address step.');
    } catch (e) {
      setMeterLookupMessage(getApiErrorMessage(e, 'NMI/MIRN lookup failed.'));
    } finally {
      setMeterLookupLoading(false);
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
      // Hide suggestions after a selection is made.
      setAddressSuggestions([]);
      setAddressSearching(false);
      methods.setValue('addressSearchTerm', '', { shouldDirty: true });
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
    setStep((s) => Math.min(s + 1, FIRST_ENERGY_WIZARD_STEPS.length - 1));
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

  const wizardValue: FirstEnergyWizardContextValue = {
    loadingLookups,
    saleTypes,
    industryTypes,
    titles,
    identificationTypes,
    values,
    validatePromoCode,
    promoChecking,
    promoMessage,
    businessNameHits,
    businessNameLoading,
    orgNameSuggestionsOpen,
    setOrgNameSuggestionsOpen,
    organisationTypeDescription,
    selectBusinessNameHit,
    runAbnValidationAndEnrichment,
    abnChecking,
    abnValidated,
    validateAcn,
    acnChecking,
    acnValidated,
    abnMessage,
    acnMessage,
    addressSearching,
    suggestionOptions,
    handlePickAddress,
    suburbOptions,
    postcodeLoading,
    concessionOptions,
    concessionLoading,
    meterLookupLoading,
    meterLookupMessage,
    lookupMeterIdentifier,
    moveInDateOptions,
    buildAccountPayload,
    handlePreview,
  };

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

      <Stepper steps={[...FIRST_ENERGY_WIZARD_STEPS]} currentStep={step} />

      <div className="bg-white rounded-xl border border-gray-200 p-6 lg:p-8">
        <FormProvider {...methods}>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
            <FirstEnergyWizardProvider value={wizardValue}>
              {step === 0 ? <FirstEnergyStepSale /> : null}
              {step === 1 ? <FirstEnergyStepCustomer /> : null}
              {step === 2 ? <FirstEnergyStepAddress /> : null}
              {step === 3 ? <FirstEnergyStepSite /> : null}
              {step === 4 ? <FirstEnergyStepReview /> : null}
            </FirstEnergyWizardProvider>
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

          {step < FIRST_ENERGY_WIZARD_STEPS.length - 1 ? (
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
