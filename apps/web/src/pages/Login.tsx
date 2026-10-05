import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/auth-store';
import type { LoginResponse } from '../lib/types';

interface FormValues {
  email: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>();

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<LoginResponse>('/auth/login', data);
      setSession(res.data);
      navigate('/', { replace: true });
    } catch (e) {
      if (axios.isAxiosError(e)) {
        setError((e.response?.data as { message?: string })?.message ?? 'No se pudo iniciar sesión');
      } else {
        setError('Error inesperado');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-brand-700">Tower</div>
          <div className="text-sm text-slate-500">WMS de All-logistics</div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Correo electrónico</label>
            <input
              type="email"
              className="input"
              autoComplete="email"
              {...register('email', { required: 'Requerido' })}
            />
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input
              type="password"
              className="input"
              autoComplete="current-password"
              {...register('password', { required: 'Requerido' })}
            />
            {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
          </div>
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3">
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
