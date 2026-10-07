import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { api } from '../lib/api';
import {
  CROSSDOCK_STATUS_LABELS,
  type CrossDockReceipt,
  type CrossDockStatus,
  type CustomerOption,
  type Paginated,
} from '../lib/types';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';

const statusBadge: Record<CrossDockStatus, string> = {
  OPEN: 'badge-yellow',
  CLOSED: 'badge-green',
  CANCELLED: 'badge-gray',
};

interface FormValues {
  customerId: string;
  boxesIn: string;
  grossKg: string;
  notes: string;
}

export function CrossDockPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const customers = useQuery({
    queryKey: ['customers', 'options'],
    queryFn: async () => (await api.get<CustomerOption[]>('/customers/options')).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['crossdock', { page, status }],
    queryFn: async () =>
      (
        await api.get<Paginated<CrossDockReceipt>>('/crossdock', {
          params: { page, pageSize: 20, status: status || undefined },
        })
      ).data,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { customerId: '', boxesIn: '', grossKg: '', notes: '' },
  });

  const create = useMutation({
    mutationFn: async (values: FormValues) =>
      (
        await api.post<CrossDockReceipt>('/crossdock', {
          customerId: values.customerId,
          boxesIn: Number(values.boxesIn),
          grossKg: values.grossKg ? Number(values.grossKg) : undefined,
          notes: values.notes.trim() || undefined,
        })
      ).data,
    onSuccess: (receipt) => {
      setModalOpen(false);
      navigate(`/crossdock/${receipt.id}`);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'No se pudo registrar el descargue');
    },
  });

  return (
    <div>
      <PageHeader
        title="Cross-dock"
        subtitle="Descargues y salidas de cajas en tránsito"
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              reset({ customerId: '', boxesIn: '', grossKg: '', notes: '' });
              setFormError(null);
              setModalOpen(true);
            }}
          >
            <Plus size={16} className="mr-1" /> Descargue
          </button>
        }
      />

      <select
        className="input max-w-[220px] mb-4"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }}
      >
        <option value="">Todos los estados</option>
        {Object.entries(CROSSDOCK_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {isLoading && <div className="text-slate-500 text-sm">Cargando…</div>}

      <div className="space-y-3">
        {data?.items.map((r) => (
          <Link key={r.id} to={`/crossdock/${r.id}`} className="card block p-4 hover:border-brand-400">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">
                <span className="font-mono text-sm mr-2">{r.code}</span>
                {r.customer?.name}
              </div>
              <span className={statusBadge[r.status]}>{CROSSDOCK_STATUS_LABELS[r.status]}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {new Date(r.arrivedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
            <div className="text-sm mt-1.5 flex gap-4">
              <span>
                Entraron <strong>{r.boxesIn}</strong>
              </span>
              <span>
                Salieron <strong>{r.boxesOut}</strong>
              </span>
              <span className={r.boxesPending > 0 ? 'text-amber-700 font-semibold' : 'text-green-700'}>
                Pendientes: {r.boxesPending}
              </span>
            </div>
          </Link>
        ))}
        {data && data.items.length === 0 && (
          <div className="text-center text-slate-400 py-10">Sin descargues</div>
        )}
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}

      <Modal open={modalOpen} title="Nuevo descargue" onClose={() => setModalOpen(false)} size="sm">
        <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
          <div>
            <label className="label">Cliente *</label>
            <select className="input" {...register('customerId', { required: 'Requerido' })}>
              <option value="">Selecciona…</option>
              {customers.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.customerId && <p className="text-xs text-red-600 mt-1">{errors.customerId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cajas que entran *</label>
              <input
                className="input"
                type="number"
                min={1}
                inputMode="numeric"
                {...register('boxesIn', { required: 'Requerido' })}
              />
              {errors.boxesIn && <p className="text-xs text-red-600 mt-1">{errors.boxesIn.message}</p>}
            </div>
            <div>
              <label className="label">Peso bruto (kg)</label>
              <input className="input" type="number" step="0.01" inputMode="decimal" {...register('grossKg')} />
            </div>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} {...register('notes')} />
          </div>
          {formError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3">{formError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Registrando…' : 'Registrar descargue'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
