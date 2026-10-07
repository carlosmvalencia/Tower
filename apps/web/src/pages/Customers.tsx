import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Pencil } from 'lucide-react';
import { api } from '../lib/api';
import { SERVICE_TYPE_LABELS, type Customer, type CustomerServiceType, type Paginated } from '../lib/types';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';

interface FormValues {
  code: string;
  name: string;
  taxId: string;
  addressLine: string;
  contactName: string;
  phone: string;
  email: string;
  serviceType: CustomerServiceType;
  notes: string;
  isActive: boolean;
}

const emptyForm: FormValues = {
  code: '',
  name: '',
  taxId: '',
  addressLine: '',
  contactName: '',
  phone: '',
  email: '',
  serviceType: 'INVENTORY',
  notes: '',
  isActive: true,
};

export function CustomersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { page, q }],
    queryFn: async () =>
      (await api.get<Paginated<Customer>>('/customers', { params: { page, pageSize: 20, q: q || undefined } })).data,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ defaultValues: emptyForm });

  const openCreate = () => {
    setEditing(null);
    reset(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    reset({
      code: c.code,
      name: c.name,
      taxId: c.taxId ?? '',
      addressLine: c.addressLine ?? '',
      contactName: c.contactName ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      serviceType: c.serviceType ?? 'INVENTORY',
      notes: c.notes ?? '',
      isActive: c.isActive,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        code: values.code.trim() || undefined,
        name: values.name.trim(),
        taxId: values.taxId.trim() || undefined,
        addressLine: values.addressLine.trim() || undefined,
        contactName: values.contactName.trim() || undefined,
        phone: values.phone.trim() || undefined,
        email: values.email.trim() || undefined,
        serviceType: values.serviceType,
        notes: values.notes.trim() || undefined,
        ...(editing ? { isActive: values.isActive } : {}),
      };
      if (editing) {
        return (await api.patch(`/customers/${editing.id}`, payload)).data;
      }
      return (await api.post('/customers', payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setModalOpen(false);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'No se pudo guardar');
    },
  });

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Clientes comerciales dueños de la mercancía almacenada"
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} className="mr-1" /> Nuevo
          </button>
        }
      />

      <input
        className="input max-w-sm mb-4"
        placeholder="Buscar por código, nombre o NIT…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />

      {isLoading && <div className="text-slate-500 text-sm">Cargando…</div>}

      {/* Tabla (desktop) */}
      <div className="hidden md:block card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">NIT</th>
              <th className="px-4 py-3">Servicio</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3">Productos</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{c.taxId ?? '—'}</td>
                <td className="px-4 py-3 text-xs">{SERVICE_TYPE_LABELS[c.serviceType]}</td>
                <td className="px-4 py-3">{c.contactName ?? '—'}</td>
                <td className="px-4 py-3">{c._count?.products ?? 0}</td>
                <td className="px-4 py-3">
                  {c.isActive ? <span className="badge-green">Activo</span> : <span className="badge-gray">Inactivo</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="btn-secondary" onClick={() => openEdit(c)} aria-label={`Editar ${c.name}`}>
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tarjetas (móvil) */}
      <div className="md:hidden space-y-3">
        {data?.items.map((c) => (
          <button key={c.id} className="card w-full p-4 text-left" onClick={() => openEdit(c)}>
            <div className="flex items-center justify-between">
              <div className="font-medium">{c.name}</div>
              {c.isActive ? <span className="badge-green">Activo</span> : <span className="badge-gray">Inactivo</span>}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              <span className="font-mono">{c.code}</span> · {SERVICE_TYPE_LABELS[c.serviceType]}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {c._count?.products ?? 0} producto(s){c.contactName ? ` · ${c.contactName}` : ''}
            </div>
          </button>
        ))}
        {data && data.items.length === 0 && (
          <div className="text-center text-slate-400 py-8">Sin resultados</div>
        )}
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}

      <Modal open={modalOpen} title={editing ? `Editar ${editing.name}` : 'Nuevo cliente'} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Código</label>
              <input className="input" placeholder="Automático si se deja vacío" {...register('code')} />
            </div>
            <div>
              <label className="label">Nombre *</label>
              <input className="input" {...register('name', { required: 'Requerido' })} />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">NIT</label>
              <input className="input" {...register('taxId')} />
            </div>
            <div>
              <label className="label">Tipo de servicio *</label>
              <select className="input" {...register('serviceType')}>
                {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Dirección</label>
              <input className="input" {...register('addressLine')} />
            </div>
            <div>
              <label className="label">Contacto</label>
              <input className="input" {...register('contactName')} />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input className="input" {...register('phone')} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" {...register('email')} />
            </div>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} {...register('notes')} />
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('isActive')} /> Cliente activo
            </label>
          )}
          {formError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3">{formError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
