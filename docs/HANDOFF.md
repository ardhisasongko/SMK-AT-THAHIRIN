# HANDOFF - Status Proyek

Tanggal pembaruan: Senin, 2 November 2026
Project: SMK PLUS AT-THAHIRIN (React/Vite + Cloudflare Pages Functions + D1)

## Status Umum

- **Ekspor Excel (.xlsx) absensi, nilai CBT, rapor (2 November 2026, TANPA
  migrasi)** — memenuhi permintaan kepala sekolah/guru non-IT: di samping
  ekspor CSV yang TIDAK berubah sama sekali, kini ada unduhan .xlsx asli
  (SheetJS `xlsx` ^0.18.5, dipindah dari devDependencies ke dependencies
  karena kini dipakai runtime). Tiga jalur: (1) Rekap absensi (klien,
  `src/utils/xlsx.ts`): baris yang sama persis dengan CSV dari
  `buildRekapExportRows`, library dimuat `import()` dinamis — kode
  SheetJS (±448 KB mentah di chunk vendor) TIDAK masuk bundle awal dan
  hanya diunduh browser saat tombol ditekan, sheet "Rekap Absensi";
  tombol lama diluruskan labelnya menjadi "Export CSV" + tombol baru
  "Export Excel (.xlsx)". (2) Nilai CBT (server): `GET
  /api/cbt/export/scores?format=xlsx`, baris & ember rate limit
  `export:<user>` yang sama, sheet "Nilai CBT", tombol "Ekspor Nilai
  (Excel)". (3) Rapor (server): `GET /api/rapor/:nisn?format=xlsx`, baris
  yang sama, sheet "Rapor", tombol "Unduh Rapor (Excel)". Keamanan: sel
  teks berawalan =, +, -, @ dipaksa menjadi sel string murni tanpa elemen
  formula (`sanitizeXlsxSheet` di `functions/_lib/xlsx.ts` + pasangan di
  `src/utils/xlsx.ts`) — setara netralisasi formula CSV. Keterbatasan
  jujur: SheetJS Community Edition menulis nama sheet & lebar kolom,
  tetapi TIDAK menulis gaya font (header tebal) maupun freeze pane —
  terbukti dari uji XML; tidak ada styling semu yang diklaim. Test baru
  `tests/xlsx-export.test.ts` (7 test): xlsx valid (magic PK) & terbaca
  balik dengan isi sama untuk builder server + klien + kedua endpoint,
  netralisasi formula terbukti (tidak ada sel formula; NISN nol-depan
  tetap teks), RBAC ekspor tetap berlaku. Test: 404 → 411 root
  (62 → 63 file) + 11 sync-worker.

- **Kode QR aktivasi 2FA (2 November 2026, TANPA migrasi)** — penyiapan
  verifikasi dua langkah di `TwoFactorCard` kini menampilkan kode QR dari
  `otpAuthUrl` (library `react-qr-code` v2.2.0, SVG ringan) yang bisa
  langsung dipindai aplikasi authenticator (Google Authenticator:
  tombol + → "Pindai kode QR"), menggantikan kewajiban input manual.
  Kunci rahasia manual tetap tampil di bawah QR sebagai cadangan; teks
  otpauth mentah tidak lagi ditampilkan. QR HANYA dirender selama tahap
  penyiapan (`pendingSecret` aktif dan 2FA belum aktif) — tidak muncul
  pada status/endpoint mana pun setelah aktivasi selesai, sesuai paparan
  kunci rahasia yang memang hanya milik pemilik akun. Test baru
  `tests/TwoFactorCard.test.tsx` (3 test): QR berisi otpauth URL yang
  benar saat penyiapan, tidak ada QR sebelum setup, tidak ada QR saat
  2FA sudah aktif. Test: 401 → 404 root (61 → 62 file) + 11 sync-worker.
  Merge ke `main` langsung live (deploy otomatis Cloudflare Pages);
  konteks: program hardening A–F sudah go-live sebelumnya hari yang sama
  (migrasi 0030–0033 teraplikasi di produksi dan secret
  `TOTP_ENCRYPTION_KEY` terpasang, `twoFactor.configured=true`).

- **Hardening Fase F — paket dokumen keamanan, SOP operasi, templat legal
  (2 November 2026, BELUM deploy, docs-only, TANPA migrasi)** — sekaligus
  menutup PROGRAM HARDENING A–F untuk kesiapan penjualan multi-sekolah:
  (1) `SECURITY.md` (root): status hardening lengkap — hasil Fase A
  (8 temuan diperbaiki; 7 temuan terbuka beserta statusnya, termasuk
  penutupan temuan bias generator oleh Fase B), ringkasan Fase B–F,
  responsible disclosure (kanal laporan, aturan safe harbor, target
  triase), dan praktik keamanan yang diterapkan beserta batasan yang
  diketahui. (2) `docs/operations/SECURITY_OPERATIONS.md`: SOP update
  keamanan serentak (per deployment backup→migrasi→deploy→verifikasi,
  canary satu sekolah, rollback kode/data, larangan hotfix di luar
  repo); SOP respons insiden dengan linimasa jam-per-jam dan kewajiban
  notifikasi UU PDP Pasal 46 paling lambat 3×24 jam ke subjek data &
  lembaga (vendor wajib memberi tahu sekolah ≤ 24 jam); SOP backup
  mingguan + uji restore triwulanan ke D1 drill; aturan WAF/edge presisi
  siap-terap per zona (dari catatan Fase C — TIDAK dapat dibuat dari
  repo); SOP kunci per sekolah (satu set kunci per deployment:
  GEMINI_API_KEY project terpisah, TOTP_ENCRYPTION_KEY stabil,
  Turnstile per domain, rotasi & pengecualiannya) + panduan nilai
  `GEMINI_DAILY_LIMIT` (Fase D); runbook monitoring (UptimeRobot/Better
  Stack ke `/api/health`, ambang tindak lanjut, jadwal cek mingguan —
  dari Fase E); checklist go-live sekolah baru yang menunjuk
  `docs/DEPLOY_SCHOOL.md` untuk langkah teknisnya. (3)
  `docs/legal-templates/`: `PERJANJIAN_PEMROSESAN_DATA.md` (vendor
  sebagai Prosesor, sekolah sebagai Pengendali; data anak = data
  spesifik; notifikasi vendor→sekolah 24 jam; sub-prosesor Cloudflare/
  Google/WhatsApp), `KEBIJAKAN_PRIVASI.md`, dan `SLA.md` (target
  ketersediaan, waktu respons dukungan, backup/RPO/RTO, kredit layanan)
  — SETIAP file berkepala mencolok "TEMPLAT — wajib ditinjau penasihat
  hukum sebelum digunakan; bukan nasihat hukum." (4) Catatan sesi A–F
  lengkap ada pada entri-entri HANDOFF ini. RINGKASAN PROGRAM: PR #7
  (A, merge `303f15f2`), PR #8 (B, `67590c37`, migrasi 0030), PR #9 (C,
  `56f5fc02`, migrasi 0031), PR #10 (D, `837067e9`, migrasi 0032),
  PR #11 (E, `763cf0a6`, migrasi 0033), PR ini (F, docs-only). Test:
  365+11 → 401 root + 11 sync-worker (57 → 61 file test root). Yang
  SADAR tidak dapat dilakukan dari repo dan menjadi tindak lanjut
  pemilik: menerapkan aturan WAF & monitor uptime eksternal per zona
  Cloudflare sekolah (daftar presisi di dokumen operasi), meninjau &
  menandatangani templat legal dengan penasihat hukum, membuat kunci
  Gemini/Turnstile per sekolah. **Deploy produksi seluruh program
  (backup → `db:migrate:remote` untuk migrasi 0030–0033 →
  `pages:deploy` → pasang secret `TOTP_ENCRYPTION_KEY`, opsional
  Turnstile & `GEMINI_DAILY_LIMIT`) MENUNGGU instruksi pemilik — belum
  dilakukan.**

- **Hardening Fase E — monitoring: health kaya + panel status admin
  (2 November 2026, BELUM deploy, migrasi baru 0033)**: (1) `GET
  /api/health` diperkaya lewat `functions/_lib/system-status.ts`:
  status ok/degraded (503 bila DB gagal), `dbLatencyMs` dari `SELECT 1`,
  `migration.latestKnown` (konstanta kode `LATEST_KNOWN_MIGRATION` —
  perbarui setiap migrasi baru; saat ini `0033_login_failure_stats`),
  status komponen boolean (Gemini aktif/terkonfigurasi, 2FA
  terkonfigurasi, Turnstile aktif), dan pemakaian kuota AI hari ini.
  Tetap publik untuk uptime monitor tetapi TANPA nilai rahasia/identitas
  akun (test menegaskan tidak ada nilai secret yang bocor). (2) Panel
  status admin: endpoint `GET /api/integrations/status`
  (admin/super_admin) kini menggabungkan status integrasi lama dengan
  bagian `system` — kesehatan DB + latensi, sesi aktif, kegagalan login
  24 jam, lockout aktif, kuota AI hari ini, migrasi dikenal, status fitur
  — dan tab "sistem" Profil menampilkan `SystemStatusCard` (termasuk
  status + heartbeat gateway WhatsApp). (3) Sumber data kegagalan login:
  migrasi 0033 tabel `login_failure_stats` (ember agregat per jam UTC,
  anonim tanpa identifier/IP; dicatat endpoint login pada setiap
  kegagalan, dibersihkan oportunistik >48 jam, fail-open). (4) RUNBOOK
  MONITORING (versi lengkap masuk dokumen Fase F): per sekolah pasang
  monitor gratis UptimeRobot/Better Stack ke `https://<domain
  sekolah>/api/health` interval 5 menit, kata kunci `"status":"ok"`,
  alert ke email/WhatsApp operator vendor bila down >5 menit atau 503;
  ambang tindak lanjut: login gagal 24 jam > 100 (panel admin) → periksa
  lockout & pertimbangkan Turnstile/WAF; kuota AI > 80% sebelum jam 12:00
  WIB → naikkan `GEMINI_DAILY_LIMIT` atau periksa penyalahgunaan; cek
  kuota D1 (reads/writes/storage) di dashboard Cloudflare mingguan;
  jadwal cek mingguan operator: buka panel status admin (DB sehat, sesi,
  kegagalan login, kuota), cek status monitor eksternal, cek heartbeat
  gateway WhatsApp, pastikan backup D1 terakhir < 7 hari. Test baru
  `tests/security-hardening-fase-e.test.ts` (6 test). **Deploy produksi
  menunggu instruksi pemilik.**

- **Hardening Fase D — kuota AI per deployment (2 November 2026, BELUM
  deploy, migrasi baru 0032)**: penghitung pemakaian Gemini harian (hari
  kalender WIB) per deployment di tabel `gemini_daily_usage`
  (`functions/_lib/gemini-quota.ts`), dinaikkan atomik oleh kedua endpoint
  AI (`/api/cbt/generate` dan `/api/modul-ajar/generate`) setelah gerbang
  per-pengguna 20/hari yang sudah ada. Batas dari variabel biasa
  `GEMINI_DAILY_LIMIT` ([vars]): kosong/0/tidak valid = TANPA batas
  (bawaan aman — deployment lama hanya mendapat penghitung, perilaku
  tidak berubah); permintaan melewati batas ditolak 429 sopan "Kuota AI
  harian sekolah … sudah tercapai. Silakan coba lagi besok." sampai hari
  WIB berikutnya. Penghitung mencatat juga percobaan yang ditolak agar
  panel status (Fase E) mencerminkan beban nyata. Fail-open bila tabel
  belum ada (deployment pra-migrasi tidak kehilangan fitur AI). Catatan
  penomoran: migrasi kuota adalah 0032 karena 0031 dipakai lockout login
  Fase C (urutan tetap runtut tanpa celah). SOP kunci per sekolah (satu
  `GEMINI_API_KEY` per deployment + cara memasang/rotasi + rekomendasi
  nilai batas) ditulis di dokumen operasi Fase F. Test baru
  `tests/security-hardening-fase-d.test.ts` (6 test): kalender WIB,
  parser batas, penghitung naik/batas menolak/reset harian, fail-open,
  integrasi kedua endpoint berbagi satu penghitung, dan mode tanpa batas.
  **Deploy produksi menunggu instruksi pemilik.**

- **Hardening Fase C — Turnstile login + lockout bertahap + cakupan rate
  limit (2 November 2026, BELUM deploy, migrasi baru 0031)**: (1) Turnstile
  siap-env (`functions/_lib/turnstile.ts`): aktif HANYA bila
  `TURNSTILE_SITE_KEY` ([vars], publik) DAN secret `TURNSTILE_SECRET_KEY`
  terisi; verifikasi server-side siteverify di `POST /api/auth/login`,
  gagal/token kosong/layanan verifikasi tak terjangkau = 401 generik
  "Verifikasi keamanan gagal". Site key dibagikan ke halaman login lewat
  `GET /api/auth/login-config` (hanya saat fitur aktif penuh); widget
  dirender eksplisit di `LoginForm` dan token disertakan pada request
  login. Env kosong (semua deployment lama) = login persis seperti
  sebelumnya, tanpa widget. (2) Lockout bertahap (migrasi 0031, tabel
  `login_lockouts`; `functions/_lib/login-lockout.ts` FAIL-OPEN agar
  deployment yang belum bermigrasi tidak terkunci total): kunci
  `account:<identifier>` terkunci setelah 5 kegagalan beruntun dan
  `ip:<ip>` setelah 50 (menghormati NAT sekolah), durasi naik per level
  5→15→60→240→1440 menit dan TIDAK pernah permanen; pemeriksaan terjadi
  SEBELUM verifikasi password (password benar pun ditolak 429 selama
  terkunci); login berhasil menghapus baris akun; reset password admin
  juga menghapus kunci akun target (kedua bentuk identifier); baris yang
  tidak tersentuh >24 jam di-reset. (3) Audit cakupan rate limit endpoint
  mahal: generate AI sudah 20/hari/pengguna (`ai-cbt`/`ai-modul`), unggah
  sudah 10/jam (+thumbnail 30/jam), ekspor nilai CBT kini punya ember
  khusus `export:<user>` 10/jam di luar batas baca global 300/menit.
  (4) ATURAN WAF TINGKAT AKUN — TIDAK bisa diimplementasikan dari repo;
  berikut daftar presisi siap-terap per deployment di dashboard Cloudflare
  (zona domain sekolah masing-masing), dicatat untuk dokumen Fase F:
  WAF Managed Rules (OWASP) aktif; Bot Fight Mode aktif; aturan rate
  limiting kustom: (a) path `/api/auth/login` — 10 request/menit/IP →
  Managed Challenge, (b) path `/api/auth/login/verify-2fa` — 30
  request/10 menit/IP → Managed Challenge, (c) path `/api/upload` — 10
  request/jam/IP → Block, (d) path `/api/cbt/generate` +
  `/api/modul-ajar/generate` — 30 request/jam/IP → Managed Challenge,
  (e) path `/api/whatsapp/gateway` — hanya izinkan IP operator sekolah
  (IP Access Rule Allowlist; Block selainnya bila IP operator statis);
  aturan cache: Bypass cache untuk `/api/*`, TTL panjang hanya untuk
  `/assets/*` ber-fingerprint; matikan akses deployment preview publik
  atau lindungi dengan Cloudflare Access; aktifkan notifikasi dashboard
  untuk lonjakan request, lonjakan 429/5xx, dan pemakaian kuota D1.
  Test baru `tests/security-hardening-fase-c.test.ts` (10 test): ambang &
  eskalasi lockout akun, ambang IP 50, fail-open tanpa tabel, lockout di
  endpoint login + pemulihan via kedaluwarsa dan via reset admin,
  Turnstile (config hanya saat aktif penuh, token valid/ditolak/kosong,
  env kosong tidak berubah), ember ekspor 10/jam. Fixture
  `tests/rapor-export.test.ts` disesuaikan untuk query rate limit baru
  (asersi tidak berubah). **Deploy produksi menunggu instruksi pemilik**
  (urutan lengkap di catatan Fase B).

- **Hardening Fase B — 2FA TOTP staf + kebijakan password (2 November 2026,
  BELUM deploy, migrasi baru 0030)**: (1) Verifikasi dua langkah TOTP
  (RFC 6238, HMAC-SHA-1/30 dtk/6 digit, kompatibel aplikasi authenticator)
  untuk role `guru`/`admin`/`super_admin` saja. Secret disimpan TERENKRIPSI
  AES-GCM (`functions/_lib/totp.ts`, kunci diturunkan dari secret server
  `TOTP_ENCRYPTION_KEY`; tanpa secret itu fitur nonaktif aman/503).
  Migrasi 0030: `users.totp_secret_enc` + `users.totp_enabled`, tabel
  `totp_recovery_codes` (hanya hash SHA-256, 10 kode, sekali pakai), dan
  `auth_challenges` (hanya hash token tantangan, TTL 10 menit, maks. 5
  percobaan). Alur: Profil → kartu "Verifikasi Dua Langkah (2FA)"
  (`src/components/TwoFactorCard.tsx`) → setup menampilkan secret →
  aktivasi wajib bukti kode pertama → kode pemulihan tampil SEKALI.
  Login menjadi dua langkah: password benar menerbitkan tantangan
  (`POST /api/auth/login` → `twoFactorRequired`), sesi penuh hanya terbit
  dari `POST /api/auth/login/verify-2fa`; token tantangan BUKAN sesi
  (ditolak `getUserFromRequest`). Aktivasi mencabut semua sesi lain agar
  sesi pra-2FA tidak menjadi bypass. Pemilik dapat menonaktifkan sendiri
  dengan kode TOTP atau password (`POST /api/auth/2fa/disable`, audit
  `DISABLE_2FA_SELF`); admin/super_admin dapat menonaktifkan 2FA staf
  terkunci (`POST /api/users/disable-2fa`, audit `DISABLE_2FA`, admin
  tidak boleh menyentuh akun admin/super_admin, sesi target dicabut).
  (2) Kebijakan password tunggal `functions/_lib/password-policy.ts` di
  semua jalur: minimal 10 karakter huruf+angka, dan password tidak boleh
  sama/mengandung NISN/NIP, email, bagian lokal email, atau nama
  (pelanggaran → 400). Diterapkan di ganti password sendiri; password
  awal/reset kini dari `generateRandomPassword()` bersama (acak
  kriptografis, rejection sampling tanpa bias modulo — menutup temuan
  terbuka Fase A soal bias generator, 16 karakter, dijamin lolos
  kebijakan); impor CSV tetap lewat jalur pembuatan akun yang sama.
  Login TIDAK digerbangi kekuatan password di klien agar password lama
  yang sah tetap bisa masuk — kebijakan hanya berlaku saat menetapkan
  password baru. Test baru `tests/security-hardening-fase-b.test.ts`:
  secret terenkripsi, aktivasi→login dua langkah, kode salah ditolak,
  tantangan musnah setelah 5 kegagalan, kode pemulihan sekali pakai,
  token tantangan bukan sesi, sesi lama dicabut, non-staf ditolak,
  penonaktifan admin teraudit + batas kewenangan, kebijakan password di
  semua jalur, dan kewajiban ganti password awal tetap menahan endpoint
  lain (middleware). **Deploy produksi (backup → migrasi 0030 remote →
  `pages:deploy` + pasang secret `TOTP_ENCRYPTION_KEY`) menunggu instruksi
  pemilik.**

- **Hardening Fase A — audit keamanan mendalam (1 November 2026, BELUM deploy,
  tanpa migrasi baru)**: audit pola pikir penyerang atas autentikasi/sesi,
  matriks RBAC 5 role × seluruh endpoint `functions/api/**`, rate limit, CSRF,
  XSS, unggah file, endpoint AI/Gemini, ekspor CSV, header, pesan error, token
  CBT, dan perbandingan secret. 8 perbaikan aman (tanpa perubahan perilaku
  sah), masing-masing dengan test regresi di
  `tests/security-hardening-fase-a.test.ts` (+19 test root, +1 test
  sync-worker): (1) formula injection CSV dinetralkan di SEMUA jalur ekspor
  (server `functions/_lib/csv.ts`, klien `src/utils/download.ts`, ekspor rekap
  AbsensiSection yang sebelumnya tanpa escaping sama sekali) — sel teks
  berawalan `=`/`+`/`-`/`@` (termasuk setelah spasi/tab) diawali apostrof,
  nilai numerik tidak disentuh; (2) perbandingan secret konstan-waktu
  (`functions/_lib/secret-compare.ts`: hash SHA-256 lalu banding digest) untuk
  X-Gateway-Key WhatsApp, hash token ujian CBT, dan SYNC_TOKEN sync-worker
  (helper `sync-worker/src/secret-compare.ts`); (3) fallback sesi legacy
  plaintext di `getUserFromRequest` dihapus — sesi hanya diterima dari hash
  SHA-256 (TTL sesi 7 hari membuat tidak ada sesi plaintext aktif yang sah);
  (4) PATCH `/api/users` kini memvalidasi enum status dan menghapus sesi
  target dalam batch yang sama bila akun menjadi non-aktif (sebelumnya sesi
  lama hidup lagi saat akun diaktifkan kembali); (5) pesan error 500 di
  data/users/nisn tidak lagi membocorkan `error.message` mentah — hanya
  pesan rancangan `CollectionDataError`/`RosterDataError` (kelas error baru
  di student-roster) yang diteruskan, sisanya generik + console.error;
  (6) ketua_kelas yang belum `approved` kini hanya membaca data/foto dirinya
  sendiri (sebelumnya membaca presensi & foto sekelas, tidak selaras hak
  tulisnya); (7) upload jalur lampiran thumbnail: ember rate limit sendiri
  30/jam, cap 512 KB, dan tidak lagi menimpa mime foto penuh; (8) CSP
  `default-src 'none'` pada respons JSON API (`_lib/response.ts`).
  TEMUAN TERBUKA (butuh keputusan produk, TIDAK diubah): limit login per-IP
  500/15 mnt masih memungkinkan password spraying lintas akun (menurunkan
  berisiko mengunci login massal satu sekolah di balik NAT); guru dapat
  menulis ulang SELURUH koleksi `modulAjar_v1` termasuk modul guru lain
  (otorisasi level koleksi — perlu desain kepemilikan per rekaman); GET
  `kelas_v1`/`modulAjar_v1` dapat dibaca semua role terautentikasi; foto
  presensi dapat dibaca guru lintas kelas (sesuai desain `canEditClass`,
  belum mengikuti penugasan 0026); bias modulo kecil pada generator password
  awal (entropi ±84 bit, dampak dapat diabaikan); sesi paralel per akun
  belum dibatasi. Terverifikasi aman tanpa perubahan: cookie
  HttpOnly/Secure/SameSite=Strict, token sesi hash SHA-256 TTL 7 hari,
  logout/reset/arsip/ketua mencabut sesi server-side, anti-enumerasi login
  (dummy hash + pesan generik), CSRF Origin untuk semua mutasi ber-cookie,
  tidak ada `dangerouslySetInnerHTML`/`innerHTML` di seluruh repo, unggah
  foto (magic bytes, 2 MB, kuota), token CBT (hash + rate limit + rotasi),
  endpoint AI (role guru+, kuota 20/hari, output tervalidasi skema, kunci
  tidak masuk konteks prompt). Verifikasi: `npm run verify` hijau —
  365 test root + 11 sync-worker, typecheck bersih, build OK. Tanpa migrasi
  (0030 dicadangkan fase berikutnya), tanpa deploy.

- **Migrasi CBT & verifikasi (1 November 2026)**: backup D1 produksi
  `backup-sebelum-0027.sql` dibuat sebelum perubahan dan di-ignore Git. Migrasi
  0027, 0028, dan 0029 telah diterapkan ke D1 remote; verifikasi memastikan tidak
  ada migrasi tertunda dan 2 attempt lama tetap utuh. Node.js 22.23.4 dipakai
  untuk `npm run verify`: lint bersih, 346 test root + 10 test sync-worker lulus,
  typecheck sync-worker bersih, build berhasil. Shebang di
  `scripts/import-data.mjs` dihapus karena Vitest gagal memuat modul `.mjs`
  dengannya; pemakaian yang didokumentasikan tetap melalui `node`. Aplikasi
  dideploy ke Pages setelah verifikasi; deployment `13595f04` berstatus sukses.
  Smoke test deployment: halaman utama tampil dan `/api/health` mengembalikan
  `status: ok`, `db: ok`.

- **Kesehatan repo & poles landing (1 November 2026)**: (1) nama paket
  `react-example` → `smk-at-thahirin` (package.json + lockfile sinkron).
  (2) `xlsx` dipindah dari tarball CDN SheetJS (0.20.3) ke registry npm resmi
  `^0.18.5` — dipakai hanya oleh `scripts/import-data.mjs`; 26 test impor
  lulus tanpa perubahan perilaku. Trade-off disadari: versi registry memang
  tertinggal dari CDN SheetJS, tetapi dapat diaudit & tidak bergantung URL
  eksternal. (3) `.env.example` root ditulis ulang sesuai variabel yang
  benar-benar dibaca kode (sebelumnya sisa template AI Studio); tidak ada
  `.env` ter-commit & tidak ada rahasia tertanam di kode (grep bersih).
  Audit backend: seluruh query D1 terparameterisasi (interpolasi hanya
  placeholder `?` & fragmen tetap dengan `.bind()`), endpoint gateway
  WhatsApp sudah dijaga `X-Gateway-Key`, header keamanan sudah ada di
  `_lib/response.ts` — tidak ada perubahan perilaku backend.
  (4) Landing tanpa gradasi: hero solid `emerald-950` (dekorasi lingkaran
  solid), teks aksen solid, banner solid `emerald-800`, ikon jurusan solid
  (`schoolConfig.color` kini kelas `bg-*`); token baru di `theme.css`:
  `--color-page`/`--color-surface` (latar lembut kehijauan & permukaan kartu)
  dipakai LandingPage; blok `prefers-reduced-motion` global di `index.css`.
  Gradasi di section pasca-login (CBT/Forum/dll) di luar cakupan sesi ini.
  (5) README.md root baru (stack, struktur, lokal, deploy, keamanan).
  Verifikasi: `npm run verify` lulus — tsc bersih, 284 test root + 10
  sync-worker, build OK. Tanpa migrasi D1.

- **Backlog audit batch 2 (24 Agustus 2026 — LIVE bersama batch 1: deploy `fa57a66d`)**:
  (E1) Modal ui/Modal.tsx di-hardening: role="dialog"+aria-modal, Escape menutup,
  focus trap + fokus awal + kembalikan fokus, body scroll-lock, opsi
  closeOnBackdrop={false} — dipakai dialog konfirmasi selesai CBT (anti misklik).
  (E2) Sistem toast non-blocking (ui/toast.tsx: showToast + ToastHost aria-live,
  auto-hilang 5 detik) dipasang di App; alert() diganti toast di alur CBT
  (CbtSection 10, CbtTestRunner 3 — termasuk "waktu habis" yang dulu blocking,
  CbtCreateExamModal 8). Test terkait dimigrasi ke vi.mock modul toast.
  (E3) Code splitting React.lazy untuk 9 section berat; bundle awal JS
  343KB -> ~71KB (-79%), sisanya chunk on-demand per section.
  (E4) strict mode TIDAK diaktifkan: --strict menghasilkan ±5.000 error
  (implicit any lintas komponen lama); butuh refactor bertahap per-komponen.
  Sisa backlog: ganti sisa alert() (Forum/Notifikasi/Kelas/Profil), styled
  confirm modal pengganti window.confirm, dark mode.

- **Backlog audit batch 1 (24 Agustus 2026 — LIVE: deploy `fa57a66d`, backup pra-deploy `/tmp/opencode/backup-pra-batch12-20260824.sql`)**:
  (A) feat(security): cap pesan WA absensi 3/siswa/hari via 1 query GROUP BY;
  rate limit GET 300/menit per user/IP di middleware (health dikecualikan, cleanup
  off di jalur GET — safety net cron purge); penilaian essai anti-gaming: semua kata
  penting kunci (>=3 huruf) wajib ada sebagai kata utuh, kunci pendek cocok token
  utuh, tanda baca tepi dibersihkan (server + client konsisten).
  (B) perf(forum,cbt): N+1 dimatikan — forum 2N+1 -> 3 query; CBT: kelas_v1 sekali
  baca (canTakeExam param preloadedClasses), attempt & jumlah soal batch.
  (C) feat(profil): tombol admin palsu diganti aksi nyata — reset password via API
  (password awal tampil sekali di modal), ekspor rekap CSV nyata (buildCsv RFC4180),
  kartu backup jadi instruksi CLI jujur, log audit /api/users/audit 10 terakhir inline.
  (D) feat(nav): deep-link '#/tab' via pushState/popstate tanpa library router;
  hash tak dikenal fallback landing.
  Fix test flaky lama: fixture AbsensiSection pakai dateWIB() (dulu UTC — gagal saat
  17:00-24:00 UTC). Verifikasi: 284 test + 10 sync-worker + build OK.

- **Hardening sesi audit (23 Agustus 2026 — LIVE: deploy Pages + sync-worker `866ea18f`)**:
  (1) fix(auth): validasi /api/auth/me hanya menghapus sesi saat 401 pasti — error
  jaringan/5xx tidak lagi me-logout user (`shouldClearSessionOnAuthCheck` + test).
  (2) fix .gitignore: `data/` → `/data/` agar functions/api/data tidak terabaikan.
  (3) feat(maintenance): cron purge harian 20:30 WIB di sync-worker — hapus sesi
  kedaluwarsa (dulu tumbuh tanpa batas), rate limit mati, kosongkan blob foto full
  terarsip >24 jam (janji desain 0004); migrasi **0025** photos.data nullable (rebuild);
  hapus ensureLegacyCbt/Forum/NotificationsMigrated dari semua endpoint (query
  domain_migrations per-request tidak diperlukan lagi).
  (4) feat(rbac): penugasan wali kelas berbasis user ID — migrasi **0026**
  teacher_class_assignments (seed k1→Nurul Faizah Ulfah, k2→M. Fachri Sujana [waliKelas
  tertulis 'Fahri', typo], k3→Rudiyatno; seed no-op aman untuk sekolah baru);
  `canEditClassScoped()`: guru dengan ≥1 penugasan dibatasi ke kelasnya, tanpa
  penugasan = perilaku lama; `/api/auth/me` mengirim `classAssignments`; dropdown
  absensi guru ikut membatasi. Verifikasi: 282 test root + 10 sync-worker + build OK;
  migrasi 0026 diterapkan lokal.
  Deploy 23 Agu: backup `/tmp/opencode/backup-pra-0026-20260823.sql` → migrasi remote
  0025+0026 ✅ → deploy Pages ✅ → sync-worker `866ea18f` dengan 3 cron ✅ (catatan:
  API CF menolak day-of-week `0`, harus `SUN`). Smoke test health/situs/401 lulus.
  Sisa tindak lanjut manual: verifikasi UI login guru (dropdown kelas terbatas) +
  perbaiki typo waliKelas k2 "Fahri" → "Fachri" di Manajemen Kelas.
- **Model tulis presensi DELTA (live 23 Agustus 2026)**: `PUT /api/data/presensi_v1` tidak lagi
  DELETE-all + INSERT-all seluruh koleksi. Baru: `writePresensiDelta()` di
  `functions/_lib/relational-data.ts` — hanya rekaman yang berubah di-upsert via
  `ON CONFLICT(tanggal, student_id)`; audit log kini ikut dalam batch atomik yang sama;
  WA notification queue hanya memproses rekaman berubah. Hemat row writes D1 free tier:
  ~2N → C baris (C = jumlah perubahan). Tanpa migrasi baru (PK sudah ada sejak 0018).
  Kontrak API & respons tidak berubah (client tak perlu update). Test: `tests/presensi-delta.test.ts` (5).
  Deploy: commit `f7b2838`, backup D1 pra-deploy `/tmp/opencode/backup-presensi-delta-20260823.sql`,
  smoke test produksi lulus (health ok, situs 200, presensi 401 tanpa auth).
- **Refactor blueprint multi-sekolah (M1–M5, 18 Agustus 2026)**: identitas sekolah
  tersentral di `src/data/schoolConfig.ts`; `npm run generate:site` menghasilkan
  `index.html`/`site.webmanifest`/`robots.txt`/`sitemap.xml` dari config
  (output identik); nama/domain sekolah di UI, functions, dan script dibaca dari
  config/env `wrangler.toml` (`SCHOOL_NAME`, `SCHOOL_EMAIL_DOMAIN`); tema warna
  via `src/theme.css` (`@theme` override palet emerald); aset sekolah di
  `public/school/` (school-mark.svg, icon-192/512, og-*). Rencana: `docs/BLUEPRINT_PLAN.md`
  (M1–M5 selesai; `docs/DEPLOY_SCHOOL.md` panduan deploy sekolah baru).
- **Nama resmi disatukan menjadi "SMK PLUS AT-THAHIRIN"** (18 Agustus): varian
  "SMKS ..." dihapus di semua tempat (config, wrangler.toml, fallback functions,
  template generator, seed, test fixture) + `alternateName` JSON-LD dihapus.
  Domain email tetap `smksplusatthahirin.sch.id` (registrasi, tidak diubah).
- **Deploy live (18 Agustus)**: `npm run pages:deploy` setelah refactor; smoke test
  curl produksi lulus — title/JSON-LD/manifest nama baru, semua aset `/school/*` 200,
  `robots.txt`/`sitemap.xml`/`sw.js`/manifest 200, `/api/health` →
  `{"status":"ok","school":"SMK PLUS AT-THAHIRIN",...}`. Rollback: `git revert <commit>` + redeploy.
- Domain produksi utama: `https://smk-at-tahirin.pages.dev/`.
- Deployment produksi terakhir yang diverifikasi (16 Agustus 2026): fitur **waktu minimal pengerjaan ujian resmi** live (deploy `9476e578`, commit `f7c52ff`); smoke test produksi lulus (409/200, latihan bebas kirim, UI tombol terkunci).
- **Migrasi relasional 0023 live (17 Agustus 2026)**: lapisan tulis `app_data` akademik ditutup — proyeksi relasional jadi sumber kebenaran; trigger sync 0018 di-drop; deploy `3690c8ba`; smoke test e2e produksi **9/9 lulus kembali**; backup D1 pra-migrasi: `/tmp/opencode/d1-backup-0022-20260817-221339.sql`.
- **Hardening D1 0024 live (17 Agustus 2026)**: 8 index tambahan sesuai pola query produksi (deploy `4d624262`); benchmark sintetis 60 ujian × 90 siswa + 27k presensi: rapor NISN 15ms→0.7ms, rekap presensi 31ms→0.3ms, analitik 31ms→11ms, list notifikasi 13ms→1.5ms; uji beban produksi 6 endpoint concurrency 10 semua 200 OK.
- **Deploy 17 Agustus 2026 (dilakukan)**: analitik, PWA offline, template PTS/UAS, `PATCH /api/users/me`, ekspor nilai CBT + rapor siswa — semua live (`5e78e61c` lalu `47968d60`); smoke test produksi lulus (detail di bawah). **Smoke test UI e2e via Playwright 9/9 lulus** (analitik, ekspor nilai, modal kelas, rapor siswa, offline shell + banner). **Ujian simulasi produksi dibersihkan**: `UAS Kearsipan (Simulasi 45 Soal)` (`UAS01`) dan `Latihan Kearsipan (Simulasi 30 Soal)` (`LAT02`) dihapus via DELETE; tersisa `Latihan Kearsipan` permanen (`LATIH01`, aktif 16–30 Agustus) + PTS/Kuis historis. 13 commit sesi sudah di-push ke `origin/main` (`82d4a4c`).
- **D1 remote**: `smk-at-tahirin-db` (`e436d309-e92a-430d-8c48-c47752b3391b`).
- Verifikasi terakhir: `npm run lint` lulus, **271/271 test** lulus (49 file), production build berhasil; migrasi D1 remote sudah sampai `0024` (0023 relasional + 0024 index hardening, deploy `3690c8ba` + `4d624262`).
- Dokumen pelengkap diperbarui 17 Agustus: `assessment-report.html` (271 test, 24 migrasi, migrasi 0023–0024, e2e 9/9 + load test) dan `cbt-simulasi.html` (pembaruan 17 Agu: ujian simulasi dibersihkan, LATIH01 permanen, ekspor CSV + rapor siswa). HEAD: `9bc5b60` (15 commit sesi, semua ter-push).
- Bundle sudah dipisah menjadi chunk aplikasi, React, ikon, motion, dan vendor; warning ukuran bundle utama sudah hilang.
- Migrasi D1 remote sudah diterapkan sampai `0023_close_app_data_academic_writes.sql` (live di produksi 17 Agustus 2026).
- Kesiapan kode integrasi eksternal dinilai A-, tetapi status operasional tetap menunggu deploy, dry-run Google Sync, scan QR WhatsApp, dan canary 7-14 hari.

### Commit Milestone Terbaru

- `1f05422 fix(profil): simpan perubahan nama/email ke server (PATCH /api/users/me) + sinkronisasi roster siswa`
- `b878aed feat(rapor): ekspor nilai CBT ke CSV + rapor siswa (rekap presensi & nilai per mapel, JSON & CSV)`
- `f495bfd feat(cbt): template jadwal PTS/UAS massal 5 hari x 4 mapel — endpoint bulk + modal dengan pratinjau dan token otomatis`
- `1304b00 feat(pwa): service worker offline (shell cached, API tidak pernah di-cache) + banner status offline`
- `84e8a4a feat(cbt): analitik nilai guru — distribusi skor per ujian + deteksi pengerjaan cepat/mencurigakan`
- `d77ef47 docs(prd): finalisasi roadmap dengan prioritas hasil review`
- `0e39e93 docs: dokumentasi project lengkap di docs/ (prd, architecture, design, schema, rules) + AGENTS.md menunjuk ke docs/`
- `76d0336 docs: arsipkan laporan perbaikan lama ke docs/archive, hapus status-report usang`
- `e2decfd docs(cbt): update diagram alur ke simulasi skala besar (UAS 45 soal & latihan 30 soal)`
- `91be39a docs(cbt): simulasi skala besar UAS 45 soal & latihan 30 soal`
- `c6eebbe docs(cbt): catat fitur waktu minimal pengerjaan di laporan simulasi`
- `f7c52ff feat(cbt): waktu minimal pengerjaan ujian resmi (anti jawaban asal-asalan)`
- `53d8c1a feat(cbt): tab "Nilai Saya" untuk siswa — riwayat ujian, skor, benar/salah, detail jawaban (UI-only); diverifikasi e2e di produksi via Playwright`
- `f520861 docs(project): laporan simulasi CBT live 1 guru-1 siswa (diagram alur + hasil nyata)`
- `bd28517 docs(project): update assessment-report.html (statistik, 21 migrasi, 227 test, essai e2e, catatan 1101)`
- `8752339 fix(cbt): akar masalah 1101 — CHECK constraint correct_answer A-E menolak kunci essai; rebuild via migrasi 0021`
- `dcdae6a feat(cbt): soal essai (textarea + kunci otomatis) dan hemat free tier — jawaban simpan di localStorage, sinkron server tiap 10 menit, wajib semua soal terisi sebelum submit`
- `7a59177 feat(cbt): jadwal harian (tab hari ini, jam buka/tutup), auto-save jawaban, dan rekap nilai lintas ujian`
- `11405a8 feat(platform): tuntaskan lifecycle dan integritas domain`

## Perubahan Utama Sesi Ini (1 November 2026) — Perapian Tata Letak Menyeluruh & Penghapusan Gradasi Pasca-Login

Perintah pemilik: perbaiki tata letak kartu ujian CBT (dari screenshot HP nyata) sekaligus rapikan semua tampilan dan maksimalkan kerapian website. Murni presentasi — **tidak ada perubahan perilaku/fitur/API/kontrak data, tidak ada migrasi**. Deploy tetap manual oleh pemilik (`npm run pages:deploy`) — sesi ini tidak men-deploy.

1. **Footer kartu ujian CBT dirancang ulang** (`CbtSection.tsx`) — pemicu: pada kartu yang sekaligus punya status pengerjaan ("Sudah Selesai Dikerjakan" + pil "Nilai") DAN tombol staf, kedua blok dulu berbagi satu baris `justify-between` sehingga saling mendesak (pensil melayang sendirian di kanan atas; "Pantau Ujian"/"Rotasi Token" menumpuk tak sejajar; tinggi tombol tidak seragam). Kini footer berupa tumpukan vertikal `space-y-3`: (a) baris status/nilai selebar penuh tersendiri (`flex-wrap justify-between` — pil nilai tidak lagi melebar penuh di mobile); (b) gugus aksi staf menjadi baris tersendiri di bawahnya dengan **semua tombol seragam `h-9`** (tombol ikon pensil/sampah `h-9 w-9` terpusat, tombol teks `px-3`, ikon `h-4 w-4 shrink-0`), membungkus rapi dengan `gap-2`. Berlaku untuk semua kombinasi keadaan (siswa belum/sudah mengerjakan, staf tanpa/dengan submission) di tab "Hari Ini" maupun "Semua" (komponen kartu yang sama). ID `start-exam-*` dan `cbt-monitor-anchor` tidak berubah. Baris siswa (catatan token + tombol "Kerjakan Ujian") perilakunya sama seperti sebelumnya.
2. **Konsistensi kontainer CBT** — root `CbtSection` kini memakai `py-8` seperti semua section lain (sebelumnya konten CBT menempel langsung ke navbar/footer karena `<main>` tidak memberi padding vertikal).
3. **Gradasi pasca-login dihapus semua** (menuntaskan catatan lama "gradasi tersisa di CBT/Forum/dll") — 11 lokasi diganti warna solid selaras identitas tanpa mengubah makna status: banner header CBT `bg-slate-900` (sebelumnya gradasi slate→emerald-950), banner Forum & Notifikasi `bg-slate-900`, header LoginGate `bg-emerald-800`, tombol generator Modul Ajar `bg-emerald-600 hover:bg-emerald-700`, ubin logo Navbar `bg-emerald-700`, strip banner Profil & kartu admin Profil `bg-slate-900`, header WhatsApp Admin `bg-emerald-950`, batang grafik CbtAnalytics `bg-emerald-500`, header CbtResultReviewModal `bg-emerald-600`. Verifikasi: `grep -i gradient src/` = **0** dan CSS hasil build mengandung **0** `linear-gradient`.
4. **Audit tata letak tampilan lain** — diperiksa satu per satu: LandingPage, LoginGate/LoginForm, AbsensiSection + StudentAbsensiCard, KelasSection, ForumSection, NotifikasiSection, ProfilSection, Navbar, BottomDock, Footer, RaporModal, UserManagementSection, WhatsAppAdminSection, ModulAjarSection, dan komponen `cbt/` lain (MonitorPanel, TestRunner, ResultsTable, GradingQueue, QuestionBank, Analytics, MyResults, modal-modal + `ui/Modal`). Mayoritas sudah rapi dari audit responsif sebelumnya (kontainer `max-w-7xl` + padding konsisten, semua tabel lebar berbalut `overflow-x-auto` dengan `min-w` lokal, teks panjang memakai `truncate`/`break-words`/`min-w-0`) sehingga tidak dibongkar. Satu perbaikan tambahan: baris kendali "Tambah waktu massal" di `CbtMonitorPanel` kini `flex-wrap` agar label panjang + select + tombol tidak mendesak pada layar 320 px.
5. **Verifikasi** — `npm run verify` hijau penuh dari branch akhir: lint/typecheck bersih, **346 test root (56 file) + 10 test sync-worker lulus**, build lulus; tidak ada test yang perlu disesuaikan (tidak ada asersi kelas lama yang dilanggar). Cek overflow: tidak ada browser headless di lingkungan pemeriksa, jadi verifikasi lebar 320/375/768/1366 dilakukan lewat inspeksi kelas sistematis (pola rawan: tabel `min-w` tanpa pembungkus scroll, baris flex tanpa `flex-wrap`, lebar tetap besar, `overflow-x: hidden` global — semuanya bersih) + build & seluruh test komponen lulus; bukan pengukuran `scrollWidth` di browser sungguhan.

## Perubahan Utama Sesi Ini (1 November 2026) — CBT: Ruang Kontrol Ujian (Proctoring Live)

Visi pengguna: proctoring pasif (pencatatan) dinaikkan menjadi ruang kontrol langsung — selama ujian berlangsung pengawas (guru pemilik ujian / admin) standby memantau progres setiap siswa lengkap dengan nilai terakumulasi, dan dapat bertindak. Migrasi baru **0029** (terverifikasi teraplikasi bersih di D1 lokal — **belum diterapkan ke produksi**; antrean migrasi remote kini 0027, 0028, 0029 untuk deploy manual berikutnya sesuai prosedur repo):

1. **Endpoint monitor** — `GET /api/cbt/exams/[id]/monitor` (otorisasi `canManageCbtExam`; guru lain/siswa 403, ujian tak dikenal 404). Satu paket hemat-kueri (soal sekali, attempt sekali, autosave sekali via JOIN, roster sekali — tanpa N+1): ringkasan ujian + hitungan per status + SELURUH roster kelas target (helper baru `getExamRoster` di `functions/_lib/cbt.ts`, logika target yang sama dengan gerbang pembahasan; target `all` = semua kelas; hanya siswa aktif) termasuk siswa **belum mulai**. Per siswa: status attempt (in_progress yang `expires_at`-nya lewat +30 dtk ditampilkan `expired` tanpa menulis di jalur baca), `answeredCount` (autosave terakhir / snapshot submit), persen progres, sisa waktu, aktivitas terakhir, counter proctoring + flag "banyak perpindahan" (tabSwitch ≥ 3, ambang sama dengan analitik), dan **nilai sementara terakumulasi** untuk yang sedang mengerjakan — dihitung SERVER dari jawaban autosave vs kunci PG memakai `scoreCbtAnswers` yang sama dengan penilaian resmi (jawaban tersimpan sebagai kunci asal, jadi konsisten dengan pengacakan; nilai sementara = nilai final bila jawaban tak berubah). Untuk paket warisan ber-esai nilai sementara hanya bagian PG + `hasEssayPending: true`; yang sudah kumpul mengikuti aturan final/pending yang ada. **Kunci & pembahasan tidak pernah ada di respons ini** (ada test regresinya).
2. **Dashboard Ruang Kontrol** — komponen baru `src/components/cbt/CbtMonitorPanel.tsx`, dibuka dari tombol "Pantau Ujian" pada kartu ujian staf. Polling otomatis **15 detik** (jeda saat tab disembunyikan, segarkan manual + penanda "terakhir diperbarui pukul …", tick lokal 1 detik untuk sisa waktu dari snapshot server). Kartu ringkasan (total peserta, sudah kumpul, sedang mengerjakan, belum mulai, perlu perhatian, rata-rata nilai sementara/final), tabel siswa (label status berwarna, bilah progres, nilai sementara/final, ikon counter proctoring, baris terflag menonjol), pencarian nama, keadaan belum mulai/selesai ditangani (panel selesai = rekap cepat). Gaya solid mengikuti komponen CBT yang ada, tanpa gradasi baru, responsif untuk HP operator.
3. **Kendali pengawas + audit (migrasi 0029)** — tabel `cbt_exam_announcements` (pengumuman), `cbt_monitor_actions` (audit: `extend_time`/`force_submit`/`announcement`, satu baris per attempt terdampak), dan kolom `cbt_attempts.submitted_by` (`student` default | `proctor`). Endpoint tunggal `POST /api/cbt/exams/[id]/monitor/actions` (hanya `canManageCbtExam`):
   - **Pengumuman siaran**: teks polos tersanitasi (tag HTML dibuang, whitespace dirapikan), wajib 1–300 karakter; tampil sebagai banner di semua runner aktif sampai ditutup siswa.
   - **Tambah waktu**: +5/+10/+15 menit per attempt berjalan atau "semua yang sedang mengerjakan"; memperpanjang `expires_at`; runner mengetahui batas baru via kanal notices.
   - **Paksa kumpul**: attempt berjalan diselesaikan SEKARANG dari jawaban autosave terakhir (fallback snapshot attempt) lewat **`finalizeCbtAttempt`** — jalur finalisasi bersama BARU di `functions/_lib/cbt.ts` yang kini juga dipakai endpoint submit siswa (perilaku submit tidak berubah: PG dinilai otomatis, esai warisan → `pending_grading`, tanpa esai → final). Aturan waktu-minimal-kirim **diabaikan** (wewenang pengawas), attempt yang jendelanya sudah expired **ditolak 409**. Penanda "oleh pengawas" tampil di monitor, tabel hasil guru (`submittedBy` kini ikut di `GET /api/cbt/results`), dan notices siswa. UI mewajibkan dialog konfirmasi dengan nama siswa tertulis + centang keyakinan.
4. **Sisi runner siswa** — `CbtTestRunner` memeriksa kanal ringan `GET /api/cbt/attempts/[id]/notices` (hanya siswa pemilik attempt; siswa lain 404, guru 403) tiap **30 detik** selama attempt berjalan (polling pertama setelah satu interval agar membuka runner tidak menambah request): pengumuman aktif ujian (banner kuning mencolok; ditutup siswa → tidak muncul lagi di sesi itu), `expiresAt` server terkini (timer menyesuaikan + toast sopan "Waktu ditambah pengawas (+N menit)"), dan status paksa-kumpul (runner berhenti rapi ke layar selesai "Ujian Telah Dikumpulkan oleh Pengawas" lalu menyerahkan ke alur hasil biasa — submit server idempoten sehingga tidak ada pengiriman ganda). Alur autosave/submit yang ada tidak diubah selain penyesuaian timer ini + guard `finishedRef` agar tak ada simpan/kirim setelah attempt ditutup pengawas.

Test: `tests/cbt-monitor.test.ts` baru (18 test, D1 SQLite nyata dengan seluruh rantai migrasi 0001–0029: otorisasi monitor & aksi, roster memuat belum-mulai & mengecualikan kelas lain/nonaktif, progres & nilai sementara dari autosave, respons bebas kunci, esai warisan PG-saja + pending, tambah waktu + audit, paksa kumpul = nilai final & penanda pengawas & abaikan min-submit & tolak expired, pengumuman tersanitasi/teraudit/terkirim & terisolasi antar-ujian, notices hanya pemilik) + `tests/CbtTestRunnerNotices.test.tsx` baru (3 test: banner pengumuman & dismiss, timer menyesuaikan + toast tambah waktu, paksa kumpul → layar selesai). `npm run verify` hijau penuh (lihat "Verifikasi Terakhir").

**Deploy tetap manual oleh pemilik** (`npm run pages:deploy`) sesuai aturan repo — sesi ini tidak men-deploy dan tidak menerapkan migrasi ke D1 produksi.

## Perubahan Utama Sesi Ini (1 November 2026) — CBT: Penonaktifan Pembuatan Soal Esai

Keputusan pengguna: demi keamanan proses penilaian & kesederhanaan alur aplikasi, **soal esai tidak boleh dibuat lagi** — CBT ke depan fokus pilihan ganda. Cakupan penutupan: SEMUA jalur pembuatan. Paket warisan yang sudah terlanjur berisi esai **tetap didukung penuh sampai selesai masa pakainya** (tetap dapat dijalankan siswa, dikoreksi manual guru lewat antrean Koreksi Esai, masuk alur pending→final, tampil di review bergate/ekspor/rapor). Tidak ada migrasi dan tidak ada penghapusan data.

1. **Validasi server** — helper baru `findEssayCreationViolation(questions, storedQuestions?)` + pesan `ESSAY_CREATE_MESSAGE`/`ESSAY_LEGACY_EDIT_MESSAGE` di `functions/_lib/cbt.ts`. Validasi struktural esai di `validateCbtQuestions` SENGAJA dipertahankan (payload edit paket warisan melewatinya); penolakan pembuatan ditegakkan di lapisan API:
   - `POST /api/cbt/exams`: payload berisi esai apa pun → 400 "Soal esai tidak lagi dapat dibuat; gunakan pilihan ganda."
   - `PATCH /api/cbt/exams` (paket belum mulai): esai payload dicocokkan dengan soal tersimpan — id cocok DAN teks/kunci/pembahasan persis sama → diterima apa adanya; id baru → 400 pesan pembuatan; isi diubah → 400 "Soal esai warisan tidak dapat diubah; hanya dapat dihapus dari paket." Menghapus esai dari payload tetap diperbolehkan.
   - Bank (`functions/api/cbt/bank`): POST/PATCH bertipe esai → 400; PATCH pada baris bank esai warisan → 400 (baris warisan hanya dapat dihapus).
2. **UI pembuat ujian** (`CbtCreateExamModal`) — tombol "Tambahkan Essai" dihapus. Saat mengedit paket warisan, soal esai tampil sebagai kartu hanya-baca berpenanda "Esai (warisan — tidak dapat dibuat baru)" (teks + kunci ditampilkan, tanpa kolom ubah, tanpa tombol Simpan ke Bank) dan hanya bisa dihapus. "Simpan Semua ke Bank" kini hanya mengirim soal PG.
3. **UI bank soal** — form tambah/edit hanya PG (pemilih tipe dihilangkan). Baris esai warisan tampil dengan lencana "Esai (warisan)" + catatan, tanpa tombol edit (hapus tetap ada). `CbtBankPicker` ("Ambil dari Bank Soal") mengecualikan esai warisan dari daftar yang dapat dicentang, dengan catatan jumlah yang disembunyikan.
4. **Generator AI** (`functions/api/cbt/generate.ts`) — prompt dipertegas (semua soal wajib `type: "pg"`, esai dilarang eksplisit); `validateGeneratedCbt` kini MEMBUANG keluaran non-PG dari model sebelum validasi jumlah — esai tidak pernah lolos ke paket (PG kurang dari jumlah diminta → 502 seperti sebelumnya).
5. **Test** — file baru `tests/cbt-essay-disabled.test.ts` (12 test: POST ujian esai ditolak & PG murni diterima; PATCH warisan: dipertahankan→200, teks/kunci diubah→400, esai id baru→400, dihapus→200; bank: POST esai→400, PATCH baris warisan→400, PATCH PG→esai→400; generator: campuran esai dibuang, PG kurang→null). `tests/CbtCreateExamModal.test.tsx`: test pembuatan esai via UI DIGANTI test penanda warisan (hanya-baca, dipertahankan saat simpan, dapat dihapus) + test tombol tambah esai sudah tidak ada (5→7 test). Data esai pada test pengerjaan/koreksi warisan memang sudah disemai langsung di lapisan data (mock DB/runner props), bukan lewat jalur pembuatan — tidak ada asersi yang dilemahkan. Lihat "Verifikasi Terakhir" untuk angka final.

**Deploy tetap manual oleh pemilik** (`npm run pages:deploy`) sesuai aturan repo — sesi ini tidak men-deploy; tidak ada migrasi baru pada sesi ini.

## Perubahan Utama Sesi Ini (1 November 2026) — CBT: Pengacakan, Koreksi Esai Manual, Pembahasan, Proctoring, Bank Soal

Lima pengembangan CBT dalam satu branch `feat/cbt-shuffle-esai-proctor-bank` (migrasi baru **0027** & **0028**; keduanya terverifikasi teraplikasi bersih di D1 lokal — **belum diterapkan ke produksi**; jalankan sebagai bagian dari deploy manual berikutnya sesuai prosedur repo):

1. **Pengacakan soal & opsi per siswa** — setiap attempt baru menyimpan `shuffle_seed` acak (kolom 0027). Soal & opsi PG disajikan teracak deterministik dari seed (mulberry32 + Fisher-Yates di `functions/_lib/cbt.ts`); setiap opsi membawa `originalKey`, jawaban siswa selalu disimpan sebagai kunci asal sehingga **penilaian server tidak berubah**. Resume menghasilkan urutan yang sama persis; review staf memakai urutan asli; attempt lama (seed NULL) tetap urutan asli. Kunci/pembahasan tidak pernah dikirim selama attempt berjalan.
2. **Penilaian baru: PG otomatis, esai manual guru** — skor resmi saat submit kini **hanya dari PG** (`scoreCbtAnswers` ditulis ulang; `correct_count`/`wrong_count` khusus PG). Penilaian esai otomatis (`isEssayAnswerCorrect`) **dihentikan untuk skor resmi** dan hanya tampil sebagai *petunjuk kata kunci non-mengikat* ("petunjuk, bukan nilai") di layar koreksi guru. Bobot per soal tetap 100 ÷ total soal; guru memberi nilai esai 0 s.d. bobot soal itu (1 desimal) + catatan opsional per soal lewat endpoint baru `GET/POST /api/cbt/attempts/[id]/grade` (otorisasi `canManageCbtExam`) dan antrean `GET /api/cbt/grading`. Status: paket tanpa esai → langsung final; ada esai belum lengkap → `grading_status='pending_grading'` (skor tampil = `pg_score` sementara, terlabel "Esai menunggu koreksi guru"); lengkap → `graded`, `score` = PG + total esai. Attempt lama (`grading_status` NULL) dianggap final. **Rapor/summary/analitik/ekspor hanya memakai nilai final** — attempt pending tidak masuk rapor sama sekali sampai final (pilihan aman agar nilai rapor lama tidak berubah). Ekspor CSV menambah kolom Skor PG & Status Koreksi.
3. **Pembahasan siswa dengan gerbang seluruh-peserta-selesai** — endpoint baru `GET /api/cbt/attempts/[id]/review` mengirim kunci + `explanation` per soal hanya untuk attempt **milik siswa sendiri yang sudah submitted**, DAN hanya setelah gerbang terbuka (`isCbtReviewUnlocked`): (a) jendela ujian berakhir (status efektif `completed`, atau `close_time` pada `end_date` sudah lewat) — attempt tak tersubmit tidak menahan; atau (b) semua siswa aktif di kelas target (target "Semua Kelas"/`all` = semua kelas) sudah submit/expired dan tak ada attempt `in_progress` yang masih hidup (in_progress yang `expires_at`-nya lewat diperlakukan expired). Selama terkunci server **tidak mengirim data per soal sama sekali** — respons hanya ringkasan hasil siswa + `reviewLocked: 'waiting_all_students'`, dan UI menampilkan pesan "Pembahasan dibuka setelah semua peserta menyelesaikan ujian". Aturan yang sama berlaku untuk paket **latihan** maupun ujian resmi (keseragaman anti-bocor). Selama attempt masih berjalan endpoint menolak (403) — tidak ada kebocoran kunci.
4. **Proctoring web (pencatatan + peringatan ramah, TANPA sanksi otomatis)** — runner meminta layar penuh saat mulai (dengan tombol masuk lagi + banner peringatan bila keluar), mencatat pindah tab (`visibilitychange`), blur jendela, dan keluar layar penuh lewat `POST /api/cbt/attempts/[id]/proctor` (agregat counter di `proctor_events_json`), mencegah copy/cut/contextmenu di area runner, dan memberi tahu siswa hitungan perpindahannya dengan bahasa tenang. **Tidak ada auto-submit/auto-gagal** karena pelanggaran; guru melihat ringkasan proctoring di tabel hasil dan flag analitik "banyak perpindahan" (pindah tab ≥ 3) sebagai bahan pertimbangan, bukan vonis. Proctoring kamera di luar cakupan.
5. **Bank soal** — tabel baru `cbt_question_bank` (0028): soal per guru (admin/super_admin semua) dengan CRUD `functions/api/cbt/bank` (validasi memakai ulang `validateCbtQuestions`), UI tab "Bank Soal" (cari + filter mapel), dan integrasi di pembuat ujian: "Ambil dari Bank Soal" (multi-centang) + "Simpan ke Bank" per soal/semua soal. Penyalinan bersifat **snapshot** — mengubah bank tidak mengubah ujian yang sudah dibuat.

Test: file baru `tests/cbt-shuffle-grading-bank.test.ts` (27 test: shuffle deterministik & pemetaan originalKey, skor PG-saja + alur pending→final + otorisasi koreksi, gerbang pembahasan (terkunci bila ada yang belum selesai / terbuka bila semua selesai / terbuka saat jendela berakhir & attempt menggantung lewat expires_at), proctoring, bank CRUD & kepemilikan); test lama yang menegaskan penilaian esai otomatis diperbarui ke semantik baru. `npm run verify` hijau penuh (lihat "Verifikasi Terakhir").

**Deploy tetap manual oleh pemilik** (`npm run pages:deploy`) sesuai aturan repo — sesi ini tidak men-deploy dan tidak menerapkan migrasi ke D1 produksi.

## Perubahan Utama Sesi Ini (17 Agustus 2026)

### Analitik Nilai Guru

- `GET /api/cbt/analytics` (staff: guru/admin/super_admin; guru hanya ujian miliknya, 403 untuk siswa): distribusi skor 6 bucket (0–49 s.d. 90–100), rata-rata, jumlah siswa, dan daftar flag pengerjaan mencurigakan.
- Deteksi: `FAST_RATIO=0.25` — jawaban dikirim dalam ≤25% durasi; `SUSPICIOUS_SCORE=75` — cepat + skor ≥75 (indikasi kerja sama/kunci, bukan vonis).
- UI `src/components/cbt/CbtAnalytics.tsx` (bar chart CSS, kartu ujian, tabel flag yang bisa di-expand) dibuka dari tombol `btn-open-analytics` di `CbtSection`.
- Test: `tests/cbt-analytics-api.test.ts` (4) + `tests/CbtAnalytics.test.tsx` (4).

### Service Worker + Offline Mode (PWA)

- `public/sw.js`: cache `smk-at-tahirin-v1`; precache `/`, manifest, ikon; **respons API (`/api/`) tidak pernah di-cache** (sesi/privasi aman); navigasi network-first dengan fallback `caches.match('/')`; `/assets/` & `/images/` stale-while-revalidate; `skipWaiting` + `clients.claim`.
- Registrasi di `src/main.tsx` hanya saat `import.meta.env.PROD` (dev tidak terganggu); `src/vite-env.d.ts` ditambah agar tsc mengenali `import.meta.env`.
- Banner amber "Anda sedang offline" di `src/App.tsx` via listener `online`/`offline`.
- Test: `tests/pwa-offline.test.ts` (4).

### Template Jadwal PTS/UAS Massal (5 Hari × 4 Mapel)

- `POST /api/cbt/exams/bulk` (staff): sekali submit menghasilkan 20 ujian (5 hari kerja dari `startDate`, melewati Sabtu/Minggu; 4 mapel per hari). Validasi: title ≤200, 1–8 mapel (name ≤150, teacher ≤100), durasi 1–300 menit, `openTime` HH:MM, jeda antar sesi 0–180 menit, `classTarget` valid.
- Sesi beruntun: jam buka sesi berikutnya = tutup sesi sebelumnya + jeda; token 8 karakter uppercase otomatis per ujian; `exam_type='ujian'` (terkena min-submit 80%); status `upcoming`/`active` vs `todayWIB()`; insert D1 batch.
- Helper diekspor untuk test: `weekdaysFrom`, `dayNameOf`, `addMinutesToTime`. `validClassTarget` diekspor dari `functions/api/cbt/exams/index.ts`.
- UI `src/components/cbt/CbtBulkScheduleModal.tsx`: form + pratinjau grid 5×4 + tabel hasil dengan token & tombol salin semua; tombol `btn-open-bulk-schedule` "Jadwal PTS/UAS Massal" di `CbtSection`.
- Bug yang diperbaiki selama pengerjaan: `await` di dalam callback `forEach` non-async (transform error vitest) → diganti `for...of`; test mengoreksi ekspektasi sesi ke-4 (07:30 + 3×105 mnt = 12:45–14:15).
- Test: `tests/cbt-bulk-schedule.test.ts` (6) + `tests/CbtBulkScheduleModal.test.tsx` (3).

### Perbaikan: Simpan Profil Sendiri ke Server (bug nyata lama)

- Sebelumnya tombol "Edit Informasi" di Profil hanya memutasi objek `currentUser` (state React) tanpa menyimpan ke mana pun — hilang saat reload, dan nama di roster tidak pernah berubah.
- Endpoint baru `PATCH /api/users/me`: autentikasi wajib; validasi nama 1–100 & format email; cek email duplikat (409); untuk siswa/ketua_kelas yang mengganti nama, roster `siswa_v1` ikut disinkronkan (`replaceStudentStatement`) dalam satu `DB.batch`.
- Frontend: `handleSaveProfile` async dengan loading state, pesan error di modal, dan callback `onProfileUpdated` di `App.tsx` yang memperbarui sesi (nama/email tampil seketika di navbar/profil).
- Test: `tests/users-me.test.ts` (6).

### Ekspor Nilai CBT + Rapor Siswa

- `GET /api/cbt/export/scores` (staff; guru hanya ujian miliknya): CSV nilai CBT — NISN, nama, tanggal kirim, ujian, mapel, jenis, skor, benar, salah, waktu. Tombol "Ekspor Nilai (CSV)" (`btn-export-cbt-scores`) di `CbtSection`.
- `GET /api/rapor/:nisn` (JSON) dan `?format=csv`: identitas siswa (dari `students` + `school_classes`), rekap presensi per status (Hadir/Terlambat/Sakit/Izin/Alpa + % kehadiran), rekap nilai CBT per mapel (jumlah ujian, rata-rata, terbaik), dan riwayat 50 ujian terakhir. Akses: staff semua; siswa/ketua_kelas hanya dirinya; ketua_kelas approved boleh siswa sekelasnya; NISN divalidasi (4–20 digit).
- UI: `src/components/RaporModal.tsx` — dibuka dari tombol dokumen rapor di kartu siswa (modal detail kelas) dan tombol "Rapor Saya" (`btn-open-rapor-saya`) di ProfilSection untuk siswa/ketua_kelas; tombol "Unduh Rapor (CSV)".
- Helper baru `functions/_lib/csv.ts` (`toCsv`, `csvEscape`, `csvResponse`) + `src/utils/download.ts` (`downloadCsv` via blob).
- Catatan: ekspor presensi TIDAK dibuat server-side — AbsensiSection sudah punya "Export Excel/CSV" client-side; endpoint `attendance/export` yang sempat dibuat dihapus (hindari duplikasi fitur).
- Test: `tests/rapor-export.test.ts` (7) — scope per role, escaping, format CSV.
- **Deploy 17 Agustus (kedua)**: rapor + ekspor live (`47968d60`). Smoke test produksi: rapor siswa GHINA NAILA `0082219950` JSON+CSV benar (kelas X MPLB 1, 1 ujian, rata-rata 67), rapor siswa lain 403, endpoint baru 401 tanpa auth.

### Smoke Test UI e2e (Playwright) + Pembersihan Ujian Simulasi

- **9/9 lulus** di produksi (`/tmp/opencode/e2e_smoke.py`): analitik panel terbuka (`#btn-open-analytics`), ekspor nilai CSV terunduh (`nilai-cbt-2026-08-17.csv`), modal kelas dibuka via tombol **"Siswa & Roster"** (klik teks nama kelas TIDAK membuka modal — tombol yang punya `onClick`), tombol rapor siswa ada, rapor modal terbuka + CSV terunduh (`rapor-0082219950.csv`), SW mengontrol halaman, banner offline muncul, rapor siswa ("Rapor Saya") terbuka dari Profil.
- Temuan teknis e2e: (1) klik dock navigasi harus pakai `:visible` — `#dock-nav-profil` match 2 elemen (baris mobile `sm:hidden` + desktop `hidden sm:contents`) dan `.first` adalah yang tersembunyi; (2) offline reload hanya bekerja setelah cache di-warm (reload online kedua) — asset JS/CSS masuk cache saat SW sudah mengontrol; (3) di Chromium headless `navigator.onLine` tidak berubah oleh `set_offline` — emulasi via `add_init_script` `Object.defineProperty(navigator,'onLine',{get:()=>false})`; shell tetap termuat dari cache saat jaringan mati (body tampil, `ERR_INTERNET_DISCONNECTED` di console).
- **Pembersihan produksi**: `DELETE /api/cbt/exams` sukses untuk `UAS Kearsipan (Simulasi 45 Soal)` dan `Latihan Kearsipan (Simulasi 30 Soal)` (keduanya `completed`, endDate 16 Agustus). Ujian yang tersisa: `Latihan Kearsipan` permanen (`LATIH01`, aktif 16–30 Agustus, punya attempt GHINA 67), `PTS Kearsipan Digital` (historis, attempt Ir. Suranto), `Kuis Harian Korespondensi` (historis).

### Migrasi Penuh Relasional (0023) — Tutup Lapisan Tulis `app_data` Akademik

- **Keputusan** (dengan pemilik project): lanjut "migrasi penuh relasional" — 4 koleksi akademik (`kelas_v1`, `siswa_v1`, `presensi_v1`, `modulAjar_v1`) kini ditulis **langsung ke proyeksi relasional**; `app_data` menjadi **mirror/arsip** (tetap ditulis atomik di batch yang sama agar pembaca legacy — `GET /api/data/:key`, WhatsApp contacts, forum, notifikasi, foto siswa — tidak rusak). Menghapus 4 kelas risiko crash/error: 500 "Projection tidak sinkron", trigger presensi destruktif (satu rekaman FK-broken menggagalkan semua simpan presensi), tulis roster via manipulasi string + validasi ketat, dan JSON app_data korup tersembunyi.
- **Migrasi `0023_close_app_data_academic_writes.sql`**: re-sync akhir (urutan hormat FK: kelas → jadwal → siswa → presensi → modul; presensi lewati siswa yatim via `EXISTS`) lalu `DROP TRIGGER IF EXISTS` 8 trigger (`sync_kelas_projection_*`, `sync_siswa_projection_*`, `sync_presensi_projection_*`, `sync_modules_projection_*`). Trigger yang tersisa hanya proteksi soal CBT (0015/0021).
- **`functions/_lib/relational-data.ts` ditulis ulang**: `writeRelationalCollection` = batch atomik [guard CAS opsional, replace proyeksi, mirror upsert `app_data`, bump revision]; `readRelationalCollection` baca proyeksi saja bila `initialized=1` (tanpa komparasi JSON → error desync hilang), fallback `app_data` untuk deploy pra-0023. **Guard CAS baru**: `INSERT INTO academic_collection_revisions SELECT ?1,-1,0,... WHERE (SELECT revision ... WHERE key=?1) IS NOT ?2` — revisi berubah → insert `revision=-1` melanggar `CHECK (revision >= 0)` → batch rollback atomik → 409. (`RAISE()` tidak valid di luar trigger di node:sqlite/D1.) **FK pre-check** `ensureReferencedIdsExist`: siswa → `class_id` harus ada di `school_classes`, presensi → `student_id` harus ada di `students` (lempar `CollectionDataError`, pre-0023 di-swallow).
- **`functions/_lib/student-roster.ts`**: `saveCollectionStatement`/`appendStudentStatement`/`replaceStudentStatement`/`removeStudentStatement` dihapus → satu `rosterReplaceStatements(db, roster)` = 4 statement (UPDATE `students` active=0; INSERT dari `json_each(?)` ON CONFLICT active=1; mirror `app_data('siswa_v1',...)`; bump revision). Call site diperbarui: `users/index.ts` (POST/PATCH), `users/nisn.ts`, `users/me/index.ts` (hanya bila JSON roster berubah).
- **`scripts/import-data.mjs`**: `siswaSql`/`kelasSql` kini emit mirror + proyeksi + revision (siswa & kelas + jadwal), bukan lagi mengandalkan trigger.
- **Test**: 271/271 lulus (49 file; +2 test baru di `relational-academic-data.test.ts`: lapisan tertutup + tulis-dua-lapisan + mirror korup tak merusak baca + FK guard). Mock `TestD1Database` kini menerapkan 0023 dan punya `batch()` (transactional); mock `makeDb` user-management/`users-me` menangani statement tanpa `.bind()` dan bentuk batch baru (6 statement siswa-create, 5 pada users-me).
- **Deploy & verifikasi**: migrasi diterapkan lokal + remote (backup `/tmp/opencode/d1-backup-0022-20260817-221339.sql`); deploy `3690c8ba`; konsistensi remote: 87 siswa / 3 kelas / 1 modul / 4 mirror / 4 revisi, trigger tersisa hanya 3 CBT; **e2e Playwright produksi 9/9 lulus kembali** (analitik, ekspor nilai, modal kelas, rapor siswa, PWA offline, banner).

### Uji Beban & Hardening D1 (0024) — 8 Index Sesuai Pola Query

- **Analisis pola query** (fungsi vs index): hotspot = 4 query hasil/analitik/ekspor CBT filter `status='submitted'` + sort `submitted_at` (full scan `cbt_attempts`), rapor per NISN (2× `cbt_attempts.nisn` + 1× `attendance_records.nisn` tanpa index), dan `hasHistoricalReferences` saat hapus user permanen (5 subquery EXISTS tanpa index).
- **Migrasi `0024_d1_index_hardening.sql`** (8 index, semua `IF NOT EXISTS`): `idx_cbt_attempts_status_submitted (status, submitted_at DESC)`, `idx_cbt_attempts_nisn (nisn, status, submitted_at DESC)`, `idx_attendance_nisn (nisn, status, tanggal)`, `idx_cbt_exams_teacher (teacher_user_id)`, `idx_forum_topics_author`, `idx_forum_replies_author`, `idx_notifications_sender (sender_user_id, created_at DESC)`, `idx_wa_outbox_teacher (teacher_user_id)`.
- **Benchmark sintetis** (node:sqlite, 5.4k attempts / 27k presensi / 5k notif): query hasil 183→114ms (SELECT * masih baca ribuan baris), analitik 31→10.6ms, rapor NISN 15.4→0.7ms, rekap presensi 30.6→0.3ms, notif sender 12.9→1.5ms.
- **Uji beban produksi** (Playwright login admin + request API, `/tmp/opencode/loadtest.py`): 6 endpoint (`/api/cbt/results`, `/analytics`, `/exams`, `/api/rapor/0082219950`, `/cbt/export/scores`, `/notifications`) — concurrency 10 semuanya 200 OK; seq med 141–539ms, conc10 max 4.1s (cold start Cloudflare).
- **Diterapkan**: lokal + remote (backup `/tmp/opencode/d1-backup-0023-20260817-224012.sql`), 8 index terverifikasi di remote, deploy `4d624262`. Monitor D1 usage dashboard via Cloudflare dashboard (tidak ada CLI metric).

## Perubahan Utama Sesi Sebelumnya

### Waktu Minimal Pengerjaan (Anti Jawaban Asal-Asalan) — Live

- **2 jenis ujian**: `exam_type` `latihan` (ulangan harian/kuis, bebas kirim kapan saja) vs `ujian` (UAS/UTS/PTS, submit ditahan sampai waktu minimal). Kolom baru di `cbt_exams`: `exam_type` (default `'latihan'`) dan `min_submit_minutes` (default 80% durasi via `resolveMinSubmitSeconds`, dibatasi ≤ durasi).
- **Enforce 2 lapis**: server `submit.ts` menolak 409 `Ujian resmi belum boleh dikirim. Minimal pengerjaan X menit; tunggu sekitar Y menit lagi.` (tidak bisa di-bypass browser); frontend `CbtTestRunner` men-disable tombol kirim + countdown `Kirim dibuka dalam MM:SS` + pill di kartu soal terakhir.
- **UI guru** (`CbtCreateExamModal`): select "Jenis Ujian" + input "Waktu Minimal Kirim (menit)" (diset otomatis 80% saat pilih ujian resmi, validasi 1..durasi); badge kartu ujian `Ujian Resmi · min. kirim X mnt` vs `Latihan` di `CbtSection`.
- **API**: GET `exams` dan POST `exams/[id]/attempts` mengembalikan `examType`/`minSubmitMinutes`. PATCH/POST `exams` menyimpan kedua kolom.
- **Migrasi**: `0022_cbt_exam_type.sql` (2 ALTER TABLE) — sudah diterapkan lokal + remote (backup `/tmp/opencode/backup-produksi-cbt-0022-20260816-142040.sql`).
- **Bug ditemukan saat smoke test**: `attempts.ts` awalnya tidak meneruskan `exam_type` ke runner → tombol tidak terkunci; diperbaiki dan diverifikasi Playwright produksi (tombol `Kirim dibuka dalam 02:30` disabled).
- **Test**: 235/235 lulus; 13 test baru (`tests/cbt-min-submit.test.ts` + runner + modal).
- Catatan: ujian latihan/permanen lama tanpa `exam_type` dianggap latihan (kompatibel).

### Tab "Nilai Saya" untuk Siswa

- `src/components/cbt/CbtMyResults.tsx`: tabel riwayat nilai siswa (ujian, skor, benar/salah, tanggal) + modal detail jawaban; tab hanya muncul untuk siswa di `CbtSection`.
- `tests/CbtMyResults.test.tsx` (3 test). Verifikasi Playwright produksi: login siswa GHINA NAILA (NISN `0082219950`, password = NISN), tabel menampilkan Latihan Kearsipan 67/100 (2 benar, 1 salah), modal detail terbuka; akun guru tidak terpengaruh.

### Akar Masalah Error 1101 (Essai) — Selesai

- Penyebab: CHECK constraint `correct_answer IN ('A','B','C','D','E')` dari migrasi 0010 menolak kunci jawaban teks essai → `SQLITE_CONSTRAINT` → Worker 1101.
- Fix: `0021_cbt_questions_no_check.sql` rebuild `cbt_questions` tanpa CHECK + restore index & trigger `prevent_cbt_question_*`. Live lokal + remote (backup `/tmp/opencode/backup-produksi-cbt-0021.sql`); POST essai 201, E2E skor 100.

### Simulasi Skala Besar di Produksi (Laporan: `cbt-simulasi.html`)

- **UAS Kearsipan (Simulasi 45 Soal)** — aktif di produksi: `examType` ujian, 45 soal (40 PG + 5 essai), durasi 90 menit, min. kirim 30 menit, token `UAS01`.
- **Latihan Kearsipan (Simulasi 30 Soal)** — aktif: `examType` latihan, 30 soal (25 PG + 5 essai), durasi 60 menit, token `LAT02`. Konten soal berbeda dari UAS.
- Simulasi nyata: siswa GHINA NAILA mengerjakan 45 soal → submit awal ditolak **409** → setelah min berlalu **200 skor 100** (45/45 benar, pengerjaan 2.117 detik); latihan 30 soal submit instan **200 skor 100**. Attempt simulasi dibersihkan (rekap guru bersih); ujian dibiarkan aktif atas persetujuan user.
- `cbt-simulasi.html`: kartu hasil simulasi pertama (3 soal, skor 67), kartu "Waktu Minimal Pengerjaan", kartu "Simulasi Skala Besar", dan diagram alur sudah diupdate ke skala besar (step 1 = 2 ujian, step 5 = min-submit).
- **PERHATIAN**: `cbt-simulasi.html` pernah ditimpa dari luar sesi (isi versi lama + teks `saa` nyangkut di `<head>`, format prettier). Diduga editor dengan prettier-on-save menimpa dari salinan lama. Sudah direstore via `git checkout`. Jangan simpan file ini dari editor yang masih membuka versi lama.

### Fitur CBT untuk Ujian 5 Hari × 4 Mapel

- **Jadwal per hari**: siswa melihat tab `Hari Ini` (ujian yang aktif hari itu) dan `Semua`; chip tanggal per hari; kartu menampilkan jadwal tanggal dan jam ujian.
- **Jam buka/tutup ujian**: guru dapat mengisi `open_time`/`close_time` (HH:MM WIB) per ujian di `CbtCreateExamModal`; validasi format dan `close > open`. Server menolak mulai attempt di luar jam (403 dengan alasan eksplisit); tombol `Kerjakan Ujian` dinonaktifkan di luar jam dengan label jam.
- **Auto-save jawaban**: tabel `cbt_attempt_answers` (PK `attempt_id`, FK ON DELETE CASCADE) + endpoint `POST /api/cbt/attempts/:id/save` (siswa, attempt miliknya, status `in_progress`, grace 30 detik dari `expires_at`, validasi soal/opsi). Runner menyimpan debounce 1,5 detik + flush saat `pagehide`/`beforeunload` + sebelum submit, dengan indikator Tersimpan/Menyimpan/Gagal. Jawaban tersimpan dikembalikan saat resume attempt.
- **Rekap nilai lintas ujian**: `GET /api/cbt/summary` agregat `examCount/avgScore/bestScore/worstScore` per siswa; scope admin semua, guru ujian miliknya, siswa miliknya; tabel `Rekap Nilai Siswa (Lintas Ujian)` di CbtSection.
- Fix bug: bind query summary untuk siswa/guru memakai spread argumen (tidak lagi mengirim `undefined` yang menyebabkan error 1101 di produksi); test scope siswa/guru ditambahkan.

### Lanjutan Audit Domain

- Migrasi data legacy CBT, forum, dan notifikasi kini memakai marker idempotent, bukan asumsi tabel target kosong. POST pertama tidak lagi dapat menyebabkan data legacy terlewat permanen.
- Guru hanya dapat melihat kunci soal dan hasil CBT untuk ujian miliknya. Admin dan Super Admin tetap memiliki akses pengawasan global.
- Attempt CBT yang sudah kedaluwarsa ditutup dengan respons eksplisit dan tidak lagi membuka runner dalam keadaan macet.
- Hapus permanen pengguna kini memeriksa histori CBT, forum, notifikasi, dan WhatsApp serta membersihkan relasi read/like/setting yang tidak bersifat historis.
- Test ownership CBT ditambahkan.

### UI Responsif

- Audit dan perbaikan overflow mencakup Profil, CBT, Absensi, Kelas, Modul Ajar, Forum, Notifikasi, Footer, serta modal terkait.
- Email profil panjang memakai wrapping eksplisit; row label/nilai menjadi bertumpuk pada mobile dan kembali sejajar pada breakpoint yang cukup.
- Header runner CBT dipadatkan pada 320 px; label aksi sekunder disembunyikan pada mobile tanpa menghilangkan tombolnya.
- Tabel lebar memakai scroll lokal; grup tombol, filter tanggal, pagination, badge dinamis, dan konten pengguna dapat wrap.
- Jadwal siswa memakai kartu pada mobile dan tabel pada desktop; form Modul Ajar menjadi satu kolom pada mobile.
- Dock mobile memakai menu utama + tombol `Lainnya`, sehingga role dengan banyak menu tidak membuat document overflow.
- Global `overflow-x: hidden` di `src/index.css` telah dihapus agar bug overflow tidak disembunyikan.
- Verifikasi browser pada 320, 375, 768, dan 1366 px menghasilkan `scrollWidth === clientWidth`.

### Navigasi Publik dan Login

- Sebelum login, landing page tampil langsung dari hero tanpa navbar atas dan tanpa bottom dock.
- Hero guest memiliki CTA utama `Masuk Portal` berikon `LogIn`; pada mobile tombol login memenuhi satu baris dan CBT/Absensi berada pada dua kolom di bawahnya.
- Setelah login, navbar atas dan bottom dock tampil di semua halaman, termasuk Beranda.
- Logout mengembalikan pengguna ke landing publik dan langsung menghilangkan kedua navigasi.
- Bar gelap nama sekolah/tahun ajaran/telepon serta badge `Navigasi menu aktif di dock bawah layar` telah dihapus.
- Footer memberi ruang tambahan ketika login agar bagian paling bawah tidak tertutup dock tetap.

### Instalasi di HP / PWA

- `index.html` sudah menautkan `public/site.webmanifest`, `theme-color`, dan `apple-touch-icon`.
- Manifest memakai `display: standalone` dan ikon 192/512 px, sehingga Chrome dapat menawarkan `Install aplikasi` atau `Tambahkan ke layar utama`.
- Android: buka situs di Chrome lalu pilih notifikasi install atau menu titik tiga -> Install aplikasi/Tambahkan ke layar utama.
- iPhone: buka melalui Safari -> Bagikan -> Tambahkan ke Layar Utama.
- Belum ada service worker. Aplikasi yang dipasang tetap memerlukan internet dan belum memiliki cache/offline mode penuh.

### Hardening Integrasi Eksternal

- Gemini sekarang fail-closed melalui `GEMINI_ENABLED`, model dapat dikonfigurasi, memiliki timeout, bounded retry untuk network/429/5xx, pemeriksaan safety/finish reason, batas output, dan validasi schema CBT/Modul Ajar.
- WhatsApp Web memiliki integration gate, emergency pause, rollout `off/canary/all`, allowlist, heartbeat, graceful shutdown, status `sent_unknown`, rekonsiliasi manual, pagination history, consent audit atomik, dan dedupe revision.
- `begin_send` memeriksa ulang semua kill switch sehingga emergency pause dapat menghentikan batch yang sudah diklaim.
- Google Sync default `SYNC_ENABLED=false` dan `SYNC_DRY_RUN=true`; memakai stable key/fingerprint, lock lease, batch maksimal 10, bounded retry, idempotency manifest, dan per-entry error isolation.
- Google Sync tidak lagi menghapus atau mengosongkan foto penuh D1. Apps Script menulis ke `Harian Sync v2` dan `Rekap Sync v2`, sehingga sheet lama tidak disentuh.
- Status teragregasi Admin/Super Admin tersedia melalui `GET /api/integrations/status` tanpa mengekspos secret.
- CI `.github/workflows/verify.yml` menjalankan aplikasi utama, sync-worker, build, syntax gateway, dan Wrangler dry-run.
- Panduan rollout dan rollback lengkap berada di `EXTERNAL_INTEGRATIONS.md`.

### Role dan RBAC

- Role saat ini: `super_admin`, `admin`, `guru`, `ketua_kelas`, dan `siswa`.
- Admin lama telah dimigrasikan menjadi Super Admin pertama.
- Menu siswa/ketua kelas: Beranda, CBT, Absensi, Forum, Profil.
- Ketua kelas tetap siswa, tetapi dapat mengelola absensi kelasnya jika berstatus approved.
- Guru mendapat fitur CBT, Absensi, Kelas, Modul Ajar, Forum, Notifikasi, dan Profil.
- Admin/Super Admin mendapat menu Pengguna dan WhatsApp.
- Tab frontend divalidasi dengan `canAccessTab()`; akses backend juga dibatasi per role.
- Guru kini konsisten dapat menginput absensi semua kelas di frontend dan backend.
- Siswa biasa hanya melihat presensi sendiri. Daftar kehadiran seluruh kelas hanya terlihat oleh ketua kelas.
- Forum sudah tersedia untuk siswa agar dapat memberi saran, masukan, dan berbagi informasi sekolah.

### Manajemen Pengguna

- Super Admin dapat membuat Admin, Guru, dan Siswa.
- Admin dapat membuat serta mengelola Guru/Siswa, tetapi tidak Admin atau Super Admin.
- Mendukung edit akun, aktif/nonaktif, arsip, reset password, impor CSV, dan audit log.
- Hapus permanen hanya Super Admin, membutuhkan password dan akun harus sudah diarsipkan.
- Penghapusan permanen ditolak jika sistem mendeteksi referensi historis.
- Password awal dibuat acak, hanya ditampilkan sekali, dan pengguna wajib menggantinya saat login pertama.
- Akun nonaktif/arsip tidak dapat login; sesi dihapus saat reset/arsip.
- Format CSV: `name,email,identifier,role,classId,jabatan`.

### Identitas Sekolah

- Nama tampilan sekolah diubah menjadi `SMK PLUS AT THAHIRIN`.
- Nama kepala sekolah dikoreksi menjadi `Ir. Suranto`.
- Foto kepala sekolah pada landing page diganti dengan foto laki-laki.
- Data pengguna admin produksi juga sudah dimigrasikan ke nama `Ir. Suranto`.

## Pekerjaan Coding Selesai

- Lifecycle CBT lengkap: tanggal dinamis, kelas aktual, edit, aktif/nonaktif, selesai, hapus, validasi soal, state transition, dan proteksi database setelah attempt dimulai.
- Retry WhatsApp maksimal dua attempt, stale claim, jam aktif D1, retensi, statistik, validasi referensi, dan error handling panel sudah diperbaiki.
- Akun siswa dan roster disinkronkan dengan mutasi JSON atomik, termasuk perubahan identitas serta transisi role.
- Menu dan filter Notifikasi siswa/ketua kelas, target kelas, query status baca, serta visibilitas Forum per kelas sudah diselesaikan.
- Rate limiter memakai UPSERT atomik dan membersihkan window lama secara bertahap.
- Lampiran Forum dan email simulasi tidak lagi ditampilkan sebagai fitur aktif.
- Header autentikasi generate AI sudah konsisten dan code splitting sudah diterapkan.
- Test domain/API/UI ditambah; total saat ini 197 test dalam 39 file, ditambah 8 test sync-worker.

## Peningkatan Database Relasional (Migrasi 0018)

- Koleksi akademik `kelas_v1`, `siswa_v1`, `presensi_v1`, dan `modulAjar_v1` kini memiliki proyeksi relasional (`school_classes`, `class_schedule_items`, `students`, `attendance_records`, `teaching_modules`) dengan index, constraint NOT NULL, FK, CHECK JSON, dan soft-delete (`active`) agar referensi historis tetap valid.
- `academic_collection_revisions` menyimpan nomor revisi; GET mengembalikan `revision`, PUT mendukung optimistic concurrency via header `If-Match`/`X-Collection-Revision` dan menolak tulis usang dengan HTTP 409 (client dihook me-refresh otomatis).
- Validasi ketat per koleksi di `functions/_lib/relational-data.ts`: tolak ID/NISN/key presensi duplikat, format tanggal/waktu/status salah, dan struktur modul rusak; data korup tidak lagi diam-diam di-seed.
- Trigger `AFTER INSERT/UPDATE` pada `app_data` menyinkronkan proyeksi + revision secara atomik untuk SEMUA penulis lama (roster, user management, API generik) — kontrak API tidak berubah.
- Respons PUT presensi kini difilter per role (siswa hanya rekamannya, ketua kelas hanya kelasnya) — menutup kebocoran data sekolah pada respons.
- Migrasi additive/idempotent dengan backfill; fallback aman ke `app_data` bila tabel proyeksi belum ada (mis. deploy sebelum migrasi remote).
- Terverifikasi: 9 test baru lulus, roundtrip 87 siswa produksi presisi, dan penulisan CAS di D1 lokal (konflik, tulis lama, tulis tanpa header).

## Migrasi D1

Migrasi berikut sudah berhasil diterapkan ke D1 remote:

- `0007_fix_principal_name.sql`
- `0008_user_management.sql`
- `0009_whatsapp_notifications.sql`
- `0010_domain_architecture.sql`
- `0011_api_rate_limits.sql`
- `0012_domain_migration_markers.sql`
- `0013_cbt_exam_lifecycle.sql`
- `0014_rate_limit_expiration.sql`
- `0015_domain_integrity.sql`
- `0016_security_hardening.sql`

Migrasi berikut sudah diterapkan dan diverifikasi di D1 remote (16 Agustus 2026):

- `0017_external_integrations.sql`
- `0018_relational_academic_data.sql`
- `0019_cbt_schedule_autosave.sql`
- `0020_cbt_essay_questions.sql`
- `0021_cbt_questions_no_check.sql` — fix CHECK constraint 1101 (essai)
- `0022_cbt_exam_type.sql` — `exam_type` + `min_submit_minutes` (fitur waktu minimal pengerjaan)

Migrasi `0009` membuat tabel:

- `guardian_contacts`
- `teacher_whatsapp_settings`
- `whatsapp_settings`
- `whatsapp_outbox`
- `whatsapp_daily_stats`
- `whatsapp_job_runs`

## Aktivasi Produksi CBT (16 Agustus 2026)

- Deploy produksi berhasil via `npm run pages:deploy` (deployment URL: `https://f8fe1529.smk-at-tahirin.pages.dev`).
- Sebelum migrasi, D1 remote di-backup ke `/tmp/opencode/backup-produksi-cbt-0019.sql` (301 KB).
- `npm run db:migrate:remote` berhasil menerapkan `0019_cbt_schedule_autosave.sql` ke D1 remote; verifikasi `PRAGMA table_info(cbt_exams)` menunjukkan kolom `open_time`/`close_time` dan tabel `cbt_attempt_answers` ada; data ujian (2) dan attempt (1) tetap utuh.
- Smoke test produksi: login siswa (`0082219950`) sukses, `GET /api/cbt/exams` OK, `GET /api/cbt/summary` → `{"success":true,"data":[]}` (siswa belum punya attempt submitted), `POST /api/cbt/attempts/:id/save` menolak tanpa `Origin` (CSRF, benar) dan mengembalikan `Percobaan ujian tidak ditemukan.` untuk attempt palsu (validasi benar).

## Aktivasi Produksi (16 Agustus 2026)

### Deploy dan Migrasi Remote

- Deploy produksi berhasil via `npm run pages:deploy` (deployment URL: `https://2d76353e.smk-at-tahirin.pages.dev`).
- Sebelum migrasi, D1 remote dibuat backup ke `/tmp/opencode/backup-produksi.sql` (192 KB) dengan `wrangler d1 export`.
- `npm run db:migrate:remote` berhasil menerapkan `0017_external_integrations.sql` dan `0018_relational_academic_data.sql` ke D1 remote (sebelumnya remote s.d. `0016`).

### Pre-flight dan Pembersihan Data

- Pre-flight menemukan `presensi_v1` remote berisi 17 rekaman dummy pengujian yang tidak cocok dengan roster (`siswaId` format lama `s1`–`s8`, NISN `0068123491`–`0068123498`, nama tidak cocok) plus satu duplikat `(2026-08-04, s2)`; semua akan melanggar FK migrasi 0018.
- `siswa_v1`, `kelas_v1`, `modulAjar_v1` bersih (0 orphan, 0 duplikat).
- Atas persetujuan pengguna, `presensi_v1` dikosongkan (`[]`); backup tetap tersedia di `/tmp/opencode/backup-produksi.sql`.

### Backfill dan Verifikasi Produksi

- Backfill produksi berhasil: 87 siswa, 3 kelas, 10 jadwal, 1 modul, 0 presensi, 0 orphan; semua `revision=1` dan `initialized=1`.
- 8 trigger sinkronisasi (`sync_*_projection_*`) aktif di remote.
- Integration gate tetap OFF: `whatsapp_settings.enabled=0`, tabel 0017 ada, outbox kosong.

### Smoke Test Produksi (via API live)

- Landing `200`, akses tanpa login `401`.
- Login siswa (`0082219950`) sukses; token dikirim via `Set-Cookie: smk_session` (HttpOnly), bukan JSON body.
- `GET` presensi/siswa/kelas membawa `revision` dan filter per-role benar (siswa hanya rekamannya).
- `PUT` tanpa `If-Match` (klien lama) → `200` (revision naik ke 2) — kompatibilitas terjaga.
- `PUT` dengan `If-Match` benar → `200`; `If-Match` basi → `409` dengan pesan konflik (klien dihook me-refresh).
- Catatan: `PUT` butuh header `Origin: https://smk-at-tahirin.pages.dev` (CSRF middleware); tanpa Origin → `403`.

## Fitur WhatsApp Sekolah

### Status

- Backend, D1, panel Admin, dan gateway lokal sudah dibuat.
- API produksi `contacts`, `teachers`, `settings`, `history`, dan gateway sudah diuji merespons sukses.
- Cloudflare Pages secret `WHATSAPP_GATEWAY_KEY` sudah dibuat. Nilainya tidak ditulis di dokumentasi/Git.
- Konfigurasi gateway lokal ada di `whatsapp-gateway/.env` dan di-ignore Git.
- Dependensi gateway sudah terpasang dengan `PUPPETEER_SKIP_DOWNLOAD=true`.
- Pengiriman otomatis masih `OFF` secara default.
- Integration gate default `OFF`, emergency pause default aktif, rollout default `off`, dan gateway lokal default `GATEWAY_ENABLED=false`.
- Belum ada QR WhatsApp yang dipindai dan gateway belum berjalan terus-menerus.
- Komputer environment ini tidak memiliki Chrome/Chromium terdeteksi. Gateway memerlukan Google Chrome di komputer operator atau `CHROME_PATH` yang benar.

### Fungsi yang Sudah Dibuat

- Admin dapat mengisi maksimal dua nomor wali per siswa.
- Nomor `08...` dinormalisasi menjadi `628...` dan divalidasi.
- Persetujuan wali wajib dicatat sebelum nomor diaktifkan.
- Admin dapat mengisi nomor guru, mengaktifkan reminder, dan menentukan jam reminder.
- Status presensi: Hadir, Terlambat, Sakit, Izin, dan Alpa.
- Hadir/Terlambat/Sakit/Izin masuk antrean segera setelah status berubah.
- Alpa dijadwalkan sesuai cutoff, default pukul 09.00 WIB.
- Perubahan status menghasilkan pesan koreksi; perubahan foto/catatan tanpa perubahan status tidak membuat pesan status baru.
- Reminder guru dibuat satu kali per guru per hari, hanya jika jadwal hari tersebut ditemukan.
- Riwayat antrean/status tersedia pada panel Admin.
- Panel menampilkan heartbeat/last-seen gateway, pagination history, serta rekonsiliasi manual `sent_unknown` oleh Super Admin.

### Hemat D1 dan Anti-Spam

- Deduplikasi memakai event revision agar transisi `Alpa -> Hadir -> Alpa` dapat menghasilkan koreksi baru tanpa mengirim ulang event yang sama.
- Reminder guru memiliki dedupe key per guru per tanggal.
- Gateway mengambil maksimal 25 pesan per batch.
- Polling aktif default setiap 60 detik dan melambat ketika kosong/di luar jam aktif.
- Jeda pengiriman acak 5-7 detik per pesan.
- Kegagalan normal otomatis dicoba kembali maksimal dua attempt.
- Claim kedaluwarsa setelah 10 menit agar pesan tidak hilang ketika gateway mati.
- Sesi WhatsApp (`.wwebjs_auth`) tersimpan lokal, bukan di D1.
- Statistik harian disimpan sebagai satu baris per tanggal.

### Langkah Aktivasi Berikutnya (Operator, di luar repo)

Google Sync dan WhatsApp tidak dapat diselesaikan hanya dengan perubahan codebase; memerlukan akun Google sekolah, nomor WhatsApp nyata, Chrome di mesin operator, dan secret yang tidak boleh ditulis di dokumentasi.

1. **Google Sync** — deploy Apps Script sebagai Web App + set Script Property `SYNC_TOKEN` di editor Apps Script; pasang secret Worker `npx wrangler secret put SYNC_TOKEN` dari `sync-worker/`; set `SYNC_ENABLED=true` + `SYNC_DRY_RUN=true`, lalu `npx wrangler deploy`.
2. **Dry-run Google Sync** — jalankan dry-run manual daily/weekly, lalu non-dry-run staging; verifikasi tiga job harian dan satu mingguan tanpa duplikasi.
3. **WhatsApp gateway** — pastikan Google Chrome terpasang di komputer operator; isi `GATEWAY_KEY` di `whatsapp-gateway/.env` (sama dengan secret Cloudflare); `npm start` di `whatsapp-gateway/`; scan QR nomor pengirim (sesi lokal `.wwebjs_auth`, tidak masuk D1); pastikan heartbeat muncul di panel.
4. **Canary** — aktifkan canary hanya untuk 1-2 nomor ber-consent selama 7-14 hari; uji pause, restart, reconnect, dan rekonsiliasi `sent_unknown`.
5. **Uji terbatas** — isi satu siswa + satu wali (catat consent) dan satu guru; aktifkan pengiriman otomatis di tab Pengaturan; uji satu presensi dan cek Riwayat sebelum impor massal.
6. **Offline mode (opsional)** — jika dibutuhkan, tambahkan service worker sebagai proyek terpisah tanpa menyimpan respons API/sesi sensitif.

Panduan gateway: `WHATSAPP_GATEWAY.md` dan `EXTERNAL_INTEGRATIONS.md`.

### Catatan Risiko

- Gateway memakai `whatsapp-web.js`, bukan API resmi Meta.
- Nomor personal dapat dipakai, tetapi berisiko sesi terputus atau dibatasi WhatsApp.
- Disarankan memakai nomor khusus sekolah setelah uji awal.
- Jangan menjalankan pengiriman massal sebelum uji 1-2 penerima berhasil.

## Google Drive dan Spreadsheet

- Google Apps Script bound ke spreadsheet sudah mendapat izin Drive/Spreadsheet.
- Fungsi `testManual` pernah berhasil membuat baris `Harian` dan file Drive (`ok=true`, `driveLink` tersedia).
- URL Apps Script aktif tersimpan di `sync-worker/wrangler.toml`.
- Worker sinkronisasi berada di `sync-worker/` dengan job harian/mingguan.
- Worker memiliki package/test/typecheck mandiri; 8 test lulus dan `wrangler deploy --dry-run` berhasil.
- Worker default nonaktif/dry-run, batch maksimal 10, menggunakan stable key/fingerprint dan lock agar retry tidak membuat duplikat.
- Apps Script baru memakai Script Property `SYNC_TOKEN` dan sheet versi baru; data foto penuh D1 tidak pernah dipurge oleh Worker.
- `GET /exec` yang menampilkan `Fungsi skrip tidak ditemukan: doGet` adalah normal karena script hanya memiliki `doPost`.
- Pengujian POST eksternal dari terminal sebelumnya masih menghasilkan halaman Google/redirect, sedangkan pengujian manual dari editor Apps Script berhasil. Jangan menyatakan integrasi eksternal end-to-end selesai tanpa verifikasi data nyata dari Worker ke Sheet/Drive.
- Perlu sesi berikutnya (operator): cek apakah `smk-absensi-sync` sudah dideploy, jalankan trigger manual, lihat log Worker, dan pastikan data benar-benar masuk ke Sheet/Drive.

## File Penting

- `src/navItems.ts`: menu dan akses tab per role.
- `src/App.tsx`: kondisi navbar/dock berdasarkan sesi login dan routing tab utama.
- `src/components/Navbar.tsx`: navbar khusus pengguna yang sudah login.
- `src/components/BottomDock.tsx`: navigasi tetap bawah setelah login, termasuk pada Beranda.
- `src/components/LandingPage.tsx`: landing publik dan CTA login responsif.
- `public/site.webmanifest`: metadata instalasi aplikasi di HP.
- `src/components/UserManagementSection.tsx`: panel manajemen akun.
- `src/components/WhatsAppAdminSection.tsx`: panel WhatsApp Admin.
- `functions/api/users/`: API pengguna, reset password, audit.
- `functions/api/whatsapp/`: API kontak, guru, setting, history, dan gateway.
- `functions/_lib/whatsapp.ts`: normalisasi nomor, template pesan, enqueue/dedupe.
- `functions/api/data/[key].ts`: validasi presensi dan enqueue notifikasi WhatsApp.
- `whatsapp-gateway/src/index.js`: gateway WhatsApp Web lokal.
- `WHATSAPP_GATEWAY.md`: panduan setup.
- `sync-worker/`: sinkronisasi Google Drive/Spreadsheet.
- `functions/api/integrations/status.ts`: status Gemini, WhatsApp, dan Google Sync untuk Admin/Super Admin.
- `EXTERNAL_INTEGRATIONS.md`: prosedur rollout, canary, monitoring, dan rollback integrasi.
- `.github/workflows/verify.yml`: CI aplikasi utama dan sync-worker.
- `migrations/0017_external_integrations.sql`: integration gate, delivery metadata, consent event, reminder, dan event revision WhatsApp.
- `migrations/0018_relational_academic_data.sql`: proyeksi relasional akademik, index, trigger sinkronisasi, dan revision.
- `migrations/0019_cbt_schedule_autosave.sql`: jam buka/tutup ujian CBT (`open_time`/`close_time`) dan tabel auto-save jawaban `cbt_attempt_answers`.
- `functions/api/cbt/summary/index.ts`: rekap nilai lintas ujian per siswa dengan scope per role.
- `functions/api/cbt/attempts/[id]/save.ts`: endpoint auto-save/resume jawaban attempt.
- `functions/api/cbt/analytics/index.ts`: analitik nilai guru (distribusi skor + flag mencurigakan).
- `functions/api/cbt/exams/bulk/index.ts`: template jadwal PTS/UAS massal (5 hari × mapel, batch insert, token otomatis).
- `functions/api/users/me/index.ts`: simpan nama/email profil sendiri + sinkronisasi roster siswa.
- `public/sw.js`: service worker offline (API tidak pernah di-cache).
- `src/components/cbt/CbtAnalytics.tsx`, `src/components/cbt/CbtBulkScheduleModal.tsx`: UI analitik & template PTS/UAS.
- `tests/cbt-analytics-api.test.ts`, `tests/CbtAnalytics.test.tsx`, `tests/pwa-offline.test.ts`, `tests/cbt-bulk-schedule.test.ts`, `tests/CbtBulkScheduleModal.test.tsx`, `tests/users-me.test.ts`: test baru sesi 17 Agustus.
- `src/components/CbtSection.tsx`, `src/components/cbt/CbtCreateExamModal.tsx`, `src/components/cbt/CbtTestRunner.tsx`: jadwal harian, jam buka/tutup, auto-save, dan rekap nilai.
- `tests/cbt-schedule-autosave.test.ts`: test window jam, validasi, save API, dan summary API.
- `functions/_lib/relational-data.ts`: validasi ketat, pembacaan proyeksi, dan tulis CAS untuk koleksi akademik.
- `tests/relational-academic-data.test.ts`: test migrasi/backfill/trigger/konflik/privasi.
- `imported/kredensial-akun.txt`: kredensial awal produksi; file sensitif, jangan dipublikasikan.

## Verifikasi Terakhir

Perintah yang berhasil:

```bash
npm run lint
npm run verify
npm run db:migrate:local
node --check whatsapp-gateway/src/index.js
npx wrangler deploy --dry-run # dari sync-worker/
```

Hasil terakhir (1 November 2026, sesi Ruang Kontrol Ujian CBT):

- `npm run verify` hijau penuh: TypeScript lulus, **56 test files / 346 tests aplikasi lulus** (325 baseline + 21 baru: 18 di `tests/cbt-monitor.test.ts` + 3 di `tests/CbtTestRunnerNotices.test.tsx`), 10 tests sync-worker lulus, production build lulus.
- Migrasi baru **0029** teraplikasi bersih di D1 lokal (`npm run db:migrate:local`, semua migrasi ✅). **Belum diterapkan ke D1 produksi** — antrean migrasi remote kini **0027, 0028, 0029**; jalankan sebagai bagian dari deploy manual berikutnya (backup D1 → `db:migrate:remote` → `pages:deploy`).
- Refactor terverifikasi: finalisasi attempt diekstrak ke `finalizeCbtAttempt` (dipakai submit siswa & paksa kumpul) — seluruh test submit/koreksi lama tetap lulus tanpa perubahan asersi.

Hasil sebelumnya (1 November 2026, sesi penonaktifan esai CBT):

- `npm run verify` hijau penuh: TypeScript lulus, **54 test files / 325 tests aplikasi lulus** (311 baseline + 14 baru: 12 di `tests/cbt-essay-disabled.test.ts` + 2 neto di `CbtCreateExamModal.test.tsx`), 10 tests sync-worker lulus, production build lulus.
- **Tidak ada migrasi D1 baru** pada sesi ini — penonaktifan esai ditegakkan murni di lapisan aplikasi (validasi API + UI).
- Test koreksi & pengerjaan esai warisan (PR #3) tetap lulus semua — paket lama berisi esai tetap didukung penuh; yang ditutup hanya jalur pembuatannya.

Hasil sebelumnya (1 November 2026, sesi CBT — PR #3):

- `npm run verify` hijau penuh: TypeScript lulus, **53 test files / 311 tests aplikasi lulus** (284 baseline + 27 baru CBT), 10 tests sync-worker lulus, production build lulus.
- Migrasi baru **0027 & 0028** teraplikasi bersih di D1 lokal (`npm run db:migrate:local`, semua migrasi ✅). **Belum diterapkan ke D1 produksi** — bagian dari deploy manual berikutnya.
- Fitur CBT baru (pengacakan, koreksi esai manual, gerbang pembahasan, proctoring, bank soal) terverifikasi di level unit/API test; belum di-deploy ke produksi.

Hasil sebelumnya (17 Agustus 2026):

- 49 test files aplikasi lulus.
- 269 tests aplikasi lulus (262 + 7 baru: rapor/ekspor).
- TypeScript lulus. Production build lulus.
- Tidak ada migrasi D1 baru di sesi ini (remote tetap sampai `0022`).
- 8 tests sync-worker lulus (tidak berubah).
- Migrasi D1 remote sampai `0022` berhasil (0021–0022 live 16 Agustus 2026; backup di `/tmp/opencode/backup-produksi-cbt-0021.sql` dan `backup-produksi-cbt-0022-*.sql`).
- Smoke test produksi fitur min-submit (16 Agustus 2026): ujian resmi submit awal → 409; setelah min → 200 skor 100; latihan submit instan → 200; Playwright: tombol `Kirim dibuka dalam 02:30` disabled; badge kartu `Ujian Resmi · min. kirim 4 mnt`.
- Simulasi skala besar produksi: UAS 45 soal (40 PG + 5 essai) skor 100, latihan 30 soal (25 PG + 5 essai) skor 100; attempt simulasi dibersihkan.
- Roundtrip 87 siswa produksi melalui proyeksi relasional terverifikasi presisi (tidak ada field hilang/berubah).
- Wrangler sync-worker dry-run lulus.
- Browser guest/authenticated pada 320, 375, 768, dan 1366 px tidak memiliki document overflow.
- Guest: header/dock tidak ada dan CTA login tampil. Authenticated: header/dock tampil di Beranda dan CTA login hilang.
- Klik CTA login membuka modal; logout menghapus header/dock dan mengembalikan CTA login.
- `npm test` dapat sesekali membuat test forum melewati timeout default 5 detik ketika mesin sibuk. Test tersebut lulus terisolasi; full suite terakhir lulus dengan `npx vitest run --testTimeout=10000`.
- Deployment produksi terverifikasi ulang (16 Agustus 2026): deploy sukses, migrasi remote 0017-0018 sukses, backfill 87 siswa/3 kelas/10 jadwal/1 modul bersih, smoke test API lulus (revision, CAS, filter per-role, 409 konflik).
- Deployment CBT (16 Agustus 2026): commit `7a59177` + migrasi `0019` live, smoke test `/api/cbt/exams`, `/api/cbt/summary`, dan auto-save lulus.
- Integration gate WhatsApp `enabled=0` di produksi; gateway claim ketika sistem nonaktif: HTTP 200, `enabled=false`, antrean kosong.

## Urutan Aman Sesi Berikutnya (Operator)

Kode, migrasi, dan deploy sudah selesai (16 Agustus 2026). Langkah tersisa memerlukan mesin/akun operator dan dijalankan di luar repo:

1. Jalankan `git status --short --branch` dan pastikan mulai dari `main` yang sinkron dengan `origin/main` (HEAD: `7abb135`).
2. **Deploy fitur sesi 17 Agustus 2026** (`npm run pages:deploy`): analitik guru, service worker offline (perhatikan `_headers` CSP tetap `script-src 'self'` — SW tidak menambah script inline), template PTS/UAS massal, dan `PATCH /api/users/me`. Tidak ada migrasi D1 baru. Smoke test: buka halaman lalu mode pesawat → shell tetap tampil; guru buka panel analitik; buat 20 ujian via template; siswa ubah nama di Profil → nama baru tampil & konsisten di daftar kelas.
3. Ujian aktif di produksi: `Latihan Kearsipan` permanen (token `LATIH01`, aktif 16–30 Agustus 2026). Ujian simulasi `UAS01`/`LAT02` sudah dihapus 17 Agustus 2026; PTS & Kuis historis dibiarkan.
4. Hati-hati dengan editor/prettier-on-save yang bisa menimpa `cbt-simulasi.html` dari salinan lama (pernah terjadi; restore via `git checkout -- cbt-simulasi.html`).
5. Google Sync: deploy Apps Script baru sebagai Web App, set Script Property `SYNC_TOKEN`, pasang secret Worker dari `sync-worker/`, set `SYNC_ENABLED=true` + `SYNC_DRY_RUN=true`, lalu `npx wrangler deploy`.
3. Dry-run manual daily/weekly, kemudian non-dry-run staging; verifikasi tiga job harian dan satu mingguan tanpa duplikasi.
4. WhatsApp: pastikan Google Chrome terpasang di komputer operator; isi `GATEWAY_KEY` di `whatsapp-gateway/.env`; `npm start` di `whatsapp-gateway/`; scan QR nomor pengirim; pastikan heartbeat muncul di panel Admin.
5. Aktifkan canary hanya untuk 1-2 nomor ber-consent selama 7-14 hari; uji pause, restart, reconnect, dan rekonsiliasi `sent_unknown`.
6. Smoke test produksi pasca-aktivasi: landing, login/logout, semua role, CBT, Forum, Notifikasi, presensi, upload, dan `/api/integrations/status` dalam kondisi WhatsApp/Sync tetap OFF sampai langkah 2-5 selesai.
7. Jika offline mode dibutuhkan, tambahkan service worker sebagai proyek terpisah tanpa menyimpan respons API/sesi sensitif.

## Keamanan dan Tindak Lanjut

- Jangan menaruh nilai `WHATSAPP_GATEWAY_KEY`, token Cloudflare, token sesi, atau file `.env` di dokumentasi/commit.
- Token Cloudflare pernah terlihat selama sesi sebelumnya; rotasi token Cloudflare sangat disarankan.
- Password admin pernah disebut dalam percakapan dan tersimpan pada file kredensial lokal; ganti password Super Admin setelah pengujian.
- `SYNC_TOKEN` sudah dihapus dari konfigurasi statis. Pastikan nilainya dipasang sebagai secret Worker sebelum deploy ulang.
- Nilai `SYNC_TOKEN` lama pernah ada di riwayat Git. Rotasi token sebelum deploy ulang Worker.
- `.env`, data impor, kredensial lokal, `node_modules`, cache Wrangler, dan session WhatsApp tetap harus berada di luar commit.
