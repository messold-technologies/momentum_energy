import { useEffect, useState } from 'react';
import moment from 'moment-timezone';
import { CheckCircle, ChevronDown, ChevronUp, FileText, Trash2, XCircle } from 'lucide-react';
import { firstEnergyApi, submissionsApi, type Submission } from '../lib/api';
import { getApiErrorMessage } from '../lib/errorMessage';

const COMPANY_ID = 'first-energy' as const;

function prettyJson(v: unknown) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return '';
  }
}

export default function FirstEnergyFormResponsesPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [accountDetailsById, setAccountDetailsById] = useState<Record<string, unknown>>({});
  const [accountLoadingById, setAccountLoadingById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    submissionsApi
      .list({ limit: 200, companyId: COMPANY_ID })
      .then((res) => setSubmissions(res.submissions || []))
      .catch((e) => setError(getApiErrorMessage(e, 'Failed to load submissions')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const sub = submissions.find((x) => x.id === expandedId);
    if (!sub) return;
    const accountId = sub?.salesTransactionId ?? null; // stored in shared column `sales_transaction_id`
    if (!expandedId || !accountId) return;
    if (accountDetailsById[accountId]) return;
    if (sub.outcome !== 'success') return;

    setAccountLoadingById((prev) => ({ ...prev, [accountId]: true }));
    firstEnergyApi.accounts
      .get(accountId)
      .then((res) => {
        setAccountDetailsById((prev) => ({ ...prev, [accountId]: res.data }));
      })
      .catch(() => {})
      .finally(() => {
        setAccountLoadingById((prev) => ({ ...prev, [accountId]: false }));
      });
  }, [expandedId, submissions, accountDetailsById]);

  const handleDeleteSubmission = async (submissionId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const ok = globalThis.confirm('Delete this submission? This cannot be undone.');
    if (!ok) return;
    setDeletingId(submissionId);
    setError(null);
    try {
      await submissionsApi.delete(submissionId, { companyId: COMPANY_ID });
      setSubmissions((prev) => prev.filter((x) => x.id !== submissionId));
      setExpandedId((prev) => (prev === submissionId ? null : prev));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to delete submission'));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Form Responses</h1>
        <p className="text-sm text-gray-500 mt-1">1st Energy account submissions (success + errors)</p>
      </div>

      {submissions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No submissions yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => {
            const expanded = expandedId === s.id;
            const ok = s.outcome === 'success';
            return (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-amber-300 transition-colors">
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setExpandedId((prev) => (prev === s.id ? null : s.id))}
                      className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${ok ? 'bg-green-50' : 'bg-red-50'}`}
                      >
                        {ok ? (
                          <CheckCircle className="w-5 h-5 text-green-700" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-700" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {ok ? 'Success' : 'Error'} {s.salesTransactionId ? `— Account ID: ${s.salesTransactionId}` : ''}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {moment(s.createdAt).tz('Australia/Sydney').format('YYYY-MM-DD HH:mm')}
                        </p>
                      </div>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Delete submission"
                      disabled={deletingId === s.id}
                      onClick={(e) => handleDeleteSubmission(s.id, e)}
                      className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={expanded ? 'Collapse' : 'Expand'}
                      onClick={() => setExpandedId((prev) => (prev === s.id ? null : s.id))}
                      className="p-2 text-gray-400 hover:text-gray-700 cursor-pointer"
                    >
                      {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {expanded ? (
                  <div className="border-t border-gray-200 bg-gray-50/50 p-4 space-y-3">
                    {s.outcome === 'success' && s.salesTransactionId ? (
                      <div>
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Latest account details</p>
                        {accountLoadingById[s.salesTransactionId] ? (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            Fetching account…
                          </div>
                        ) : accountDetailsById[s.salesTransactionId] ? (
                          <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-auto max-h-[420px]">
                            {prettyJson(accountDetailsById[s.salesTransactionId])}
                          </pre>
                        ) : (
                          <p className="text-sm text-gray-500">No account details loaded.</p>
                        )}
                      </div>
                    ) : null}
                    {s.errorMessage ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                        {s.errorMessage}
                      </div>
                    ) : null}
                    {s.payloadSnapshot ? (
                      <div>
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Submitted payload snapshot</p>
                        <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-auto max-h-[420px]">
                          {prettyJson(s.payloadSnapshot)}
                        </pre>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No payload snapshot stored.</p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

