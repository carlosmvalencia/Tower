import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  Home,
  Building2,
  Package,
  PackagePlus,
  ArrowLeftRight,
  Users as UsersIcon,
  Settings,
  LogOut,
  MoreHorizontal,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/auth-store';
import { ROLE_LABELS, type UserRole } from '../lib/types';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  roles?: UserRole[]; // sin roles = visible para todos
}

// Sidebar completo (desktop)
const navItems: NavItem[] = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/receipts', label: 'Recepción', icon: PackagePlus },
  { to: '/crossdock', label: 'Cross-dock', icon: ArrowLeftRight },
  { to: '/customers', label: 'Clientes', icon: Building2 },
  { to: '/products', label: 'Productos', icon: Package },
  { to: '/users', label: 'Usuarios', icon: UsersIcon, roles: ['ADMIN'] },
  { to: '/settings', label: 'Configuración', icon: Settings },
];

// Barra inferior (móvil): lo operativo a la mano; el resto va en "Más"
const mobileNavItems: NavItem[] = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/receipts', label: 'Recepción', icon: PackagePlus },
  { to: '/crossdock', label: 'Cross-dock', icon: ArrowLeftRight },
  { to: '/more', label: 'Más', icon: MoreHorizontal },
];

export function ProtectedLayout() {
  const navigate = useNavigate();
  const { accessToken, user, clear } = useAuthStore();

  if (!accessToken) return <Navigate to="/login" replace />;

  const items = navItems.filter((i) => !i.roles || (user && i.roles.includes(user.role)));
  const mobileItems = mobileNavItems.filter((i) => !i.roles || (user && i.roles.includes(user.role)));

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // igual cerramos sesión local
    }
    clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ===== Sidebar (desktop) ===== */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-brand-900 text-white print:hidden">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-2xl font-bold tracking-tight">Tower</div>
          <div className="text-xs text-brand-200">WMS de All-logistics</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-700 text-white' : 'text-brand-100 hover:bg-brand-800',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10">
          <div className="text-sm font-medium truncate">{user?.fullName}</div>
          <div className="text-xs text-brand-300 mb-3">{user ? ROLE_LABELS[user.role] : ''}</div>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-brand-200 hover:text-white">
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ===== Header (móvil) ===== */}
      <header className="md:hidden sticky top-0 z-40 bg-brand-900 text-white flex items-center justify-between px-4 h-14 shadow print:hidden">
        <div>
          <span className="text-lg font-bold">Tower</span>
          <span className="ml-2 text-xs text-brand-300">{user?.fullName}</span>
        </div>
        <button onClick={logout} aria-label="Cerrar sesión" className="p-2 text-brand-200 hover:text-white">
          <LogOut size={20} />
        </button>
      </header>

      {/* ===== Contenido ===== */}
      <main className="md:ml-60 px-4 py-5 md:px-8 md:py-7 pb-24 md:pb-7 print:ml-0 print:p-0">
        <Outlet />
      </main>

      {/* ===== Nav inferior (móvil) ===== */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 grid print:hidden"
        style={{
          gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))`,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {mobileItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium',
                isActive ? 'text-brand-700' : 'text-slate-400',
              )
            }
          >
            <Icon size={22} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
