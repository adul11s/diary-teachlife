import { useState, useRef, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Diary } from '../types/diary';
import { MAX_PHOTOS_PER_DAY } from '../types/diary';
import { compressImageToBase64 } from '../utils/imageCompression';
import { createDiary, fetchDiaryById, updateDiary, setDiaryStatus } from '../utils/api';
import { Spinner } from '../components/Spinner';
import { PhotoGallery } from '../components/PhotoGallery';
import { PreviewModal } from '../components/PreviewModal';

const EMPTY: Diary = {
  id: '',
  date: new Date().toISOString().slice(0, 10),
  photo1: undefined,
  photo2: undefined,
  photo3: undefined,
  caption: '',
  status: 'Draft',
};

export default function UploadPage() {
  const nav = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<Diary>(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [compressingIdx, setCompressingIdx] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- Load existing diary ketika edit ----
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchDiaryById(id).then((res) => {
      if (res.success && res.data) setForm(res.data as Diary);
      else setError(res.message || 'Gagal memuat data.');
      setLoading(false);
    });
  }, [id]);

  // ---- Slot foto yang masih kosong ----
  function nextEmptySlot(): number {
    return [1, 2, 3].find((i) => !form[`photo${i}` as keyof Diary]) ?? -1;
  }

  function totalPhotos(): number {
    return [form.photo1, form.photo2, form.photo3].filter(Boolean).length;
  }

  // ---- Handle file input ----
  async function onPickFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setError('');

    const remaining = MAX_PHOTOS_PER_DAY - totalPhotos();
    if (remaining <= 0) {
      setError(`Maksimal ${MAX_PHOTOS_PER_DAY} foto per hari.`);
      e.target.value = '';
      return;
    }
    const toProcess = files.slice(0, remaining);
    for (const file of toProcess) {
      const slot = nextEmptySlot();
      if (slot === -1) break;
      setCompressingIdx(slot);
      try {
        const { base64, sizeBytes } = await compressImageToBase64(file);
        if (sizeBytes > 45_000) {
          setError(`Foto "${file.name}" terlalu besar setelah kompresi (${(sizeBytes / 1024).toFixed(0)} KB).`);
          continue;
        }
        setForm((prev) => ({ ...prev, [`photo${slot}`]: base64 } as Diary));
      } catch (err) {
        setError((err as Error).message);
      }
    }
    setCompressingIdx(null);
    e.target.value = '';
  }

  function removePhoto(idx: number) {
    // idx berbasis posisi tampilan (0-2), tapi nyimpan sebagai photo1..3
    // geser foto setelahnya
    const photos = [form.photo1, form.photo2, form.photo3];
    photos.splice(idx, 1);
    setForm({
      ...form,
      photo1: photos[0],
      photo2: photos[1],
      photo3: photos[2],
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.date) {
      setError('Tanggal wajib diisi.');
      return;
    }
    if (totalPhotos() === 0) {
      setError('Unggah minimal 1 foto.');
      return;
    }
    if (form.status === 'Published') {
      // Jika user toggle langsung ke Published dari form, tampilkan preview dulu
      setShowPreview(true);
      return;
    }
    save('Draft');
  }

  function saveInitial() {
    save(form.status === 'Published' ? 'Published' : 'Draft');
  }

  async function save(status: 'Draft' | 'Published') {
    setBusy(true);
    const res = isEdit
      ? await updateDiary({ id: form.id, date: form.date, photo1: form.photo1, photo2: form.photo2, photo3: form.photo3, caption: form.caption, status })
      : await createDiary({
          date: form.date,
          photo1: form.photo1,
          photo2: form.photo2,
          photo3: form.photo3,
          caption: form.caption,
          status: 'Draft',
        });
    setBusy(false);
    setShowPreview(false);
    if (res.success) {
      // Jika langsung ingin publish: panggil setStatus terpisah
      if (status === 'Published' && res.data) {
        await setDiaryStatus((res.data as Diary).id, 'Published');
      }
      nav('/admin');
    } else {
      setError(res.message || 'Gagal menyimpan.');
    }
  }

  async function confirmPublish() {
    // Simpan dulu, lalu set published
    await save('Published');
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="border-slate-300 border-t-brand-600" />
      </div>
    );
  }

  const total = totalPhotos();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">
          {isEdit ? 'Edit Diary' : 'Buat Diary Baru'}
        </h1>
        <button
          onClick={() => nav(-1)}
          className="text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          ← Kembali
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        {/* Tanggal */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Tanggal</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            required
          />
        </div>

        {/* Foto */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">Foto (maks. {MAX_PHOTOS_PER_DAY})</label>
            <span className="text-xs text-slate-400">{total}/{MAX_PHOTOS_PER_DAY} foto</span>
          </div>
          <PhotoGallery
            photos={[form.photo1, form.photo2, form.photo3]}
            onRemove={removePhoto}
            className="mb-3"
          />
          {total < MAX_PHOTOS_PER_DAY ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={compressingIdx !== null}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 transition hover:border-brand-500 hover:text-brand-600 disabled:opacity-60"
            >
              {compressingIdx !== null ? (
                <>
                  <Spinner /> Mengompresi foto...
                </>
              ) : (
                <span>+ Tambah Foto</span>
              )}
            </button>
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Batas maksimal {MAX_PHOTOS_PER_DAY} foto tercapai. Hapus salah satu untuk mengganti.
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onPickFiles}
            className="hidden"
          />
          <p className="mt-1 text-xs text-slate-400">
            Foto akan dikompresi otomatis (max 800px, kualitas 70%) lalu dikirim sebagai Base64.
          </p>
        </div>

        {/* Caption */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Caption</label>
          <textarea
            value={form.caption}
            onChange={(e) => setForm({ ...form, caption: e.target.value })}
            rows={5}
            placeholder="Tuliskan kegiatan pembelajaran hari ini..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}

        {/* Aksi */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {isEdit && form.status === 'Published' && (
            <button
              type="button"
              onClick={() => setDiaryStatus(form.id, 'Draft').then(() => nav('/admin'))}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Unpublish
            </button>
          )}
          <button
            type="button"
            onClick={() => saveInitial()}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Simpan sebagai Draft
          </button>
          <button
            type="submit"
            disabled={busy || compressingIdx !== null}
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Lanjut ke Preview & Publish
          </button>
        </div>
      </form>

      {showPreview && (
        <PreviewModal
          diary={form}
          onConfirm={confirmPublish}
          onClose={() => setShowPreview(false)}
          loading={busy}
        />
      )}
    </div>
  );
}