import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { transactionApi } from '../lib/api';
import StatusBadge from '../components/ui/StatusBadge';
import { ArrowLeft, RefreshCw, Copy, Check } from 'lucide-react';

interface TransactionStatus {
  salesTransactionId: string;
  transactionStatus: string;
  lastChecked: string;
  [key: string]: unknown;
}

/** Renders any API response field value */
function formatValue(val: unknown): string {
  if (val === null) return 'null';
  if (val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
    try {
      return new Date(val).toLocaleString('en-AU');
    } catch {
      return val;
    }
  }
  if (typeof val === 'object') return ''; // handled by recursive render
  return String(val);
}

/** Safe string for display (handles objects without [object Object]) */
function toDisplayString(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

/** Recursively renders an object as key-value sections (for unknown/extra fields) */
function ResponseField({ label, value, depth = 0 }: { label: string; value: unknown; depth?: number }) {
  const fmt = formatValue(value);
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && fmt === '') {
    const entries = Object.entries(value);
    if (entries.length === 0) return null;
    return (
      <div className={depth > 0 ? 'mt-3 pl-4 border-l-2 border-gray-100' : ''}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
        <div className="space-y-2">
          {entries.map(([k, v]) => (
            <ResponseField key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())} value={v} depth={depth + 1} />
          ))}
        </div>
      </div>
    );
  }
  if (Array.isArray(value)) {
    return (
      <div className={depth > 0 ? 'mt-2' : ''}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
        <div className="space-y-2 pl-3 border-l-2 border-gray-100">
          {value.map((item, i) =>
            typeof item === 'object' && item !== null && !Array.isArray(item) ? (
              <ResponseField key={i} label={`Item ${i + 1}`} value={item} depth={depth + 1} />
            ) : (
              <p key={i} className="text-sm text-gray-900 font-mono">
                {formatValue(item)}
              </p>
            )
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 py-1">
      <span className="text-sm text-gray-500 shrink-0">{label}:</span>
      <span className="text-sm text-gray-900 font-mono break-all">{fmt}</span>
    </div>
  );
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

      {/* Extract payload: Momentum returns { status, data }, our backend wraps as { ..., details } */}
      {(() => {
        const momentum = status.details as Record<string, unknown> | undefined;
        const payload = (momentum?.data ?? status) as Record<string, unknown>;
        const apiStatus = (momentum?.status ?? status.status) as string | undefined;
        const saleStatusVal = (payload?.status as Record<string, unknown>)?.saleStatus ?? status.transactionStatus;
        const service = payload?.service as Record<string, unknown> | undefined;
        const transaction = payload?.transaction as Record<string, unknown> | undefined;
        return (
          <>
            {/* API invocation status */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">API Invocation Status</p>
                  <div className="mt-1">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      apiStatus === 'SUCCESS' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {apiStatus || '—'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Last Checked</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {status.lastChecked ? new Date(status.lastChecked).toLocaleString('en-AU') : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Overview: salesTransactionId, salesTransactionCreationDate */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Overview</h2>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <span className="text-sm text-gray-500 shrink-0">Sales Transaction ID:</span>
                  <span className="text-sm text-gray-900 font-mono break-all">
                    {(payload?.salesTransactionId ?? status.salesTransactionId) as string}
                  </span>
                  <button onClick={() => copyToClipboard(toDisplayString(payload?.salesTransactionId ?? status.salesTransactionId))} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <span className="text-sm text-gray-500 shrink-0">Transaction Creation Date:</span>
                  <span className="text-sm text-gray-900 font-mono">
                    {payload?.salesTransactionCreationDate
                      ? new Date(payload.salesTransactionCreationDate as string).toLocaleString('en-AU')
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Sale Status */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Sale Status</h2>
              <p className="text-xs text-gray-500 mb-2">
                Status of the sale: Accepted, Failed, Cancelled, Rejected, Validation Failed, On Hold, or Pending.
              </p>
              <StatusBadge status={toDisplayString(saleStatusVal ?? '—')} />
            </div>

            {/* Service section */}
            {service && Object.keys(service).length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Service</h2>
                <div className="space-y-3">
                  {service.serviceType != null && (
                    <div className="flex flex-wrap gap-x-2">
                      <span className="text-sm text-gray-500 shrink-0">Service Type:</span>
                      <span className="text-sm text-gray-900 font-mono">{toDisplayString(service.serviceType)}</span>
                    </div>
                  )}
                  {service.serviceSubType != null && (
                    <div className="flex flex-wrap gap-x-2">
                      <span className="text-sm text-gray-500 shrink-0">Service Sub Type:</span>
                      <span className="text-sm text-gray-900 font-mono">{toDisplayString(service.serviceSubType)}</span>
                    </div>
                  )}
                  {service.serviceConnectionId != null && (
                    <div className="flex flex-wrap gap-x-2">
                      <span className="text-sm text-gray-500 shrink-0">Service Connection ID (NMI/MIRN):</span>
                      <span className="text-sm text-gray-900 font-mono">{toDisplayString(service.serviceConnectionId)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Transaction section */}
            {transaction && Object.keys(transaction).length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Transaction</h2>
                <div className="space-y-3">
                  {transaction.transactionReference != null && (
                    <div className="flex flex-wrap gap-x-2">
                      <span className="text-sm text-gray-500 shrink-0">Transaction Reference:</span>
                      <span className="text-sm text-gray-900 font-mono">{toDisplayString(transaction.transactionReference)}</span>
                    </div>
                  )}
                  {transaction.transactionChannel != null && (
                    <div className="flex flex-wrap gap-x-2">
                      <span className="text-sm text-gray-500 shrink-0">Transaction Channel:</span>
                      <span className="text-sm text-gray-900 font-mono">{toDisplayString(transaction.transactionChannel)}</span>
                    </div>
                  )}
                  {transaction.transactionDate != null && (
                    <div className="flex flex-wrap gap-x-2">
                      <span className="text-sm text-gray-500 shrink-0">Transaction Date:</span>
                      <span className="text-sm text-gray-900 font-mono">
                        {new Date(transaction.transactionDate as string).toLocaleString('en-AU')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Any other API response fields not in the spec */}
            {(() => {
              const knownKeys = new Set(['salesTransactionId', 'salesTransactionCreationDate', 'status', 'service', 'transaction', 'details', 'lastChecked', 'transactionStatus']);
              const extra = Object.entries(status).filter(([k]) => !knownKeys.has(k));
              const payloadKeys = payload && payload !== status ? Object.keys(payload) : [];
              const extraPayload = payloadKeys.filter((k) => !['salesTransactionId', 'salesTransactionCreationDate', 'status', 'service', 'transaction'].includes(k));
              const allExtra: [string, unknown][] = [...extra, ...extraPayload.map((k) => [k, payload[k]] as [string, unknown])];
              if (allExtra.length === 0) return null;
              return (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-sm font-semibold text-gray-900 mb-4">Additional Response Fields</h2>
                  <div className="space-y-4 divide-y divide-gray-100">
                    {allExtra.map(([key, value]) => (
                      <ResponseField
                        key={key}
                        label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                        value={value}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        );
      })()}
    </div>
  );
}
