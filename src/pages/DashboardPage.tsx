import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Diary } from '../types/diary';
import {
  fetchAdminDiaries,
  setDiaryStatus,
  deleteDiary,
  logout,
} from '../utils/api';
import { clearToken } from '../utils/auth';
import { StatusBadge } from '../components/StatusBadge';
import { Spinner } from '../components/Spinner';
import { PhotoGallery } from '../components/PhotoGallery';

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return d;
  }
}

export default function DashboardPage() {
  const nav = useNavigate();
  const [data, setData] = useState<Diary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetchAdminDiaries();
    if (res.success && res.data) setData(res.data);
    else setError(res.message || 'Gagal memuat.');
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  // Kelompokkan per tanggal
  const grouped = useMemo(() => {
    const map = new Map<string, Diary[]>();
    for (const d of data) {
      const list = map.get(d.date) ?? [];
      list.push(d);
      map.set(d.date, list);
    }
    return Array.from(map.entries()).sort(
      (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime(),
    );
  }, [data]);

  async function togglePublish(d: Diary) {
    const next = d.status === 'Published' ? 'Draft' : 'Published';
    setBusyId(d.id);
    const res = await setDiaryStatus(d.id, next);
    setBusyId(null);
    if (res.success) {
      setData((prev) =>
        prev.map((x) => (x.id === d.id ? { ...x, status: next } : x)),
      );
    } else {
      setError(res.message || 'Gagal mengubah status.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus diary ini? Tindakan ini tidak dapat dibatalkan.')) return;
    setBusyId(id);
    const res = await deleteDiary(id);
    setBusyId(null);
    if (res.success) setData((prev) => prev.filter((x) => x.id !== id));
    else setError(res.message || 'Gagal menghapus.');
  }

  async function handleLogout() {
    await logout();
    clearToken();
    nav('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-slate-800">Dashboard Guru</h1>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/" className="text-slate-500 hover:text-brand-600">Lihat Publik</Link>
            <button onClick={handleLogout} className="font-medium text-slate-500 hover:text-rose-600">
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-700">Diary Pembelajaran</h2>
          <Link
            to="/admin/new"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + Buat Diary
          </Link>
        </div>

        {loading && (
          <div className="flex justify-center py-10">
            <Spinner className="border-slate-300 border-t-brand-600" />
          </div>
        )}
        {error && (
          <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}

        {!loading && grouped.length === 0 && (
          <div className="rounded-2xl bg-white p-10 text-center text-slate-400 shadow-sm">
            Belum ada diary. Klik "Buat Diary" untuk mulai.
          </div>
        )}

        {!loading && grouped.map(([date, items]) => (
          <section key={date} className="mb-6">
            <h3 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {formatDate(date)} {''}
              <span className="text-xs font-normal text-slate-400">
                ({items.reduce((n, d) => n + [d.photo1Id, d.photo2Id, d.photo3Id].filter(Boolean).length, 0)} foto)
              </span>
            </h3>
            <div className="space-y-3">
              {items.map((d) => (
                <div
                  key={d.id}
                  className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <StatusBadge status={d.status} />
                    <div className="flex items-center gap-2 text-xs">
                      <Link
                        to={`/admin/edit/${d.id}`}
                        className="font-medium text-slate-600 hover:text-brand-600"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => togglePublish(d)}
                        disabled={busyId === d.id}
                        className="font-medium text-brand-700 hover:text-brand-600 disabled:opacity-50"
                      >
                        {d.status === 'Published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => handleDelete(d.id)}
                        disabled={busyId === d.id}
                        className="font-medium text-rose-500 hover:text-rose-600 disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                  <PhotoGallery photoIds={[d.photo1Id, d.photo2Id, d.photo3Id]} />
                  {d.caption && (
                    <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {d.caption}
                    </p>
                  )}
                  {busyId === d.id && (
                    <div className="mt-3 flex justify-center">
                      <Spinner className="border-slate-300 border-t-brand-600" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}