import type { TransactionStatus } from '../../lib/types';

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  SUBMITTED: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Submitted' },
  ACCEPTED: { bg: 'bg-green-50', text: 'text-green-700', label: 'Accepted' },
  FAILED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Failed' },
  CANCELLED: { bg: 'bg-gray-50', text: 'text-gray-700', label: 'Cancelled' },
  REJECTED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Rejected' },
  VALIDATION_FAILED: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Validation Failed' },
  ONHOLD: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'On Hold' },
  PENDING: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Pending' },
};

export default function StatusBadge({ status }: { status: TransactionStatus | string }) {
  const config = statusConfig[status] || {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    label: status,
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}
