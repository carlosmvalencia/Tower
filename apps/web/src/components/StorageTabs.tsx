import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

const tabs = [
  { to: '/storage', label: 'Registro diario', end: true },
  { to: '/storage/occupancy', label: 'Ocupación' },
  { to: '/storage/monthly', label: 'Mensual / facturación' },
  { to: '/storage/rates', label: 'Tarifas' },
];

export function StorageTabs() {
  return (
    <div className="flex gap-1 mb-5 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            clsx(
              'px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap',
              isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-200',
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}

export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}
