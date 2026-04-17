/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/set-state-in-effect */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

export const COMPANY_IDS = ['momentum', 'first-energy'] as const;
export type CompanyId = (typeof COMPANY_IDS)[number];

const STORAGE_KEY = 'utilityhub_selected_company';

function readStoredCompany(): CompanyId | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'momentum' || raw === 'first-energy') return raw;
  return null;
}

type CompanyContextValue = {
  company: CompanyId | null;
  setCompany: (c: CompanyId) => void;
  clearCompany: () => void;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [company, setCompanyState] = useState<CompanyId | null>(() => readStoredCompany());

  const setCompany = useCallback((c: CompanyId) => {
    localStorage.setItem(STORAGE_KEY, c);
    setCompanyState(c);
  }, []);

  const clearCompany = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCompanyState(null);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) clearCompany();
  }, [user, loading, clearCompany]);

  const value = useMemo(
    () => ({
      company,
      setCompany,
      clearCompany,
    }),
    [company, setCompany, clearCompany]
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}

/** Sync selected company from URL prefix (`/momentum/...` or `/first-energy/...`). */
export function useSyncCompanyFromPath(pathname: string) {
  const { setCompany } = useCompany();

  useEffect(() => {
    if (pathname.startsWith('/momentum')) {
      setCompany('momentum');
    } else if (pathname.startsWith('/first-energy')) {
      setCompany('first-energy');
    }
  }, [pathname, setCompany]);
}
