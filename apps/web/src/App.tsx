import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { CustomersPage } from './pages/Customers';
import { ProductsPage } from './pages/Products';
import { UsersPage } from './pages/Users';
import { ReceiptsPage } from './pages/Receipts';
import { ReceiptDetailPage } from './pages/ReceiptDetail';
import { PalletLabelPage } from './pages/PalletLabel';
import { CrossDockPage } from './pages/CrossDock';
import { CrossDockDetailPage } from './pages/CrossDockDetail';
import { SettingsPage } from './pages/Settings';
import { MorePage } from './pages/More';
import { ProtectedLayout } from './components/ProtectedLayout';
import { useAuthStore } from './lib/auth-store';

function PublicOnly({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  if (token) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/receipts" element={<ReceiptsPage />} />
        <Route path="/receipts/:id" element={<ReceiptDetailPage />} />
        <Route path="/pallets/:palletId/label" element={<PalletLabelPage />} />
        <Route path="/crossdock" element={<CrossDockPage />} />
        <Route path="/crossdock/:id" element={<CrossDockDetailPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/more" element={<MorePage />} />
        <Route
          path="/users"
          element={
            <AdminOnly>
              <UsersPage />
            </AdminOnly>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
