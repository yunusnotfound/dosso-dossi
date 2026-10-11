import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { useAuth } from './auth/auth-state';
import { Spinner } from './components/ui';
import { ChangePassword } from './features/auth/ChangePassword';
import { LoginPage } from './features/auth/LoginPage';
import { AppShell } from './routes/AppShell';
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const OrdersPage = lazy(() => import('./features/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const MenuPage = lazy(() => import('./features/menu/MenuPage').then((m) => ({ default: m.MenuPage })));
const BranchesPage = lazy(() => import('./features/branches/BranchesPage').then((m) => ({ default: m.BranchesPage })));
const CampaignsPage = lazy(() => import('./features/campaigns/CampaignsPage').then((m) => ({ default: m.CampaignsPage })));
const CustomersPage = lazy(() => import('./features/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const AccountRequestsPage = lazy(() => import('./features/account-requests/AccountRequestsPage').then((m) => ({ default: m.AccountRequestsPage })));
const FinancePage = lazy(() => import('./features/finance/FinancePage').then((m) => ({ default: m.FinancePage })));
const PosPage = lazy(() => import('./features/pos/PosPage').then((m) => ({ default: m.PosPage })));
const AdminsPage = lazy(() => import('./features/admins/AdminsPage').then((m) => ({ default: m.AdminsPage })));

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      // Oturum düşünce zaten yönlendiriliyoruz; 401'i tekrar denemek anlamsız.
      retry: (count, error) =>
        count < 2 && !(error as { status?: number }).status?.toString().startsWith('4'),
      staleTime: 30_000,
    },
  },
});

function SessionQueries({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  useEffect(() => () => {
    void client.cancelQueries();
    client.clear();
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function AuthenticatedApp() {
  const { admin, sessionKey } = useAuth();
  const scope = `${sessionKey}:${admin?.id}:${admin?.role}:${admin?.branchId}`;
  return (
    <SessionQueries key={scope}>
      <BrowserRouter><Suspense fallback={<Spinner />}><Gate /></Suspense></BrowserRouter>
    </SessionQueries>
  );
}
function CentralOnly({ children }: { children: ReactNode }) {
  const { admin } = useAuth();
  return admin?.role === 'BRANCH_MANAGER' ? <Navigate to="/" replace /> : children;
}
function SuperOnly({ children }: { children: ReactNode }) {
  const { admin } = useAuth();
  return admin?.role !== 'SUPER_ADMIN' ? <Navigate to="/" replace /> : children;
}

/// Oturum yoksa login; varsa panel kabuğu. İlk açılışta saklı token
/// doğrulanana kadar hiçbir yere yönlendirme yapılmaz (yanıp sönmesin).
function Gate() {
  const { admin, loading, logout } = useAuth();
  if (loading) return <Spinner />;
  if (!admin) return <LoginPage />;
  if (admin.mustChangePassword) return <ChangePassword required onClose={() => void logout()} />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/siparisler" element={<OrdersPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/subeler" element={<BranchesPage />} />
        <Route path="/kampanyalar" element={<CampaignsPage />} />
        <Route path="/musteriler" element={<CentralOnly><CustomersPage /></CentralOnly>} />
        <Route path="/hesap-talepleri" element={<CentralOnly><AccountRequestsPage /></CentralOnly>} />
        <Route path="/finans" element={<CentralOnly><FinancePage /></CentralOnly>} />
        <Route path="/pos" element={<CentralOnly><PosPage /></CentralOnly>} />
        <Route path="/yonetim" element={<SuperOnly><AdminsPage /></SuperOnly>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return <AuthProvider><AuthenticatedApp /></AuthProvider>;
}
