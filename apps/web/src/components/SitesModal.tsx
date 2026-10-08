import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Pencil, Plus } from 'lucide-react';
import { api } from '../lib/api';
import type { Customer, CustomerSite } from '../lib/types';
import { Modal } from './Modal';

interface Props {
  customer: Customer | null;
  onClose: () => void;
}

interface FormValues {
  name: string;
  addressLine: string;
  city: string;
  contactName: string;
  phone: string;
  isActive: boolean;
}

const emptyForm: FormValues = {
  name: '',
  addressLine: '',
  city: '',
  contactName: '',
  phone: '',
  isActive: true,
};

/** Administración de sedes de un cliente (destinos de las salidas). */
export function SitesModal({ customer, onClose }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CustomerSite | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: sites } = useQuery({
    queryKey: ['sites', customer?.id],
    enabled: !!customer,
    queryFn: async () =>
      (await api.get<CustomerSite[]>(`/customers/${customer!.id}/sites`, { params: { all: true } })).data,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: emptyForm,
  });

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        name: values.name.trim(),
        addressLine: values.addressLine.trim() || undefined,
        city: values.city.trim() || undefined,
        contactName: values.contactName.trim() || undefined,
        phone: values.phone.trim() || undefined,
        ...(editing ? { isActive: values.isActive } : {}),
      };
      if (editing) {
        return api.patch(`/customers/${customer!.id}/sites/${editing.id}`, payload);
      }
      return api.post(`/customers/${customer!.id}/sites`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites', customer?.id] });
      setFormOpen(false);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'No se pudo guardar la sede');
    },
  });

  const openCreate = () => {
    setEditing(null);
    reset(emptyForm);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (s: CustomerSite) => {
    setEditing(s);
    reset({
      name: s.name,
      addressLine: s.addressLine ?? '',
      city: s.city ?? '',
      contactName: s.contactName ?? '',
      phone: s.phone ?? '',
      isActive: s.isActive,
    });
    setFormError(null);
    setFormOpen(true);
  };

  return (
    <Modal open={!!customer} title={`Sedes de ${customer?.name ?? ''}`} onClose={onClose}>
      {!formOpen ? (
        <div className="space-y-3">
          <button className="btn-primary w-full" onClick={openCreate}>
            <Plus size={16} className="mr-1" /> Nueva sede
          </button>
          {sites?.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-2 border border-slate-200 rounded-md p-3">
              <div className="text-sm">
                <div className="font-medium">
                  {s.name}
                  {!s.isActive && <span className="badge-gray ml-2">Inactiva</span>}
                </div>
                <div className="text-xs text-slate-500">
                  {[s.addressLine, s.city].filter(Boolean).join(' · ') || 'Sin dirección'}
                  {s.contactName && ` · ${s.contactName}`}
                  {s.phone && ` · ${s.phone}`}
                </div>
              </div>
              <button className="btn-secondary" onClick={() => openEdit(s)} aria-label={`Editar ${s.name}`}>
                <Pencil size={14} />
              </button>
            </div>
          ))}
          {sites && sites.length === 0 && (
            <div className="text-center text-slate-400 text-sm py-4">Este cliente aún no tiene sedes</div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4">
          <div>
            <label className="label">Nombre de la sede *</label>
            <input className="input" placeholder="Ej: Sede Cali Norte" {...register('name', { required: 'Requerido' })} />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Dirección</label>
              <input className="input" {...register('addressLine')} />
            </div>
            <div>
              <label className="label">Ciudad</label>
              <input className="input" {...register('city')} />
            </div>
            <div>
              <label className="label">Contacto</label>
              <input className="input" {...register('contactName')} />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input className="input" {...register('phone')} />
            </div>
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('isActive')} /> Sede activa
            </label>
          )}
          {formError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3">{formError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>
              Volver
            </button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar sede'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
