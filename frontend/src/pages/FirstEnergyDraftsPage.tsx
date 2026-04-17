import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import moment from 'moment-timezone';
import { FileEdit, Trash2 } from 'lucide-react';
import { draftsApi, type Draft } from '../lib/api';
import { getApiErrorMessage } from '../lib/errorMessage';

const COMPANY_ID = 'first-energy' as const;

export default function FirstEnergyDraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await draftsApi.list({ limit: 200, companyId: COMPANY_ID });
        if (!mounted) return;
        setDrafts(res.drafts || []);
      } catch (e) {
        if (!mounted) return;
        setError(getApiErrorMessage(e, 'Failed to load drafts'));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleDelete(id: string) {
    const ok = globalThis.confirm('Delete this draft? This cannot be undone.');
    if (!ok) return;
    setDeletingId(id);
    setError(null);
    try {
      await draftsApi.delete(id, { companyId: COMPANY_ID });
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to delete draft'));
    } finally {
      setDeletingId(null);
    }
  }

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
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Drafts</h1>
        <p className="text-sm text-gray-500 mt-1">Saved 1st Energy account forms — resume and submit when ready</p>
      </div>

      {drafts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          <FileEdit className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No saved drafts yet.</p>
          <p className="text-sm mt-1">Start a new sale and click Save draft to save your progress.</p>
          <Link to="/first-energy/transactions/new" className="inline-block mt-4 text-primary-600 hover:text-primary-700 font-medium">
            New sale
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4 hover:border-amber-300 transition-colors"
            >
              <button
                type="button"
                onClick={() => navigate(`/first-energy/transactions/new?draft=${d.id}`)}
                className="text-left flex-1 min-w-0 cursor-pointer"
              >
                <p className="font-medium text-gray-900 truncate">{d.preview || 'Draft'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Updated {moment(d.updatedAt).tz('Australia/Sydney').format('YYYY-MM-DD HH:mm')}
                </p>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/first-energy/transactions/new?draft=${d.id}`)}
                className="px-3 py-2 text-sm bg-amber-50 text-amber-800 rounded-lg hover:bg-amber-100 cursor-pointer"
              >
                Resume
              </button>
              <button
                type="button"
                disabled={deletingId === d.id}
                onClick={() => handleDelete(d.id)}
                className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-50 cursor-pointer"
                aria-label="Delete draft"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

