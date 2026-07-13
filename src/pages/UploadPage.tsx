import { useState, useRef, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Diary } from '../types/diary';
import { MAX_PHOTOS_PER_DAY } from '../types/diary';
import { uploadPhotoToDrive } from '../utils/upload';
import { createDiary, fetchDiaryById, updateDiary } from '../utils/api';
import { Spinner } from '../components/Spinner';
import { PhotoGallery } from '../components/PhotoGallery';
import { PreviewModal } from '../components/PreviewModal';

const EMPTY: Diary = {
  id: '',
  date: new Date().toISOString().slice(0, 10),
  photo1Url: undefined,
  photo2Url: undefined,
  photo3Url: undefined,
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
  const [showPreview, setShowPreview] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load diary saat edit
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchDiaryById(id).then((res) => {
      if (res.success && res.data) setForm(res.data as Diary);
      else setError(res.message || 'Gagal memuat data.');
      setLoading(false);
    });
  }, [id]);

  // ---- Foto helpers ----
  const photos = (): (string | undefined)[] => [
    form.photo1Url, form.photo2Url, form.photo3Url,
  ];

  function totalPhotos(): number {
    return photos().filter(Boolean).length;
  }

  function nextEmptySlot(): number {
    return [1, 2, 3].find((i) => !form[`photo${i}Url` as keyof Diary]) ?? -1;
  }

  // ---- Pick & Upload file ----
  async function onPickFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setError('');
    e.target.value = '';

    const remaining = MAX_PHOTOS_PER_DAY - totalPhotos();
    if (remaining <= 0) {
      setError(`Maksimal ${MAX_PHOTOS_PER_DAY} foto per hari.`);
      return;
    }

    const toProcess = files.slice(0, remaining);

    for (const file of toProcess) {
      const slot = nextEmptySlot();
      if (slot === -1) break;

      setUploadingSlot(slot);
      try {
        const result = await uploadPhotoToDrive(file);
        setForm((prev) => ({
          ...prev,
          [`photo${slot}Url`]: result.url,
        } as Diary));
      } catch (err) {
        setError((err as Error).message);
      }
    }

    setUploadingSlot(null);
  }

  function removePhoto(idx: number) {
    const urls = [form.photo1Url, form.photo2Url, form.photo3Url];
    urls.splice(idx, 1);
    setForm({
      ...form,
      photo1Url: urls[0],
      photo2Url: urls[1],
      photo3Url: urls[2],
    });
  }

  // ---- Submit ----
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
    setShowPreview(true);
  }

  async function save(status: 'Draft' | 'Published') {
    setBusy(true);
    const res = isEdit
      ? await updateDiary({
          id: form.id,
          date: form.date,
          photo1Url: form.photo1Url,
          photo2Url: form.photo2Url,
          photo3Url: form.photo3Url,
          caption: form.caption,
          status,
        })
      : await createDiary({
          date: form.date,
          photo1Url: form.photo1Url,
          photo2Url: form.photo2Url,
          photo3Url: form.photo3Url,
          caption: form.caption,
          status,
        });
    setBusy(false);
    setShowPreview(false);
    if (res.success) {
      nav('/admin');
    } else {
      setError(res.message || 'Gagal menyimpan.');
    }
  }

  async function saveDraft() {
    await save('Draft');
  }

  async function confirmPublish() {
    await save('Published');
  }

  // ---- Render ----
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

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">
              Foto (maks. {MAX_PHOTOS_PER_DAY})
            </label>
            <span className="text-xs text-slate-400">{total}/{MAX_PHOTOS_PER_DAY} foto</span>
          </div>

          <PhotoGallery
            photos={photos()}
            onRemove={removePhoto}
            className="mb-3"
          />

          {total < MAX_PHOTOS_PER_DAY ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingSlot !== null}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 transition hover:border-brand-500 hover:text-brand-600 disabled:opacity-60"
            >
              {uploadingSlot !== null ? (
                <>
                  <Spinner /> Mengunggah foto ke Drive...
                </>
              ) : (
                <span>+ Tambah Foto</span>
              )}
            </button>
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Batas maksimal {MAX_PHOTOS_PER_DAY} foto tercapai.
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
            Foto dikompresi lalu dikirim ke Google Drive &mdash; hanya URL-nya yang disimpan.
          </p>
        </div>

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

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={saveDraft}
            disabled={busy || uploadingSlot !== null}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Simpan sebagai Draft
          </button>
          <button
            type="submit"
            disabled={busy || uploadingSlot !== null}
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Preview & Publish
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
