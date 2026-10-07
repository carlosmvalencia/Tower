import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { ArrowLeft, Plus, Printer, ScanBarcode, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import {
  ENVIRONMENT_LABELS,
  RECEIPT_STATUS_LABELS,
  type Environment,
  type Pallet,
  type Photo,
  type Product,
  type Receipt,
  type ReceiptLine,
} from '../lib/types';
import { Modal } from '../components/Modal';
import { EnvironmentBadge } from '../components/EnvironmentBadge';
import { PhotoGallery } from '../components/PhotoGallery';
import { BarcodeScanner } from '../components/BarcodeScanner';

const ENVIRONMENTS: Environment[] = ['FROZEN', 'REFRIGERATED', 'DRY'];

interface LineFormValues {
  productId: string;
  lotCode: string;
  expiryDate: string;
  grossKg: string;
  canastillas: string;
  estibas: string;
  tareKg: string; // vacío = automática
  netKg: string; // vacío = automática
  units: string;
}

const emptyLine: LineFormValues = {
  productId: '',
  lotCode: '',
  expiryDate: '',
  grossKg: '',
  canastillas: '0',
  estibas: '1',
  tareKg: '',
  netKg: '',
  units: '',
};

function fmtKg(v?: string | null) {
  return v == null ? '—' : `${Number(v).toLocaleString('es-CO')} kg`;
}

export function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [lineModal, setLineModal] = useState<{ pallet: Pallet } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: receipt, isLoading } = useQuery({
    queryKey: ['receipt', id],
    queryFn: async () => (await api.get<Receipt>(`/receipts/${id}`)).data,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<Record<string, string>>('/settings')).data,
  });

  const { data: products } = useQuery({
    queryKey: ['products', 'all', receipt?.customerId],
    enabled: !!receipt?.customerId,
    queryFn: async () =>
      (
        await api.get<{ items: Product[] }>('/products', {
          params: { customerId: receipt!.customerId, pageSize: 100 },
        })
      ).data.items,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['receipt', id] });
  const onError = (e: unknown, set = setActionError) => {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
    set(msg ?? 'Ocurrió un error');
  };

  // ---------- Mutations ----------
  const addPallet = useMutation({
    mutationFn: async (environment: Environment) =>
      api.post(`/receipts/${id}/pallets`, { environment }),
    onSuccess: refresh,
    onError: (e) => onError(e),
  });

  const removePallet = useMutation({
    mutationFn: async (palletId: string) => api.delete(`/receipts/${id}/pallets/${palletId}`),
    onSuccess: refresh,
    onError: (e) => onError(e),
  });

  const removeLine = useMutation({
    mutationFn: async (lineId: string) => api.delete(`/receipts/${id}/lines/${lineId}`),
    onSuccess: refresh,
    onError: (e) => onError(e),
  });

  const confirm = useMutation({
    mutationFn: async () => api.post(`/receipts/${id}/confirm`),
    onSuccess: refresh,
    onError: (e) => onError(e),
  });

  const addLine = useMutation({
    mutationFn: async (values: LineFormValues) => {
      const product = products?.find((p) => p.id === values.productId);
      const payload: Record<string, unknown> = {
        productId: values.productId,
        lotCode: values.lotCode.trim(),
        expiryDate: values.expiryDate || undefined,
      };
      if (product?.measure === 'KG') {
        payload.grossKg = Number(values.grossKg);
        payload.canastillas = Number(values.canastillas) || 0;
        payload.estibas = Number(values.estibas) || 0;
        if (values.tareKg !== '') payload.tareKg = Number(values.tareKg);
        if (values.netKg !== '') payload.netKg = Number(values.netKg);
      } else {
        payload.units = Number(values.units);
      }
      return api.post(`/receipts/${id}/pallets/${lineModal!.pallet.id}/lines`, payload);
    },
    onSuccess: () => {
      refresh();
      // deja el modal abierto con lote/producto limpios para la siguiente pesada rápida
      reset({ ...emptyLine, estibas: '0' });
      setFormError(null);
    },
    onError: (e) => onError(e, setFormError),
  });

  // ---------- Formulario de pesada ----------
  const { register, handleSubmit, reset, setValue, control, formState: { errors } } =
    useForm<LineFormValues>({ defaultValues: emptyLine });
  const watched = useWatch({ control });

  const selectedProduct = useMemo(
    () => products?.find((p) => p.id === watched.productId),
    [products, watched.productId],
  );

  const canastillaKg = Number(settings?.['tare.canastillaKg'] ?? 0);
  const estibaKg = Number(settings?.['tare.estibaKg'] ?? 0);
  const autoTare =
    (Number(watched.canastillas) || 0) * canastillaKg + (Number(watched.estibas) || 0) * estibaKg;
  const effectiveTare = watched.tareKg !== '' ? Number(watched.tareKg) : autoTare;
  const autoNet = (Number(watched.grossKg) || 0) - effectiveTare;
  const effectiveNet = watched.netKg !== '' ? Number(watched.netKg) : autoNet;

  const openLineModal = (pallet: Pallet) => {
    reset({ ...emptyLine, estibas: pallet.lines.length === 0 ? '1' : '0' });
    setFormError(null);
    setLineModal({ pallet });
  };

  const onBarcode = (code: string) => {
    setScannerOpen(false);
    const product = products?.find((p) => p.barcode === code);
    if (product) {
      setValue('productId', product.id);
      setFormError(null);
    } else {
      setFormError(`Ningún producto de este cliente tiene el código ${code}`);
    }
  };

  if (isLoading || !receipt) {
    return <div className="text-slate-500 text-sm">Cargando…</div>;
  }

  const editable = receipt.status === 'DRAFT';
  const totalLines = receipt.pallets.reduce((s, p) => s + p.lines.length, 0);

  return (
    <div>
      {/* ---------- Encabezado ---------- */}
      <Link to="/receipts" className="inline-flex items-center gap-1 text-sm text-brand-700 mb-3">
        <ArrowLeft size={16} /> Recepciones
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            <span className="font-mono">{receipt.code}</span>
            <span className="ml-3 text-lg font-medium text-slate-600">{receipt.customer?.name}</span>
          </h1>
          <div className="text-sm text-slate-500 mt-1">
            {new Date(receipt.receivedAt).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}
            {' · '}
            <span className={receipt.status === 'CONFIRMED' ? 'badge-green' : receipt.status === 'DRAFT' ? 'badge-yellow' : 'badge-gray'}>
              {RECEIPT_STATUS_LABELS[receipt.status]}
            </span>
          </div>
        </div>
        {editable && (
          <button
            className="btn-primary"
            disabled={confirm.isPending || totalLines === 0}
            onClick={() => confirm.mutate()}
          >
            {confirm.isPending ? 'Confirmando…' : 'Confirmar recepción'}
          </button>
        )}
      </div>

      {actionError && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3 mb-4">
          {actionError}
          <button className="ml-2 underline" onClick={() => setActionError(null)}>
            cerrar
          </button>
        </div>
      )}

      {/* ---------- Fotos del soporte ---------- */}
      <div className="card p-4 mb-5">
        <div className="font-semibold text-sm mb-3">Fotos del soporte</div>
        <PhotoGallery
          photos={receipt.photos}
          readonly={!editable}
          onUpload={async (file) => {
            const form = new FormData();
            form.append('photo', file);
            await api.post(`/receipts/${id}/photos`, form, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            refresh();
          }}
          onDelete={async (photo: Photo) => {
            await api.delete(`/receipts/${id}/photos/${photo.id}`);
            refresh();
          }}
        />
      </div>

      {/* ---------- Estibas ---------- */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Estibas ({receipt.pallets.length})</h2>
        {editable && (
          <div className="flex gap-2">
            {ENVIRONMENTS.map((env) => (
              <button
                key={env}
                className="btn-secondary text-xs"
                disabled={addPallet.isPending}
                onClick={() => addPallet.mutate(env)}
              >
                <Plus size={14} className="mr-1" /> {ENVIRONMENT_LABELS[env]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {receipt.pallets.map((pallet) => (
          <div key={pallet.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold">{pallet.code}</span>
                <EnvironmentBadge environment={pallet.environment} />
              </div>
              <div className="flex gap-2">
                <Link
                  to={`/pallets/${pallet.id}/label`}
                  className="btn-secondary text-xs"
                  title="Imprimir cédula"
                >
                  <Printer size={14} className="mr-1" /> Cédula
                </Link>
                {editable && (
                  <>
                    <button className="btn-primary text-xs" onClick={() => openLineModal(pallet)}>
                      <Plus size={14} className="mr-1" /> Pesada
                    </button>
                    {pallet.lines.length === 0 && (
                      <button
                        className="btn-danger text-xs"
                        onClick={() => removePallet.mutate(pallet.id)}
                        aria-label="Eliminar estiba"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {pallet.lines.length === 0 ? (
              <div className="text-sm text-slate-400">Sin pesadas — agrega la primera</div>
            ) : (
              <div className="space-y-2">
                {pallet.lines.map((line: ReceiptLine) => (
                  <div key={line.id} className="flex items-start justify-between gap-2 border-t border-slate-100 pt-2">
                    <div className="text-sm">
                      <div className="font-medium">{line.product.name}</div>
                      <div className="text-xs text-slate-500">
                        Lote <span className="font-mono">{line.lotCode}</span>
                        {line.expiryDate &&
                          ` · vence ${new Date(line.expiryDate).toLocaleDateString('es-CO', { timeZone: 'UTC' })}`}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {line.product.measure === 'KG' ? (
                          <>
                            Bruto {fmtKg(line.grossKg)} · {line.canastillas} canastilla(s) +{' '}
                            {line.estibas} estiba(s) = tara {fmtKg(line.tareKg)} ·{' '}
                            <strong>Neto {fmtKg(line.netKg)}</strong>
                          </>
                        ) : (
                          <strong>
                            {line.units} {line.product.unit}
                          </strong>
                        )}
                      </div>
                    </div>
                    {editable && (
                      <button
                        className="text-slate-400 hover:text-red-600 p-1"
                        onClick={() => removeLine.mutate(line.id)}
                        aria-label="Eliminar pesada"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {receipt.pallets.length === 0 && (
          <div className="text-center text-slate-400 py-8 card">
            Agrega la primera estiba indicando a qué cuarto entra
          </div>
        )}
      </div>

      {/* ---------- Modal de pesada ---------- */}
      <Modal
        open={!!lineModal}
        title={`Pesada — estiba ${lineModal?.pallet.code ?? ''}`}
        onClose={() => setLineModal(null)}
      >
        <form onSubmit={handleSubmit((v) => addLine.mutate(v))} className="space-y-4">
          <div>
            <label className="label">Producto *</label>
            <div className="flex gap-2">
              <select className="input" {...register('productId', { required: 'Requerido' })}>
                <option value="">Selecciona…</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.measure === 'KG' ? 'kg' : p.unit})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary shrink-0"
                onClick={() => setScannerOpen(true)}
                aria-label="Escanear código de barras"
              >
                <ScanBarcode size={18} />
              </button>
            </div>
            {errors.productId && <p className="text-xs text-red-600 mt-1">{errors.productId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Lote *</label>
              <input className="input" {...register('lotCode', { required: 'Requerido' })} />
              {errors.lotCode && <p className="text-xs text-red-600 mt-1">{errors.lotCode.message}</p>}
            </div>
            <div>
              <label className="label">Vencimiento</label>
              <input className="input" type="date" {...register('expiryDate')} />
            </div>
          </div>

          {selectedProduct?.measure === 'KG' ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Peso bruto (kg) *</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    {...register('grossKg', { required: 'Requerido' })}
                  />
                </div>
                <div>
                  <label className="label">Canastillas</label>
                  <input className="input" type="number" min={0} inputMode="numeric" {...register('canastillas')} />
                </div>
                <div>
                  <label className="label">Estibas</label>
                  <input className="input" type="number" min={0} inputMode="numeric" {...register('estibas')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tara (kg)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder={`Auto: ${autoTare.toFixed(2)}`}
                    {...register('tareKg')}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    {canastillaKg} kg/canastilla · {estibaKg} kg/estiba
                  </p>
                </div>
                <div>
                  <label className="label">Peso neto (kg)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder={`Auto: ${autoNet > 0 ? autoNet.toFixed(2) : '—'}`}
                    {...register('netKg')}
                  />
                </div>
              </div>
              <div
                className={`rounded-md text-sm p-3 border ${
                  effectiveNet > 0
                    ? 'bg-brand-50 border-brand-200 text-brand-900'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                Neto a registrar: <strong>{effectiveNet > 0 ? `${effectiveNet.toFixed(2)} kg` : 'revisa bruto y taras'}</strong>
              </div>
            </>
          ) : selectedProduct ? (
            <div>
              <label className="label">Cantidad ({selectedProduct.unit}) *</label>
              <input
                className="input"
                type="number"
                min={1}
                inputMode="numeric"
                {...register('units', { required: 'Requerido' })}
              />
              {errors.units && <p className="text-xs text-red-600 mt-1">{errors.units.message}</p>}
            </div>
          ) : null}

          {formError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3">{formError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setLineModal(null)}>
              Cerrar
            </button>
            <button type="submit" className="btn-primary" disabled={addLine.isPending}>
              {addLine.isPending ? 'Guardando…' : 'Registrar pesada'}
            </button>
          </div>
        </form>
      </Modal>

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetect={onBarcode} />
    </div>
  );
}
