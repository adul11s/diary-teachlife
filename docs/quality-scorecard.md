# Quality Scorecard

Rubrik sesuai plan-portfolio-9-5 section 1/6. Skor jujur per 2026-10-25; tiap klaim tautan ke buktinya.

| Dimensi | Bobot | Skor | Bukti |
|---|---|---|---|
| Narasi masalah | 10% | 8 | README#diary-pembelajaran (kebutuhan guru → orang tua nyata, tapi belum ada case study) |
| Demo & reproduksibilitas | 15% | 6 | README + docs/deploy.md — deploy terikat manual ke Apps Script, tidak ada satu-perintah demo seed; screenshot halaman publik tersedia |
| Kebenaran & test | 20% | 6 | `tests/gs-logic.test.mjs` (7 test: token kedaluwarsa, limit ukuran gambar, fail-fast kredensial) — tanpa CI, lingkup logic murni saja |
| Arsitektur & keputusan | 15% | 7 | Backendless GAS + Sheets + Drive proxy (README); belum ada `docs/adr/` |
| Keamanan | 10% | 7 | Kredensial dari Script Properties, fail-fast (gs/Code.gs#getAdminCredentials), token expiry 24h; belum ada threat model |
| Operasional | 10% | 4 | Log tidak terstruktur (Logger), tidak ada metrics/alert/runbook; deploy halaman manusiawi (docs/deploy.md) |
| Kerapian kode | 10% | 8 | TS, `npm run lint` (oxlint), `npm test` (vitest); tanpa CI hijau |
| Presentasi | 10% | 6 | README tuntas namun tanpa video/GIF/case study |

**Total:** 6.5
**Target berikutnya:** CI (GitHub Actions: lint + vitest), threat model singkat, GIF/video demo.
**Tanggal review:** 2026-10-25
