import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Pencil, KeyRound } from 'lucide-react';
import { api } from '../lib/api';
import { ROLE_LABELS, type Paginated, type User, type UserRole } from '../lib/types';
import { useAuthStore } from '../lib/auth-store';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';

interface FormValues {
  email: string;
  fullName: string;
  role: UserRole;
  password: string;
  isActive: boolean;
}

const emptyForm: FormValues = {
  email: '',
  fullName: '',
  role: 'OPERARIO',
  password: '',
  isActive: true,
};

const ROLES: UserRole[] = ['ADMIN', 'SUPERVISOR', 'OPERARIO'];

export function UsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Contraseña temporal generada por el backend — se muestra UNA sola vez.
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', { page, q }],
    queryFn: async () =>
      (await api.get<Paginated<User>>('/users', { params: { page, pageSize: 20, q: q || undefined } })).data,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ defaultValues: emptyForm });

  const openCreate = () => {
    setEditing(null);
    reset(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    reset({ email: u.email, fullName: u.fullName, role: u.role, password: '', isActive: u.isActive });
    setFormError(null);
    setModalOpen(true);
  };

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      if (editing) {
        const payload = {
          email: values.email.trim(),
          fullName: values.fullName.trim(),
          role: values.role,
          isActive: values.isActive,
          ...(values.password ? { password: values.password } : {}),
        };
        return { user: (await api.patch<User>(`/users/${editing.id}`, payload)).data, temporaryPassword: null };
      }
      const payload = {
        email: values.email.trim(),
        fullName: values.fullName.trim(),
        role: values.role,
        ...(values.password ? { password: values.password } : {}),
      };
      return (await api.post<{ user: User; temporaryPassword: string | null }>('/users', payload)).data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModalOpen(false);
      if (result.temporaryPassword) {
        setTempPassword({ email: result.user.email, password: result.temporaryPassword });
      }
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'No se pudo guardar');
    },
  });

  const resetPassword = useMutation({
    mutationFn: async (u: User) =>
      (await api.post<{ email: string; temporaryPassword: string }>(`/users/${u.id}/reset-password`)).data,
    onSuccess: (r) => setTempPassword({ email: r.email, password: r.temporaryPassword }),
  });

  const roleBadge = (role: UserRole) =>
    role === 'ADMIN' ? 'badge-blue' : role === 'SUPERVISOR' ? 'badge-cyan' : 'badge-gray';

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle="Acceso al sistema y roles"
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} className="mr-1" /> Nuevo
          </button>
        }
      />

      <input
        className="input max-w-sm mb-4"
        placeholder="Buscar por nombre o email…"
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
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{u.fullName}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={roleBadge(u.role)}>{ROLE_LABELS[u.role]}</span>
                </td>
                <td className="px-4 py-3">
                  {u.isActive ? <span className="badge-green">Activo</span> : <span className="badge-gray">Inactivo</span>}
                </td>
                <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                  {u.id !== currentUser?.id && (
                    <button
                      className="btn-secondary"
                      onClick={() => resetPassword.mutate(u)}
                      title="Generar contraseña temporal"
                      aria-label={`Resetear contraseña de ${u.fullName}`}
                    >
                      <KeyRound size={14} />
                    </button>
                  )}
                  <button className="btn-secondary" onClick={() => openEdit(u)} aria-label={`Editar ${u.fullName}`}>
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tarjetas (móvil) */}
      <div className="md:hidden space-y-3">
        {data?.items.map((u) => (
          <button key={u.id} className="card w-full p-4 text-left" onClick={() => openEdit(u)}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{u.fullName}</div>
              <span className={roleBadge(u.role)}>{ROLE_LABELS[u.role]}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {u.email}
              {!u.isActive ? ' · INACTIVO' : ''}
            </div>
          </button>
        ))}
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}

      {/* Modal crear/editar */}
      <Modal open={modalOpen} title={editing ? `Editar ${editing.fullName}` : 'Nuevo usuario'} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4">
          <div>
            <label className="label">Nombre completo *</label>
            <input className="input" {...register('fullName', { required: 'Requerido' })} />
            {errors.fullName && <p className="text-xs text-red-600 mt-1">{errors.fullName.message}</p>}
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" {...register('email', { required: 'Requerido' })} />
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Rol *</label>
              <select className="input" {...register('role', { required: true })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{editing ? 'Nueva contraseña (opcional)' : 'Contraseña (opcional)'}</label>
              <input
                className="input"
                type="password"
                placeholder={editing ? 'Dejar vacío para no cambiar' : 'Vacío = se genera temporal'}
                {...register('password', { minLength: { value: editing ? 8 : 6, message: 'Muy corta' } })}
              />
              {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
            </div>
          </div>
          {editing && editing.id !== currentUser?.id && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('isActive')} /> Usuario activo
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

      {/* Contraseña temporal — se muestra una sola vez */}
      <Modal open={!!tempPassword} title="Contraseña temporal" onClose={() => setTempPassword(null)} size="sm">
        {tempPassword && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Entrégala al usuario <strong>{tempPassword.email}</strong>. No se podrá volver a consultar.
            </p>
            <div className="rounded-md bg-slate-100 border border-slate-200 text-center text-xl font-mono py-3 select-all">
              {tempPassword.password}
            </div>
            <button className="btn-primary w-full" onClick={() => setTempPassword(null)}>
              Listo, la copié
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
