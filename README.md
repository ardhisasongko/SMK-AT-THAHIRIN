# SMK PLUS AT-THAHIRIN — Sistem Informasi Sekolah

Situs resmi & portal digital **SMK PLUS AT-THAHIRIN** (NPSN 20232426, akreditasi B),
sekolah kejuruan di Megamendung, Kabupaten Bogor, dengan konsentrasi keahlian
Manajemen Perkantoran dan Layanan Bisnis (MPLB). Aplikasi ini melayani siswa,
guru, dan admin sekolah: portal informasi publik, ujian CBT, absensi harian,
manajemen kelas, modul ajar berbantuan AI, forum, notifikasi, rapor, dan
pengiriman notifikasi WhatsApp ke wali siswa.

**Live:** https://smk-at-tahirin.pages.dev

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite 6, Tailwind CSS 4, ikon `lucide-react`,
  animasi `motion`. SPA berbasis tab (tanpa router) di folder `src/`.
- **Backend:** Cloudflare Pages Functions (TypeScript) di folder `functions/`,
  REST JSON dengan middleware global (auth sesi cookie, CSRF origin check,
  rate limit, batas ukuran body).
- **Database:** Cloudflare D1 (SQLite), binding `DB`, 26 migrasi di `migrations/`.
- **Integrasi eksternal:**
  - `sync-worker/` — Worker cron sinkronisasi absensi/foto ke Google Sheets & Drive.
  - `whatsapp-gateway/` — gateway WhatsApp lokal (Node + whatsapp-web.js),
    berkomunikasi lewat header rahasia `X-Gateway-Key`.
  - Google Gemini (fitur AI Modul Ajar & generate soal CBT) via secret `GEMINI_API_KEY`.
  - `google-apps-script/` — Apps Script penerima sinkronisasi.
- **Pengujian:** Vitest + Testing Library (folder `tests/`).

## Struktur Folder (ringkas)

```
src/            Frontend React (komponen per fitur, data awal, utilitas)
functions/      Backend Pages Functions (api/ = endpoint, _lib/ = helper, _middleware.ts)
migrations/     Migrasi skema D1 (jangan edit yang sudah diterapkan — buat baru)
sync-worker/    Worker cron sinkronisasi Google
whatsapp-gateway/ Gateway WhatsApp lokal (proses terpisah, bukan bagian situs)
scripts/        Skrip utilitas (generate file situs, impor data Excel)
docs/           Dokumentasi proyek: prd, architecture, schema, design, rules, HANDOFF
tests/          Test Vitest frontend & fungsi
public/         Aset statis (ikon sekolah, manifest PWA, _headers)
```

Dokumen penting: `AGENTS.md` (konteks & aturan sesi), `docs/rules.md` (aturan kerja),
`docs/HANDOFF.md` (status proyek terbaru), `DEPLOY_CLOUDFLARE.md`,
`SECURITY_HARDENING.md`, `WHATSAPP_GATEWAY.md`, `EXTERNAL_INTEGRATIONS.md`.

## Menjalankan Secara Lokal

Persyaratan: Node.js 20+ dan npm.

```bash
npm install

# Terapkan migrasi D1 lokal (sekali di awal)
npm run db:migrate:local

# Salin contoh variabel lokal lalu isi seperlunya (GEMINI_API_KEY boleh kosong
# bila fitur AI tidak dipakai)
cp .dev.vars.example .dev.vars

# Jalankan: build frontend + Pages Functions + D1 lokal di http://localhost:8788
npm run dev
```

Perintah lain:

```bash
npm run lint          # cek tipe TypeScript (tsc --noEmit)
npm test              # Vitest (tambahkan --testTimeout=10000 bila perlu)
npm run verify        # lint + semua test + typecheck sync-worker + build (wajib sebelum deploy)
npm run build         # build frontend ke dist/
node scripts/import-data.mjs <file.xlsx>   # impor siswa/guru dari Excel
```

Impor data Excel memakai paket `xlsx` dari registry npm resmi.

## Variabel Lingkungan & Rahasia

- Daftar lengkap variabel ada di `.env.example` (root) dan `.dev.vars.example`
  (pengembangan lokal). Nilai variabel biasa juga terdokumentasi di
  `wrangler.toml` bagian `[vars]`.
- **Rahasia tidak pernah ditulis di repo.** `GEMINI_API_KEY` dan
  `WHATSAPP_GATEWAY_KEY` diatur sebagai Secret di dashboard Cloudflare Pages
  (atau `npx wrangler pages secret put <NAMA>`); `SYNC_TOKEN` diatur sebagai
  secret pada `sync-worker`.
- Jangan commit file `.env`, `.dev.vars`, folder `imported/`, atau `data/*.xlsx`
  — semuanya sudah diabaikan oleh `.gitignore`.

## Deploy

Deploy produksi dilakukan **manual dari CLI oleh pemilik project** (pola yang
tercatat di `docs/HANDOFF.md`; repo hanya memiliki workflow CI *Verify* —
tidak ada workflow deploy otomatis, dan aturan project mewajibkan persetujuan
pemilik sebelum deploy produksi):

```bash
npm run pages:deploy  # build + wrangler pages deploy ke project smk-at-tahirin
```

Hasilnya terbit di https://smk-at-tahirin.pages.dev. Bila suatu saat project
Pages dihubungkan ke Git dari dashboard Cloudflare, merge ke `main` juga akan
memicu deploy — periksa status keterhubungan itu di dashboard, bukan dari repo.

Migrasi database produksi (selalu backup D1 lebih dulu — lihat `docs/rules.md`):

```bash
npm run db:migrate:remote
```

Panduan lengkap: `DEPLOY_CLOUDFLARE.md`; panduan menerapkan template ini ke
sekolah lain: `docs/DEPLOY_SCHOOL.md` (identitas sekolah tersentral di
`src/data/schoolConfig.ts` + `wrangler.toml`).

## Catatan Keamanan

- Sesi memakai cookie `HttpOnly` + `Secure` + `SameSite=Strict`; token sesi
  disimpan sebagai hash SHA-256 di D1; password di-hash PBKDF2-SHA256.
- RBAC lima role (`super_admin`, `admin`, `guru`, `ketua_kelas`, `siswa`)
  selalu diperiksa di server; seluruh query D1 memakai parameter terikat.
- Ringkasan hardening & langkah wajib di dashboard Cloudflare (WAF, rate
  limiting edge): `SECURITY_HARDENING.md`.
- Bila ada kunci/token yang pernah terekspos, rotasi segera — menghapus file
  dari repo tidak menghapus riwayat Git.
