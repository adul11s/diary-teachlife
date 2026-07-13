# Diary Pembelajaran

Aplikasi web untuk guru mencatat kegiatan belajar harian (foto + caption) yang dilihat orang tua murid (read-only). Backend memakai **Google Sheets** sebagai database via **Google Apps Script**.

## Tech Stack

- Frontend: **React + TypeScript (Vite)**
- Styling: **Tailwind CSS**
- Routing: **react-router-dom**
- Kompresi gambar: **browser-image-compression** (Canvas API + Base64)
- Backend/DB: **Google Sheets** (Google Apps Script Web App)

## Struktur Folder

```
diary-teachlife/
├─ gs/
│  └─ Code.gs                 # Google Apps Script (backend REST sederhana)
├─ src/
│  ├─ types/
│  │  └─ diary.ts             # Tipe Diary + konstanta (max 3 foto, batas Base64)
│  ├─ utils/
│  │  ├─ auth.ts              # Simpan / ambil / hapus token sesi (localStorage)
│  │  ├─ api.ts               # Client ke Google Apps Script Web App
│  │  └─ imageCompression.ts  # Kompresi foto -> Base64 (maks 800px, kualitas 0.7)
│  ├─ components/
│  │  ├─ StatusBadge.tsx      # Badge Draft/Published
│  │  ├─ Spinner.tsx          # Loading indicator
│  │  ├─ PhotoGallery.tsx     # Galeri 1-3 foto + lightbox preview
│  │  └─ PreviewModal.tsx     # Modal preview sebelum publish
│  ├─ pages/
│  │  ├─ LoginPage.tsx        # Login guru
│  │  ├─ DashboardPage.tsx    # List diary dikelompokkan per tanggal
│  │  ├─ UploadPage.tsx       # Create/Edit diary + validasi 3 foto + preview
│  │  └─ PublicPage.tsx       # Halaman publik untuk orang tua
│  ├─ App.tsx                 # Routing + ProtectedRoute
│  ├─ main.tsx
│  └─ index.css               # Tailwind + font
├─ .env.local                 # VITE_API_URL=... (URL Web App Apps Script)
├─ tailwind.config.js
└─ vite.config.ts
```

## Skema Google Sheets (sheet `Diary`)

Baris 1 = header (dibuat otomatis oleh script jika belum ada):

| A | B | C | D | E | F | G | H | I |
|------|------|--------|--------|--------|---------|-----------|------|------|
| ID | Date | Photo1 | Photo2 | Photo3 | Caption | Status | CreatedAt | UpdatedAt |

- **Photo1..Photo3**: string Base64 (data URI) — dipisah 3 kolom agar beban karakter tidak menumpuk di 1 sel (batas Google Sheets ~50.000/sel, di sini diasumsikan aman < ~48 KB per sel).
- **Status**: `Draft` atau `Published`. Hanya yang `Published` yang tampil di halaman publik.

Sheet kedua `Session` (dibuat otomatis) menyimpan token sesi admin:
`Token | CreatedAt | ExpiresAt` (token berlaku 24 jam).

## Setup Backend (Google Apps Script)

1. Buat Google Spreadsheet baru.
2. Buka **Extensions → Apps Script**, hapus isi default, tempel seluruh isi `gs/Code.gs`.
3. (Opsional) Ubah `ADMIN_USERNAME` dan `ADMIN_PASSWORD` di bagian konfigurasi.
4. Save, lalu **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Salin **Web App URL**.

## Setup Frontend

```bash
npm install
echo "VITE_API_URL=<URL_WEB_APP_APPS_SCRIPT>" > .env.local
npm run dev
```

Build production: `npm run build`. Type-check + lint: `npx tsc -b && npm run lint`.

## Alur Kompresi Gambar (PENTING)

1. Guru memilih file pada form Upload/Edit.
2. `compressImageToBase64()` (di `src/utils/imageCompression.ts`) memanggil `browser-image-compression`:
   - `maxWidthOrHeight: 800`, `initialQuality: 0.7`, `useWebWorker: true`.
3. Hasil `Blob` dikonversi ke **data URI Base64** via `FileReader`.
4. Jika string Base64 melebihi `MAX_BASE64_PER_PHOTO` (48.000), script mencoba kompresi lebih agresif (600px, kualitas 0.5); masih gagal → error ditampilkan.
5. Hanya foto yang lolos validasi yang dikirim ke backend sebagai `Photo1/2/3`.

## Validasi 3 Foto per Hari

- Frontend membatasi jumlah slot foto hingga 3 (`MAX_PHOTOS_PER_DAY`).
- Backend (`Code.gs`) juga memvalidasi `countPhotosByDate` + foto baru ≤ 3, jadi tidak bisa diakali dari sisi client.

## Alur Publish + Preview

1. Guru menyimpan sebagai **Draft** (langsung simpan), atau menekan tombol **"Lanjut ke Preview & Publish"**.
2. Modal `PreviewModal` menampilkan tampilan seperti halaman publik (tanggal, foto, caption).
3. Konfirmasi **"Publish Sekarang"** → backend `setStatus` menjadi `Published`.
4. Diary segera muncul di halaman publik.

## Catatan Keamanan

- Sistem login bersifat sederhana (1 user). Untuk produksi dengan banyak user, integrasikan Google Sign-In atau layanan auth eksternal.
- Token sesi disimpan di `localStorage`; lindungi endpoint admin lewat validasi token di Apps Script (sudah ada di `requireAuth`).