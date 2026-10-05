import { useState } from 'react';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}

/**
 * Paginación con botones Primera / Anterior / Siguiente / Última + input
 * para saltar directo a una página N.
 *
 * El input se sincroniza con el valor actual, pero permite escribir mientras
 * tanto sin que la query se dispare — solo salta cuando el usuario presiona
 * Enter o pierde foco. Así evita bombardear el backend al escribir "15" con
 * páginas intermedias "1" y luego "15".
 */
export function Pagination({ page, totalPages, total, onChange }: Props) {
  const [jumpValue, setJumpValue] = useState<string>('');

  if (totalPages <= 1) {
    return (
      <div className="text-sm text-slate-500 mt-3">
        {total} {total === 1 ? 'registro' : 'registros'}
      </div>
    );
  }

  const commitJump = () => {
    const n = parseInt(jumpValue, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= totalPages && n !== page) {
      onChange(n);
    }
    setJumpValue('');
  };

  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  return (
    <div className="flex items-center justify-between mt-3 text-sm flex-wrap gap-3">
      <div className="text-slate-500">
        {total} registros · página <strong className="text-slate-700">{page}</strong> de {totalPages}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="btn-secondary"
          disabled={isFirst}
          onClick={() => onChange(1)}
          title="Primera página"
          aria-label="Primera página"
        >
          «
        </button>
        <button
          className="btn-secondary"
          disabled={isFirst}
          onClick={() => onChange(page - 1)}
        >
          Anterior
        </button>

        {/* Saltar a página N — se activa escribiendo + Enter o perdiendo foco */}
        <div className="flex items-center gap-1 px-2 border-l border-r border-slate-200">
          <span className="text-slate-500 text-xs">Ir a</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jumpValue}
            placeholder={String(page)}
            onChange={(e) => setJumpValue(e.target.value)}
            onBlur={commitJump}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitJump(); }
            }}
            className="input w-16 text-center"
            aria-label="Saltar a página"
          />
        </div>

        <button
          className="btn-secondary"
          disabled={isLast}
          onClick={() => onChange(page + 1)}
        >
          Siguiente
        </button>
        <button
          className="btn-secondary"
          disabled={isLast}
          onClick={() => onChange(totalPages)}
          title={`Última página (${totalPages})`}
          aria-label="Última página"
        >
          »
        </button>
      </div>
    </div>
  );
}
