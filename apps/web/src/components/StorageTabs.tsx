import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

const tabs = [
  { to: '/storage', label: 'Registro diario', end: true },
  { to: '/storage/occupancy', label: 'Ocupación' },
  { to: '/storage/monthly', label: 'Mensual por cliente' },
  { to: '/storage/billing', label: 'Pre-factura / cierre' },
  { to: '/storage/rates', label: 'Tarifas' },
];

/** Descarga un endpoint que responde un archivo (XLSX) con el token de la sesión. */
export async function downloadFile(apiGet: Promise<{ data: Blob }>, fallbackName: string) {
  const res = await apiGet;
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackName;
  a.click();
  URL.revokeObjectURL(url);
}

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
