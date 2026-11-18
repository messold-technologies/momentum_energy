#!/usr/bin/env node
/**
 * Import Momentum's "All Channel Master Template" workbook into the rate card tables.
 *
 * Usage:
 *   node scripts/importRateCard.js <path-to.xlsx> [--label "..."] [--no-activate] [--dry-run]
 *
 * --dry-run parses and reports without touching the database.
 *
 * Each run creates a new rate_card_versions row. Previous versions are retained so offer
 * codes on past submissions stay resolvable for audit; --no-activate stages an import
 * without switching the live version over.
 *
 * Rates come from the "(c)" sheets: cents, GST-inclusive.
 */
import dotenv from 'dotenv';
import pg from 'pg';
import ExcelJS from 'exceljs';
import { basename, resolve } from 'path';

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
} from '../src/utils/rateCardParse.js';

dotenv.config();

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
  if (!ws) throw new Error(`Sheet not found: ${sheetName}`);
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
        // Gas has no default-network column: 24 postcodes are genuinely ambiguous and the
        // agent must choose. Recorded as false rather than guessed.
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

/* -------------------------------------------------------------------- main */

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith('--'));
  if (!filePath) {
    console.error('Usage: node scripts/importRateCard.js <path-to.xlsx> [--label "..."] [--no-activate]');
    process.exit(1);
  }
  const labelIdx = args.indexOf('--label');
  const label = labelIdx >= 0 ? args[labelIdx + 1] : basename(filePath, '.xlsx');
  const activate = !args.includes('--no-activate');
  const dryRun = args.includes('--dry-run');

  const url = process.env.DATABASE_URL;
  if (!url && !dryRun) {
    console.error('DATABASE_URL is required. Add it to .env (or pass --dry-run)');
    process.exit(1);
  }

  const abs = resolve(filePath);
  console.log(`Reading ${abs}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(abs);

  if (dryRun) {
    const versionId = '00000000-0000-0000-0000-000000000000';
    const plans = parseOffers(wb, versionId);
    const elec = parseRates(wb, versionId, 'All_Channels_Elec (c)', 'ELECTRICITY');
    const gas = parseRates(wb, versionId, 'All_Channels_Gas (c)', 'GAS');
    const postcodes = parsePostcodes(wb, versionId);
    const tariffs = parseTariffMaps(wb, versionId);
    const prefixes = parseNmiPrefixes(wb, versionId);
    const rateRows = [...elec.rows, ...gas.rows];

    console.log('\nDry run - nothing written.');
    console.log(`  plans          : ${plans.length}  (${plans.map((p) => p.plan_code).join(', ')})`);
    console.log(`  offer rates    : ${elec.rows.length} electricity + ${gas.rows.length} gas`);
    console.log(`  distinct codes : ${new Set(rateRows.map((r) => r.offer_code)).size}`);
    console.log(`  with CDR code  : ${rateRows.filter((r) => r.cdr_plan_code).length}`);
    console.log(`  @VEC / @EME    : ${rateRows.filter((r) => r.cdr_plan_id?.endsWith('@VEC')).length} / ${rateRows.filter((r) => r.cdr_plan_id?.endsWith('@EME')).length}`);
    console.log(`  postcodes      : ${postcodes.length}`);
    console.log(`  tariff maps    : ${tariffs.length}`);
    console.log(`  nmi prefixes   : ${prefixes.length}`);
    console.log(`  skipped        : ${elec.skipped.length + gas.skipped.length}`);

    const sample = rateRows.find((r) => r.momentum_cost !== null);
    if (sample) {
      console.log('\n  sample row:');
      for (const k of ['offer_code', 'plan_code', 'state', 'network_name', 'retail_tariff_code',
        'customer_type', 'daily_charge', 'cdr_plan_id', 'benchmark_cost', 'momentum_cost',
        'difference_percent']) {
        console.log(`    ${k.padEnd(20)}: ${sample[k]}`);
      }
      console.log(`    rates               : ${sample.rates}`);
    }
    return;
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    await client.query('BEGIN');

    const { rows: vrows } = await client.query(
      `INSERT INTO rate_card_versions (label, source_file, is_active)
       VALUES ($1, $2, false) RETURNING id`,
      [label, basename(abs)]
    );
    const versionId = vrows[0].id;

    const plans = parseOffers(wb, versionId);
    const elec = parseRates(wb, versionId, 'All_Channels_Elec (c)', 'ELECTRICITY');
    const gas = parseRates(wb, versionId, 'All_Channels_Gas (c)', 'GAS');
    const postcodes = parsePostcodes(wb, versionId);
    const tariffs = parseTariffMaps(wb, versionId);
    const prefixes = parseNmiPrefixes(wb, versionId);

    const rateRows = [...elec.rows, ...gas.rows];

    // Offer codes must be unique within a version, else the resolver is ambiguous and an
    // agent could submit a code that does not match the price the customer agreed to.
    const seen = new Set();
    const dupes = [];
    for (const r of rateRows) {
      if (seen.has(r.offer_code)) dupes.push(r.offer_code);
      seen.add(r.offer_code);
    }
    if (dupes.length) {
      throw new Error(`Duplicate Offer_With_Rate_ID in workbook: ${dupes.slice(0, 5).join(', ')}`);
    }

    await bulkInsert(client, 'offer_plans', [
      'version_id', 'plan_code', 'energy_type', 'provider_id', 'offer_number',
      'state_availability', 'customer_type', 'customer_eligibility', 'contract_term',
      'features', 'termination_fee', 'dishonoured_payment_fee', 'credit_card_payment_fee',
      'billing_options', 'payment_options', 'green_options', 'terms_and_conditions', 'extras',
    ], plans);

    await bulkInsert(client, 'offer_rates', [
      'version_id', 'offer_code', 'offer_with_rate_number', 'offer_number', 'plan_code',
      'price_item_name', 'energy_type', 'state', 'network_name', 'network_zone',
      'retail_tariff_code', 'customer_type', 'effective_start', 'effective_end',
      'daily_charge', 'rates', 'solar', 'demand', 'cdr_plan_code', 'cdr_plan_id', 'bpid_url',
      'benchmark_tariff_type', 'benchmark_kwh', 'benchmark_cost', 'momentum_cost',
      'difference_dollar', 'difference_percent', 'tariff_category',
    ], rateRows);

    await bulkInsert(client, 'postcode_network', [
      'version_id', 'energy_type', 'postcode', 'network_name', 'network_zone', 'is_default',
    ], postcodes);

    await bulkInsert(client, 'tariff_map', [
      'version_id', 'energy_type', 'network_name', 'tariff_combination_key', 'network_zone',
      'customer_type', 'retail_tariff_code', 'solar_applicable', 'solar_scheme',
    ], tariffs);

    await bulkInsert(client, 'nmi_prefix_network', [
      'version_id', 'prefix', 'energy_type', 'network_name',
    ], prefixes);

    const stats = {
      plans: plans.length,
      offerRatesElectricity: elec.rows.length,
      offerRatesGas: gas.rows.length,
      offerRatesWithCdrCode: rateRows.filter((r) => r.cdr_plan_code).length,
      postcodes: postcodes.length,
      tariffMappings: tariffs.length,
      nmiPrefixes: prefixes.length,
      skipped: [...elec.skipped, ...gas.skipped],
    };

    await client.query('UPDATE rate_card_versions SET stats = $1 WHERE id = $2', [
      JSON.stringify(stats),
      versionId,
    ]);

    if (activate) {
      await client.query('UPDATE rate_card_versions SET is_active = false WHERE is_active');
      await client.query('UPDATE rate_card_versions SET is_active = true WHERE id = $1', [versionId]);
    }

    await client.query('COMMIT');

    console.log('\nImport complete.');
    console.log(`  version id   : ${versionId}`);
    console.log(`  label        : ${label}`);
    console.log(`  active       : ${activate}`);
    console.log(`  plans        : ${stats.plans}`);
    console.log(`  offer rates  : ${stats.offerRatesElectricity} electricity + ${stats.offerRatesGas} gas`);
    console.log(`  with CDR code: ${stats.offerRatesWithCdrCode}`);
    console.log(`  postcodes    : ${stats.postcodes}`);
    console.log(`  tariff maps  : ${stats.tariffMappings}`);
    console.log(`  nmi prefixes : ${stats.nmiPrefixes}`);
    if (stats.skipped.length) console.log(`  skipped rows : ${stats.skipped.length}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

// Only run when invoked directly, so the parsers above stay importable from tests.
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]).endsWith('importRateCard.js');
if (invokedDirectly) main();
