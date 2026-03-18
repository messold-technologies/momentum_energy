import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, CheckCircle, XCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { PayloadViewer } from '../components/PayloadViewer';
import { submissionsApi, type Submission } from '../lib/api';
import { format } from 'date-fns';

export default function FormResponsesPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    submissionsApi
      .list()
      .then((res) => {
        setSubmissions(res.submissions || []);
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to load submissions');
      })
      .finally(() => setLoading(false));
  }, []);

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
    <div className="max-w-4xl mx-auto">
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
                role="button"
                tabIndex={0}
                className={`flex items-center justify-between gap-4 p-4 cursor-pointer ${
                  s.outcome === 'success' ? 'bg-success-50/50' : 'bg-danger-50/50'
                }`}
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setExpandedId(expandedId === s.id ? null : s.id);
                  }
                }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {s.outcome === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-success-600 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-danger-600 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                    <div>
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sales Transaction ID</span>
                      <p className="text-sm text-gray-900 mt-0.5">
                        {s.salesTransactionId ? (
                          <Link
                            to={`/transactions/${s.salesTransactionId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700"
                          >
                            {s.salesTransactionId}
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Submitted by</span>
                      <p className="text-sm text-gray-900 mt-0.5 truncate">{s.userName ?? '—'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Time</span>
                      <p className="text-sm text-gray-900 mt-0.5">{format(new Date(s.createdAt), 'MMM d, yyyy · h:mm a')}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      s.outcome === 'success' ? 'bg-success-100 text-success-800' : 'bg-danger-100 text-danger-800'
                    }`}
                  >
                    {s.outcome}
                  </span>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-gray-400 hover:text-gray-600 p-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedId(expandedId === s.id ? null : s.id);
                  }}
                >
                  {expandedId === s.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
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
