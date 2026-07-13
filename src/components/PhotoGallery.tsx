import { useState } from 'react';
import { PhotoView } from './PhotoView';

interface Props {
  photoIds: (string | undefined | null)[];
  className?: string;
  onRemove?: (idx: number) => void;
}

export function PhotoGallery({ photoIds, className = '', onRemove }: Props) {
  const valid = photoIds.filter(Boolean) as string[];
  if (!valid.length) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 ${className}`}>
        <span className="text-sm">Belum ada foto</span>
      </div>
    );
  }
  return (
    <div className={`grid gap-2 ${className}`}
      style={{ gridTemplateColumns: `repeat(${Math.min(valid.length, 3)}, minmax(0, 1fr))` }}>
      {valid.map((id, idx) => (
        <div key={idx} className="relative group">
          <PhotoView fileId={id} alt={`Foto ${idx + 1}`} />
          {onRemove && (
            <button type="button" onClick={() => onRemove(idx)}
              className="absolute top-1 right-1 rounded-full bg-slate-900/70 px-2 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100">
              Hapus
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function PhotoGalleryPreview({ photoIds }: { photoIds: (string | undefined | null)[] }) {
  const valid = photoIds.filter(Boolean) as string[];
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <div className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.min(valid.length, 3)}, minmax(0, 1fr))` }}>
        {valid.map((id, idx) => (
          <button key={idx} type="button" onClick={() => setOpen(idx)}
            className="overflow-hidden rounded-xl bg-slate-100">
            <PhotoView fileId={id} alt={`Foto ${idx + 1}`} />
          </button>
        ))}
      </div>
      {open !== null && valid[open] && (
        <div role="dialog" onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <PhotoView fileId={valid[open]} alt="Preview" className="max-h-full max-w-full !aspect-auto object-contain" />
        </div>
      )}
    </>
  );
}
