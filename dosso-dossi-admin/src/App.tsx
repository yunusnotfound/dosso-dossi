import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { OrdersPage } from './features/orders/OrdersPage';
import { MenuPage } from './features/menu/MenuPage';
import { BranchesPage } from './features/branches/BranchesPage';
import { CampaignsPage } from './features/campaigns/CampaignsPage';
import { CustomersPage } from './features/customers/CustomersPage';
import { FinancePage } from './features/finance/FinancePage';
import { PosPage } from './features/pos/PosPage';
import { AdminsPage } from './features/admins/AdminsPage';
import { AppShell } from './routes/AppShell';
import { Spinner } from './components/ui';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Oturum düşünce zaten yönlendiriliyoruz; 401'i tekrar denemek anlamsız.
      retry: (count, error) =>
        count < 2 && !(error as { status?: number }).status?.toString().startsWith('4'),
      staleTime: 30_000,
    },
  },
});

/// Oturum yoksa login; varsa panel kabuğu. İlk açılışta saklı token
/// doğrulanana kadar hiçbir yere yönlendirme yapılmaz (yanıp sönmesin).
function Gate() {
  const { admin, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!admin) return <LoginPage />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/siparisler" element={<OrdersPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/subeler" element={<BranchesPage />} />
        <Route path="/kampanyalar" element={<CampaignsPage />} />
        <Route path="/musteriler" element={<CustomersPage />} />
        <Route path="/finans" element={<FinancePage />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/yonetim" element={<AdminsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
