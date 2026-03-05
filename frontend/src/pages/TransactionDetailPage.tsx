import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { transactionApi } from '../lib/api';
import type { TransactionRecord } from '../lib/types';
import StatusBadge from '../components/ui/StatusBadge';
import { ArrowLeft, RefreshCw, Copy, Check } from 'lucide-react';

export default function TransactionDetailPage() {
  const { reference } = useParams<{ reference: string }>();
  const [transaction, setTransaction] = useState<TransactionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!reference) return;
    setLoading(true);
    transactionApi
      .getByReference(reference)
      .then((res) => setTransaction(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Transaction not found'))
      .finally(() => setLoading(false));
  }, [reference]);

  async function handleRefreshStatus() {
    if (!transaction?.sales_transaction_id) return;
    setRefreshing(true);
    try {
      const result = await transactionApi.refreshStatus(transaction.sales_transaction_id);
      setTransaction((prev) =>
        prev ? { ...prev, status: result.data.transactionStatus, updated_at: new Date().toISOString() } : prev
      );
    } catch {
      // status refresh failed silently
    } finally {
      setRefreshing(false);
    }
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

  if (error || !transaction) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">{error || 'Transaction not found'}</p>
        <Link to="/" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const payload = transaction.submission_payload;

  const infoSections = [
    {
      title: 'Transaction',
      items: [
        { label: 'Internal Reference', value: transaction.internal_reference },
        { label: 'Sales Transaction ID', value: transaction.sales_transaction_id || '-' },
        { label: 'Status', value: transaction.status, badge: true },
        { label: 'Channel', value: transaction.channel_name },
        { label: 'Created', value: new Date(transaction.created_at).toLocaleString('en-AU') },
        { label: 'Updated', value: new Date(transaction.updated_at).toLocaleString('en-AU') },
      ],
    },
    {
      title: 'Customer',
      items: [
        { label: 'Name', value: transaction.customer_name },
        { label: 'Email', value: transaction.customer_email || '-' },
        { label: 'Type', value: transaction.customer_type },
        { label: 'Service Address', value: transaction.service_address || '-' },
      ],
    },
    {
      title: 'Service',
      items: [
        { label: 'Type', value: `${transaction.service_type} / ${transaction.service_subtype}` },
        { label: 'Connection ID', value: payload?.service?.serviceConnectionId || '-' },
        { label: 'Offer Code', value: transaction.offer_code || '-' },
        { label: 'Bill Cycle', value: payload?.service?.billingDetails?.billCycleCode || '-' },
        { label: 'Contract Term', value: payload?.service?.billingDetails?.contractTerm || '-' },
        { label: 'Payment Method', value: payload?.service?.billingDetails?.paymentMethod || '-' },
      ],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Transaction Details</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <code className="text-xs text-gray-500 font-mono">
                {transaction.internal_reference}
              </code>
              <button
                onClick={() => copyToClipboard(transaction.internal_reference)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {transaction.sales_transaction_id && (
          <button
            onClick={handleRefreshStatus}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        )}
      </div>

      {/* Status banner */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Current Status</p>
          <div className="mt-1">
            <StatusBadge status={transaction.status} />
          </div>
        </div>
        {transaction.sales_transaction_id && (
          <div className="text-right">
            <p className="text-sm text-gray-500">Momentum Transaction ID</p>
            <code className="text-sm font-mono text-gray-900 font-semibold">
              {transaction.sales_transaction_id}
            </code>
          </div>
        )}
      </div>

      {/* Info sections */}
      {infoSections.map((section) => (
        <div key={section.title} className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
          </div>
          <div className="p-5">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {section.items.map((item) => (
                <div key={item.label}>
                  <dt className="text-xs font-medium text-gray-500">{item.label}</dt>
                  <dd className="mt-0.5 text-sm text-gray-900">
                    {item.badge ? <StatusBadge status={item.value} /> : item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ))}

      {/* Error details */}
      {transaction.error_details && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-5">
          <h3 className="text-sm font-semibold text-red-800 mb-2">Error Details</h3>
          <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono overflow-auto max-h-48">
            {typeof transaction.error_details === 'string'
              ? transaction.error_details
              : JSON.stringify(transaction.error_details, null, 2)}
          </pre>
        </div>
      )}

      {/* Raw response */}
      {transaction.momentum_response && (
        <details className="bg-white rounded-xl border border-gray-200">
          <summary className="px-5 py-3 text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-50 rounded-xl">
            Momentum API Response
          </summary>
          <pre className="px-5 pb-5 text-xs text-gray-600 whitespace-pre-wrap font-mono overflow-auto max-h-64">
            {JSON.stringify(transaction.momentum_response, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
