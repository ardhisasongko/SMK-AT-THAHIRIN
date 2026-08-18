# Aturan Project — Sistem Informasi Sekolah (Template)

Aturan wajib untuk semua sesi kerja (manusia maupun AI) di repo ini. **AGENTS.md di root menunjuk ke dokumen ini.**

## 1. Stack & Struktur

- **Frontend**: React 19 + Vite 6 + Tailwind 4 (`src/`), SPA tab-based (tanpa router).
- **Backend**: Cloudflare Pages Functions (`functions/api/**`), REST JSON, helper di `functions/_lib/**`.
- **Database**: D1 SQLite, binding `DB`, migrasi di `migrations/`. **Jangan edit file migrasi yang sudah diterapkan** — buat migrasi baru.
- **Eksternal**: `sync-worker/` (cron Google Sheets/Drive), `whatsapp-gateway/` (Node + wa-web.js), `google-apps-script/sync.gs` (Apps Script).
- **Bahasa komunikasi**: Indonesia untuk UI, pesan error, dan dokumentasi; nama variabel/fungsi produktif berbahasa Inggris (kecuali istilah domain sekolah seperti `presensi`, `kelas`).

## 2. Perintah Standar

```bash
npm run dev              # build + wrangler pages dev (D1 lokal)
npm run dev:watch        # auto rebuild saat src/functions/migrations berubah
npm run lint             # tsc --noEmit (cek tipe cepat)
npm run typecheck        # tsc --noEmit --skipLibCheck
npm test                 # vitest run (235+ test, butuh --testTimeout=10000 kadang)
npm run test:watch       # vitest watch
npm run verify           # lint + test + test:sync-worker + typecheck:sync-worker + build (WAJIB sebelum deploy)
npm run db:migrate:local # terapkan migrasi D1 lokal
npm run db:migrate:remote# terapkan migrasi D1 produksi
npm run pages:deploy     # build + deploy ke Cloudflare Pages
```

**Aturan verifikasi**: sebelum menyatakan selesai, jalankan `npm run verify` (atau minimal lint + test). Jika ada perubahan di `sync-worker/`, jalankan juga `npm --prefix sync-worker test` dan `npm --prefix sync-worker run typecheck` (sudah termasuk dalam verify).

## 3. Migrasi D1

1. Buat file baru `migrations/00XX_nama_keterangan.sql` (nomor lanjut dari terakhir, jangan pernah mengubah yang sudah ada).
2. Uji lokal: `npm run db:migrate:local`, lalu jalankan test.
3. **Backup dulu** sebelum remote: `wrangler d1 export smk-at-tahirin-db --remote --output=/tmp/opencode/backup-<nama>-<tanggal>.sql`.
4. Terapkan: `npm run db:migrate:remote`, verifikasi di produksi (smoke test).
5. Migrasi bisa berisi perbaikan data (bukan hanya skema) — contoh migrasi 0007.
6. Perubahan skema yang menghapus CHECK/constraint lama harus diuji dengan data produksi riil (kasus: essai CBT error 1101, migrasi 0021).

## 4. Pola Backend

- Respons API: `{ success: true, data }` / `{ success: false, error: "<pesan ID>" }`; kode status standar (400/401/403/404/409/410/413/415/423/429/5xx).
- Semua endpoint lewat middleware global (`functions/_middleware.ts`): CSRF origin check, body limit, auth, rate limit mutasi, blokir must-change-password.
- **Auth**: jangan bikin mekanisme login baru; pakai helper `functions/_lib/auth.ts` (`getUserFromRequest`, RBAC `canEditClass`, dll).
- **RBAC dicek di server** — frontend hanya untuk UX; jangan percaya klaim role dari client.
- Data generik koleksi JSON: lewat `GET/PUT /api/data/:key` dengan optimistic concurrency (`If-Match`). Domain baru (CBT/forum/notif/WA): tabel relasional + endpoint khusus.
- Rate limit: pakai `functions/_lib/rate-limit.ts` untuk endpoint rawan (login, upload, forum, token, AI).
- Error dari AI/eksternal: jangan pernah bocorkan secret/stack trace ke client; gunakan kode 502/503/504.

## 5. Pola Frontend

- Koleksi data via `usePersistedCollection(key, fallback)` — jangan panggil `fetch('/api/data/...')` manual di komponen.
- Sesi: `utils/auth.ts` (`loadAuthSession`, `authHeaders`, `saveAuthSession`, `clearAuthSession`).
- Navigasi baru: tambahkan item di `src/navItems.ts` + section di `App.tsx` — jangan tambah router baru.
- UI mobile-first; jangan tambah `overflow-x: hidden` global untuk menutupi bug (sudah dihapus di `src/index.css`).
- Konfirmasi server dulu sebelum UI menampilkan sukses (`actions.save`), bukan setter optimistik buta.
- Testing komponen: Vitest + Testing Library (lihat `tests/*.test.tsx`); setiap fitur baru wajib test.

## 6. Identitas Sekolah (template multi-sekolah)

- **Identitas tersentral** di `src/data/schoolConfig.ts` (nama, kontak, alamat, NPSN, brand, fitur)
  + `wrangler.toml` `[vars]` (`APP_NAME`, `SCHOOL_NAME`, `SCHOOL_EMAIL_DOMAIN`) untuk backend,
  + aset `public/school/` + `src/theme.css` untuk warna/logo.
- **LARANGAN hardcode nama/domain/email sekolah** di komponen, fungsi, script, atau test —
  baca dari config (frontend) / env (backend).
- File situs (`index.html`, `site.webmanifest`, `robots.txt`, `sitemap.xml`) di-generate:
  `npm run generate:site` — jangan edit manual.
- Fitur umum dikerjakan di template; fitur khusus sekolah di repo sekolah itu.
  Identitas sekolah yang tersentral membuat merge antar repo tidak bentrok.

## 7. Keamanan (tidak bisa ditawar)

- Jangan pernah commit: `.env*`, `imported/` (akun.sql, kredensial, siswa.json), `data/*.xlsx`, secret API key.
- Jangan expose secret di respons/console/commit message. Rotasi key yang pernah bocor ke git history.
- Mutasi ber-cookie wajib Origin check; upload wajib batas ukuran + tipe MIME + rate limit.
- WhatsApp gateway hanya via header `X-Gateway-Key` (secret `WHATSAPP_GATEWAY_KEY`).
- Gate integrasi: `external_integrations` (enabled, emergency_pause, rollout off/canary/all) — jangan hardcode bypass.

## 8. Dokumentasi & Konvensi

- **`docs/` adalah sumber kebenaran**: `prd.md`, `architecture.md`, `design.md`, `schema.md`, `rules.md`, `HANDOFF.md`.
- **Setiap akhir sesi**: perbarui `docs/HANDOFF.md` (status, perubahan, test count, migrasi, verifikasi, tindak lanjut). Jangan tumpuk info lama di root.
- Dokumen operasional lain di root tetap relevan: `EXTERNAL_INTEGRATIONS.md`, `SECURITY_HARDENING.md`, `WHATSAPP_GATEWAY.md`, `DEPLOY_CLOUDFLARE.md`.
- `docs/archive/` untuk dokumen yang sudah usang (jangan dihapus total — pertahankan jejak).
- Jangan simpan file laporan HTML sesi (assessment-report, cbt-simulasi) dari editor dengan prettier-on-save yang memegang salinan lama — pernah menimpa isi (`cbt-simulasi.html`).
- Konvensi commit: `<type>(<scope>): <pesan ringkas bahasa Indonesia>`, contoh `feat(cbt): ...`, `fix(forum): ...`, `docs(cbt): ...`, `test(auth): ...`. Commit per milestone kecil.

## 9. Alur Kerja Sesi

1. Baca `docs/HANDOFF.md` dulu (status terakhir) + `docs/rules.md`.
2. Eksplorasi kode sebelum mengubah — jangan tebak.
3. Implementasi → test → `npm run verify` → commit per milestone.
4. Perbarui `docs/HANDOFF.md` + dokumen terkait (schema/prd bila skema/fitur berubah).
5. Deploy produksi hanya setelah disetujui pemilik project (backup D1 dulu).