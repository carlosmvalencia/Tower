import { Link } from 'react-router-dom';
import {
  Boxes,
  Building2,
  ChevronRight,
  Package,
  Settings,
  SlidersHorizontal,
  Users as UsersIcon,
} from 'lucide-react';
import { useAuthStore } from '../lib/auth-store';
import { PageHeader } from '../components/PageHeader';

/** Menú "Más" del celular: entradas que no caben en la barra inferior. */
export function MorePage() {
  const user = useAuthStore((s) => s.user);

  const items = [
    { to: '/inventory', label: 'Inventario', icon: Boxes },
    { to: '/adjustments', label: 'Ajustes (AJ)', icon: SlidersHorizontal },
    { to: '/customers', label: 'Clientes', icon: Building2 },
    { to: '/products', label: 'Productos', icon: Package },
    ...(user?.role === 'ADMIN' ? [{ to: '/users', label: 'Usuarios', icon: UsersIcon }] : []),
    { to: '/settings', label: 'Configuración', icon: Settings },
  ];

  return (
    <div>
      <PageHeader title="Más" />
      <div className="card divide-y divide-slate-100">
        {items.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50">
            <span className="flex items-center gap-3 font-medium text-slate-700">
              <Icon size={20} className="text-brand-600" /> {label}
            </span>
            <ChevronRight size={18} className="text-slate-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
