import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Truck } from 'lucide-react';
import { api } from '../lib/api';
import { CROSSDOCK_STATUS_LABELS, type CrossDockReceipt, type Photo } from '../lib/types';
import { Modal } from '../components/Modal';
import { PhotoGallery } from '../components/PhotoGallery';

interface DispatchFormValues {
  boxesOut: string;
  destination: string;
  notes: string;
}

export function CrossDockDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [dispatchModal, setDispatchModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: receipt, isLoading } = useQuery({
    queryKey: ['crossdock', id],
    queryFn: async () => (await api.get<CrossDockReceipt>(`/crossdock/${id}`)).data,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['crossdock', id] });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<DispatchFormValues>({
    defaultValues: { boxesOut: '', destination: '', notes: '' },
  });

  const addDispatch = useMutation({
    mutationFn: async (values: DispatchFormValues) =>
      api.post(`/crossdock/${id}/dispatches`, {
        boxesOut: Number(values.boxesOut),
        destination: values.destination.trim() || undefined,
        notes: values.notes.trim() || undefined,
      }),
    onSuccess: () => {
      refresh();
      setDispatchModal(false);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'No se pudo registrar la salida');
    },
  });

  if (isLoading || !receipt) return <div className="text-slate-500 text-sm">Cargando…</div>;

  const active = receipt.status !== 'CANCELLED';

  return (
    <div>
      <Link to="/crossdock" className="inline-flex items-center gap-1 text-sm text-brand-700 mb-3">
        <ArrowLeft size={16} /> Cross-dock
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            <span className="font-mono">{receipt.code}</span>
            <span className="ml-3 text-lg font-medium text-slate-600">{receipt.customer?.name}</span>
          </h1>
          <div className="text-sm text-slate-500 mt-1">
            Llegó{' '}
            {new Date(receipt.arrivedAt).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}
            {' · '}
            <span className={receipt.status === 'CLOSED' ? 'badge-green' : receipt.status === 'OPEN' ? 'badge-yellow' : 'badge-gray'}>
              {CROSSDOCK_STATUS_LABELS[receipt.status]}
            </span>
          </div>
        </div>
        {active && receipt.boxesPending > 0 && (
          <button
            className="btn-primary"
            onClick={() => {
              reset({ boxesOut: String(receipt.boxesPending), destination: '', notes: '' });
              setFormError(null);
              setDispatchModal(true);
            }}
          >
            <Truck size={16} className="mr-1" /> Registrar salida
          </button>
        )}
      </div>

      {/* Saldo de cajas */}
      <div className="grid grid-cols-3 gap-3 max-w-md mb-5">
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold">{receipt.boxesIn}</div>
          <div className="text-xs text-slate-500">Entraron</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold">{receipt.boxesOut}</div>
          <div className="text-xs text-slate-500">Salieron</div>
        </div>
        <div className={`card p-3 text-center ${receipt.boxesPending > 0 ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'}`}>
          <div className="text-2xl font-bold">{receipt.boxesPending}</div>
          <div className="text-xs text-slate-500">Pendientes</div>
        </div>
      </div>

      {receipt.grossKg && (
        <div className="text-sm text-slate-600 mb-4">
          Peso bruto del descargue: <strong>{Number(receipt.grossKg).toLocaleString('es-CO')} kg</strong>
        </div>
      )}
      {receipt.notes && <div className="text-sm text-slate-600 mb-4">Notas: {receipt.notes}</div>}

      {/* Fotos del descargue */}
      <div className="card p-4 mb-5">
        <div className="font-semibold text-sm mb-3">Registro fotográfico del descargue</div>
        <PhotoGallery
          photos={receipt.photos}
          readonly={!active}
          onUpload={async (file) => {
            const form = new FormData();
            form.append('photo', file);
            await api.post(`/crossdock/${id}/photos`, form, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            refresh();
          }}
          onDelete={async (photo: Photo) => {
            await api.delete(`/crossdock/photos/${photo.id}`);
            refresh();
          }}
        />
      </div>

      {/* Salidas */}
      <h2 className="font-semibold mb-3">Salidas ({receipt.dispatches.length})</h2>
      <div className="space-y-3">
        {receipt.dispatches.map((d) => (
          <div key={d.id} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">
                {d.boxesOut} caja(s)
                {d.destination && <span className="text-slate-500 font-normal"> → {d.destination}</span>}
              </div>
              <div className="text-xs text-slate-500">
                {new Date(d.dispatchedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
            {d.notes && <div className="text-xs text-slate-500 mt-1">{d.notes}</div>}
            <div className="mt-2">
              <PhotoGallery
                photos={d.photos}
                readonly={!active}
                onUpload={async (file) => {
                  const form = new FormData();
                  form.append('photo', file);
                  await api.post(`/crossdock/${id}/dispatches/${d.id}/photos`, form, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                  });
                  refresh();
                }}
                onDelete={async (photo: Photo) => {
                  await api.delete(`/crossdock/photos/${photo.id}`);
                  refresh();
                }}
              />
            </div>
          </div>
        ))}
        {receipt.dispatches.length === 0 && (
          <div className="text-center text-slate-400 py-6 card">Aún no han salido cajas</div>
        )}
      </div>

      {/* Modal de salida */}
      <Modal open={dispatchModal} title="Registrar salida de cajas" onClose={() => setDispatchModal(false)} size="sm">
        <form onSubmit={handleSubmit((v) => addDispatch.mutate(v))} className="space-y-4">
          <div>
            <label className="label">Cajas que salen * (pendientes: {receipt.boxesPending})</label>
            <input
              className="input"
              type="number"
              min={1}
              max={receipt.boxesPending}
              inputMode="numeric"
              {...register('boxesOut', { required: 'Requerido' })}
            />
            {errors.boxesOut && <p className="text-xs text-red-600 mt-1">{errors.boxesOut.message}</p>}
          </div>
          <div>
            <label className="label">Vehículo / destino</label>
            <input className="input" placeholder="Ej: WXY-123 — ruta Cali norte" {...register('destination')} />
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} {...register('notes')} />
          </div>
          {formError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3">{formError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setDispatchModal(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={addDispatch.isPending}>
              {addDispatch.isPending ? 'Registrando…' : 'Registrar salida'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
