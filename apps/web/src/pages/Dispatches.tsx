import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { api } from '../lib/api';
import {
  DISPATCH_STATUS_LABELS,
  type CustomerOption,
  type CustomerSite,
  type Dispatch,
  type DispatchStatus,
  type Paginated,
} from '../lib/types';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';

const statusBadge: Record<DispatchStatus, string> = {
  DRAFT: 'badge-yellow',
  CONFIRMED: 'badge-green',
  CANCELLED: 'badge-gray',
};

interface FormValues {
  customerId: string;
  siteId: string;
  notes: string;
}

export function DispatchesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const customers = useQuery({
    queryKey: ['customers', 'options'],
    queryFn: async () => (await api.get<CustomerOption[]>('/customers/options')).data,
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormValues>({
    defaultValues: { customerId: '', siteId: '', notes: '' },
  });
  const customerId = useWatch({ control, name: 'customerId' });

  const sites = useQuery({
    queryKey: ['sites', customerId],
    enabled: !!customerId,
    queryFn: async () => (await api.get<CustomerSite[]>(`/customers/${customerId}/sites`)).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['dispatches', { page, status }],
    queryFn: async () =>
      (
        await api.get<Paginated<Dispatch>>('/dispatches', {
          params: { page, pageSize: 20, status: status || undefined },
        })
      ).data,
  });

  const create = useMutation({
    mutationFn: async (values: FormValues) =>
      (
        await api.post<Dispatch>('/dispatches', {
          customerId: values.customerId,
          siteId: values.siteId || undefined,
          notes: values.notes.trim() || undefined,
        })
      ).data,
    onSuccess: (dispatch) => {
      setModalOpen(false);
      navigate(`/dispatches/${dispatch.id}`);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'No se pudo crear la salida');
    },
  });

  return (
    <div>
      <PageHeader
        title="Salidas"
        subtitle="Salidas de mercancía (SM) hacia las sedes de los clientes"
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              reset({ customerId: '', siteId: '', notes: '' });
              setFormError(null);
              setModalOpen(true);
            }}
          >
            <Plus size={16} className="mr-1" /> Nueva
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
        {Object.entries(DISPATCH_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {isLoading && <div className="text-slate-500 text-sm">Cargando…</div>}

      <div className="space-y-3">
        {data?.items.map((d) => (
          <Link key={d.id} to={`/dispatches/${d.id}`} className="card block p-4 hover:border-brand-400">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">
                <span className="font-mono text-sm mr-2">{d.code}</span>
                {d.customer?.name}
              </div>
              <span className={statusBadge[d.status]}>{DISPATCH_STATUS_LABELS[d.status]}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {new Date(d.dispatchedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
              {d.site && ` · Sede: ${d.site.name}`}
              {' · '}
              {d._count?.lines ?? 0} línea(s)
            </div>
          </Link>
        ))}
        {data && data.items.length === 0 && (
          <div className="text-center text-slate-400 py-10">Sin salidas</div>
        )}
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}

      <Modal open={modalOpen} title="Nueva salida (SM)" onClose={() => setModalOpen(false)} size="sm">
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
          <div>
            <label className="label">Sede destino *</label>
            <select className="input" disabled={!customerId} {...register('siteId', { required: 'Requerido' })}>
              <option value="">{customerId ? 'Selecciona…' : 'Elige primero el cliente'}</option>
              {sites.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.city ? ` — ${s.city}` : ''}
                </option>
              ))}
            </select>
            {errors.siteId && <p className="text-xs text-red-600 mt-1">{errors.siteId.message}</p>}
            {customerId && sites.data?.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                Este cliente no tiene sedes — créalas en Clientes → botón de sedes
              </p>
            )}
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
              {create.isPending ? 'Creando…' : 'Crear y agregar productos'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
