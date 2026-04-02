import * as XLSX from 'xlsx';

export type ExcelExportRow = Record<string, string | number | boolean | null | undefined>;

/** Metadata columns (fixed order when present). Payload fields follow domain order (see `sortPayloadColumnKeys`). */
export const EXCEL_META_KEYS = [
  'Status',
  'Type',
  'Date',
  'User',
  'TransactionReference',
  'SalesTransactionId',
  'ErrorMessage',
] as const;

function flattenArrayValue(value: unknown[], prefix: string, out: Record<string, string>): void {
  if (value.length === 0) {
    out[prefix] = '';
    return;
  }
  value.forEach((item, index) => {
    const key = `${prefix}.${index}`;
    if (item !== null && typeof item === 'object' && !(item instanceof Date) && !Array.isArray(item)) {
      flattenValue(item, key, out);
    } else if (Array.isArray(item)) {
      flattenValue(item, key, out);
    } else if (item instanceof Date) {
      out[key] = item.toISOString();
    } else if (item === null || item === undefined) {
      out[key] = '';
    } else if (typeof item === 'string') {
      out[key] = item;
    } else if (typeof item === 'number' || typeof item === 'boolean' || typeof item === 'bigint') {
      out[key] = String(item);
    } else {
      out[key] = JSON.stringify(item);
    }
  });
}

function flattenValue(value: unknown, prefix: string, out: Record<string, string>): void {
  if (value === null || value === undefined) {
    out[prefix] = '';
    return;
  }
  const t = typeof value;
  if (t === 'string') {
    out[prefix] = value as string;
    return;
  }
  if (t === 'number') {
    out[prefix] = String(value as number);
    return;
  }
  if (t === 'boolean') {
    out[prefix] = (value as boolean) ? 'true' : 'false';
    return;
  }
  if (t === 'bigint') {
    out[prefix] = (value as bigint).toString();
    return;
  }
  if (value instanceof Date) {
    out[prefix] = value.toISOString();
    return;
  }
  if (Array.isArray(value)) {
    flattenArrayValue(value, prefix, out);
    return;
  }
  if (t === 'object') {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length === 0) {
      out[prefix] = '';
      return;
    }
    for (const k of keys) {
      const key = `${prefix}.${k}`;
      flattenValue(o[k], key, out);
    }
  }
}

/**
 * Flattens a nested JSON payload into dot-path column keys with string cell values (Excel-friendly).
 */
export function flattenPayloadToExcelColumns(payload: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (payload === null || payload === undefined) return out;
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    out._payload = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return out;
  }
  const o = payload as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v === null || v === undefined) {
      out[k] = '';
    } else {
      flattenValue(v, k, out);
    }
  }
  return out;
}

/**
 * Order payload columns: transaction → customer contacts → other customer → service → anything else.
 * Within each group, keys are sorted alphabetically.
 */
export function sortPayloadColumnKeys(keys: string[]): string[] {
  const rank = (k: string): number => {
    if (k === 'transaction' || k.startsWith('transaction.')) return 0;
    if (k === 'customer.contacts' || k.startsWith('customer.contacts.')) return 1;
    if (k === 'customer' || k.startsWith('customer.')) return 2;
    if (k === 'service' || k.startsWith('service.')) return 3;
    return 4;
  };
  return [...keys].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}

/**
 * Ensures every row has the same keys so SheetJS includes all columns (union of keys across rows).
 * Meta columns first (when any row has them), then payload keys in domain order.
 */
export function normalizeExcelRows(rows: ExcelExportRow[]): ExcelExportRow[] {
  if (rows.length === 0) return rows;
  const allKeys = new Set<string>();
  rows.forEach((r) => Object.keys(r).forEach((k) => allKeys.add(k)));
  const metaKeys = EXCEL_META_KEYS.filter((k) => allKeys.has(k));
  const metaSet = new Set<string>(EXCEL_META_KEYS);
  const payloadKeys = sortPayloadColumnKeys([...allKeys].filter((k) => !metaSet.has(k)));
  const orderedKeys = [...metaKeys, ...payloadKeys];
  return rows.map((r) => {
    const out: ExcelExportRow = {};
    for (const k of orderedKeys) {
      const v = r[k];
      out[k] = v ?? '';
    }
    return out;
  });
}

export const DEFAULT_EXCEL_SHEET_NAME = 'All forms';

/**
 * Build one worksheet as a single table: header row + one row per form (all submissions + drafts in one grid).
 */
function rowsToSheetAoA(rows: ExcelExportRow[]): (string | number | boolean)[][] {
  const normalized = normalizeExcelRows(rows);
  if (normalized.length === 0) return [];
  const headers = Object.keys(normalized[0]);
  const body = normalized.map((row) =>
    headers.map((h) => row[h] ?? '')
  );
  return [headers, ...body];
}

export type DownloadRowsAsXlsxOptions = {
  /** Single tab name (Excel max 31 chars). Default: "All forms". */
  sheetName?: string;
};

/**
 * Download one .xlsx file with a single worksheet containing every row (e.g. all forms on one sheet).
 */
export function downloadRowsAsXlsx(filename: string, rows: ExcelExportRow[], options?: DownloadRowsAsXlsxOptions): void {
  if (rows.length === 0) return;
  const aoa = rowsToSheetAoA(rows);
  if (aoa.length === 0) return;
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  const sheetName = (options?.sheetName ?? DEFAULT_EXCEL_SHEET_NAME).slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const name = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, name);
}
