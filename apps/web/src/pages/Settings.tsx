import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Pencil, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { TARE_KIND_LABELS, type TareKind, type TareType } from '../lib/types';
import { useAuthStore } from '../lib/auth-store';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';

interface CapacityForm {
  dry: string;
  refrigerated: string;
  frozen: string;
}

interface TareForm {
  kind: TareKind;
  name: string;
  weightKg: string;
  isActive: boolean;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const [tareModal, setTareModal] = useState(false);
  const [editingTare, setEditingTare] = useState<TareType | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<Record<string, string>>('/settings')).data,
  });

  const { data: tareTypes } = useQuery({
    queryKey: ['tare-types'],
    queryFn: async () => (await api.get<TareType[]>('/settings/tare-types')).data,
  });

  const capForm = useForm<CapacityForm>();
  useEffect(() => {
    if (settings) {
      capForm.reset({
        dry: settings['capacity.dry'] ?? '',
        refrigerated: settings['capacity.refrigerated'] ?? '',
        frozen: settings['capacity.frozen'] ?? '',
      });
    }
  }, [settings, capForm]);

  const saveCapacity = useMutation({
    mutationFn: async (v: CapacityForm) =>
      api.patch('/settings', {
        values: {
          'capacity.dry': v.dry,
          'capacity.refrigerated': v.refrigerated,
          'capacity.frozen': v.frozen,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const tareForm = useForm<TareForm>({
    defaultValues: { kind: 'CANASTILLA', name: '', weightKg: '', isActive: true },
  });

  const saveTare = useMutation({
    mutationFn: async (v: TareForm) => {
      const payload = { name: v.name.trim(), weightKg: Number(v.weightKg) };
      if (editingTare) {
        return api.patch(`/settings/tare-types/${editingTare.id}`, { ...payload, isActive: v.isActive });
      }
      return api.post('/settings/tare-types', { ...payload, kind: v.kind });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tare-types'] });
      setTareModal(false);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'No se pudo guardar');
    },
  });

  const openTareModal = (t?: TareType) => {
    setEditingTare(t ?? null);
    tareForm.reset({
      kind: t?.kind ?? 'CANASTILLA',
      name: t?.name ?? '',
      weightKg: t ? String(Number(t.weightKg)) : '',
      isActive: t?.isActive ?? true,
    });
    setFormError(null);
    setTareModal(true);
  };

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Taras, capacidades de bodega y parámetros operativos" />

      <div className="grid md:grid-cols-2 gap-4 items-start max-w-4xl">
        {/* ---------- Tipos de tara ---------- */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold text-sm">Tipos de tara</div>
              <p className="text-xs text-slate-500">Cada canastilla/estiba con su peso real — se usan en las pesadas de las EM</p>
            </div>
            {canEdit && (
              <button className="btn-primary text-xs shrink-0" onClick={() => openTareModal()}>
                <Plus size={14} className="mr-1" /> Nuevo
              </button>
            )}
          </div>
          <div className="space-y-2">
            {tareTypes?.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 text-sm border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                <div>
                  <span className="badge-gray mr-2">{TARE_KIND_LABELS[t.kind]}</span>
                  <span className={`font-medium ${!t.isActive ? 'line-through text-slate-400' : ''}`}>{t.name}</span>{' '}
                  <span className="font-semibold">{Number(t.weightKg)} kg</span>
                </div>
                {canEdit && (
                  <button className="btn-secondary" onClick={() => openTareModal(t)} aria-label={`Editar ${t.name}`}>
                    <Pencil size={13} />
                  </button>
                )}
              </div>
            ))}
            {tareTypes?.length === 0 && <div className="text-sm text-slate-400">Sin tipos de tara</div>}
          </div>
        </div>

        {/* ---------- Capacidad de bodegas ---------- */}
        <form onSubmit={capForm.handleSubmit((v) => saveCapacity.mutate(v))} className="card p-5 space-y-4">
          <div>
            <div className="font-semibold text-sm">Capacidad de bodegas (posiciones)</div>
            <p className="text-xs text-slate-500">Base del panel de ocupación del Almacenaje</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Seco</label>
              <input className="input" type="number" min={0} disabled={!canEdit} {...capForm.register('dry')} />
            </div>
            <div>
              <label className="label">Refrigerado</label>
              <input className="input" type="number" min={0} disabled={!canEdit} {...capForm.register('refrigerated')} />
            </div>
            <div>
              <label className="label">Congelado</label>
              <input className="input" type="number" min={0} disabled={!canEdit} {...capForm.register('frozen')} />
            </div>
          </div>
          {canEdit ? (
            <button type="submit" className="btn-primary" disabled={saveCapacity.isPending}>
              {saveCapacity.isPending ? 'Guardando…' : saveCapacity.isSuccess ? 'Guardado ✓' : 'Guardar capacidades'}
            </button>
          ) : (
            <p className="text-xs text-slate-400">Solo administradores y supervisores pueden modificar.</p>
          )}
        </form>
      </div>

      {/* ---------- Modal tipo de tara ---------- */}
      <Modal
        open={tareModal}
        title={editingTare ? `Editar ${editingTare.name}` : 'Nuevo tipo de tara'}
        onClose={() => setTareModal(false)}
        size="sm"
      >
        <form onSubmit={tareForm.handleSubmit((v) => saveTare.mutate(v))} className="space-y-4">
          {!editingTare && (
            <div>
              <label className="label">Tipo *</label>
              <select className="input" {...tareForm.register('kind')}>
                {Object.entries(TARE_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Nombre *</label>
            <input
              className="input"
              placeholder="Ej: Canastilla grande, Estiba de madera"
              {...tareForm.register('name', { required: true })}
            />
          </div>
          <div>
            <label className="label">Peso (kg) *</label>
            <input className="input" type="number" step="0.01" min={0.01} {...tareForm.register('weightKg', { required: true })} />
          </div>
          {editingTare && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...tareForm.register('isActive')} /> Activo (visible en las pesadas)
            </label>
          )}
          {formError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3">{formError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setTareModal(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saveTare.isPending}>
              {saveTare.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
