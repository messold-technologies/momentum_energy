import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CompanyProvider } from './contexts/CompanyContext';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import DashboardPage from './pages/DashboardPage';
import NewTransactionPage from './pages/NewTransactionPage';
import TransactionDetailPage from './pages/TransactionDetailPage';
import DraftsPage from './pages/DraftsPage';
import FormResponsesPage from './pages/FormResponsesPage';
import ExcelDashboardPage from './pages/ExcelDashboardPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SelectCompanyPage from './pages/SelectCompanyPage';
import FirstEnergyNewTransactionPage from './pages/FirstEnergyNewTransactionPage';
import FirstEnergyDraftsPage from './pages/FirstEnergyDraftsPage';
import FirstEnergyFormResponsesPage from './pages/FirstEnergyFormResponsesPage';
import { LegacyTransactionRedirect } from './components/LegacyMomentumRedirect';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CompanyProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="select-company" element={<SelectCompanyPage />} />
              <Route path="momentum/transactions/new" element={<NewTransactionPage />} />
              <Route path="momentum/transactions/:reference" element={<TransactionDetailPage />} />
              <Route path="momentum/drafts" element={<DraftsPage />} />
              <Route path="momentum/form-responses" element={<FormResponsesPage />} />
              <Route
                path="momentum/excel-dashboard"
                element={
                  <AdminRoute>
                    <ExcelDashboardPage />
                  </AdminRoute>
                }
              />
              <Route path="first-energy/transactions/new" element={<FirstEnergyNewTransactionPage />} />
              <Route path="first-energy/drafts" element={<FirstEnergyDraftsPage />} />
              <Route path="first-energy/form-responses" element={<FirstEnergyFormResponsesPage />} />
              {/* Legacy URLs → Momentum (existing bookmarks) */}
              <Route path="transactions/new" element={<Navigate to="/momentum/transactions/new" replace />} />
              <Route path="transactions/:reference" element={<LegacyTransactionRedirect />} />
              <Route path="drafts" element={<Navigate to="/momentum/drafts" replace />} />
              <Route path="form-responses" element={<Navigate to="/momentum/form-responses" replace />} />
              <Route path="excel-dashboard" element={<Navigate to="/momentum/excel-dashboard" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
