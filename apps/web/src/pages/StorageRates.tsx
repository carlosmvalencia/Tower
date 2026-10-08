import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import {
  ENVIRONMENT_LABELS,
  EXTRA_KIND_LABELS,
  type CustomerOption,
  type Environment,
  type StorageExtraKind,
  type StorageExtraRate,
  type StorageRate,
} from '../lib/types';
import { useAuthStore } from '../lib/auth-store';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { EnvironmentBadge } from '../components/EnvironmentBadge';
import { StorageTabs, fmtMoney } from '../components/StorageTabs';

const ENVIRONMENTS: Environment[] = ['FROZEN', 'REFRIGERATED', 'DRY'];

function today(): string {
  return new Date().toLocaleDateString('sv-SE');
}

interface RateForm {
  environment: Environment;
  unit: 'POSITION_DAY' | 'KG_DAY';
  ratePerDay: string;
  validFrom: string;
}

interface ExtraForm {
  kind: StorageExtraKind;
  name: string;
  ratePerKg: string;
  validFrom: string;
}

export function StorageRatesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const [customerId, setCustomerId] = useState('');
  const [rateModal, setRateModal] = useState(false);
  const [extraModal, setExtraModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const customers = useQuery({
    queryKey: ['customers', 'options'],
    queryFn: async () => (await api.get<CustomerOption[]>('/customers/options')).data,
  });

  const { data } = useQuery({
    queryKey: ['storage-rates', customerId],
    enabled: !!customerId,
    queryFn: async () =>
      (await api.get<{ rates: StorageRate[]; extras: StorageExtraRate[] }>(`/storage-control/rates/${customerId}`)).data,
  });

  const rateForm = useForm<RateForm>({
    defaultValues: { environment: 'REFRIGERATED', unit: 'POSITION_DAY', ratePerDay: '', validFrom: today() },
  });
  const extraForm = useForm<ExtraForm>({
    defaultValues: { kind: 'CARGUE_DESCARGUE', name: '', ratePerKg: '', validFrom: today() },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['storage-rates', customerId] });
  const onError = (e: unknown) => {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
    setFormError(msg ?? 'No se pudo guardar');
  };

  const createRate = useMutation({
    mutationFn: async (v: RateForm) =>
      api.post('/storage-control/rates', {
        customerId,
        environment: v.environment,
        unit: v.unit,
        ratePerDay: Number(v.ratePerDay),
        validFrom: v.validFrom,
      }),
    onSuccess: () => {
      refresh();
      setRateModal(false);
    },
    onError,
  });

  const createExtra = useMutation({
    mutationFn: async (v: ExtraForm) =>
      api.post('/storage-control/extra-rates', {
        customerId,
        kind: v.kind,
        name: v.name.trim() || undefined,
        ratePerKg: Number(v.ratePerKg),
        validFrom: v.validFrom,
      }),
    onSuccess: () => {
      refresh();
      setExtraModal(false);
    },
    onError,
  });

  const delRate = useMutation({
    mutationFn: async (id: string) => api.delete(`/storage-control/rates/${id}`),
    onSuccess: refresh,
  });
  const delExtra = useMutation({
    mutationFn: async (id: string) => api.delete(`/storage-control/extra-rates/${id}`),
    onSuccess: refresh,
  });

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('es-CO', { timeZone: 'UTC' });

  return (
    <div>
      <PageHeader title="Almacenaje" subtitle="Tarifario por cliente — la personalización de cada contrato" />
      <StorageTabs />

      <select className="input max-w-[260px] mb-4" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
        <option value="">Selecciona cliente…</option>
        {customers.data?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {customerId && data && (
        <div className="grid md:grid-cols-2 gap-4 items-start">
          {/* Tarifas de almacenaje */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm">Almacenaje por bodega</div>
              {canEdit && (
                <button
                  className="btn-primary text-xs"
                  onClick={() => {
                    rateForm.reset({ environment: 'REFRIGERATED', unit: 'POSITION_DAY', ratePerDay: '', validFrom: today() });
                    setFormError(null);
                    setRateModal(true);
                  }}
                >
                  <Plus size={14} className="mr-1" /> Tarifa
                </button>
              )}
            </div>
            {data.rates.length === 0 && <div className="text-sm text-slate-400">Sin tarifas — el cliente no genera cobro de almacenaje</div>}
            <div className="space-y-2">
              {data.rates.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                  <div className="flex items-center gap-2">
                    <EnvironmentBadge environment={r.environment} />
                    <span className="font-semibold">{fmtMoney(Number(r.ratePerDay))}</span>
                    <span className="text-xs text-slate-500">por {r.unit === 'KG_DAY' ? 'kg' : 'posición'}/día</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">desde {fmtDate(r.validFrom)}</span>
                    {canEdit && (
                      <button className="text-slate-300 hover:text-red-600" onClick={() => delRate.mutate(r.id)} aria-label="Eliminar tarifa">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conceptos adicionales */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm">Conceptos adicionales ($/kg)</div>
              {canEdit && (
                <button
                  className="btn-primary text-xs"
                  onClick={() => {
                    extraForm.reset({ kind: 'CARGUE_DESCARGUE', name: '', ratePerKg: '', validFrom: today() });
                    setFormError(null);
                    setExtraModal(true);
                  }}
                >
                  <Plus size={14} className="mr-1" /> Concepto
                </button>
              )}
            </div>
            {data.extras.length === 0 && <div className="text-sm text-slate-400">Sin conceptos adicionales</div>}
            <div className="space-y-2">
              {data.extras.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 text-sm border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                  <div>
                    <span className="font-medium">{e.kind === 'OTRO' ? e.name : EXTRA_KIND_LABELS[e.kind]}</span>{' '}
                    <span className="font-semibold">{fmtMoney(Number(e.ratePerKg))}</span>
                    <span className="text-xs text-slate-500">/kg</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">desde {fmtDate(e.validFrom)}</span>
                    {canEdit && (
                      <button className="text-slate-300 hover:text-red-600" onClick={() => delExtra.mutate(e.id)} aria-label="Eliminar concepto">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal tarifa */}
      <Modal open={rateModal} title="Nueva tarifa de almacenaje" onClose={() => setRateModal(false)} size="sm">
        <form onSubmit={rateForm.handleSubmit((v) => createRate.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Bodega *</label>
              <select className="input" {...rateForm.register('environment')}>
                {ENVIRONMENTS.map((env) => (
                  <option key={env} value={env}>
                    {ENVIRONMENT_LABELS[env]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Unidad de cobro *</label>
              <select className="input" {...rateForm.register('unit')}>
                <option value="POSITION_DAY">$/posición/día</option>
                <option value="KG_DAY">$/kg/día</option>
              </select>
            </div>
            <div>
              <label className="label">Tarifa ($) *</label>
              <input className="input" type="number" step="0.01" min={0} {...rateForm.register('ratePerDay', { required: true })} />
            </div>
            <div>
              <label className="label">Rige desde *</label>
              <input className="input" type="date" {...rateForm.register('validFrom', { required: true })} />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Para subir la tarifa en el futuro, agrega una nueva con la fecha desde la que rige — el histórico se conserva.
          </p>
          {formError && <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3">{formError}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setRateModal(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={createRate.isPending}>
              Guardar
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal concepto adicional */}
      <Modal open={extraModal} title="Nuevo concepto adicional" onClose={() => setExtraModal(false)} size="sm">
        <form onSubmit={extraForm.handleSubmit((v) => createExtra.mutate(v))} className="space-y-4">
          <div>
            <label className="label">Concepto *</label>
            <select className="input" {...extraForm.register('kind')}>
              {Object.entries(EXTRA_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {extraForm.watch('kind') === 'OTRO' && (
            <div>
              <label className="label">Nombre del concepto *</label>
              <input className="input" {...extraForm.register('name')} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tarifa ($/kg) *</label>
              <input className="input" type="number" step="0.01" min={0} {...extraForm.register('ratePerKg', { required: true })} />
            </div>
            <div>
              <label className="label">Rige desde *</label>
              <input className="input" type="date" {...extraForm.register('validFrom', { required: true })} />
            </div>
          </div>
          {formError && <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3">{formError}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setExtraModal(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={createExtra.isPending}>
              Guardar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
