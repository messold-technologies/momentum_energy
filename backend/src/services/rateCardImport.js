/**
 * Rate card import, shared by the CLI (scripts/importRateCard.js) and the admin upload
 * endpoint, so both behave identically and there is one place to fix a parsing bug.
 *
 * Reads the "(c)" sheets, so rates come through as cents and GST-inclusive.
 */
import ExcelJS from 'exceljs';
import pg from 'pg';

import config from '../config/index.js';
import {
  str,
  num,
  dateOnly,
  bool,
  normalisePlan,
  normaliseCustomerType,
  normaliseEnergyType,
  cdrPlanId,
  collectRates,
  collectPrefixed,
  readSheet,
} from '../utils/rateCardParse.js';

/** Sheets the workbook must contain. Checked up front so a wrong file fails clearly. */
const REQUIRED_SHEETS = [
  'Offers',
  'All_Channels_Elec (c)',
  'All_Channels_Gas (c)',
  'Postcodes_Elec',
  'Postcodes_Gas',
  'Electricity_Tariff_Map',
  'Gas_Tariff_Map',
  'NMI MIRN Networks',
];

export class RateCardImportError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'RateCardImportError';
    this.details = details;
  }
}

/* ----------------------------------------------------------------- parsers */

export function parseOffers(wb, versionId) {
  const ws = wb.getWorksheet('Offers');
  if (!ws) return [];
  const { rows } = readSheet(ws, 1);

  return rows
    .filter((r) => normalisePlan(r['Offer_Display_Name']))
    .map((r) => {
      const features = [];
      for (let i = 1; i <= 10; i += 1) {
        const heading = str(r[`Feature_Heading_${i}`]);
        const text = str(r[`Feature_Text_${i}`]);
        if (heading || text) features.push({ heading, text });
      }
      const states = (str(r['State_Availability']) || '')
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      return {
        version_id: versionId,
        plan_code: normalisePlan(r['Offer_Display_Name']),
        energy_type: normaliseEnergyType(r['Energy_Type']),
        provider_id: str(r['Provider_ID']),
        offer_number: str(r['Offer_Number']),
        state_availability: states.length ? states : null,
        customer_type: str(r['Customer_Type']),
        customer_eligibility: str(r['Customer_Eligibility']),
        contract_term: str(r['Contract_Term']),
        features: features.length ? JSON.stringify(features) : null,
        termination_fee: str(r['Termination_Fee']),
        dishonoured_payment_fee: str(r['Dishonoured_Payment_Fee']),
        credit_card_payment_fee: str(r['Credit_Card_Payment_Fee']),
        billing_options: str(r['Billing_Options']),
        payment_options: str(r['Payment_Options']),
        green_options: str(r['Green_Options']),
        terms_and_conditions: str(r['Terms_and_Conditions']),
        extras: JSON.stringify({
          renewableEnergyPlans: str(r['Renewable_energy_plans']),
          billSmoothing: str(r['Bill_smoothing']),
          onlineAccountManagement: str(r['Online_account_management']),
          contractTypeHeading: str(r['Contract_Type_Heading']),
          contractTextHeading2: str(r['Contract_Text_Heading2']),
        }),
      };
    });
}

export function parseRates(wb, versionId, sheetName, energyType) {
  const ws = wb.getWorksheet(sheetName);
  if (!ws) throw new RateCardImportError(`Sheet not found: ${sheetName}`);
  const { rows, headers } = readSheet(ws, 1);

  // Gas calls it "Offer Display Name", electricity "Offer: Offer Display Name".
  const planHeader = headers.includes('Offer: Offer Display Name')
    ? 'Offer: Offer Display Name'
    : 'Offer Display Name';

  const out = [];
  const skipped = [];

  for (const r of rows) {
    const offerCode = str(r['Offer_With_Rate_ID']);
    if (!offerCode) continue; // trailing blank / "OTHER" filler rows carry no offer

    const state = str(r['State']);
    const planCode = normalisePlan(r[planHeader]) || normalisePlan(r['Price Item: Unique Name']);
    const retailTariff = str(r['Retail_Tariff_Code']);
    const network = str(r['Network_Name']);
    const customerType = normaliseCustomerType(r['Customer_Type']);

    if (!planCode || !retailTariff || !network || !state || !customerType) {
      skipped.push({ offerCode, reason: 'missing key field' });
      continue;
    }

    const code = str(r['Code']);

    out.push({
      version_id: versionId,
      offer_code: offerCode,
      offer_with_rate_number: str(r['Offer_With_Rate_Number']),
      offer_number: str(r['Offer_Number']),
      plan_code: planCode,
      price_item_name: str(r['Price Item: Unique Name']),
      energy_type: energyType,
      state: state.toUpperCase(),
      network_name: network,
      network_zone: str(r['Network_Zone']),
      retail_tariff_code: retailTariff,
      customer_type: customerType,
      effective_start: dateOnly(r['Effective_Start_Date']),
      effective_end: dateOnly(r['Effective_End_Date']),
      daily_charge: num(r['Daily_Charge']),
      rates: JSON.stringify(collectRates(r, headers)),
      solar: JSON.stringify(collectPrefixed(r, headers, 'Solar_')),
      demand: JSON.stringify(collectPrefixed(r, headers, 'Demand_')),
      cdr_plan_code: code,
      cdr_plan_id: cdrPlanId(code, state),
      bpid_url: str(r['BPID Link/VEFS']),
      benchmark_tariff_type: str(r['Default Offer Benchmark Tariff Type']),
      benchmark_kwh: num(r['Default Offer Benchmark kWh'], 0),
      benchmark_cost: num(r['Default Offer Benchmark Cost GST incl'], 2),
      momentum_cost: num(r['Default Offer Momentum Cost GST incl'], 2),
      difference_dollar: num(r['Default Offer Difference Dollar GST incl'], 2),
      difference_percent: num(r['Default Offer Difference Percent'], 4),
      tariff_category: str(r['Tariff Category']),
    });
  }

  return { rows: out, skipped };
}

export function parsePostcodes(wb, versionId) {
  const out = [];

  const elec = wb.getWorksheet('Postcodes_Elec');
  if (elec) {
    for (const r of readSheet(elec, 1).rows) {
      const postcode = str(r['Postcode']);
      const network = str(r['Network']);
      if (!postcode || !network) continue;
      out.push({
        version_id: versionId,
        energy_type: 'ELECTRICITY',
        postcode,
        network_name: network,
        network_zone: null,
        is_default: bool(r['Default Network']),
      });
    }
  }

  const gas = wb.getWorksheet('Postcodes_Gas');
  if (gas) {
    for (const r of readSheet(gas, 1).rows) {
      const postcode = str(r['Postcode']);
      const network = str(r['Network_Name']);
      if (!postcode || !network) continue;
      out.push({
        version_id: versionId,
        energy_type: 'GAS',
        postcode,
        network_name: network,
        network_zone: str(r['Network_Zone']),
        // Gas has no default-network column: ambiguous postcodes are resolved by the
        // agent picking, not by guessing here.
        is_default: false,
      });
    }
  }

  return out;
}

export function parseTariffMaps(wb, versionId) {
  const out = [];

  // Header sits on row 2; row 1 holds an "Updated: dd/mm/yyyy" note.
  const elec = wb.getWorksheet('Electricity_Tariff_Map');
  if (elec) {
    for (const r of readSheet(elec, 2).rows) {
      const network = str(r['Network_Name']);
      const retail = str(r['Retail_Tariff_Code']);
      if (!network || !retail) continue;
      out.push({
        version_id: versionId,
        energy_type: 'ELECTRICITY',
        network_name: network,
        tariff_combination_key: str(r['Tariff_Combination_Key']),
        network_zone: null,
        customer_type: null,
        retail_tariff_code: retail,
        solar_applicable: bool(r['Solar Applicable']),
        solar_scheme: str(r['Solar scheme']),
      });
    }
  }

  const gas = wb.getWorksheet('Gas_Tariff_Map');
  if (gas) {
    for (const r of readSheet(gas, 1).rows) {
      const network = str(r['Network_Name']);
      const retail = str(r['Retail_Tariff_Code']);
      if (!network || !retail) continue;
      out.push({
        version_id: versionId,
        energy_type: 'GAS',
        network_name: network,
        tariff_combination_key: null,
        network_zone: str(r['Network_Zone']),
        customer_type: normaliseCustomerType(r['Customer_Type']),
        retail_tariff_code: retail,
        solar_applicable: null,
        solar_scheme: null,
      });
    }
  }

  return out;
}

export function parseNmiPrefixes(wb, versionId) {
  const ws = wb.getWorksheet('NMI MIRN Networks');
  if (!ws) return [];
  return readSheet(ws, 1)
    .rows.map((r) => ({
      version_id: versionId,
      prefix: str(r['Prefix']),
      energy_type: normaliseEnergyType(r['Energy_Type']),
      network_name: str(r['Network_Name']),
    }))
    .filter((r) => r.prefix && r.network_name);
}

/* ------------------------------------------------------------- bulk insert */

async function bulkInsert(client, table, columns, rows, chunkSize = 400) {
  if (!rows.length) return 0;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const params = [];
    const tuples = chunk.map((r) => {
      const ph = columns.map((_, c) => `$${params.length + c + 1}`);
      params.push(...columns.map((c) => (r[c] === undefined ? null : r[c])));
      return `(${ph.join(',')})`;
    });
    await client.query(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES ${tuples.join(',')}`,
      params
    );
    inserted += chunk.length;
  }
  return inserted;
}

/* ---------------------------------------------------------------- workbook */

/** Load from a path (CLI) or a buffer (upload), and check it is the right workbook. */
export async function loadWorkbook({ filePath, buffer }) {
  const wb = new ExcelJS.Workbook();
  try {
    if (buffer) await wb.xlsx.load(buffer);
    else await wb.xlsx.readFile(filePath);
  } catch {
    throw new RateCardImportError(
      'That file could not be read as an Excel workbook. Upload the .xlsx master template.'
    );
  }

  const present = wb.worksheets.map((w) => w.name);
  const missing = REQUIRED_SHEETS.filter((s) => !present.includes(s));
  if (missing.length) {
    throw new RateCardImportError(
      `This does not look like the master template. Missing sheet${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
      { missing, present }
    );
  }
  return wb;
}

/** Parse everything without touching the database. */
export function parseWorkbook(wb, versionId) {
  const plans = parseOffers(wb, versionId);
  const elec = parseRates(wb, versionId, 'All_Channels_Elec (c)', 'ELECTRICITY');
  const gas = parseRates(wb, versionId, 'All_Channels_Gas (c)', 'GAS');
  const postcodes = parsePostcodes(wb, versionId);
  const tariffs = parseTariffMaps(wb, versionId);
  const prefixes = parseNmiPrefixes(wb, versionId);
  const rateRows = [...elec.rows, ...gas.rows];

  // An offer code must be unique within a version, else the resolver is ambiguous and an
  // agent could submit a code that does not match the price the customer agreed to.
  const seen = new Set();
  const dupes = [];
  for (const r of rateRows) {
    if (seen.has(r.offer_code)) dupes.push(r.offer_code);
    seen.add(r.offer_code);
  }
  if (dupes.length) {
    throw new RateCardImportError(
      `Duplicate offer codes in the workbook: ${dupes.slice(0, 5).join(', ')}`,
      { duplicates: dupes.slice(0, 20) }
    );
  }

  if (!rateRows.length) {
    throw new RateCardImportError('No offers found in the workbook. Nothing would be imported.');
  }

  const stats = {
    plans: plans.length,
    planNames: plans.map((p) => p.plan_code),
    offerRatesElectricity: elec.rows.length,
    offerRatesGas: gas.rows.length,
    offerRatesWithCdrCode: rateRows.filter((r) => r.cdr_plan_code).length,
    postcodes: postcodes.length,
    tariffMappings: tariffs.length,
    nmiPrefixes: prefixes.length,
    skipped: [...elec.skipped, ...gas.skipped],
  };

  return { plans, rateRows, postcodes, tariffs, prefixes, stats };
}

/**
 * Parse and, unless dryRun, write a new version in one transaction.
 *
 * Previous versions are never deleted: an offer code on a past submission has to stay
 * resolvable for audit. Activating is a separate flag, so a card can be staged and
 * switched over (or rolled back) without re-uploading.
 */
export async function importRateCard({
  filePath,
  buffer,
  label,
  activate = true,
  dryRun = false,
  sourceFile,
  uploadedBy = null,
  client: externalClient = null,
}) {
  const wb = await loadWorkbook({ filePath, buffer });

  if (dryRun) {
    const { stats } = parseWorkbook(wb, '00000000-0000-0000-0000-000000000000');
    return { dryRun: true, versionId: null, label, stats };
  }

  const url = config.database?.url;
  if (!externalClient && !url) throw new RateCardImportError('DATABASE_URL is not configured');

  const client = externalClient ?? new pg.Client({ connectionString: url });
  if (!externalClient) await client.connect();

  try {
    await client.query('BEGIN');

    const { rows: vrows } = await client.query(
      `INSERT INTO rate_card_versions (label, source_file, is_active)
       VALUES ($1, $2, false) RETURNING id, imported_at`,
      [label, sourceFile ?? label]
    );
    const versionId = vrows[0].id;

    const parsed = parseWorkbook(wb, versionId);

    await bulkInsert(client, 'offer_plans', [
      'version_id', 'plan_code', 'energy_type', 'provider_id', 'offer_number',
      'state_availability', 'customer_type', 'customer_eligibility', 'contract_term',
      'features', 'termination_fee', 'dishonoured_payment_fee', 'credit_card_payment_fee',
      'billing_options', 'payment_options', 'green_options', 'terms_and_conditions', 'extras',
    ], parsed.plans);

    await bulkInsert(client, 'offer_rates', [
      'version_id', 'offer_code', 'offer_with_rate_number', 'offer_number', 'plan_code',
      'price_item_name', 'energy_type', 'state', 'network_name', 'network_zone',
      'retail_tariff_code', 'customer_type', 'effective_start', 'effective_end',
      'daily_charge', 'rates', 'solar', 'demand', 'cdr_plan_code', 'cdr_plan_id', 'bpid_url',
      'benchmark_tariff_type', 'benchmark_kwh', 'benchmark_cost', 'momentum_cost',
      'difference_dollar', 'difference_percent', 'tariff_category',
    ], parsed.rateRows);

    await bulkInsert(client, 'postcode_network', [
      'version_id', 'energy_type', 'postcode', 'network_name', 'network_zone', 'is_default',
    ], parsed.postcodes);

    await bulkInsert(client, 'tariff_map', [
      'version_id', 'energy_type', 'network_name', 'tariff_combination_key', 'network_zone',
      'customer_type', 'retail_tariff_code', 'solar_applicable', 'solar_scheme',
    ], parsed.tariffs);

    await bulkInsert(client, 'nmi_prefix_network', [
      'version_id', 'prefix', 'energy_type', 'network_name',
    ], parsed.prefixes);

    const stats = { ...parsed.stats, uploadedBy };
    await client.query('UPDATE rate_card_versions SET stats = $1 WHERE id = $2', [
      JSON.stringify(stats),
      versionId,
    ]);

    if (activate) {
      await client.query('UPDATE rate_card_versions SET is_active = false WHERE is_active');
      await client.query('UPDATE rate_card_versions SET is_active = true WHERE id = $1', [versionId]);
    }

    await client.query('COMMIT');
    return { dryRun: false, versionId, label, active: activate, stats };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    if (!externalClient) await client.end();
  }
}
