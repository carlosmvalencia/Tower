import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { api } from '../lib/api';
import {
  RECEIPT_STATUS_LABELS,
  type CustomerOption,
  type Paginated,
  type Receipt,
  type ReceiptStatus,
} from '../lib/types';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';

const statusBadge: Record<ReceiptStatus, string> = {
  DRAFT: 'badge-yellow',
  CONFIRMED: 'badge-green',
  CANCELLED: 'badge-gray',
};

interface FormValues {
  customerId: string;
  notes: string;
}

export function ReceiptsPage() {
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
    queryKey: ['receipts', { page, status }],
    queryFn: async () =>
      (
        await api.get<Paginated<Receipt>>('/receipts', {
          params: { page, pageSize: 20, status: status || undefined },
        })
      ).data,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { customerId: '', notes: '' },
  });

  const create = useMutation({
    mutationFn: async (values: FormValues) =>
      (
        await api.post<Receipt>('/receipts', {
          customerId: values.customerId,
          notes: values.notes.trim() || undefined,
        })
      ).data,
    onSuccess: (receipt) => {
      setModalOpen(false);
      navigate(`/receipts/${receipt.id}`);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'No se pudo crear la recepción');
    },
  });

  return (
    <div>
      <PageHeader
        title="Recepción"
        subtitle="Entradas de inventario con pesaje y cedulización"
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              reset({ customerId: '', notes: '' });
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
        {Object.entries(RECEIPT_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {isLoading && <div className="text-slate-500 text-sm">Cargando…</div>}

      <div className="space-y-3">
        {data?.items.map((r) => (
          <Link key={r.id} to={`/receipts/${r.id}`} className="card block p-4 hover:border-brand-400">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">
                <span className="font-mono text-sm mr-2">{r.code}</span>
                {r.customer?.name}
              </div>
              <span className={statusBadge[r.status]}>{RECEIPT_STATUS_LABELS[r.status]}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {new Date(r.receivedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
              {' · '}
              {r._count?.pallets ?? 0} estiba(s) · {r._count?.lines ?? 0} pesada(s) ·{' '}
              {r._count?.photos ?? 0} foto(s)
            </div>
          </Link>
        ))}
        {data && data.items.length === 0 && (
          <div className="text-center text-slate-400 py-10">Sin recepciones</div>
        )}
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}

      <Modal open={modalOpen} title="Nueva recepción" onClose={() => setModalOpen(false)} size="sm">
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
              {create.isPending ? 'Creando…' : 'Crear y registrar pesadas'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
