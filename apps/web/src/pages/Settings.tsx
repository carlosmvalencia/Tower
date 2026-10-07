import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/auth-store';
import { PageHeader } from '../components/PageHeader';

interface FormValues {
  canastillaKg: string;
  estibaKg: string;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<Record<string, string>>('/settings')).data,
  });

  const { register, handleSubmit, reset } = useForm<FormValues>();

  useEffect(() => {
    if (data) {
      reset({
        canastillaKg: data['tare.canastillaKg'] ?? '',
        estibaKg: data['tare.estibaKg'] ?? '',
      });
    }
  }, [data, reset]);

  const save = useMutation({
    mutationFn: async (values: FormValues) =>
      api.patch('/settings', {
        values: {
          'tare.canastillaKg': values.canastillaKg,
          'tare.estibaKg': values.estibaKg,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Taras estándar para el cálculo del peso neto" />
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className="card p-5 max-w-md space-y-4">
        <div>
          <label className="label">Peso de la canastilla (kg)</label>
          <input className="input" type="number" step="0.01" disabled={!canEdit} {...register('canastillaKg')} />
        </div>
        <div>
          <label className="label">Peso de la estiba (kg)</label>
          <input className="input" type="number" step="0.01" disabled={!canEdit} {...register('estibaKg')} />
        </div>
        {canEdit ? (
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : save.isSuccess ? 'Guardado ✓' : 'Guardar'}
          </button>
        ) : (
          <p className="text-xs text-slate-400">Solo administradores y supervisores pueden modificar las taras.</p>
        )}
      </form>
    </div>
  );
}
