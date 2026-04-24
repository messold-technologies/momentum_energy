import { useMemo, useState } from 'react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { Check, CheckCircle2, Copy, RefreshCcw, Send } from 'lucide-react';

export function FirstEnergyStepSubmit(
  props: Readonly<{
    accountId: string | null;
    hash: string | null;
    submitting: boolean;
    error: string | null;
    result: Record<string, unknown> | null;
    onSubmit: () => void;
  }>,
) {
  const [copied, setCopied] = useState(false);

  const markCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyText = useMemo(() => {
    if (props.result) {
      try {
        return JSON.stringify(props.result, null, 2);
      } catch {
        // fall through
      }
    }
    if (props.accountId || props.hash) {
      return JSON.stringify({ account_id: props.accountId, hash: props.hash }, null, 2);
    }
    return '';
  }, [props.accountId, props.hash, props.result]);

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
            <dd className="text-gray-900 font-medium font-mono break-all flex items-center gap-2">
              <span>{props.hash || '—'}</span>
              {props.hash ? (
                <CopyToClipboard text={String(props.hash)} onCopy={markCopied}>
                  <button type="button" className="text-gray-400 hover:text-gray-600 cursor-pointer" aria-label="Copy hash">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </CopyToClipboard>
              ) : null}
            </dd>
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

      {(props.result || props.accountId || props.hash) && copyText ? (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Response / payload</p>
              <p className="text-xs text-gray-500">Copy and re-submit after editing if needed.</p>
            </div>
            <CopyToClipboard text={copyText} onCopy={markCopied}>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </CopyToClipboard>
          </div>
          <pre className="p-4 text-xs bg-gray-50 overflow-auto max-h-[420px]">{copyText}</pre>
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

