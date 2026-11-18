import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, RefreshCw } from 'lucide-react';

import {
  agentSalesApi,
  STATUS_CLASS,
  STATUS_LABEL,
  type AgentSale,
  type AgentSaleStatus,
} from '../../lib/agentSalesApi';

const FILTERS: Array<{ label: string; statuses?: AgentSaleStatus[] }> = [
  { label: 'Ready for QA', statuses: ['consented'] },
  { label: 'Awaiting consent', statuses: ['awaiting_consent'] },
  { label: 'Drafts', statuses: ['agent_draft'] },
  { label: 'Submitted', statuses: ['submitted'] },
  { label: 'All' },
];

export default function AgentSalesQueuePage() {
  const [filter, setFilter] = useState(0);
  const [rows, setRows] = useState<AgentSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load(index = filter) {
    setLoading(true);
    setError(null);
    agentSalesApi
      .list(FILTERS[index].statuses)
      .then(setRows)
      .catch(() => setError('Could not load agent sales'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Agent sales</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Sales captured on the agent portal. QA reviews and submits them to Momentum.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <Link
            to="/momentum/agent/sales/new"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            New sale
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f, i) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setFilter(i)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg cursor-pointer ${
              i === filter
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading...
          </div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">No sales in this view.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Service address</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.customerName ?? '—'}</p>
                      <p className="text-xs text-gray-500">{r.customerEmail ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.serviceAddress ?? '—'}</td>
                    <td className="px-4 py-3">
                      {r.selectedPlan ? (
                        <>
                          <p className="text-gray-900">{r.selectedPlan.planCode}</p>
                          <p className="text-xs text-gray-500">
                            {r.selectedPlan.monthlyCost != null
                              ? `$${r.selectedPlan.monthlyCost}/mth`
                              : 'Rates only'}
                            {r.selectedPlan.indicativeOnly ? ' · indicative' : ''}
                          </p>
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{r.agentName ?? r.createdByName ?? '—'}</p>
                      {r.fromAgentPortal && (
                        <p className="text-xs text-gray-500" title="Entered by the agent; the portal uses a shared password">
                          Agent portal · self-reported
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[r.status]}`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/momentum/agent/sales/${r.id}`}
                        className="text-sm font-medium text-primary-700 hover:underline"
                      >
                        {r.status === 'consented' ? 'Review' : 'Open'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
