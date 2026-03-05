import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import NewTransactionPage from './pages/NewTransactionPage';
import TransactionDetailPage from './pages/TransactionDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions/new" element={<NewTransactionPage />} />
          <Route path="/transactions/:reference" element={<TransactionDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
