# Arsitektur — SMKS PLUS AT THAHIRIN

Platform: **React 19 SPA (Vite) + Cloudflare Pages Functions + D1 (SQLite)**. Semua di satu project, tanpa server tradisional.

## Diagram Arsitektur

```
                        ┌─────────────────────────────────────────────┐
                        │           Cloudflare Pages (edge)            │
                        │                                             │
  Browser (SPA) ──────►│  /dist (Vite build)        functions/_lib    │
  React 19 + Tailwind   │  index.html, aset statis  ─ auth, RBAC,     │
  localStorage sesi     │                             rate-limit,     │
                        │  /api/** (Pages Functions)  response, dll   │
                        │     │                                        │
                        │     ▼                                        │
                        │  D1  smk-at-tahirin-db (SQLite, 22 migrasi)  │
                        └────────────┬────────────────────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────────┐
            ▼                        ▼                            ▼
   ┌───────────────┐       ┌──────────────────┐        ┌──────────────────┐
   │ Gemini API    │       │ sync-worker      │        │ whatsapp-gateway │
   │ (AI generate) │       │ (cron D1→Sheets) │        │ (wa-web.js lokal)│
   └───────────────┘       │ Google Apps      │        │ polling claim    │
                           │ Script / Drive   │        └──────────────────┘
                           └──────────────────┘
```

**Komponen:**

| Komponen | Teknologi | Peran |
|---|---|---|
| Frontend | React 19 + Vite 6 + Tailwind 4, lucide-react, motion | SPA tab-based tanpa router (state `activeTab` di `App.tsx`) |
| API | Cloudflare Pages Functions (`functions/api/**`) | Seluruh backend, REST JSON |
| Database | D1 binding `DB` | SQLite, migrasi `migrations/` |
| AI | Gemini REST (`functions/_lib/gemini.ts`) | Generate soal CBT & modul ajar, fail-closed |
| Google Sheets | `sync-worker/` (cron worker) + `google-apps-script/sync.gs` | Sinkronisasi presensi/foto ke Sheet + Drive |
| WhatsApp | `whatsapp-gateway/` (Node + wa-web.js, komputer operator) | Kirim notifikasi WA via pola outbox polling |

## Alur Request API

1. Request masuk ke `functions/_middleware.ts` (semua `/api/**`):
   - **CSRF check** — mutasi ber-cookie tanpa `Bearer` wajib `Origin` = host (403 bila beda).
   - **Body limit** per-path: upload 2MB, presensi_v1 5MB, data lain 2MB, cbt/exams 512KB, sisanya 128KB → 413.
   - **Autentikasi** — `getUserFromRequest` menyimpan user di `context.data.user`.
   - **Rate limit mutasi** — semua POST/PUT/PATCH/DELETE kecuali login: `mutation:<userId|IP>` 120/60 detik → 429.
   - **Paksa ganti password** — `mustChangePassword` memblokir semua endpoint kecuali change-password/logout/me → 403.
2. Endpoint memvalidasi role (RBAC), memproses D1, mengembalikan `{ success: true, data }` atau `{ success: false, error }` dengan header keamanan (no-store, nosniff, X-Frame-Options DENY, HSTS, dll).

## Autentikasi & Sesi

- **Bukan JWT.** Token sesi acak `st_` + 32 byte hex, disimpan **hash SHA-256** di tabel `sessions`, TTL **7 hari**.
- Dikirim via cookie `smk_session` (HttpOnly, SameSite=Strict, Secure) **atau** header `Authorization: Bearer`.
- Password: **PBKDF2-SHA256 100.000 iterasi**, salt 16 byte, format `pbkdf2$100000$salt$hash` (batas Workers).
- Login anti user-enumeration (dummy hash), rate limit per-IP (500/15 mnt) & per-akun (10/15 mnt).
- Reset password diinisiasi **admin** (password acak 14 char, wajib ganti, sesi target dihapus). Tidak ada reset mandiri via email.
- Frontend menyimpan sesi di localStorage (`AuthSession { token, user }`), divalidasi ulang ke `/api/auth/me` saat load.

## RBAC

Role: `super_admin`, `admin`, `guru`, `ketua_kelas`, `siswa`. Status: `active | inactive | archived`.

| Kemampuan | super_admin | admin | guru | ketua_kelas | siswa |
|---|---|---|---|---|---|
| Kelola user (CRUD, audit, reset, ketua) | ✔ (termasuk admin) | ✔ (tanpa admin) | ✘ | ✘ | ✘ |
| Presensi input/edit | ✔ semua kelas | ✔ semua kelas | ✔ semua kelas | ✔ kelasnya (approved) | ✔ record sendiri, sebelum 08:00 WIB |
| CBT kelola (buat/edit/hapus/token/generate) | ✔ | ✔ | ✔ (ujian milik sendiri) | ✘ | ✘ |
| CBT kerjakan (attempt/save/submit) | ✘ | ✘ | ✘ | ✔ | ✔ |
| Forum moderasi (pin/resolved) | ✔ | ✔ | ✔ | ✘ | ✘ |
| Kirim notifikasi | ✔ | ✔ | ✔ (tanpa target admin/Sistem) | ✘ | ✘ |
| WhatsApp admin (kontak/guru/history) | ✔ | ✔ | ✘ | ✘ | ✘ |
| WhatsApp settings (gateway/rollout) | ✔ | ✘ | ✘ | ✘ | ✘ |
| Hapus permanen user | ✔ (butuh password) | ✘ | ✘ | ✘ | ✘ |

Helper: `canEditClass`, `editableClassIds`, `canManageCbtExam`, `notificationVisible`, `forumTopicVisible` (`functions/_lib/auth.ts`, `cbt.ts`, `forum-notifications.ts`).

## Data: JSON Legacy + Proyeksi Relasional

- API generik `GET/PUT /api/data/:key` membaca/menulis `app_data` (JSON per koleksi) dengan **optimistic concurrency** (`If-Match`/`X-Collection-Revision` → 409).
- Domain baru (CBT, forum, notifikasi, WA) dan data akademik memakai tabel relasional.
- Proyeksi akademik (`school_classes`, `students`, `attendance_records`, `teaching_modules`) **disinkronkan trigger dari `app_data`** (migrasi 0018) + marker revisi di `academic_collection_revisions`. Backfill/validasi ketat ada di `functions/_lib/relational-data.ts` (max 10.000 record, CAS).
- Roster siswa juga dimanipulasi via prepared statement JSON (`functions/_lib/student-roster.ts`) — API user (create/update/NISN) menjaga `siswa_v1` dan `users` sinkron.

## Rate Limiting

Sliding window di tabel `api_rate_limits` (upsert atomik + cleanup bertahap 32 baris).

| Key | Limit | Window |
|---|---|---|
| `mutation:<user\|IP>` | 120 | 60 detik (global middleware) |
| `login-ip:<IP>` / `login-account:<id>` | 500 / 10 | 15 menit |
| `upload:<user>` | 10 | 1 jam (+20 foto/hari) |
| `forum-topic:<user>` / `forum-reply:<user>` | 5 / 30 | 1 jam |
| `cbt-token:<exam>:<user>` | 10 | 15 menit (reset saat token benar) |
| `ai-cbt:<user>` / `ai-modul:<user>` | 20 | 24 jam |

## Integrasi Eksternal

### Gemini (aktif di produksi)
- Endpoint `POST /api/cbt/generate` (1–50 soal PG) & `POST /api/modul-ajar/generate` (Kurikulum Merdeka), role guru+.
- **Fail-closed**: `GEMINI_ENABLED` (var) → 503 bila mati/tanpa key; model `GEMINI_MODEL` (default `gemini-3.6-flash`); secret `GEMINI_API_KEY`.
- Safety: retry exponential (429/5xx), timeout 20s, cek blockReason/finishReason, validasi schema output.

### WhatsApp (belum aktif operasional)
- **Pola outbox polling**: gateway lokal (wa-web.js + LocalAuth) **tidak dipanggil server**; ia POST ke `/api/whatsapp/gateway` (header `X-Gateway-Key` = secret `WHATSAPP_GATEWAY_KEY`) dengan action: `heartbeat` (60s), `claim` (max 25/batch), `begin_send` (re-check semua kill switch → 423 bila diblokir), `complete`.
- Guardrail berlapis: `whatsapp_settings.enabled` → `external_integrations.enabled` → emergency_pause → rollout `off/canary/all` → `GATEWAY_ENABLED`. Dedupe event via fingerprint + UNIQUE dedupe_key; claim basi 10 menit; jeda 5–7s antar pesan.
- Status `sent_unknown` tidak dikirim ulang otomatis — rekonsiliasi manual Super Admin.

### Google Sheets / Drive (dry-run default)
- `sync-worker/` cron: daily 20:00 WIB (`0 13 * * *`), weekly Minggu 21:00 WIB (`0 14 * * 0`). Manual: `POST /?job=daily|weekly` + Bearer `SYNC_TOKEN`.
- Daily: presensi_v1 → Apps Script `Harian Sync v2` + push foto ke Drive (folder `Absensi SMK AT-THAHIRIN/<tahun>/W<xx>/<nama>_<nisn>`), tandai `photos.drive_link/pushed`.
- Weekly: agregasi per siswa per minggu → `Rekap Sync v2`.
- Amankan: `SYNC_ENABLED=false` & `SYNC_DRY_RUN=true` default; stable key + fingerprint SHA-256; checkpoint `google_sync_state_v2`; batch ≤10; Apps Script verifikasi token constant-time + LockService; foto Drive privat; **Worker tidak pernah menghapus foto D1**.
- Apps Script: `google-apps-script/sync.gs` — sheet versi 2 (`Harian Sync v2`, `Rekap Sync v2`, `_SyncManifestV2`), anti formula injection, kolom key diproteksi.

## Keamanan

- Sesi: cookie HttpOnly + Secure + SameSite=Strict; token hash SHA-256.
- CSRF: Origin check pada mutasi ber-cookie.
- Body limit per route + header keamanan global (`public/_headers`: CSP ketat, HSTS, X-Frame-Options DENY, nosniff, Referrer/Permissions-Policy).
- Rate limit D1 + audit log (`user_audit_log`, `presensi_log`, `whatsapp_consent_events`).
- RBAC per endpoint + scope data per role (siswa hanya melihat datanya sendiri, guru hanya ujian/kelasnya).
- **Wajib di dashboard Cloudflare**: WAF Managed Rules, Bot Fight Mode, rate rule login/upload, batasi `/api/whatsapp/gateway` ke IP operator, cache bypass `/api/*`.
- Sensitif & tidak di repo: `.env*`, `imported/` (akun.sql, kredensial, siswa.json), `data/` (xlsx sumber).

## Deployment & CI/CD

- **Verifikasi**: `npm run verify` = lint (tsc --noEmit) + 235 test vitest + test sync-worker + typecheck sync-worker + build.
- CI `.github/workflows/verify.yml`: push ke `main` & PR → npm ci (root + sync-worker) → verify → syntax check gateway → wrangler dry-run.
- Deploy **manual**: `npm run db:migrate:remote` (backup dulu via `wrangler d1 export`) lalu `npm run pages:deploy`.
- Env: vars `APP_NAME`, `GEMINI_ENABLED`, `GEMINI_MODEL`; secrets `GEMINI_API_KEY`, `WHATSAPP_GATEWAY_KEY`.
- Domain produksi: `https://smk-at-tahirin.pages.dev` (D1 remote `smk-at-tahirin-db`).

## Status Operasional (Agustus 2026)

- 235/235 test lulus; migrasi 0022 live lokal + remote; produksi deploy 16 Agu 2026.
- Gemini aktif; WhatsApp & Google Sync **belum aktif** (gate default off, butuh operator: scan QR + deploy Apps Script + canary 7–14 hari).
- Lihat `docs/HANDOFF.md` untuk status per sesi terbaru.