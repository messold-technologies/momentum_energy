import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Link2,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
} from 'lucide-react';

import {
  agentPortalApi,
  getAgentChannel,
  AgentSessionExpiredError,
  type AgentSaleView,
} from '../../lib/agentPortalApi';

/**
 * Sales taken from this portal, so an agent who filled a form and forgot to send the
 * link can get one.
 *
 * A link cannot be shown again after it is issued. Only a SHA-256 hash of the token is
 * stored, so the original is unrecoverable by design -- anyone with database access
 * still cannot sign on a customer's behalf. What this page does instead is issue a
 * fresh link, which replaces the previous one. The wording says so, because a customer
 * sitting on the older link will find it stops working.
 */

type Props = {
  onNewSale: () => void;
  onSessionLost: () => void;
};

/** Agent-facing wording. QA's internal vocabulary stays out of the portal. */
const STATUS: Record<string, { label: string; tone: string }> = {
  agent_draft: { label: 'Link not sent', tone: 'bg-amber-100 text-amber-800' },
  awaiting_consent: { label: 'Waiting on customer', tone: 'bg-blue-100 text-blue-800' },
  consented: { label: 'Customer confirmed', tone: 'bg-green-100 text-green-800' },
  submitted: { label: 'Sent to Momentum', tone: 'bg-green-100 text-green-800' },
  rejected: { label: 'QA rejected', tone: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Cancelled', tone: 'bg-gray-100 text-gray-700' },
};

/** Statuses the server will still issue a link for. Matches the consent-link route. */
const CAN_ISSUE = ['agent_draft', 'awaiting_consent'];

function apiError(err: unknown, fallback: string): string {
  const d = (err as { response?: { data?: { error?: string } } }).response?.data;
  return d?.error ?? fallback;
}

export default function AgentSalesList({ onNewSale, onSessionLost }: Props) {
  const channel = getAgentChannel();
  const [sales, setSales] = useState<AgentSaleView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Links live here rather than on the row, so they survive a refresh of the list.
  const [links, setLinks] = useState<Record<string, string>>({});
  const [issuing, setIssuing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function handleFailure(err: unknown, fallback: string) {
    if (err instanceof AgentSessionExpiredError) return onSessionLost();
    setError(apiError(err, fallback));
  }

  async function load() {
    setLoading(true);
    try {
      setSales(await agentPortalApi.list());
      setError(null);
    } catch (err) {
      handleFailure(err, 'Could not load your sales');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function issueLink(sale: AgentSaleView) {
    setIssuing(sale.id);
    setError(null);
    try {
      const res = await agentPortalApi.consentLink(sale.id);
      setLinks((prev) => ({ ...prev, [sale.id]: res.consentUrl }));
      // Pick up the status change (agent_draft -> awaiting_consent).
      setSales((prev) => prev.map((s) => (s.id === sale.id ? { ...s, ...res } : s)));
    } catch (err) {
      handleFailure(err, 'Could not create a link for this sale');
    } finally {
      setIssuing(null);
    }
  }

  async function copy(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard blocked -- the link is on screen and can be selected by hand */
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="w-full px-6 lg:px-8 py-3 flex items-center justify-between">
          <img src="/utility-hub-logo.png" alt="Utility Hub" className="h-8" />
          <div className="flex items-center gap-4">
            {channel && (
              <span className="hidden sm:inline text-sm text-gray-500">{channel.name}</span>
            )}
            <button
              type="button"
              onClick={onNewSale}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New sale
            </button>
            <button
              type="button"
              onClick={onSessionLost}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Exit
            </button>
          </div>
        </div>
      </header>

      <main className="w-full px-6 lg:px-8 py-6 lg:py-8">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">My sales</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Create a link for any sale where the customer has not confirmed yet.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
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

        {loading ? (
          <p className="py-16 text-center text-sm text-gray-500">Loading…</p>
        ) : sales.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
            <p className="text-sm text-gray-600">No sales yet.</p>
            <button
              type="button"
              onClick={onNewSale}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Start a sale
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {sales.map((sale) => {
              const status = STATUS[sale.status] ?? {
                label: sale.status,
                tone: 'bg-gray-100 text-gray-700',
              };
              const link = links[sale.id];
              const canIssue = CAN_ISSUE.includes(sale.status);

              return (
                <li
                  key={sale.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 lg:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900">
                          {sale.customerName || 'Unnamed customer'}
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.tone}`}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {sale.selectedPlan?.planCode ? `${sale.selectedPlan.planCode} · ` : ''}
                        started {new Date(sale.createdAt).toLocaleString()}
                        {sale.consentSentAt
                          ? ` · link sent ${new Date(sale.consentSentAt).toLocaleString()}`
                          : ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {sale.consentedAt
                          ? `Customer confirmed on ${new Date(sale.consentedAt).toLocaleString()}. No link needed.`
                          : status.label}
                      </p>
                    </div>

                    {canIssue && (
                      <button
                        type="button"
                        onClick={() => void issueLink(sale)}
                        disabled={issuing === sale.id}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {issuing === sale.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Link2 className="w-4 h-4" />
                        )}
                        {sale.consentSentAt ? 'Create a new link' : 'Create a link'}
                      </button>
                    )}
                  </div>

                  {link && (
                    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <p className="text-sm font-medium text-blue-900">
                        Send this link to the customer
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          readOnly
                          value={link}
                          onFocus={(e) => e.currentTarget.select()}
                          className="flex-1 min-w-0 px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => void copy(sale.id, link)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer shrink-0"
                        >
                          {copied === sale.id ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                          {copied === sale.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-blue-800">
                        Usable once. Copy it now — it cannot be shown again. Any link sent for
                        this sale earlier has stopped working.
                      </p>
                    </div>
                  )}

                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
