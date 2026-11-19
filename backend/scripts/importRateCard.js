#!/usr/bin/env node
/**
 * Import Momentum's "All Channel Master Template" workbook from the command line.
 *
 * Usage:
 *   node scripts/importRateCard.js <path-to.xlsx> [--label "..."] [--no-activate] [--dry-run]
 *
 * The parsing and writing live in src/services/rateCardImport.js, shared with the admin
 * upload screen, so both do exactly the same thing.
 */
import dotenv from 'dotenv';
import { basename, resolve } from 'path';

dotenv.config();

const { importRateCard, RateCardImportError } = await import('../src/services/rateCardImport.js');

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith('--'));
  if (!filePath) {
    console.error(
      'Usage: node scripts/importRateCard.js <path-to.xlsx> [--label "..."] [--no-activate] [--dry-run]'
    );
    process.exit(1);
  }

  const labelIdx = args.indexOf('--label');
  const label = labelIdx >= 0 ? args[labelIdx + 1] : basename(filePath, '.xlsx');
  const activate = !args.includes('--no-activate');
  const dryRun = args.includes('--dry-run');

  if (!process.env.DATABASE_URL && !dryRun) {
    console.error('DATABASE_URL is required. Add it to .env (or pass --dry-run)');
    process.exit(1);
  }

  const abs = resolve(filePath);
  console.log(`Reading ${abs}`);

  try {
    const result = await importRateCard({
      filePath: abs,
      label,
      activate,
      dryRun,
      sourceFile: basename(abs),
    });
    const s = result.stats;

    console.log(dryRun ? '\nDry run - nothing written.' : '\nImport complete.');
    if (!dryRun) {
      console.log(`  version id   : ${result.versionId}`);
      console.log(`  active       : ${result.active}`);
    }
    console.log(`  label        : ${result.label}`);
    console.log(`  plans        : ${s.plans}  (${s.planNames.join(', ')})`);
    console.log(`  offer rates  : ${s.offerRatesElectricity} electricity + ${s.offerRatesGas} gas`);
    console.log(`  with CDR code: ${s.offerRatesWithCdrCode}`);
    console.log(`  postcodes    : ${s.postcodes}`);
    console.log(`  tariff maps  : ${s.tariffMappings}`);
    console.log(`  nmi prefixes : ${s.nmiPrefixes}`);
    if (s.skipped.length) console.log(`  skipped rows : ${s.skipped.length}`);
  } catch (err) {
    if (err instanceof RateCardImportError) {
      console.error(`Import rejected: ${err.message}`);
      if (err.details) console.error(JSON.stringify(err.details, null, 2));
    } else {
      console.error('Import failed:', err.message);
    }
    process.exitCode = 1;
  }
}

main();
