import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, Loader2, Send, X } from 'lucide-react';

import { PayloadViewer } from '../../components/PayloadViewer';
import {
  agentSalesApi,
  STATUS_CLASS,
  STATUS_LABEL,
  type AgentSale,
} from '../../lib/agentSalesApi';

function apiError(err: unknown, fallback: string): string {
  const d = (err as { response?: { data?: { error?: string } } }).response?.data;
  return d?.error ?? fallback;
}

export default function AgentSaleReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [sale, setSale] = useState<AgentSale | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<'submit' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    agentSalesApi
      .get(id)
      .then(setSale)
      .catch((err) => setError(apiError(err, 'Could not load this sale')))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit() {
    if (!sale) return;
    setBusyAction('submit');
    setError(null);
    try {
      const updated = await agentSalesApi.submit(sale.id);
      setSale(updated);
    } catch (err) {
      setError(apiError(err, 'Submission failed'));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReject() {
    if (!sale || !reason.trim()) return;
    setBusyAction('reject');
    setError(null);
    try {
      const updated = await agentSalesApi.reject(sale.id, reason.trim());
      setSale(updated);
      setRejecting(false);
    } catch (err) {
      setError(apiError(err, 'Could not reject this sale'));
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <p className="text-gray-600">{error ?? 'Sale not found.'}</p>
        <Link to="/momentum/agent/sales" className="mt-4 inline-block text-primary-700 hover:underline">
          Back to agent sales
        </Link>
      </div>
    );
  }

  const plan = sale.selectedPlan;
  const canSubmit = sale.status === 'consented';
  const editable = ['agent_draft', 'awaiting_consent'].includes(sale.status);

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        to="/momentum/agent/sales"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Agent sales
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{sale.customerName ?? 'Agent sale'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{sale.serviceAddress ?? ''}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[sale.status]}`}>
          {STATUS_LABEL[sale.status]}
        </span>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {sale.status === 'submitted' && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <p className="flex items-center gap-2 font-medium">
            <Check className="w-4 h-4" />
            Submitted to Momentum
          </p>
          <p className="mt-1">
            salesTransactionId: <span className="font-mono">{sale.salesTransactionId}</span>
          </p>
        </div>
      )}

      {sale.status === 'rejected' && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-medium">Rejected</p>
          <p className="mt-1">{sale.rejectionReason}</p>
        </div>
      )}

      {/* ------------------------------------------------------------ plan + consent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-900">Plan quoted to the customer</p>
          {plan ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Plan</dt>
                <dd className="font-medium text-gray-900">{plan.planCode}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Price shown</dt>
                <dd className="font-medium text-gray-900">
                  {plan.monthlyCost != null ? `$${plan.monthlyCost}/mth` : 'Rates only'}
                  {plan.annualCost != null ? ` · $${plan.annualCost}/yr` : ''}
                </dd>
              </div>
              {plan.comparisonLabel && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Comparison</dt>
                  <dd className="text-gray-900">
                    {plan.comparisonLabel} {plan.benchmarkName}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Network / tariff</dt>
                <dd className="text-gray-900">
                  {plan.networkName} · {plan.retailTariffCode}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Offer code</dt>
                <dd className="font-mono text-xs text-gray-900 break-all">{plan.offerCode}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-gray-500">No plan recorded.</p>
          )}

          {plan?.indicativeOnly && (
            <p className="mt-3 flex items-start gap-1.5 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
              Quoted on flat-rate pricing without the site's network tariff. Confirm the tariff is
              right for this site before submitting — the offer code may not match the meter
              configuration.
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-900">Customer consent</p>
          {sale.consentedAt ? (
            <>
              <p className="mt-2 text-sm text-gray-700">
                Consented {new Date(sale.consentedAt).toLocaleString()}
              </p>
              <ul className="mt-3 space-y-1.5">
                {sale.consent?.statementsShown?.map((s) => (
                  <li key={s.key} className="flex items-start gap-2 text-sm">
                    {sale.consent?.items?.[s.key] ? (
                      <Check className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
                    ) : (
                      <X className="w-4 h-4 mt-0.5 text-gray-300 shrink-0" />
                    )}
                    <span className={sale.consent?.items?.[s.key] ? 'text-gray-900' : 'text-gray-400'}>
                      {s.label}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              {sale.consentSentAt
                ? `Link sent ${new Date(sale.consentSentAt).toLocaleString()}, not yet used.`
                : 'No consent link issued yet.'}
            </p>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------------- payload */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <p className="text-sm font-semibold text-gray-900 mb-3">Sale details</p>
        {sale.payload ? (
          <PayloadViewer payload={sale.payload as unknown as Record<string, unknown>} />
        ) : (
          <p className="text-sm text-gray-500">No payload.</p>
        )}
      </div>

      {/* --------------------------------------------------------------- actions */}
      <div className="flex flex-wrap items-center gap-3">
        {editable && (
          <button
            type="button"
            onClick={() => navigate(`/momentum/agent/sales/${sale.id}/edit`)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            Edit sale
          </button>
        )}

        {canSubmit && (
          <>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 cursor-pointer"
            >
              {busyAction === 'submit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit to Momentum
            </button>
            <button
              type="button"
              onClick={() => setRejecting((v) => !v)}
              disabled={busyAction !== null}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 cursor-pointer"
            >
              Reject
            </button>
          </>
        )}
      </div>

      {rejecting && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <label className="block text-sm font-medium text-red-900 mb-2">Reason for rejection</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg focus:ring-2 focus:ring-red-400"
            placeholder="What needs fixing?"
          />
          <button
            type="button"
            onClick={() => void handleReject()}
            disabled={busyAction !== null || !reason.trim()}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 cursor-pointer"
          >
            {busyAction === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Confirm rejection
          </button>
        </div>
      )}
    </div>
  );
}
