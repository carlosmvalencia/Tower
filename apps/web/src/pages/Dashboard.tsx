import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Package, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/auth-store';
import type { Paginated, Customer, Product } from '../lib/types';
import { PageHeader } from '../components/PageHeader';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const customers = useQuery({
    queryKey: ['customers', { page: 1, pageSize: 1 }],
    queryFn: async () =>
      (await api.get<Paginated<Customer>>('/customers', { params: { page: 1, pageSize: 1 } })).data,
  });
  const products = useQuery({
    queryKey: ['products', { page: 1, pageSize: 1 }],
    queryFn: async () =>
      (await api.get<Paginated<Product>>('/products', { params: { page: 1, pageSize: 1 } })).data,
  });

  return (
    <div>
      <PageHeader
        title={`Hola, ${user?.fullName?.split(' ')[0] ?? ''}`}
        subtitle="Panel de la bodega — los indicadores de inventario llegan con las siguientes fases"
      />

      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <Link to="/customers" className="card p-5 hover:border-brand-400 transition-colors">
          <Building2 className="text-brand-600 mb-2" size={24} />
          <div className="text-3xl font-bold text-slate-900">
            {customers.data?.total ?? '—'}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-1">
            Clientes <ArrowRight size={14} />
          </div>
        </Link>
        <Link to="/products" className="card p-5 hover:border-brand-400 transition-colors">
          <Package className="text-brand-600 mb-2" size={24} />
          <div className="text-3xl font-bold text-slate-900">
            {products.data?.total ?? '—'}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-1">
            Productos <ArrowRight size={14} />
          </div>
        </Link>
      </div>

      <div className="card p-5 mt-6 max-w-xl bg-brand-50 border-brand-200">
        <div className="font-semibold text-brand-900 mb-1">Próximamente</div>
        <ul className="text-sm text-brand-800 list-disc list-inside space-y-1">
          <li>Recepción de mercancía con lotes y vencimientos</li>
          <li>Inventario por ambiente y kardex</li>
          <li>Despacho con FEFO y cross-docking</li>
        </ul>
      </div>
    </div>
  );
}
