# Panduan Deploy — Diary Pembelajaran

Backend berjalan sebagai **Google Apps Script Web App** (tanpa server sendiri). Kredensial admin **tidak ada di kode** — disimpan di Script Properties.

## 1. Persiapan Google Sheets & Drive

1. Buat Google Spreadsheet baru (ini jadi "database" Diary).
2. Buat folder di Google Drive untuk foto (mis. "Diary Photos"), salin ID folder dari URL: `https://drive.google.com/drive/folders/<FOLDER_ID>`.

## 2. Set Script Properties (WAJIB)

Buka **Extensions → Apps Script → Project Settings (⚙) → Script Properties → Add**:

| Property          | Nilai                          |
| ----------------- | ------------------------------ |
| `ADMIN_USERNAME`  | username login guru            |
| `ADMIN_PASSWORD`  | password guru (bisa di-generate random) |
| `DRIVE_FOLDER_ID` | ID folder Drive untuk foto     |

Jika `ADMIN_USERNAME`/`ADMIN_PASSWORD` kosong, backend **gagal cepat**: semua request `login` merespons
`{ success: false, code: 500, message: "Server belum dikonfigurasi: ..." }` — tidak pernah ada fallback kredensial di kode.

## 3. Pasang kode Apps Script

1. Buka **Extensions → Apps Script**, tempel isi `gs/Code.gs`.
2. Jalankan fungsi `setup()` sekali dari editor (untuk membuat sheet `Diary` dan `Session`).
3. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**

Save ≥ 1 kali setelah mengubah Script Properties atau kode agar deployment baru memakai nilai terbaru. Setiap perubahan → **Deploy → Manage deployments → edit → New version**.

## 4. Sambungkan frontend

Salin Web App URL (`https://script.google.com/macros/s/.../exec`):

```bash
npm install
cp .env.example .env.local   # lalu isi VITE_API_URL
npm run dev
```

Build produksi: `npm run build`.

## 5. Rotasi / ganti kredensial

- Ganti nilai `ADMIN_PASSWORD` di Script Properties lalu save & deploy versi baru.
- Token lama tetap berlaku sampai 24 jam; klik **Logout** di admin untuk menghapus token, atau hapus isi sheet `Session` untuk memaksa semua sesi berakhir.
