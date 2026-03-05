import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { transactionApi, adminApi } from '../lib/api';
import type { TransactionRecord } from '../lib/types';
import StatusBadge from '../components/ui/StatusBadge';
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FilePlus,
  Search,
  TrendingUp,
  FileText,
  Clock,
} from 'lucide-react';

interface Stats {
  statusCounts: Array<{ status: string; count: string }>;
  recentActivity: TransactionRecord[];
  todayCount: number;
}

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [filterType, setFilterType] = useState(searchParams.get('serviceType') || '');
  const [searchRef, setSearchRef] = useState('');

  const page = parseInt(searchParams.get('page') || '1');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 10 };
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.serviceType = filterType;

      const [txResult, statsResult] = await Promise.all([
        transactionApi.list(params),
        adminApi.stats().catch(() => null),
      ]);

      setTransactions(txResult.data);
      setPagination(txResult.pagination);
      if (statsResult?.success) setStats(statsResult.data);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function setPage(p: number) {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
    setSearchParams(params);
  }

  function applyFilters() {
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (filterType) params.set('serviceType', filterType);
    params.set('page', '1');
    setSearchParams(params);
  }

  function clearFilters() {
    setFilterStatus('');
    setFilterType('');
    setSearchParams({ page: '1' });
  }

  const statCards = [
    {
      label: 'Total Transactions',
      value: pagination.total,
      icon: FileText,
      color: 'bg-primary-50 text-primary-700',
    },
    {
      label: 'Today',
      value: stats?.todayCount ?? '-',
      icon: Clock,
      color: 'bg-green-50 text-green-700',
    },
    {
      label: 'Accepted',
      value: stats?.statusCounts?.find((s) => s.status === 'ACCEPTED')?.count ?? '0',
      icon: TrendingUp,
      color: 'bg-emerald-50 text-emerald-700',
    },
  ];

  const filteredBySearch = searchRef
    ? transactions.filter(
        (t) =>
          t.internal_reference?.toLowerCase().includes(searchRef.toLowerCase()) ||
          t.sales_transaction_id?.toLowerCase().includes(searchRef.toLowerCase()) ||
          t.customer_name?.toLowerCase().includes(searchRef.toLowerCase())
      )
    : transactions;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of your sales transactions</p>
        </div>
        <Link
          to="/transactions/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition-colors"
        >
          <FilePlus className="w-4 h-4" />
          New Transaction
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              {[
                'PENDING_SUBMISSION',
                'SUBMITTED',
                'ACCEPTED',
                'FAILED',
                'CANCELLED',
                'REJECTED',
                'VALIDATION_FAILED',
                'ONHOLD',
                'PENDING',
                'SUBMISSION_FAILED',
              ].map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Service Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Types</option>
              <option value="GAS">GAS</option>
              <option value="POWER">POWER</option>
            </select>
          </div>
          <button
            onClick={applyFilters}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 cursor-pointer"
          >
            Apply
          </button>
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 cursor-pointer"
          >
            Clear
          </button>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search reference..."
                value={searchRef}
                onChange={(e) => setSearchRef(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 w-52"
              />
            </div>
            <button
              onClick={fetchData}
              className="p-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Reference</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    <div className="w-6 h-6 border-2 border-gray-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-2" />
                    Loading...
                  </td>
                </tr>
              ) : filteredBySearch.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredBySearch.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/transactions/${tx.sales_transaction_id || tx.internal_reference}`}
                        className="text-primary-600 hover:text-primary-700 font-medium"
                      >
                        {tx.internal_reference?.slice(0, 16)}...
                      </Link>
                      {tx.sales_transaction_id && (
                        <p className="text-xs text-gray-400 font-mono mt-0.5">
                          {tx.sales_transaction_id}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{tx.customer_name}</p>
                      <p className="text-xs text-gray-500">{tx.customer_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span className="font-medium text-gray-700">{tx.service_type}</span>
                        <span className="text-gray-400">/</span>
                        <span className="text-gray-500">{tx.service_subtype}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(tx.created_at).toLocaleDateString('en-AU', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">
              Showing {(pagination.page - 1) * pagination.limit + 1}-
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium cursor-pointer ${
                    p === page
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 hover:bg-white'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.pages}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
