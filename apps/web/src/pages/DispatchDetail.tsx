import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { ArrowLeft, Plus, Printer, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import {
  DISPATCH_STATUS_LABELS,
  type Dispatch,
  type LotAvailability,
  type Photo,
  type Product,
} from '../lib/types';
import { Modal } from '../components/Modal';
import { PhotoGallery } from '../components/PhotoGallery';

interface LineFormValues {
  productId: string;
  lotId: string;
  qty: string;
}

function fmtQty(qty: string | number, measure: string, unit: string) {
  const n = Number(qty);
  return measure === 'KG' ? `${n.toLocaleString('es-CO')} kg` : `${n} ${unit}`;
}

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('es-CO', { timeZone: 'UTC' }) : null;
}

export function DispatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [lineModal, setLineModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: dispatch, isLoading } = useQuery({
    queryKey: ['dispatch', id],
    queryFn: async () => (await api.get<Dispatch>(`/dispatches/${id}`)).data,
  });

  const { data: products } = useQuery({
    queryKey: ['products', 'all', dispatch?.customerId],
    enabled: !!dispatch?.customerId,
    queryFn: async () =>
      (
        await api.get<{ items: Product[] }>('/products', {
          params: { customerId: dispatch!.customerId, pageSize: 100 },
        })
      ).data.items,
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<LineFormValues>({
    defaultValues: { productId: '', lotId: '', qty: '' },
  });
  const productId = useWatch({ control, name: 'productId' });
  const lotId = useWatch({ control, name: 'lotId' });

  const { data: lots } = useQuery({
    queryKey: ['stock-lots', productId],
    enabled: !!productId,
    queryFn: async () =>
      (await api.get<LotAvailability[]>(`/stock/products/${productId}/lots`)).data,
  });

  const selectedProduct = useMemo(
    () => products?.find((p) => p.id === productId),
    [products, productId],
  );
  const selectedLot = useMemo(() => lots?.find((l) => l.lotId === lotId), [lots, lotId]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dispatch', id] });
    queryClient.invalidateQueries({ queryKey: ['stock-lots'] });
  };
  const onError = (e: unknown, set = setActionError) => {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
    set(msg ?? 'Ocurrió un error');
  };

  const addLine = useMutation({
    mutationFn: async (values: LineFormValues) =>
      api.post(`/dispatches/${id}/lines`, {
        productId: values.productId,
        lotId: values.lotId,
        qty: Number(values.qty),
      }),
    onSuccess: () => {
      refresh();
      reset({ productId: '', lotId: '', qty: '' });
      setFormError(null);
    },
    onError: (e) => onError(e, setFormError),
  });

  const removeLine = useMutation({
    mutationFn: async (lineId: string) => api.delete(`/dispatches/${id}/lines/${lineId}`),
    onSuccess: refresh,
    onError: (e) => onError(e),
  });

  const confirm = useMutation({
    mutationFn: async () => api.post(`/dispatches/${id}/confirm`),
    onSuccess: refresh,
    onError: (e) => onError(e),
  });

  if (isLoading || !dispatch) return <div className="text-slate-500 text-sm">Cargando…</div>;

  const editable = dispatch.status === 'DRAFT';

  return (
    <div>
      <div className="print:hidden">
        <Link to="/dispatches" className="inline-flex items-center gap-1 text-sm text-brand-700 mb-3">
          <ArrowLeft size={16} /> Salidas
        </Link>
      </div>

      {/* ---------- Encabezado / remisión ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <div className="hidden print:block text-xs uppercase tracking-wide text-slate-500 mb-1">
            All-logistics · Tower — Remisión de salida
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            <span className="font-mono">{dispatch.code}</span>
            <span className="ml-3 text-lg font-medium text-slate-600">{dispatch.customer?.name}</span>
          </h1>
          <div className="text-sm text-slate-500 mt-1">
            {new Date(dispatch.dispatchedAt).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}
            {dispatch.site && (
              <>
                {' · '}Sede: <strong>{dispatch.site.name}</strong>
                {dispatch.site.city && ` (${dispatch.site.city})`}
              </>
            )}
            {' · '}
            <span className={dispatch.status === 'CONFIRMED' ? 'badge-green' : dispatch.status === 'DRAFT' ? 'badge-yellow' : 'badge-gray'}>
              {DISPATCH_STATUS_LABELS[dispatch.status]}
            </span>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          {dispatch.status === 'CONFIRMED' && (
            <button className="btn-secondary" onClick={() => window.print()}>
              <Printer size={16} className="mr-1" /> Remisión
            </button>
          )}
          {editable && (
            <button
              className="btn-primary"
              disabled={confirm.isPending || dispatch.lines.length === 0}
              onClick={() => confirm.mutate()}
            >
              {confirm.isPending ? 'Confirmando…' : 'Confirmar salida'}
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3 mb-4 print:hidden">
          {actionError}
          <button className="ml-2 underline" onClick={() => setActionError(null)}>
            cerrar
          </button>
        </div>
      )}

      {/* ---------- Líneas ---------- */}
      <div className="card p-4 mb-5">
        <div className="flex items-center justify-between mb-3 print:hidden">
          <div className="font-semibold text-sm">Productos ({dispatch.lines.length})</div>
          {editable && (
            <button
              className="btn-primary text-xs"
              onClick={() => {
                reset({ productId: '', lotId: '', qty: '' });
                setFormError(null);
                setLineModal(true);
              }}
            >
              <Plus size={14} className="mr-1" /> Agregar
            </button>
          )}
        </div>
        {dispatch.lines.length === 0 ? (
          <div className="text-sm text-slate-400">Sin productos — agrega el primero</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="py-2">Referencia</th>
                <th className="py-2">Lote</th>
                <th className="py-2">Vence</th>
                <th className="py-2 text-right">Cantidad</th>
                {editable && <th className="py-2 print:hidden" />}
              </tr>
            </thead>
            <tbody>
              {dispatch.lines.map((line) => (
                <tr key={line.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2 font-medium">{line.product.name}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{line.lot.code}</td>
                  <td className="py-2 pr-2 text-xs">{fmtDate(line.lot.expiryDate) ?? '—'}</td>
                  <td className="py-2 text-right font-semibold">
                    {fmtQty(line.qty, line.product.measure, line.product.unit)}
                  </td>
                  {editable && (
                    <td className="py-2 text-right print:hidden">
                      <button
                        className="text-slate-400 hover:text-red-600 p-1"
                        onClick={() => removeLine.mutate(line.id)}
                        aria-label="Eliminar línea"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------- Fotos ---------- */}
      <div className="card p-4 mb-5 print:hidden">
        <div className="font-semibold text-sm mb-3">Fotos del despacho</div>
        <PhotoGallery
          photos={dispatch.photos}
          readonly={!editable}
          onUpload={async (file) => {
            const form = new FormData();
            form.append('photo', file);
            await api.post(`/dispatches/${id}/photos`, form, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            refresh();
          }}
          onDelete={async (photo: Photo) => {
            await api.delete(`/dispatches/${id}/photos/${photo.id}`);
            refresh();
          }}
        />
      </div>

      {/* Firma en la remisión impresa */}
      <div className="hidden print:block mt-12 text-sm">
        <div className="grid grid-cols-2 gap-10">
          <div className="border-t border-slate-400 pt-2">Entrega (All-logistics)</div>
          <div className="border-t border-slate-400 pt-2">Recibe (cliente / sede)</div>
        </div>
      </div>

      {/* ---------- Modal agregar línea ---------- */}
      <Modal open={lineModal} title="Agregar producto a la salida" onClose={() => setLineModal(false)}>
        <form onSubmit={handleSubmit((v) => addLine.mutate(v))} className="space-y-4">
          <div>
            <label className="label">Producto *</label>
            <select className="input" {...register('productId', { required: 'Requerido' })}>
              <option value="">Selecciona…</option>
              {products?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.measure === 'KG' ? 'kg' : p.unit})
                </option>
              ))}
            </select>
            {errors.productId && <p className="text-xs text-red-600 mt-1">{errors.productId.message}</p>}
          </div>

          {productId && (
            <div>
              <label className="label">Lote * (ordenados por FEFO — primero el que vence primero)</label>
              <select className="input" {...register('lotId', { required: 'Requerido' })}>
                <option value="">Selecciona…</option>
                {lots?.map((l, i) => (
                  <option key={l.lotId} value={l.lotId}>
                    {i === 0 ? '★ ' : ''}
                    {l.lotCode} — disp. {l.available.toLocaleString('es-CO')}
                    {l.expiryDate ? ` — vence ${fmtDate(l.expiryDate)}` : ''}
                  </option>
                ))}
              </select>
              {lots?.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">Este producto no tiene existencias</p>
              )}
              {errors.lotId && <p className="text-xs text-red-600 mt-1">{errors.lotId.message}</p>}
            </div>
          )}

          {selectedLot && selectedProduct && (
            <div>
              <label className="label">
                Cantidad ({selectedProduct.measure === 'KG' ? 'kg' : selectedProduct.unit}) * — disponible:{' '}
                {selectedLot.available.toLocaleString('es-CO')}
              </label>
              <input
                className="input"
                type="number"
                step={selectedProduct.measure === 'KG' ? '0.01' : '1'}
                min={selectedProduct.measure === 'KG' ? 0.01 : 1}
                max={selectedLot.available}
                inputMode="decimal"
                {...register('qty', { required: 'Requerido' })}
              />
              {errors.qty && <p className="text-xs text-red-600 mt-1">{errors.qty.message}</p>}
            </div>
          )}

          {formError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3">{formError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setLineModal(false)}>
              Cerrar
            </button>
            <button type="submit" className="btn-primary" disabled={addLine.isPending}>
              {addLine.isPending ? 'Agregando…' : 'Agregar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
