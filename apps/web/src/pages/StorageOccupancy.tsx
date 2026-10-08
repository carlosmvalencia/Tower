import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ENVIRONMENT_LABELS, type Environment, type OccupancyCell, type OccupancyDay } from '../lib/types';
import { PageHeader } from '../components/PageHeader';
import { StorageTabs } from '../components/StorageTabs';

const ENVIRONMENTS: Environment[] = ['DRY', 'REFRIGERATED', 'FROZEN'];

function currentMonth(): string {
  return new Date().toLocaleDateString('sv-SE').slice(0, 7);
}

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

function Cell({ c }: { c: OccupancyCell }) {
  const over = c.available < 0;
  const warn = !over && c.pct != null && c.pct >= 90;
  return (
    <td
      className={`px-2 py-1.5 text-right tabular-nums ${
        over ? 'bg-red-100 text-red-800 font-bold' : warn ? 'bg-amber-50 text-amber-800 font-semibold' : ''
      }`}
    >
      {c.occupied}
      <span className="text-[10px] text-slate-400">/{c.capacity}</span>
      <span className="ml-1 text-xs">{c.pct != null ? `${Math.round(c.pct)}%` : ''}</span>
    </td>
  );
}

export function StorageOccupancyPage() {
  const [month, setMonth] = useState(currentMonth());
  const { from, to } = monthRange(month);

  const { data, isLoading } = useQuery({
    queryKey: ['storage-occupancy', month],
    queryFn: async () =>
      (await api.get<{ capacity: Record<Environment, number>; days: OccupancyDay[] }>('/storage-control/occupancy', {
        params: { from, to },
      })).data,
  });

  return (
    <div>
      <PageHeader title="Almacenaje" subtitle="Ocupación diaria vs capacidad de cada bodega" />
      <StorageTabs />

      <input type="month" className="input max-w-[180px] mb-4" value={month} onChange={(e) => setMonth(e.target.value)} />

      {isLoading && <div className="text-slate-500 text-sm">Calculando…</div>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              {ENVIRONMENTS.map((env) => (
                <th key={env} className="px-2 py-2 text-right">
                  {ENVIRONMENT_LABELS[env]} (ocup./cap.)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.days.map((d) => (
              <tr key={d.date} className="border-t border-slate-100">
                <td className="px-3 py-1.5">
                  {new Date(d.date).toLocaleDateString('es-CO', { timeZone: 'UTC', day: '2-digit', month: 'short', weekday: 'short' })}
                </td>
                {ENVIRONMENTS.map((env) => (
                  <Cell key={env} c={d[env]} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        Rojo = sobrecupo (más posiciones que la capacidad) · Ámbar = 90% o más. La capacidad se configura en
        Configuración.
      </p>
    </div>
  );
}
