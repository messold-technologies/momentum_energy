import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';

import {
  rateCardApi,
  rateCardError,
  type RateCardPreview,
  type RateCardStats,
  type RateCardVersionRow,
} from '../lib/rateCardApi';

/**
 * Admin screen for the rate card. Replaces running the import script by hand.
 *
 * Deliberately a two-step flow: a file is parsed and shown first, and only goes live
 * when the admin chooses. Uploading changes every price the agent portal quotes and
 * every offer code it submits, so it should not happen on one click.
 */
export default function RateCardPage() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<RateCardPreview | null>(null);
  const [versions, setVersions] = useState<RateCardVersionRow[]>([]);
  const [busy, setBusy] = useState<'preview' | 'import' | 'activate' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(true);

  function loadVersions() {
    setLoadingVersions(true);
    rateCardApi
      .versions()
      .then(setVersions)
      .catch(() => setError('Could not load the rate card history'))
      .finally(() => setLoadingVersions(false));
  }

  useEffect(loadVersions, []);

  function chooseFile(f: File | null) {
    setFile(f);
    setPreview(null);
    setError(null);
    setNotice(null);
  }

  async function handlePreview() {
    if (!file) return;
    setBusy('preview');
    setError(null);
    setNotice(null);
    try {
      setPreview(await rateCardApi.preview(file));
    } catch (err) {
      setError(rateCardError(err, 'Could not read that file'));
    } finally {
      setBusy(null);
    }
  }

  async function handleImport(activate: boolean) {
    if (!file) return;
    setBusy('import');
    setError(null);
    try {
      const res = await rateCardApi.upload(file, { activate });
      setNotice(
        activate
          ? `Imported and made live: ${res.label}. Agents now quote from this rate card.`
          : `Imported as a staged version: ${res.label}. It is not live until you activate it.`
      );
      setFile(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      loadVersions();
    } catch (err) {
      setError(rateCardError(err, 'The import failed. Nothing was changed.'));
    } finally {
      setBusy(null);
    }
  }

  async function handleActivate(v: RateCardVersionRow) {
    setBusy('activate');
    setError(null);
    try {
      await rateCardApi.activate(v.id);
      setNotice(`${v.label} is now the live rate card.`);
      loadVersions();
    } catch (err) {
      setError(rateCardError(err, 'Could not switch version'));
    } finally {
      setBusy(null);
    }
  }

  const active = versions.find((v) => v.isActive);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Rate card</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Upload Momentum's All Channel Master Template. This is what the agent portal quotes
          from and where every submitted offer code comes from.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- current */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Currently live
        </p>
        {loadingVersions ? (
          <p className="mt-2 text-sm text-gray-500">Loading…</p>
        ) : active ? (
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-lg font-semibold text-gray-900">{active.label}</p>
            <p className="text-sm text-gray-600">{active.offerCount} offers</p>
            <p className="text-sm text-gray-500">
              imported {new Date(active.importedAt).toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-amber-700">
            No rate card is live. The agent portal cannot quote until one is uploaded.
          </p>
        )}
      </div>

      {/* -------------------------------------------------------------- upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 lg:p-6 mb-5">
        <p className="text-sm font-medium text-gray-900">Upload a new rate card</p>

        <label className="mt-3 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-6 py-8 cursor-pointer hover:border-primary-400 hover:bg-primary-50/40 transition-colors">
          <FileSpreadsheet className="w-8 h-8 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">
            {file ? file.name : 'Choose the master template (.xlsx)'}
          </span>
          {file && (
            <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB</span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handlePreview()}
            disabled={!file || busy !== null}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
          >
            {busy === 'preview' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            Check the file
          </button>

          <button
            type="button"
            onClick={() => void handleImport(false)}
            disabled={!preview || busy !== null}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Import without going live
          </button>

          <button
            type="button"
            onClick={() => void handleImport(true)}
            disabled={!preview || busy !== null}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-40 cursor-pointer"
          >
            {busy === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import and make live
          </button>
        </div>

        {!preview && file && (
          <p className="mt-3 text-xs text-gray-500">
            Check the file first. Nothing is written until you import.
          </p>
        )}

        {preview && (
          <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-900">
              This file parses cleanly. Nothing has been written yet.
            </p>
            <StatGrid stats={preview.stats} />
            <p className="mt-3 text-xs text-gray-500">
              Importing creates a new version. The one in use now is kept, so you can switch
              back from the history below.
            </p>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- history */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <p className="text-sm font-medium text-gray-900">History</p>
          <button
            type="button"
            onClick={loadVersions}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {loadingVersions ? (
          <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
        ) : versions.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">No rate card imported yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Version</th>
                <th className="px-5 py-3 font-medium">Offers</th>
                <th className="px-5 py-3 font-medium">Imported</th>
                <th className="px-5 py-3 font-medium">By</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {versions.map((v) => (
                <tr key={v.id} className={v.isActive ? 'bg-green-50/60' : ''}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{v.label}</p>
                    {v.isActive && (
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                        Live
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-700">{v.offerCount}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {new Date(v.importedAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {v.stats?.uploadedBy ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!v.isActive && (
                      <button
                        type="button"
                        onClick={() => void handleActivate(v)}
                        disabled={busy !== null}
                        className="text-sm font-medium text-primary-700 hover:underline disabled:opacity-40 cursor-pointer"
                      >
                        Make live
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatGrid({ stats }: { stats: RateCardStats }) {
  const items: Array<[string, string | number]> = [
    ['Plans', stats.plans],
    ['Electricity offers', stats.offerRatesElectricity],
    ['Gas offers', stats.offerRatesGas],
    ['With CDR code', stats.offerRatesWithCdrCode],
    ['Postcodes', stats.postcodes],
    ['Tariff mappings', stats.tariffMappings],
    ['NMI prefixes', stats.nmiPrefixes],
    ['Rows skipped', stats.skipped.length],
  ];
  return (
    <>
      <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white border border-gray-200 px-3 py-2">
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="text-lg font-semibold text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
      {stats.planNames?.length > 0 && (
        <p className="mt-3 text-xs text-gray-600">
          <span className="text-gray-500">Plans: </span>
          {stats.planNames.join(' · ')}
        </p>
      )}
    </>
  );
}
