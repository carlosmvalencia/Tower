import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { api } from '../lib/api';
import {
  type Adjustment,
  type CustomerOption,
  type LotAvailability,
  type Paginated,
  type Product,
} from '../lib/types';
import { useAuthStore } from '../lib/auth-store';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';

interface FormValues {
  customerId: string;
  productId: string;
  lotId: string;
  direction: 'IN' | 'OUT';
  qty: string;
  reason: string;
}

const emptyForm: FormValues = {
  customerId: '',
  productId: '',
  lotId: '',
  direction: 'OUT',
  qty: '',
  reason: '',
};

export function AdjustmentsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canCreate = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['adjustments', { page }],
    queryFn: async () =>
      (await api.get<Paginated<Adjustment>>('/adjustments', { params: { page, pageSize: 20 } })).data,
  });

  const customers = useQuery({
    queryKey: ['customers', 'options'],
    queryFn: async () => (await api.get<CustomerOption[]>('/customers/options')).data,
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormValues>({
    defaultValues: emptyForm,
  });
  const customerId = useWatch({ control, name: 'customerId' });
  const productId = useWatch({ control, name: 'productId' });
  const lotId = useWatch({ control, name: 'lotId' });
  const direction = useWatch({ control, name: 'direction' });

  const products = useQuery({
    queryKey: ['products', 'all', customerId],
    enabled: !!customerId,
    queryFn: async () =>
      (await api.get<{ items: Product[] }>('/products', { params: { customerId, pageSize: 100 } })).data.items,
  });

  const lots = useQuery({
    queryKey: ['stock-lots', productId],
    enabled: !!productId,
    queryFn: async () => (await api.get<LotAvailability[]>(`/stock/products/${productId}/lots`)).data,
  });

  const selectedProduct = useMemo(
    () => products.data?.find((p) => p.id === productId),
    [products.data, productId],
  );
  const selectedLot = useMemo(() => lots.data?.find((l) => l.lotId === lotId), [lots.data, lotId]);

  const create = useMutation({
    mutationFn: async (values: FormValues) =>
      api.post('/adjustments', {
        productId: values.productId,
        lotId: values.lotId,
        direction: values.direction,
        qty: Number(values.qty),
        reason: values.reason.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['stock-lots'] });
      setModalOpen(false);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'No se pudo registrar el ajuste');
    },
  });

  return (
    <div>
      <PageHeader
        title="Ajustes"
        subtitle="Ajustes de inventario (AJ) con motivo — solo supervisores"
        actions={
          canCreate && (
            <button
              className="btn-primary"
              onClick={() => {
                reset(emptyForm);
                setFormError(null);
                setModalOpen(true);
              }}
            >
              <Plus size={16} className="mr-1" /> Nuevo
            </button>
          )
        }
      />

      {isLoading && <div className="text-slate-500 text-sm">Cargando…</div>}

      <div className="space-y-3">
        {data?.items.map((a) => (
          <div key={a.id} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">
                <span className="font-mono text-sm mr-2">{a.code}</span>
                {a.product.name}
              </div>
              <span className={a.direction === 'IN' ? 'badge-green' : 'badge-red'}>
                {a.direction === 'IN' ? '+' : '−'}
                {Number(a.qty).toLocaleString('es-CO')} {a.product.measure === 'KG' ? 'kg' : a.product.unit}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {a.product.customer?.name} · Lote <span className="font-mono">{a.lot.code}</span> ·{' '}
              {new Date(a.createdAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
            <div className="text-sm text-slate-700 mt-1.5">Motivo: {a.reason}</div>
          </div>
        ))}
        {data && data.items.length === 0 && (
          <div className="text-center text-slate-400 py-10">Sin ajustes registrados</div>
        )}
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}

      <Modal open={modalOpen} title="Nuevo ajuste (AJ)" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <label className="label">Producto *</label>
              <select className="input" disabled={!customerId} {...register('productId', { required: true })}>
                <option value="">Selecciona…</option>
                {products.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {productId && (
            <div>
              <label className="label">Lote *</label>
              <select className="input" {...register('lotId', { required: true })}>
                <option value="">Selecciona…</option>
                {lots.data?.map((l) => (
                  <option key={l.lotId} value={l.lotId}>
                    {l.lotCode} — disp. {l.available.toLocaleString('es-CO')}
                  </option>
                ))}
              </select>
              {lots.data?.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">Este producto no tiene lotes con existencias</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo *</label>
              <select className="input" {...register('direction')}>
                <option value="OUT">Resta (−)</option>
                <option value="IN">Suma (+)</option>
              </select>
            </div>
            <div>
              <label className="label">
                Cantidad *{selectedProduct && ` (${selectedProduct.measure === 'KG' ? 'kg' : selectedProduct.unit})`}
                {direction === 'OUT' && selectedLot && ` — disp. ${selectedLot.available.toLocaleString('es-CO')}`}
              </label>
              <input
                className="input"
                type="number"
                step={selectedProduct?.measure === 'KG' ? '0.01' : '1'}
                min={selectedProduct?.measure === 'KG' ? 0.01 : 1}
                inputMode="decimal"
                {...register('qty', { required: 'Requerido' })}
              />
            </div>
          </div>

          <div>
            <label className="label">Motivo * (mínimo 5 caracteres)</label>
            <input
              className="input"
              placeholder="Ej: merma por rotura de empaque en manipulación"
              {...register('reason', { required: 'Requerido', minLength: { value: 5, message: 'Muy corto' } })}
            />
            {errors.reason && <p className="text-xs text-red-600 mt-1">{errors.reason.message}</p>}
          </div>

          {formError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3">{formError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Aplicando…' : 'Aplicar ajuste'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
