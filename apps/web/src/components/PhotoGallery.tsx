import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import type { Photo } from '../lib/types';

interface Props {
  photos: Photo[];
  onUpload: (file: File) => Promise<void>;
  onDelete?: (photo: Photo) => Promise<void>;
  readonly?: boolean;
}

/**
 * Tira de fotos con subida desde cámara/galería del celular.
 * `capture=environment` abre directo la cámara trasera en móvil.
 */
export function PhotoGallery({ photos, onUpload, onDelete, readonly }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Photo | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await onUpload(file);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        {photos.map((p) => (
          <div key={p.id} className="relative group">
            <button type="button" onClick={() => setPreview(p)}>
              <img
                src={p.url}
                alt="Soporte"
                className="w-20 h-20 object-cover rounded-md border border-slate-200"
              />
            </button>
            {!readonly && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(p)}
                aria-label="Eliminar foto"
                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
        {!readonly && (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="w-20 h-20 rounded-md border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-brand-400 hover:text-brand-600 disabled:opacity-50"
          >
            <Camera size={22} />
            <span className="text-[10px] mt-1">{busy ? 'Subiendo…' : 'Foto'}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {/* Vista ampliada */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <img src={preview.url} alt="Soporte" className="max-h-[85vh] max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
