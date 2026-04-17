import { Navigate, useParams } from 'react-router-dom';

/** Redirects `/transactions/:reference` → `/momentum/transactions/:reference` */
export function LegacyTransactionRedirect() {
  const { reference } = useParams<{ reference: string }>();
  if (!reference) return <Navigate to="/momentum/transactions/new" replace />;
  return <Navigate to={`/momentum/transactions/${encodeURIComponent(reference)}`} replace />;
}
