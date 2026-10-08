import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Download, FileUp, MapPin, Package } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/auth-store';
import { PageHeader } from '../components/PageHeader';

type ImportType = 'customers' | 'products' | 'sites';

interface ImportReport {
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; field?: string; message: string }[];
}

const SECTIONS: { type: ImportType; title: string; description: string; icon: typeof Package; queryKey: string }[] = [
  {
    type: 'customers',
    title: 'Clientes',
    description: 'Razón social, NIT, dirección, contacto y tipo de servicio',
    icon: Building2,
    queryKey: 'customers',
  },
  {
    type: 'products',
    title: 'Items',
    description: 'Referencias por cliente: manejo (kg/und), bodega, código de barras, vida útil',
    icon: Package,
    queryKey: 'products',
  },
  {
    type: 'sites',
    title: 'Sedes',
    description: 'Sedes de cada cliente, destinos de las salidas de mercancía',
    icon: MapPin,
    queryKey: 'sites',
  },
];

function ImportSection({ type, title, description, icon: Icon, queryKey, canImport }: (typeof SECTIONS)[number] & { canImport: boolean }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadTemplate = async () => {
    const res = await api.get(`/import/templates/${type}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla-${title.toLowerCase()}-tower.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const run = async (dryRun: boolean) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<ImportReport>(`/import/${type}?dryRun=${dryRun}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setReport(res.data);
      if (!dryRun) {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'No se pudo procesar el archivo');
      setReport(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <Icon className="text-brand-600 shrink-0 mt-0.5" size={22} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{title}</div>
          <p className="text-sm text-slate-500">{description}</p>

          <div className="flex flex-wrap gap-2 mt-3">
            <button className="btn-secondary text-sm" onClick={downloadTemplate}>
              <Download size={15} className="mr-1" /> Descargar plantilla
            </button>
            {canImport && (
              <button className="btn-secondary text-sm" onClick={() => inputRef.current?.click()}>
                <FileUp size={15} className="mr-1" />
                {file ? file.name : 'Elegir archivo…'}
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setReport(null);
              setError(null);
            }}
          />

          {file && canImport && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button className="btn-secondary text-sm" disabled={busy} onClick={() => run(true)}>
                {busy ? 'Procesando…' : '1. Simulacro (no guarda nada)'}
              </button>
              <button
                className="btn-primary text-sm"
                disabled={busy || !report || report.dryRun === false}
                title={!report ? 'Corre primero el simulacro' : ''}
                onClick={() => run(false)}
              >
                2. Importar de verdad
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3 mt-3">{error}</div>
          )}

          {report && (
            <div
              className={`rounded-md border text-sm p-3 mt-3 ${
                report.errors.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-brand-50 border-brand-200'
              }`}
            >
              <div className="font-semibold mb-1">
                {report.dryRun ? 'Simulacro' : '✓ Importación realizada'} — {report.total} fila(s)
              </div>
              <div>
                {report.dryRun ? 'Crearía' : 'Creados'}: <strong>{report.created}</strong> ·{' '}
                {report.dryRun ? 'Actualizaría' : 'Actualizados'}: <strong>{report.updated}</strong>
                {report.skipped > 0 && <> · Omitidas (ejemplo): {report.skipped}</>} · Errores:{' '}
                <strong className={report.errors.length > 0 ? 'text-red-700' : ''}>{report.errors.length}</strong>
              </div>
              {report.errors.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-red-800 max-h-40 overflow-y-auto">
                  {report.errors.map((e, i) => (
                    <li key={i}>
                      Fila {e.row}
                      {e.field ? ` · ${e.field}` : ''}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
              {report.dryRun && report.errors.length === 0 && (
                <div className="mt-1 text-brand-800">Todo en orden — puedes darle a "Importar de verdad".</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ImportPage() {
  const user = useAuthStore((s) => s.user);
  const canImport = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  return (
    <div>
      <PageHeader
        title="Importación masiva"
        subtitle="Descarga la plantilla, llénala y súbela — primero en simulacro, luego de verdad"
      />
      {!canImport && (
        <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 mb-4">
          Puedes descargar las plantillas, pero solo administradores y supervisores pueden importar.
        </div>
      )}
      <div className="space-y-4 max-w-2xl">
        {SECTIONS.map((s) => (
          <ImportSection key={s.type} {...s} canImport={canImport} />
        ))}
      </div>
    </div>
  );
}
