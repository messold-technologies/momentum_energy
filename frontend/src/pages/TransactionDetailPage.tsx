import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { transactionApi } from '../lib/api';
import StatusBadge from '../components/ui/StatusBadge';
import { ArrowLeft, RefreshCw, Copy, Check } from 'lucide-react';

interface TransactionStatus {
  salesTransactionId: string;
  transactionStatus: string;
  lastChecked: string;
  details: Record<string, unknown>;
}

export default function TransactionDetailPage() {
  const { reference } = useParams<{ reference: string }>();
  const [status, setStatus] = useState<TransactionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function fetchStatus() {
    if (!reference) return;
    try {
      const result = await transactionApi.refreshStatus(reference);
      if (result.success) {
        setStatus(result.data);
        setError('');
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.momentumError?.message ||
        err.response?.data?.error ||
        'Failed to fetch transaction status';
      setError(msg);
    }
  }

  useEffect(() => {
    setLoading(true);
    fetchStatus().finally(() => setLoading(false));
  }, [reference]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchStatus();
    setRefreshing(false);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">{error || 'Transaction not found'}</p>
        <Link to="/" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Transaction Status</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <code className="text-xs text-gray-500 font-mono">{status.salesTransactionId}</code>
              <button
                onClick={() => copyToClipboard(status.salesTransactionId)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Status card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Current Status</p>
            <div className="mt-1">
              <StatusBadge status={status.transactionStatus} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Last Checked</p>
            <p className="text-sm text-gray-900 mt-1">
              {new Date(status.lastChecked).toLocaleString('en-AU')}
            </p>
          </div>
        </div>
      </div>

      {/* Full Momentum response */}
      {status.details && (
        <details className="bg-white rounded-xl border border-gray-200">
          <summary className="px-5 py-3 text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-50 rounded-xl">
            Momentum API Response
          </summary>
          <pre className="px-5 pb-5 text-xs text-gray-600 whitespace-pre-wrap font-mono overflow-auto max-h-96">
            {JSON.stringify(status.details, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
