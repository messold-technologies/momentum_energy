/**
 * Pure parsing/normalisation helpers for Momentum's "All Channel Master Template" workbook.
 *
 * Kept free of DB and filesystem access so they can be unit tested directly.
 */

/** exceljs cells can be plain values, formula results, hyperlinks or rich text. */
export function cellValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if (v instanceof Date) return v;
    if ('result' in v) return cellValue(v.result);
    if ('hyperlink' in v) return v.text ?? v.hyperlink;
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('text' in v) return v.text;
    return null;
  }
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  return v;
}

/**
 * Source cells contain float artifacts such as 166.20999999999998 and
 * 0.47630000000000006, so every numeric read is rounded on the way in.
 */
export function num(v, dp = 4) {
  const c = cellValue(v);
  if (c === null) return null;
  const n = typeof c === 'number' ? c : Number(String(c).replace(/[$,%\s]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(dp));
}

export function str(v) {
  const c = cellValue(v);
  return c === null ? null : String(c).trim();
}

export function dateOnly(v) {
  const c = cellValue(v);
  if (c === null) return null;
  const d = c instanceof Date ? c : new Date(c);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function bool(v) {
  const c = cellValue(v);
  if (c === null) return false;
  const s = String(c).trim().toLowerCase();
  return s === '1' || s === 'y' || s === 'yes' || s === 'true';
}

/**
 * Plan names carry a stray trailing full stop in the rate card ("Bill Boss Electricity.")
 * but not in the Offers sheet or the Momentum servicePlanCode enum. Left unnormalised,
 * every Bill Boss join silently drops.
 */
export function normalisePlan(v) {
  const s = str(v);
  return s ? s.replace(/\.+$/, '').replace(/\s+/g, ' ').trim() : null;
}

/** Rate card says Residential/Commercial; the Offers sheet says SME; the API says COMPANY. */
export function normaliseCustomerType(v) {
  const s = (str(v) || '').toLowerCase();
  if (s.startsWith('resid')) return 'RESIDENTIAL';
  // "Small business" and "SME only" both appear in the workbook, so match anywhere in
  // the string rather than only at the start.
  if (s.startsWith('comm') || s.includes('business') || s.includes('sme')) return 'COMMERCIAL';
  return s ? s.toUpperCase() : null;
}

export function normaliseEnergyType(v) {
  const s = (str(v) || '').toLowerCase();
  if (s.startsWith('elec')) return 'ELECTRICITY';
  if (s.startsWith('gas')) return 'GAS';
  return s ? s.toUpperCase() : null;
}

/**
 * Victoria publishes through Victorian Energy Compare, every other state through the
 * federal Energy Made Easy. Using the wrong suffix returns a bare 404 from the CDR API,
 * not a useful error.
 */
export function cdrPlanId(code, state) {
  if (!code) return null;
  return `${code}${String(state).toUpperCase() === 'VIC' ? '@VEC' : '@EME'}`;
}

/**
 * Collect Peak_Block1_Rate / Offpeak_Block2_Limit / ControlledLoad1_Block1_Rate style
 * columns into structured JSON. Driven by the header names actually present, because the
 * "(c)" and "($)" sheets differ in column count and gas uses more block levels than
 * electricity.
 */
export function collectRates(row, headers) {
  const out = {};
  const re = /^(Peak|Shoulder|Offpeak|OffPeak|ControlledLoad\d)_Block(\d+)_(Rate|Limit)$/i;

  for (const h of headers) {
    const m = re.exec(h);
    if (!m) continue;
    const value = num(row[h]);
    if (value === null) continue;

    const groupRaw = m[1].toLowerCase();
    const group = groupRaw === 'offpeak' ? 'offpeak' : groupRaw;
    const block = Number(m[2]);
    const kind = m[3].toLowerCase();

    out[group] = out[group] || [];
    let entry = out[group].find((e) => e.block === block);
    if (!entry) {
      entry = { block };
      out[group].push(entry);
    }
    entry[kind] = value;
  }

  for (const g of Object.keys(out)) {
    if (Array.isArray(out[g])) out[g].sort((a, b) => a.block - b.block);
  }

  const season2 = num(row['Peak Season 2 Rate 1']);
  if (season2 !== null) out.peakSeason2 = season2;

  return Object.keys(out).length ? out : null;
}

/** Collect every non-empty column with a given prefix into a flat object. */
export function collectPrefixed(row, headers, prefix) {
  const out = {};
  const p = prefix.toLowerCase();
  for (const h of headers) {
    if (!h.toLowerCase().startsWith(p)) continue;
    const v = cellValue(row[h]);
    if (v === null) continue;
    out[h] = typeof v === 'number' ? num(row[h]) : String(v);
  }
  return Object.keys(out).length ? out : null;
}

/**
 * A tariff is "flat rate" when it has a single peak block and no shoulder or off-peak
 * component. Momentum's own site quotes flat-rate tariffs by default, which is what lets
 * the agent see a price before the site's real network tariff is known.
 */
export function isFlatRate(rates) {
  if (!rates) return false;
  if (rates.shoulder?.length || rates.offpeak?.length) return false;
  return (rates.peak?.length ?? 0) === 1;
}

/** Read an exceljs worksheet as plain objects keyed by header name. */
export function readSheet(ws, headerRowNumber = 1) {
  const headerRow = ws.getRow(headerRowNumber);
  const headers = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    const h = str(cell.value);
    if (h) headers[h] = col;
  });

  const rows = [];
  for (let r = headerRowNumber + 1; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const obj = {};
    let any = false;
    for (const [h, col] of Object.entries(headers)) {
      const v = row.getCell(col).value;
      obj[h] = v;
      if (cellValue(v) !== null) any = true;
    }
    if (any) rows.push(obj);
  }
  return { rows, headers: Object.keys(headers) };
}
