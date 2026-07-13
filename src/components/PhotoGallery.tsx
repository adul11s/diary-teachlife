/** Galeri foto kecil yang merender 1–3 foto dari string Base64 */
import { useState } from 'react';

interface Props {
  photos: (string | undefined | null)[];
  className?: string;
  onRemove?: (idx: number) => void;
}

export function PhotoGallery({ photos, className = '', onRemove }: Props) {
  const valid = photos.filter(Boolean) as string[];
  if (!valid.length) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 ${className}`}>
        <span className="text-sm">Belum ada foto</span>
      </div>
    );
  }

  return (
    <div
      className={`grid gap-2 ${className}`}
      style={{
        gridTemplateColumns: `repeat(${Math.min(valid.length, 3)}, minmax(0, 1fr))`,
      }}
    >
      {valid.map((src, idx) => (
        <div key={idx} className="relative group overflow-hidden rounded-xl bg-slate-100">
          <img
            src={src}
            alt={`Foto ${idx + 1}`}
            className="aspect-square w-full object-cover transition group-hover:scale-105"
          />
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="absolute top-1 right-1 rounded-full bg-slate-900/70 px-2 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100"
            >
              Hapus
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Komponen untuk preview galeri dengan lightbox klik-tilik-zoom (opsional) */
export function PhotoGalleryPreview({ photos }: { photos: (string | undefined | null)[] }) {
  const valid = photos.filter(Boolean) as string[];
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.min(valid.length, 3)}, minmax(0, 1fr))` }}
      >
        {valid.map((src, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setOpen(idx)}
            className="overflow-hidden rounded-xl bg-slate-100"
          >
            <img src={src} alt={`Foto ${idx + 1}`} className="aspect-square w-full object-cover" />
          </button>
        ))}
      </div>
      {open !== null && valid[open] && (
        <div
          role="dialog"
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <img
            src={valid[open]}
            alt="Preview"
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        </div>
      )}
    </>
  );
}