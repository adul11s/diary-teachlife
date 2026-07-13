/**
 * components/PreviewModal.tsx
 * ------------------------------------------------------------
 * Preview tampilan diary seperti yang dilihat orang tua sebelum
 * guru menekan tombol "Publish Sekarang".
 */
import type { Diary } from '../types/diary';
import { PhotoGalleryPreview } from './PhotoGallery';

interface Props {
  diary: Partial<Diary>;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

function formatDate(d?: string) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return d;
  }
}

export function PreviewModal({ diary, onConfirm, onClose, loading }: Props) {
  const photoIds = [diary.photo1Id, diary.photo2Id, diary.photo3Id].filter(Boolean) as string[];
  if (!photoIds.length && !diary.caption) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-6 text-center">
          <p className="text-slate-600">Tidak ada konten untuk dipratinjau.</p>
          <button
            onClick={onClose}
            className="mt-4 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-slate-50 sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-700">Preview untuk Orang Tua</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <article className="mx-auto max-w-md bg-white shadow-sm ring-1 ring-slate-100">
            <div className="border-b border-slate-100 px-4 py-3">
              <time className="text-sm font-semibold text-slate-700">
                {formatDate(diary.date)}
              </time>
            </div>
            <div className="px-4 py-4">
              {photoIds.length > 0 && <PhotoGalleryPreview photoIds={photoIds} />}
              {diary.caption && (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {diary.caption}
                </p>
              )}
            </div>
          </article>
        </div>

        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <p className="mb-3 text-center text-xs text-slate-500">
            Inilah tampilan yang akan dilihat oleh orang tua murid. Pastikan semua sudah benar.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Kembali Edit
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? 'Memproses...' : 'Publish Sekarang'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}