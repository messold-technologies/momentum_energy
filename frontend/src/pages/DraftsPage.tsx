import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileEdit, Trash2 } from 'lucide-react';
import { draftsApi, type Draft } from '../lib/api';
import moment from 'moment-timezone';

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadDrafts() {
      try {
        const res = await draftsApi.list();
        setDrafts(res.drafts || []);
      } catch (err) {
        setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load drafts');
      } finally {
        setLoading(false);
      }
    }
    loadDrafts();
  }, []);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await draftsApi.delete(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete draft');
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Drafts</h1>
        <p className="text-sm text-gray-500 mt-1">Saved transaction forms — resume and submit when ready</p>
      </div>

      {drafts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          <FileEdit className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No saved drafts yet.</p>
          <p className="text-sm mt-1">Start a new transaction and click Save draft to save your progress.</p>
          <Link to="/transactions/new" className="inline-block mt-4 text-primary-600 hover:text-primary-700 font-medium">
            New Transaction
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-xl border border-gray-200 flex items-center justify-between gap-4 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {d.preview === 'Untitled' ? 'Untitled draft' : d.preview}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {moment.tz(d.updatedAt, 'Australia/Sydney').format('MMM D, YYYY · h:mm A')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate(`/transactions/new?draft=${d.id}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 cursor-pointer"
                >
                  <FileEdit className="w-4 h-4" />
                  Resume
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(d.id)}
                  disabled={deletingId === d.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {deletingId === d.id ? (
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
