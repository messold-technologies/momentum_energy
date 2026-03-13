import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FilePlus, Search, Zap } from 'lucide-react';

export default function DashboardPage() {
  const [salesTransactionId, setSalesTransactionId] = useState('');
  const navigate = useNavigate();

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const id = salesTransactionId.trim();
    if (id) {
      navigate(`/transactions/${id}`);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Zap className="w-8 h-8 text-primary-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Momentum Energy Sales Portal</h1>
        <p className="text-gray-500 mt-2">Submit sales transactions and check their status</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/transactions/new?fresh=1"
          className="bg-white rounded-xl border border-gray-200 p-6 hover:border-primary-300 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary-100 transition-colors">
            <FilePlus className="w-6 h-6 text-primary-600" />
          </div>
          <h2 className="font-semibold text-gray-900">New Transaction</h2>
          <p className="text-sm text-gray-500 mt-1">Submit a new sales transaction to Momentum Energy</p>
        </Link>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="font-semibold text-gray-900">Check Status</h2>
          <p className="text-sm text-gray-500 mt-1">Look up a transaction by its Momentum ID</p>
          <form onSubmit={handleLookup} className="mt-4 flex gap-2">
            <input
              type="text"
              value={salesTransactionId}
              onChange={(e) => setSalesTransactionId(e.target.value)}
              placeholder="Sales Transaction ID"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <button
              type="submit"
              disabled={!salesTransactionId.trim()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-40 cursor-pointer transition-colors"
            >
              Look up
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
