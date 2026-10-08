import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import {
  ENVIRONMENT_LABELS,
  type CustomerOption,
  type Environment,
  type StockRow,
} from '../lib/types';
import { PageHeader } from '../components/PageHeader';
import { EnvironmentBadge } from '../components/EnvironmentBadge';

const ENVIRONMENTS: Environment[] = ['FROZEN', 'REFRIGERATED', 'DRY'];

function daysToExpiry(expiryDate?: string | null): number | null {
  if (!expiryDate) return null;
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86_400_000);
}

/** Semáforo de vencimiento: rojo vencido/≤7 días, ámbar ≤30, verde el resto. */
function ExpiryBadge({ expiryDate }: { expiryDate?: string | null }) {
  const days = daysToExpiry(expiryDate);
  if (days == null) return <span className="badge-gray">Sin vencimiento</span>;
  const label = new Date(expiryDate!).toLocaleDateString('es-CO', { timeZone: 'UTC' });
  if (days < 0) return <span className="badge-red">Vencido {label}</span>;
  if (days <= 7) return <span className="badge-red">Vence {label} ({days} d)</span>;
  if (days <= 30) return <span className="badge-amber">Vence {label} ({days} d)</span>;
  return <span className="badge-green">Vence {label}</span>;
}

export function InventoryPage() {
  const [customerId, setCustomerId] = useState('');
  const [environment, setEnvironment] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const customers = useQuery({
    queryKey: ['customers', 'options'],
    queryFn: async () => (await api.get<CustomerOption[]>('/customers/options')).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['stock', { customerId, environment, q }],
    queryFn: async () =>
      (
        await api.get<StockRow[]>('/stock', {
          params: {
            customerId: customerId || undefined,
            environment: environment || undefined,
            q: q || undefined,
          },
        })
      ).data,
  });

  return (
    <div>
      <PageHeader title="Inventario" subtitle="Existencias por producto y lote — calculadas del kardex" />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          className="input sm:max-w-xs"
          placeholder="Buscar producto…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input sm:max-w-[220px]" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Todos los clientes</option>
          {customers.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input sm:max-w-[180px]" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
          <option value="">Todas las bodegas</option>
          {ENVIRONMENTS.map((env) => (
            <option key={env} value={env}>
              {ENVIRONMENT_LABELS[env]}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <div className="text-slate-500 text-sm">Calculando existencias…</div>}

      <div className="space-y-2">
        {data?.map(({ product, total, lots }) => {
          const isOpen = open[product.id] ?? false;
          const unit = product.measure === 'KG' ? 'kg' : product.unit;
          return (
            <div key={product.id} className="card">
              <button
                className="w-full flex items-center justify-between gap-3 p-4 text-left"
                onClick={() => setOpen((s) => ({ ...s, [product.id]: !isOpen }))}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isOpen ? <ChevronDown size={16} className="shrink-0" /> : <ChevronRight size={16} className="shrink-0" />}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{product.name}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {product.customer?.name} · <span className="font-mono">{product.code}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <EnvironmentBadge environment={product.environment} />
                  <div className={`text-lg font-bold ${total > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                    {total.toLocaleString('es-CO')} <span className="text-xs font-normal text-slate-500">{unit}</span>
                  </div>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-2">
                  {lots.length === 0 && <div className="text-sm text-slate-400">Sin existencias</div>}
                  {lots.map((lot) => (
                    <div key={lot.lotId} className="flex items-center justify-between gap-2 text-sm">
                      <div className="font-mono text-xs">{lot.lotCode}</div>
                      <ExpiryBadge expiryDate={lot.expiryDate} />
                      <div className="font-semibold">
                        {lot.available.toLocaleString('es-CO')} {unit}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {data && data.length === 0 && (
          <div className="text-center text-slate-400 py-10">Sin productos con movimientos</div>
        )}
      </div>
    </div>
  );
}
