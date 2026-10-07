import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { ArrowLeft, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { ENVIRONMENT_LABELS, type PalletLabel } from '../lib/types';

/**
 * Cédula/rótulo de la estiba — pensada para imprimirse (Ctrl+P / botón).
 * El QR contiene el código de la cédula para escaneos futuros.
 */
export function PalletLabelPage() {
  const { palletId } = useParams<{ palletId: string }>();
  const [qr, setQr] = useState<string>('');

  const { data: pallet, isLoading } = useQuery({
    queryKey: ['pallet-label', palletId],
    queryFn: async () => (await api.get<PalletLabel>(`/receipts/pallets/${palletId}/label`)).data,
  });

  useEffect(() => {
    if (pallet?.code) {
      QRCode.toDataURL(pallet.code, { margin: 1, width: 240 }).then(setQr);
    }
  }, [pallet?.code]);

  if (isLoading || !pallet) return <div className="text-slate-500 text-sm p-6">Cargando…</div>;

  const totalNetKg = pallet.lines.reduce((s, l) => s + (l.netKg ? Number(l.netKg) : 0), 0);
  const totalUnits = pallet.lines.reduce((s, l) => s + (l.units ?? 0), 0);

  return (
    <div className="max-w-md mx-auto">
      {/* Controles — no salen en la impresión */}
      <div className="flex items-center justify-between my-4 print:hidden">
        <Link
          to={`/receipts/${pallet.receiptId}`}
          className="inline-flex items-center gap-1 text-sm text-brand-700"
        >
          <ArrowLeft size={16} /> Volver a la recepción
        </Link>
        <button className="btn-primary" onClick={() => window.print()}>
          <Printer size={16} className="mr-1" /> Imprimir
        </button>
      </div>

      {/* ---------- La cédula ---------- */}
      <div className="bg-white border-2 border-slate-900 rounded-lg p-5 print:border-black print:rounded-none">
        <div className="flex items-start justify-between gap-3 border-b-2 border-slate-900 pb-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">All-logistics · Tower</div>
            <div className="text-3xl font-mono font-bold">{pallet.code}</div>
            <div className="text-sm font-semibold mt-1">{pallet.receipt.customer.name}</div>
          </div>
          {qr && <img src={qr} alt={`QR ${pallet.code}`} className="w-24 h-24" />}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm py-3 border-b border-slate-300">
          <div>
            <span className="text-slate-500">Recepción:</span>{' '}
            <span className="font-mono">{pallet.receipt.code}</span>
          </div>
          <div>
            <span className="text-slate-500">Fecha:</span>{' '}
            {new Date(pallet.receipt.receivedAt).toLocaleDateString('es-CO')}
          </div>
          <div className="col-span-2">
            <span className="text-slate-500">Cuarto:</span>{' '}
            <strong>{ENVIRONMENT_LABELS[pallet.environment]}</strong>
          </div>
        </div>

        <table className="w-full text-sm mt-3">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-300">
              <th className="py-1">Referencia</th>
              <th className="py-1">Lote</th>
              <th className="py-1">Vence</th>
              <th className="py-1 text-right">Cant.</th>
            </tr>
          </thead>
          <tbody>
            {pallet.lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="py-1.5 pr-2">{l.product.name}</td>
                <td className="py-1.5 pr-2 font-mono text-xs">{l.lotCode}</td>
                <td className="py-1.5 pr-2 text-xs">
                  {l.expiryDate ? new Date(l.expiryDate).toLocaleDateString('es-CO', { timeZone: 'UTC' }) : '—'}
                </td>
                <td className="py-1.5 text-right font-medium">
                  {l.product.measure === 'KG' ? `${Number(l.netKg).toLocaleString('es-CO')} kg` : `${l.units} ${l.product.unit}`}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td colSpan={3} className="py-2 text-right pr-2">
                Total:
              </td>
              <td className="py-2 text-right">
                {totalNetKg > 0 && `${totalNetKg.toLocaleString('es-CO')} kg`}
                {totalNetKg > 0 && totalUnits > 0 && ' + '}
                {totalUnits > 0 && `${totalUnits} und`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
