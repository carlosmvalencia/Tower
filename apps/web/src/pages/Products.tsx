import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Pencil } from 'lucide-react';
import { api } from '../lib/api';
import {
  ENVIRONMENT_LABELS,
  type CustomerOption,
  type Environment,
  type Paginated,
  type Product,
} from '../lib/types';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { EnvironmentBadge } from '../components/EnvironmentBadge';

interface FormValues {
  customerId: string;
  code: string;
  name: string;
  barcode: string;
  unit: string;
  environment: Environment;
  shelfLifeDays: string;
  notes: string;
  isActive: boolean;
}

const emptyForm: FormValues = {
  customerId: '',
  code: '',
  name: '',
  barcode: '',
  unit: 'UND',
  environment: 'DRY',
  shelfLifeDays: '',
  notes: '',
  isActive: true,
};

const ENVIRONMENTS: Environment[] = ['FROZEN', 'REFRIGERATED', 'DRY'];

export function ProductsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [environment, setEnvironment] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const customers = useQuery({
    queryKey: ['customers', 'options'],
    queryFn: async () => (await api.get<CustomerOption[]>('/customers/options')).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products', { page, q, customerId, environment }],
    queryFn: async () =>
      (
        await api.get<Paginated<Product>>('/products', {
          params: {
            page,
            pageSize: 20,
            q: q || undefined,
            customerId: customerId || undefined,
            environment: environment || undefined,
          },
        })
      ).data,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ defaultValues: emptyForm });

  const openCreate = () => {
    setEditing(null);
    reset({ ...emptyForm, customerId: customerId || '' });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    reset({
      customerId: p.customerId,
      code: p.code,
      name: p.name,
      barcode: p.barcode ?? '',
      unit: p.unit,
      environment: p.environment,
      shelfLifeDays: p.shelfLifeDays ? String(p.shelfLifeDays) : '',
      notes: p.notes ?? '',
      isActive: p.isActive,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        customerId: values.customerId,
        code: values.code.trim(),
        name: values.name.trim(),
        barcode: values.barcode.trim() || undefined,
        unit: values.unit.trim() || 'UND',
        environment: values.environment,
        shelfLifeDays: values.shelfLifeDays ? Number(values.shelfLifeDays) : undefined,
        notes: values.notes.trim() || undefined,
        ...(editing ? { isActive: values.isActive } : {}),
      };
      if (editing) {
        return (await api.patch(`/products/${editing.id}`, payload)).data;
      }
      return (await api.post('/products', payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
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
        title="Productos"
        subtitle="Catálogo de productos por cliente"
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} className="mr-1" /> Nuevo
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          className="input sm:max-w-xs"
          placeholder="Buscar por código, nombre o barras…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="input sm:max-w-[220px]"
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos los clientes</option>
          {customers.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="input sm:max-w-[180px]"
          value={environment}
          onChange={(e) => {
            setEnvironment(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos los ambientes</option>
          {ENVIRONMENTS.map((env) => (
            <option key={env} value={env}>
              {ENVIRONMENT_LABELS[env]}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <div className="text-slate-500 text-sm">Cargando…</div>}

      {/* Tabla (desktop) */}
      <div className="hidden md:block card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Ambiente</th>
              <th className="px-4 py-3">Unidad</th>
              <th className="px-4 py-3">Vida útil</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3">{p.customer?.name}</td>
                <td className="px-4 py-3">
                  <EnvironmentBadge environment={p.environment} />
                </td>
                <td className="px-4 py-3">{p.unit}</td>
                <td className="px-4 py-3">{p.shelfLifeDays ? `${p.shelfLifeDays} días` : '—'}</td>
                <td className="px-4 py-3">
                  {p.isActive ? <span className="badge-green">Activo</span> : <span className="badge-gray">Inactivo</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="btn-secondary" onClick={() => openEdit(p)} aria-label={`Editar ${p.name}`}>
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
        {data?.items.map((p) => (
          <button key={p.id} className="card w-full p-4 text-left" onClick={() => openEdit(p)}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{p.name}</div>
              <EnvironmentBadge environment={p.environment} />
            </div>
            <div className="text-xs text-slate-500 mt-1">
              <span className="font-mono">{p.code}</span> · {p.customer?.name}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {p.unit}
              {p.shelfLifeDays ? ` · vida útil ${p.shelfLifeDays} días` : ''}
              {!p.isActive ? ' · INACTIVO' : ''}
            </div>
          </button>
        ))}
        {data && data.items.length === 0 && (
          <div className="text-center text-slate-400 py-8">Sin resultados</div>
        )}
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}

      <Modal open={modalOpen} title={editing ? `Editar ${editing.name}` : 'Nuevo producto'} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Código *</label>
              <input className="input" {...register('code', { required: 'Requerido' })} />
              {errors.code && <p className="text-xs text-red-600 mt-1">{errors.code.message}</p>}
            </div>
            <div>
              <label className="label">Nombre *</label>
              <input className="input" {...register('name', { required: 'Requerido' })} />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Código de barras</label>
              <input className="input" inputMode="numeric" {...register('barcode')} />
            </div>
            <div>
              <label className="label">Unidad</label>
              <input className="input" placeholder="UND, CAJA, KG…" {...register('unit')} />
            </div>
            <div>
              <label className="label">Ambiente *</label>
              <select className="input" {...register('environment', { required: true })}>
                {ENVIRONMENTS.map((env) => (
                  <option key={env} value={env}>
                    {ENVIRONMENT_LABELS[env]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Vida útil (días)</label>
              <input className="input" type="number" min={1} {...register('shelfLifeDays')} />
            </div>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} {...register('notes')} />
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('isActive')} /> Producto activo
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
