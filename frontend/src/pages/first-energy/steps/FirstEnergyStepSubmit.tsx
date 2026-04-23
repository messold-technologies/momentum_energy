import { CheckCircle2, RefreshCcw, Send } from 'lucide-react';

export function FirstEnergyStepSubmit(props: {
  accountId: string | null;
  hash: string | null;
  submitting: boolean;
  error: string | null;
  result: Record<string, unknown> | null;
  onSubmit: () => void;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Submit sale</h2>
        <p className="text-sm text-gray-500 mt-1">Final validation and submission via `signup/create`.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Account ID</dt>
            <dd className="text-gray-900 font-medium">{props.accountId || '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Hash</dt>
            <dd className="text-gray-900 font-medium font-mono break-all">{props.hash || '—'}</dd>
          </div>
        </dl>
      </div>

      {props.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{props.error}</div>
      ) : null}

      {props.result ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Sale submitted successfully.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={props.onSubmit}
          disabled={props.submitting || !props.accountId || !props.hash}
          className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 cursor-pointer"
        >
          {props.submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit sale
            </>
          )}
        </button>

        <button
          type="button"
          onClick={props.onSubmit}
          disabled={props.submitting || !props.error}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
        >
          <RefreshCcw className="w-4 h-4" />
          Retry
        </button>
      </div>
    </section>
  );
}

