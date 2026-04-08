import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import moment from 'moment-timezone';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { submissionsApi, draftsApi, type Submission, type Draft } from '../lib/api';
import { downloadRowsAsXlsx, flattenPayloadToExcelColumns, type ExcelExportRow } from '../lib/excelExport';
import type { TransactionPayload } from '../lib/types';

function txRefFromPayload(payload: Record<string, unknown> | null | undefined): string {
  const tx = payload?.transaction;
  if (!tx || typeof tx !== 'object') return '';
  const ref = (tx as { transactionReference?: string }).transactionReference;
  return typeof ref === 'string' ? ref : '';
}

type UnifiedRow = {
  key: string;
  kind: 'submission' | 'draft';
  status: 'success' | 'error' | 'draft';
  dateIso: string;
  userName: string;
  transactionRef: string;
  salesTransactionId: string;
  errorMessage: string;
  submission?: Submission;
  draftMeta?: Draft;
};

function buildUnifiedRows(submissions: Submission[], drafts: Draft[]): UnifiedRow[] {
  const subRows: UnifiedRow[] = submissions.map((s) => ({
    key: `sub-${s.id}`,
    kind: 'submission',
    status: s.outcome === 'success' ? 'success' : 'error',
    dateIso: s.createdAt,
    userName: s.userName ?? '',
    transactionRef: txRefFromPayload(s.payloadSnapshot),
    salesTransactionId: s.salesTransactionId ?? '',
    errorMessage: s.errorMessage ?? '',
    submission: s,
  }));

  const draftRows: UnifiedRow[] = drafts.map((d) => ({
    key: `draft-${d.id}`,
    kind: 'draft',
    status: 'draft',
    dateIso: d.updatedAt,
    userName: d.userName ?? '',
    transactionRef: d.preview && d.preview !== 'Untitled' ? d.preview : '',
    salesTransactionId: '',
    errorMessage: '',
    draftMeta: d,
  }));

  const merged = [...subRows, ...draftRows];
  merged.sort((a, b) => {
    const ta = Date.parse(a.dateIso);
    const tb = Date.parse(b.dateIso);
    return tb - ta;
  });
  return merged;
}

function submissionToExportRow(s: Submission): ExcelExportRow {
  const meta: ExcelExportRow = {
    Status: s.outcome === 'success' ? 'success' : 'error',
    Type: 'submission',
    Date: s.createdAt,
    User: s.userName ?? '',
    TransactionReference: txRefFromPayload(s.payloadSnapshot),
    SalesTransactionId: s.salesTransactionId ?? '',
    ErrorMessage: s.errorMessage ?? '',
  };
  const flat = s.payloadSnapshot
    ? flattenPayloadToExcelColumns(s.payloadSnapshot as unknown as Record<string, unknown>)
    : {};
  return { ...meta, ...flat };
}

function draftToExportRow(payload: TransactionPayload | null, d: Draft, updatedAt: string): ExcelExportRow {
  const meta: ExcelExportRow = {
    Status: 'draft',
    Type: 'draft',
    Date: updatedAt,
    User: d.userName ?? '',
    TransactionReference: txRefFromPayload(payload as unknown as Record<string, unknown>),
    SalesTransactionId: '',
    ErrorMessage: '',
  };
  const flat = payload ? flattenPayloadToExcelColumns(payload as unknown as Record<string, unknown>) : {};
  return { ...meta, ...flat };
}

export default function ExcelDashboardPage() {
  const today = moment().tz('Australia/Sydney').format('YYYY-MM-DD');
  const monthAgo = moment().tz('Australia/Sydney').subtract(30, 'days').format('YYYY-MM-DD');

  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subRes, draftRes] = await Promise.all([
        submissionsApi.list({ limit: 500, from, to }),
        draftsApi.list({ limit: 500, from, to }),
      ]);
      setSubmissions(subRes.submissions ?? []);
      setDrafts(draftRes.drafts ?? []);
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const rows = useMemo(() => buildUnifiedRows(submissions, drafts), [submissions, drafts]);

  const handleDownloadAll = async () => {
    if (rows.length === 0) return;
    setExportingAll(true);
    try {
      const subExport = submissions.map(submissionToExportRow);

      const draftExports: ExcelExportRow[] = await Promise.all(
        drafts.map(async (d) => {
          try {
            const res = await draftsApi.get(d.id);
            return draftToExportRow(res.draft.payload, d, res.draft.updatedAt);
          } catch {
            return {
              Status: 'draft',
              Type: 'draft',
              Date: d.updatedAt,
              User: d.userName ?? '',
              TransactionReference: d.preview && d.preview !== 'Untitled' ? d.preview : '',
              SalesTransactionId: '',
              ErrorMessage: 'Failed to load draft payload',
            };
          }
        })
      );

      const combined = [...subExport, ...draftExports].sort((a, b) => {
        const ta = Date.parse(String(a.Date));
        const tb = Date.parse(String(b.Date));
        return tb - ta;
      });

      downloadRowsAsXlsx(`forms-export-${from}-${to}.xlsx`, combined);
    } finally {
      setExportingAll(false);
    }
  };

  const handleDownloadOne = async (row: UnifiedRow) => {
    setDownloadingKey(row.key);
    try {
      if (row.kind === 'submission' && row.submission) {
        downloadRowsAsXlsx(`form-${row.submission.id}.xlsx`, [submissionToExportRow(row.submission)], {
          sheetName: 'Form',
        });
        return;
      }
      if (row.kind === 'draft' && row.draftMeta) {
        const res = await draftsApi.get(row.draftMeta.id);
        downloadRowsAsXlsx(
          `draft-${row.draftMeta.id}.xlsx`,
          [draftToExportRow(res.draft.payload, row.draftMeta, res.draft.updatedAt)],
          { sheetName: 'Form' }
        );
      }
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Download failed');
    } finally {
      setDownloadingKey(null);
    }
  };

  const statusBadge = (status: UnifiedRow['status']) => {
    const base = 'inline-flex px-2 py-0.5 rounded text-xs font-medium';
    if (status === 'success') return `${base} bg-success-100 text-success-800`;
    if (status === 'error') return `${base} bg-danger-100 text-danger-800`;
    return `${base} bg-gray-100 text-gray-800`;
  };

  let tableSection: ReactNode;
  if (loading) {
    tableSection = (
      <div className="flex items-center justify-center gap-2 text-gray-500 py-16">
        <Loader2 className="w-6 h-6 animate-spin" />
        Loading…
      </div>
    );
  } else if (rows.length === 0) {
    tableSection = (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
        No submissions or drafts in this date range.
      </div>
    );
  } else {
    tableSection = (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Type</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Date</th>
              <th className="px-4 py-3 font-semibold text-gray-700">User</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Transaction ref</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Sales txn ID</th>
              <th className="px-4 py-3 font-semibold text-gray-700 w-48">Error</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-gray-100 hover:bg-gray-50/80">
                <td className="px-4 py-3">
                  <span className={statusBadge(row.status)}>{row.status}</span>
                </td>
                <td className="px-4 py-3 capitalize text-gray-800">{row.kind}</td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                  {(() => {
                    try {
                      return moment.tz(row.dateIso, 'Australia/Sydney').format('MMM D, YYYY · h:mm A');
                    } catch {
                      return row.dateIso;
                    }
                  })()}
                </td>
                <td className="px-4 py-3 text-gray-700 max-w-[140px] truncate" title={row.userName}>
                  {row.userName || '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-800 max-w-[120px] truncate" title={row.transactionRef}>
                  {row.transactionRef || '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-700 max-w-[120px] truncate">
                  {row.salesTransactionId || '—'}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate" title={row.errorMessage}>
                  {row.errorMessage || '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDownloadOne(row)}
                    disabled={downloadingKey !== null}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-50 disabled:opacity-50 cursor-pointer"
                  >
                    {downloadingKey === row.key ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    Excel
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-primary-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Excel Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Submissions and drafts with export</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-col lg:flex-row lg:items-end gap-4 flex-wrap">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="excel-from" className="block text-xs font-medium text-gray-500 mb-1">
              From (UTC date)
            </label>
            <input
              id="excel-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label htmlFor="excel-to" className="block text-xs font-medium text-gray-500 mb-1">
              To (UTC date)
            </label>
            <input
              id="excel-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => loadData()}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 cursor-pointer"
          >
            Apply
          </button>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleDownloadAll}
          disabled={rows.length === 0 || exportingAll || loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 cursor-pointer"
        >
          {exportingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download all (Excel)
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {tableSection}
    </div>
  );
}
