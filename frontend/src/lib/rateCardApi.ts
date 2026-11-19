import api from './api';

export interface RateCardStats {
  plans: number;
  planNames: string[];
  offerRatesElectricity: number;
  offerRatesGas: number;
  offerRatesWithCdrCode: number;
  postcodes: number;
  tariffMappings: number;
  nmiPrefixes: number;
  skipped: Array<{ offerCode: string | null; reason: string }>;
  uploadedBy?: string | null;
}

export interface RateCardPreview {
  dryRun: true;
  versionId: null;
  label: string;
  sourceFile: string;
  stats: RateCardStats;
}

export interface RateCardImportResult {
  dryRun: false;
  versionId: string;
  label: string;
  active: boolean;
  stats: RateCardStats;
}

export interface RateCardVersionRow {
  id: string;
  label: string;
  sourceFile: string | null;
  isActive: boolean;
  importedAt: string;
  offerCount: number;
  stats: RateCardStats | null;
}

function unwrap<T>(data: { success: boolean; data: T }): T {
  return data.data;
}

/** Lifts the server's message out, since these are the ones worth showing verbatim. */
export function rateCardError(err: unknown, fallback: string): string {
  const d = (err as { response?: { data?: { error?: string } } }).response?.data;
  return d?.error ?? fallback;
}

/**
 * The shared client sets `Content-Type: application/json` for every request. Axios turns
 * FormData into JSON when it sees that header, which silently drops the file and the
 * server then answers "attach the master template". Naming multipart keeps the FormData
 * intact; axios removes the header again so the browser can add the boundary.
 */
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } } as const;

export const rateCardApi = {
  /** Parse without writing, so an admin can see what a file holds before committing. */
  preview: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/rate-card/preview', form, MULTIPART);
    return unwrap<RateCardPreview>(data);
  },

  upload: async (file: File, opts: { label?: string; activate: boolean }) => {
    const form = new FormData();
    form.append('file', file);
    if (opts.label) form.append('label', opts.label);
    form.append('activate', String(opts.activate));
    const { data } = await api.post('/rate-card', form, MULTIPART);
    return unwrap<RateCardImportResult>(data);
  },

  versions: async () => {
    const { data } = await api.get('/rate-card/versions');
    return unwrap<RateCardVersionRow[]>(data);
  },

  activate: async (id: string) => {
    const { data } = await api.post(`/rate-card/versions/${id}/activate`);
    return unwrap<{ id: string; label: string; isActive: boolean }>(data);
  },
};
