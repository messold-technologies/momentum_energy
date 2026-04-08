import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, CheckCircle, XCircle, ChevronDown, ChevronUp, ExternalLink, Copy, Trash2 } from 'lucide-react';
import { PayloadViewer } from '../components/PayloadViewer';
import { draftsApi, submissionsApi, type Submission } from '../lib/api';
import moment from 'moment-timezone';
import type { TransactionPayload } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';

export default function FormResponsesPage() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    submissionsApi
      .list({ limit: 200 })
      .then((res) => {
        setSubmissions(res.submissions || []);
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to load submissions');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDeleteSubmission = async (submissionId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const ok = globalThis.confirm('Delete this submission? This cannot be undone.');
    if (!ok) return;
    setDeletingId(submissionId);
    setError(null);
    try {
      await submissionsApi.delete(submissionId);
      setSubmissions((prev) => prev.filter((x) => x.id !== submissionId));
      setExpandedId((prev) => (prev === submissionId ? null : prev));
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete submission');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopySubmission = async (submission: Submission, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!submission.payloadSnapshot) return;
    setCopyingId(submission.id);
    setError(null);
    try {
      const copied = structuredClone(submission.payloadSnapshot) as unknown as TransactionPayload;
      copied.transaction = copied.transaction ?? ({} as TransactionPayload['transaction']);
      // Keep transaction reference when copying; normalize to UHM + 1-9 digits.
      const raw = String(copied.transaction.transactionReference ?? '').toUpperCase();
      const digits = raw.replace(/^UHM/, '').replaceAll(/\D/g, '').slice(0, 9);
      copied.transaction.transactionReference = `UHM${digits}`;
      copied.transaction.transactionDate = moment().tz('Australia/Sydney').format('YYYY-MM-DDTHH:mm');

      const res = await draftsApi.save(copied);
      navigate(`/transactions/new?draft=${res.draft.id}`);
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to copy form');
    } finally {
      setCopyingId(null);
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Form Responses</h1>
        <p className="text-sm text-gray-500 mt-1">All your transaction submissions, including successes and errors</p>
      </div>

      {submissions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No submissions yet.</p>
          <p className="text-sm mt-1">Submit a transaction to see it here.</p>
          <Link to="/transactions/new" className="inline-block mt-4 text-primary-600 hover:text-primary-700 font-medium">
            New Transaction
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <div
                className={`flex items-center justify-between gap-4 p-4 ${
                  s.outcome === 'success' ? 'bg-success-50/50' : 'bg-danger-50/50'
                }`}
              >
                <button
                  type="button"
                  className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                  aria-label={expandedId === s.id ? 'Collapse submission' : 'Expand submission'}
                  onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                >
                  {s.outcome === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-success-600 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-danger-600 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                    <div>
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sales Transaction ID</span>
                      <p className="text-sm text-gray-900 mt-0.5">
                        <span className={s.salesTransactionId ? 'font-mono' : 'text-gray-500'}>
                          {s.salesTransactionId || '—'}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Submitted by</span>
                      <p className="text-sm text-gray-900 mt-0.5 truncate">{s.userName ?? '—'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Time</span>
                      <p className="text-sm text-gray-900 mt-0.5">
                        {moment.tz(s.createdAt, 'Australia/Sydney').format('MMM D, YYYY · h:mm A')}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      s.outcome === 'success' ? 'bg-success-100 text-success-800' : 'bg-danger-100 text-danger-800'
                    }`}
                  >
                    {s.outcome}
                  </span>
                </button>
                <div className="shrink-0 flex items-center gap-1">
                  {s.salesTransactionId ? (
                    <Link
                      to={`/transactions/${s.salesTransactionId}`}
                      aria-label="Open transaction details"
                      title="Open details"
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-primary-700 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    aria-label="Copy form"
                    title="Copy form"
                    disabled={!s.payloadSnapshot || copyingId === s.id}
                    onClick={(e) => handleCopySubmission(s, e)}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {copyingId === s.id ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  {user?.isAdmin ? (
                    <button
                      type="button"
                      aria-label="Delete submission"
                      title="Delete"
                      disabled={deletingId === s.id}
                      onClick={(e) => handleDeleteSubmission(s.id, e)}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-danger-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {deletingId === s.id ? (
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label={expandedId === s.id ? 'Collapse details' : 'Expand details'}
                    title={expandedId === s.id ? 'Collapse' : 'Expand'}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(expandedId === s.id ? null : s.id);
                    }}
                  >
                    {expandedId === s.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {expandedId === s.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  {s.errorMessage && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                      {s.errorMessage}
                    </div>
                  )}
                  {s.payloadSnapshot ? (
                    <PayloadViewer payload={s.payloadSnapshot} salesTransactionId={s.salesTransactionId} />
                  ) : (
                    <p className="text-sm text-gray-500">No payload data available.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
