import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Diary } from '../types/diary';
import { fetchPublishedDiaries } from '../utils/api';
import { PhotoGalleryPreview } from '../components/PhotoGallery';
import { Spinner } from '../components/Spinner';

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return d;
  }
}

export default function PublicPage() {
  const [data, setData] = useState<Diary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetchPublishedDiaries();
      if (res.success && res.data) setData(res.data);
      else setError(res.message || 'Gagal memuat data.');
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-slate-800">
            Diary <span className="text-brand-600">Pembelajaran</span>
          </h1>
          <Link
            to="/login"
            className="text-sm font-medium text-slate-500 hover:text-brand-600"
          >
            Guru
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {loading && (
          <div className="flex justify-center py-10 text-slate-400">
            <Spinner className="border-slate-300 border-t-brand-600" />
          </div>
        )}
        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}

        {!loading && !data.length && (
          <div className="rounded-2xl bg-white p-10 text-center text-slate-400 shadow-sm">
            Belum ada diary yang dipublikasikan.
          </div>
        )}

        {!loading && data.length > 0 && (
          <div className="space-y-5">
            {data.map((d) => (
              <article
                key={d.id}
                className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"
              >
                <div className="border-b border-slate-100 px-4 py-3">
                  <time className="text-sm font-semibold text-slate-700">
                    {formatDate(d.date)}
                  </time>
                </div>

                <div className="px-4 py-4">
                  <PhotoGalleryPreview photos={[d.photo1, d.photo2, d.photo3]} />
                  {d.caption && (
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {d.caption}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-2xl px-4 py-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Diary Pembelajaran
      </footer>
    </div>
  );
}