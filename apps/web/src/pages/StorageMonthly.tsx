import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Lock } from 'lucide-react';
import { api } from '../lib/api';
import {
  ENVIRONMENT_LABELS,
  type CustomerOption,
  type MonthlyReport,
} from '../lib/types';
import { useAuthStore } from '../lib/auth-store';
import { PageHeader } from '../components/PageHeader';
import { StorageTabs, downloadFile, fmtMoney } from '../components/StorageTabs';

function currentMonth(): string {
  return new Date().toLocaleDateString('sv-SE').slice(0, 7);
}

export function StorageMonthlyPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canInvoice = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const [params] = useSearchParams();
  const [customerId, setCustomerId] = useState(params.get('customerId') ?? '');
  const [month, setMonth] = useState(params.get('month') ?? currentMonth());
  const [invoiceRef, setInvoiceRef] = useState('');

  const customers = useQuery({
    queryKey: ['customers', 'options'],
    queryFn: async () => (await api.get<CustomerOption[]>('/customers/options')).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['storage-monthly', customerId, month],
    enabled: !!customerId,
    queryFn: async () =>
      (await api.get<MonthlyReport>('/storage-control/monthly', { params: { customerId, month } })).data,
  });

  const mark = useMutation({
    mutationFn: async () => {
      const [y, m] = month.split('-').map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return api.post('/storage-control/mark-invoice', {
        customerId,
        from: `${month}-01`,
        to: `${month}-${String(last).padStart(2, '0')}`,
        invoiceRef: invoiceRef.trim() || undefined,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storage-monthly'] }),
  });

  const activeDays = data?.days.filter((d) => d.rows.length > 0) ?? [];

  return (
    <div>
      <PageHeader title="Almacenaje" subtitle="Cierre mensual por cliente — listo para facturar" />
      <StorageTabs />

      <div className="flex flex-wrap gap-3 mb-4">
        <select className="input max-w-[240px]" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Selecciona cliente…</option>
          {customers.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="month" className="input max-w-[180px]" value={month} onChange={(e) => setMonth(e.target.value)} />
        {data && (
          <>
            {data.closed && (
              <span className="badge-red inline-flex items-center gap-1">
                <Lock size={12} /> Mes cerrado
              </span>
            )}
            <button
              className="btn-secondary text-sm"
              onClick={() =>
                downloadFile(
                  api.get('/storage-control/monthly/export', {
                    params: { customerId, month },
                    responseType: 'blob',
                  }),
                  `almacenaje-${data.customer.name}-${month}.xlsx`,
                )
              }
            >
              <Download size={15} className="mr-1" /> Exportar Excel
            </button>
          </>
        )}
      </div>

      {isLoading && <div className="text-slate-500 text-sm">Calculando…</div>}

      {data && (
        <>
          {/* Totales del mes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              ['Almacenaje', data.totals.storage],
              ['Cargue/descargue', data.totals.handling],
              ['Nivelación', data.totals.leveling],
              ['TOTAL MES', data.totals.total],
            ].map(([label, value]) => (
              <div key={label as string} className={`card p-3 text-center ${label === 'TOTAL MES' ? 'bg-brand-50 border-brand-300' : ''}`}>
                <div className="text-lg font-bold">{fmtMoney(value as number)}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>

          {canInvoice && (
            <div className="card p-3 mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-600">Marcar el mes como facturado:</span>
              <input
                className="input max-w-[200px]"
                placeholder="No. de factura (ej: FVE-7941)"
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
              />
              <button className="btn-primary text-sm" disabled={mark.isPending || !invoiceRef.trim()} onClick={() => mark.mutate()}>
                {mark.isPending ? 'Marcando…' : 'Marcar facturado'}
              </button>
              {mark.isSuccess && <span className="text-sm text-green-700">✓ Días marcados</span>}
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Bodega</th>
                  <th className="px-3 py-2 text-right">Saldo pos.</th>
                  <th className="px-3 py-2 text-right">Saldo kg</th>
                  <th className="px-3 py-2 text-right">Tarifa</th>
                  <th className="px-3 py-2 text-right">Almacenaje $</th>
                  <th className="px-3 py-2 text-right">Cargue $</th>
                  <th className="px-3 py-2 text-right">Nivel. $</th>
                  <th className="px-3 py-2 text-right">Total $</th>
                  <th className="px-3 py-2 text-left">Factura</th>
                </tr>
              </thead>
              <tbody>
                {activeDays.flatMap((d) =>
                  d.rows.map((r, idx) => (
                    <tr key={`${d.date}|${r.environment}`} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">
                        {idx === 0
                          ? new Date(d.date).toLocaleDateString('es-CO', { timeZone: 'UTC', day: '2-digit', month: 'short' })
                          : ''}
                      </td>
                      <td className="px-3 py-1.5 text-xs">{ENVIRONMENT_LABELS[r.environment]}</td>
                      <td className="px-3 py-1.5 text-right">{r.posBalance || ''}</td>
                      <td className="px-3 py-1.5 text-right">{r.kgBalance > 0 ? r.kgBalance.toLocaleString('es-CO') : ''}</td>
                      <td className="px-3 py-1.5 text-right text-xs">
                        {r.rate != null ? `${fmtMoney(r.rate)}/${r.unit === 'KG_DAY' ? 'kg' : 'pos'}` : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right">{fmtMoney(r.storageValue)}</td>
                      <td className="px-3 py-1.5 text-right">{r.handlingValue > 0 ? fmtMoney(r.handlingValue) : ''}</td>
                      <td className="px-3 py-1.5 text-right">{r.levelingValue > 0 ? fmtMoney(r.levelingValue) : ''}</td>
                      <td className="px-3 py-1.5 text-right font-semibold">{fmtMoney(r.totalValue)}</td>
                      <td className="px-3 py-1.5 text-xs font-mono">{r.record?.invoiceRef ?? ''}</td>
                    </tr>
                  )),
                )}
                {activeDays.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                      Sin actividad en el mes
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!customerId && <div className="text-slate-400 text-sm">Elige un cliente para ver su mes.</div>}
    </div>
  );
}
