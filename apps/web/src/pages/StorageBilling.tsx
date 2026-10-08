import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Lock, LockOpen } from 'lucide-react';
import { api } from '../lib/api';
import type { BillingSummary } from '../lib/types';
import { useAuthStore } from '../lib/auth-store';
import { PageHeader } from '../components/PageHeader';
import { StorageTabs, downloadFile, fmtMoney } from '../components/StorageTabs';

function currentMonth(): string {
  return new Date().toLocaleDateString('sv-SE').slice(0, 7);
}

export function StorageBillingPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canClose = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const isAdmin = user?.role === 'ADMIN';
  const [month, setMonth] = useState(currentMonth());
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['storage-billing', month],
    queryFn: async () => (await api.get<BillingSummary>('/storage-control/billing', { params: { month } })).data,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['storage-billing'] });
    queryClient.invalidateQueries({ queryKey: ['storage-monthly'] });
  };
  const onError = (e: unknown) => {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
    setActionError(msg ?? 'Ocurrió un error');
  };

  const close = useMutation({
    mutationFn: async () => api.post('/storage-control/close-month', { month }),
    onSuccess: refresh,
    onError,
  });
  const reopen = useMutation({
    mutationFn: async () => api.post('/storage-control/reopen-month', { month }),
    onSuccess: refresh,
    onError,
  });

  const exportAll = () =>
    downloadFile(
      api.get(`/storage-control/billing/export`, { params: { month }, responseType: 'blob' }),
      `prefactura-almacenaje-${month}.xlsx`,
    );

  return (
    <div>
      <PageHeader title="Almacenaje" subtitle="Pre-factura del mes por cliente y cierre contable" />
      <StorageTabs />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="month" className="input max-w-[180px]" value={month} onChange={(e) => setMonth(e.target.value)} />
        {data?.closed ? (
          <span className="badge-red inline-flex items-center gap-1">
            <Lock size={12} /> Mes cerrado
          </span>
        ) : (
          <span className="badge-green inline-flex items-center gap-1">
            <LockOpen size={12} /> Mes abierto
          </span>
        )}
        <button className="btn-secondary text-sm" onClick={exportAll}>
          <Download size={15} className="mr-1" /> Exportar pre-factura (Excel)
        </button>
        <div className="ml-auto flex gap-2">
          {canClose && !data?.closed && (
            <button
              className="btn-danger text-sm"
              disabled={close.isPending}
              onClick={() => {
                if (window.confirm(`¿Cerrar el mes ${month}? Después del cierre solo un administrador podrá modificar sus registros.`)) {
                  close.mutate();
                }
              }}
            >
              <Lock size={14} className="mr-1" /> Cerrar mes
            </button>
          )}
          {isAdmin && data?.closed && (
            <button className="btn-secondary text-sm" disabled={reopen.isPending} onClick={() => reopen.mutate()}>
              <LockOpen size={14} className="mr-1" /> Reabrir (admin)
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3 mb-4">
          {actionError}
          <button className="ml-2 underline" onClick={() => setActionError(null)}>
            cerrar
          </button>
        </div>
      )}

      {isLoading && <div className="text-slate-500 text-sm">Calculando…</div>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-right">Almacenaje $</th>
              <th className="px-3 py-2 text-right">Cargue/desc. $</th>
              <th className="px-3 py-2 text-right">Nivelación $</th>
              <th className="px-3 py-2 text-right">TOTAL $</th>
              <th className="px-3 py-2 text-left">Factura(s)</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((r) => (
              <tr key={r.customer.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{r.customer.name}</td>
                <td className="px-3 py-2 text-right">{fmtMoney(r.totals.storage)}</td>
                <td className="px-3 py-2 text-right">{r.totals.handling > 0 ? fmtMoney(r.totals.handling) : ''}</td>
                <td className="px-3 py-2 text-right">{r.totals.leveling > 0 ? fmtMoney(r.totals.leveling) : ''}</td>
                <td className="px-3 py-2 text-right font-bold">{fmtMoney(r.totals.total)}</td>
                <td className="px-3 py-2 text-xs font-mono">
                  {r.invoiceRefs.length > 0 ? r.invoiceRefs.join(', ') : <span className="badge-yellow">Sin facturar</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link className="text-brand-700 text-xs underline" to={`/storage/monthly?customerId=${r.customer.id}&month=${month}`}>
                    detalle
                  </Link>
                </td>
              </tr>
            ))}
            {data && data.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  Sin actividad de almacenaje en el mes
                </td>
              </tr>
            )}
          </tbody>
          {data && data.rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-bold bg-slate-50">
                <td className="px-3 py-2">TOTAL</td>
                <td className="px-3 py-2 text-right">{fmtMoney(data.grand.storage)}</td>
                <td className="px-3 py-2 text-right">{fmtMoney(data.grand.handling)}</td>
                <td className="px-3 py-2 text-right">{fmtMoney(data.grand.leveling)}</td>
                <td className="px-3 py-2 text-right">{fmtMoney(data.grand.total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        Al cerrar el mes, sus registros quedan bloqueados para todos excepto administradores. La marcación de factura
        se hace en "Mensual por cliente".
      </p>
    </div>
  );
}
