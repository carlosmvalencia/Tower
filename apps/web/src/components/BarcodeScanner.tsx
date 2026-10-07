import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onDetect: (code: string) => void;
}

/**
 * Escáner de códigos de barras con la cámara (EAN/UPC/Code128/QR).
 * Pensado para el celular del operario: cámara trasera por defecto.
 */
export function BarcodeScanner({ open, onClose, onDetect }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current!,
        (result, _err, controls) => {
          controlsRef.current = controls;
          if (result && !cancelled) {
            cancelled = true;
            controls.stop();
            onDetect(result.getText());
          }
        },
      )
      .catch(() => {
        setError('No se pudo abrir la cámara. Revisa los permisos del navegador.');
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetect]);

  return (
    <Modal open={open} title="Escanear código" onClose={onClose} size="sm">
      {error ? (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3">
          {error}
        </div>
      ) : (
        <div className="space-y-2">
          <video ref={videoRef} className="w-full rounded-md bg-black aspect-[4/3]" />
          <p className="text-xs text-slate-500 text-center">
            Apunta la cámara al código de barras del producto
          </p>
        </div>
      )}
    </Modal>
  );
}
