import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Pencil, Plus } from 'lucide-react';
import { api } from '../lib/api';
import {
  ENVIRONMENT_LABELS,
  type CustomerOption,
  type Environment,
  type StorageDayRow,
} from '../lib/types';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { EnvironmentBadge } from '../components/EnvironmentBadge';
import { StorageTabs, fmtMoney } from '../components/StorageTabs';

const ENVIRONMENTS: Environment[] = ['FROZEN', 'REFRIGERATED', 'DRY'];

function today(): string {
  return new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD en hora local
}

interface FormValues {
  customerId: string;
  environment: Environment;
  posIn: string;
  posOut: string;
  kgIn: string;
  kgOut: string;
  kgLeveled: string;
  note: string;
}

export function StorageDailyPage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(today());
  const [modal, setModal] = useState<{ row?: StorageDayRow } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const customers = useQuery({
    queryKey: ['customers', 'options'],
    queryFn: async () => (await api.get<CustomerOption[]>('/customers/options')).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['storage-days', date],
    queryFn: async () =>
      (await api.get<{ date: string; rows: StorageDayRow[] }>('/storage-control/days', { params: { date } })).data,
  });

  const closures = useQuery({
    queryKey: ['storage-closures', date.slice(0, 4)],
    queryFn: async () =>
      (await api.get<{ month: string }[]>('/storage-control/closures', { params: { year: date.slice(0, 4) } })).data,
  });
  const monthClosed = closures.data?.some((c) => c.month === date.slice(0, 7)) ?? false;

  const { register, handleSubmit, reset } = useForm<FormValues>();

  const save = useMutation({
    mutationFn: async (values: FormValues) =>
      api.put('/storage-control/days', {
        date,
        customerId: values.customerId,
        environment: values.environment,
        posIn: Number(values.posIn) || 0,
        posOut: Number(values.posOut) || 0,
        kgIn: Number(values.kgIn) || 0,
        kgOut: Number(values.kgOut) || 0,
        kgLeveled: Number(values.kgLeveled) || 0,
        note: values.note.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-days'] });
      setModal(null);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'No se pudo guardar');
    },
  });

  const openModal = (row?: StorageDayRow) => {
    reset({
      customerId: row?.customerId ?? '',
      environment: row?.environment ?? 'REFRIGERATED',
      posIn: String(row?.record?.posIn ?? ''),
      posOut: String(row?.record?.posOut ?? ''),
      kgIn: row?.record ? String(Number(row.record.kgIn) || '') : '',
      kgOut: row?.record ? String(Number(row.record.kgOut) || '') : '',
      kgLeveled: row?.record ? String(Number(row.record.kgLeveled) || '') : '',
      note: row?.record?.note ?? '',
    });
    setFormError(null);
    setModal({ row });
  };

  const totalDay = data?.rows.reduce((s, r) => s + r.totalValue, 0) ?? 0;

  return (
    <div>
      <PageHeader title="Almacenaje" subtitle="Control diario de posiciones y kg por cliente" />
      <StorageTabs />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="date" className="input max-w-[180px]" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn-primary" onClick={() => openModal()}>
          <Plus size={16} className="mr-1" /> Registrar movimiento
        </button>
        {monthClosed && (
          <span className="badge-red">Mes cerrado — solo administradores pueden modificar</span>
        )}
        <div className="ml-auto text-sm text-slate-600">
          Valor total del día: <strong>{fmtMoney(totalDay)}</strong>
        </div>
      </div>

      {isLoading && <div className="text-slate-500 text-sm">Calculando…</div>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Bodega</th>
              <th className="px-3 py-2 text-right">Pos. entra</th>
              <th className="px-3 py-2 text-right">Pos. sale</th>
              <th className="px-3 py-2 text-right">Saldo pos.</th>
              <th className="px-3 py-2 text-right">Kg entra</th>
              <th className="px-3 py-2 text-right">Kg sale</th>
              <th className="px-3 py-2 text-right">Saldo kg</th>
              <th className="px-3 py-2 text-right">Almacenaje $</th>
              <th className="px-3 py-2 text-right">Cargue $</th>
              <th className="px-3 py-2 text-right">Nivel. $</th>
              <th className="px-3 py-2 text-right">Total día $</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((r) => (
              <tr key={`${r.customerId}|${r.environment}`} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{r.customer.name}</td>
                <td className="px-3 py-2">
                  <EnvironmentBadge environment={r.environment} />
                  {r.unit && (
                    <span className="text-[10px] text-slate-400 ml-1">
                      {r.unit === 'KG_DAY' ? '$/kg' : '$/pos'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{r.record?.posIn || ''}</td>
                <td className="px-3 py-2 text-right">{r.record?.posOut || ''}</td>
                <td className={`px-3 py-2 text-right font-semibold ${r.posBalance < 0 ? 'text-red-600' : ''}`}>
                  {r.posBalance}
                </td>
                <td className="px-3 py-2 text-right">{r.record && Number(r.record.kgIn) > 0 ? Number(r.record.kgIn).toLocaleString('es-CO') : ''}</td>
                <td className="px-3 py-2 text-right">{r.record && Number(r.record.kgOut) > 0 ? Number(r.record.kgOut).toLocaleString('es-CO') : ''}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  {r.kgBalance > 0 ? r.kgBalance.toLocaleString('es-CO') : ''}
                </td>
                <td className="px-3 py-2 text-right">{fmtMoney(r.storageValue)}</td>
                <td className="px-3 py-2 text-right">{r.handlingValue > 0 ? fmtMoney(r.handlingValue) : ''}</td>
                <td className="px-3 py-2 text-right">{r.levelingValue > 0 ? fmtMoney(r.levelingValue) : ''}</td>
                <td className="px-3 py-2 text-right font-bold">{fmtMoney(r.totalValue)}</td>
                <td className="px-3 py-2">
                  <button className="btn-secondary" onClick={() => openModal(r)} aria-label="Editar día">
                    <Pencil size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {data && data.rows.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-slate-400">
                  Sin registros ni contratos — empieza con "Registrar movimiento" o configura tarifas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        Los saldos acumulan todos los registros hasta la fecha elegida. El valor usa la tarifa vigente de cada cliente.
      </p>

      <Modal
        open={!!modal}
        title={modal?.row ? `${modal.row.customer.name} — ${ENVIRONMENT_LABELS[modal.row.environment]} — ${date}` : `Registrar movimiento — ${date}`}
        onClose={() => setModal(null)}
      >
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4">
          {!modal?.row && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Cliente *</label>
                <select className="input" {...register('customerId', { required: true })}>
                  <option value="">Selecciona…</option>
                  {customers.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Bodega *</label>
                <select className="input" {...register('environment')}>
                  {ENVIRONMENTS.map((env) => (
                    <option key={env} value={env}>
                      {ENVIRONMENT_LABELS[env]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {modal?.row && (
            <>
              <input type="hidden" {...register('customerId')} />
              <input type="hidden" {...register('environment')} />
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Posiciones que entran</label>
              <input className="input" type="number" min={0} inputMode="numeric" {...register('posIn')} />
            </div>
            <div>
              <label className="label">Posiciones que salen</label>
              <input className="input" type="number" min={0} inputMode="numeric" {...register('posOut')} />
            </div>
            <div>
              <label className="label">Kg que entran</label>
              <input className="input" type="number" step="0.1" min={0} inputMode="decimal" {...register('kgIn')} />
            </div>
            <div>
              <label className="label">Kg que salen</label>
              <input className="input" type="number" step="0.1" min={0} inputMode="decimal" {...register('kgOut')} />
            </div>
            <div>
              <label className="label">Kg nivelados (fuera de temperatura)</label>
              <input className="input" type="number" step="0.1" min={0} inputMode="decimal" {...register('kgLeveled')} />
            </div>
            <div>
              <label className="label">Nota / producto</label>
              <input className="input" {...register('note')} />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Las posiciones alimentan la ocupación de la bodega; los kg solo aplican a clientes con cobro por kg.
            El cargue/descargue se calcula automático (kg entran + kg salen) × tarifa.
          </p>
          {formError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3">{formError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar día'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
