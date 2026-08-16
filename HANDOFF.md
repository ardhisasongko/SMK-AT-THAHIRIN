# HANDOFF - Status Proyek

Tanggal pembaruan: Minggu, 16 Agustus 2026
Project: SMK PLUS AT THAHIRIN (React/Vite + Cloudflare Pages Functions + D1)

## Status Umum

- Domain produksi utama: `https://smk-at-tahirin.pages.dev/`.
- Deployment produksi terakhir yang diverifikasi end-to-end berada pada commit `3013ebd`; commit UI setelahnya sudah di-push tetapi deployment produksinya belum diverifikasi ulang dalam sesi ini.
- D1 remote: `smk-at-tahirin-db` (`e436d309-e92a-430d-8c48-c47752b3391b`).
- Verifikasi terakhir: `npm run verify` lulus, 197/197 test aplikasi + 8/8 test sync-worker lulus, production build berhasil, dan migrasi `0018` lulus di D1 lokal.
- Bundle sudah dipisah menjadi chunk aplikasi, React, ikon, motion, dan vendor; warning ukuran bundle utama sudah hilang.
- Commit implementasi integrasi terbaru yang sudah di-push: `b787e62 feat(integrations): perkuat layanan eksternal`.
- Migrasi D1 remote masih diterapkan sampai `0016_security_hardening.sql`; migrasi `0017_external_integrations.sql` dan `0018_relational_academic_data.sql` sudah lulus di D1 lokal tetapi belum diterapkan ke remote.
- Kesiapan kode integrasi eksternal dinilai A-, tetapi status operasional tetap menunggu deploy, dry-run Google Sync, scan QR WhatsApp, dan canary 7-14 hari.

### Commit Milestone Terbaru

- `11405a8 feat(platform): tuntaskan lifecycle dan integritas domain`
- `17fc537 fix(ui): rapikan navbar dan tambah metadata SEO`
- `e028e37 security(platform): perkuat sesi, rate limit, dan upload`
- `3013ebd fix(auth): sesuaikan PBKDF2 dengan batas Cloudflare`
- `2ed1c7a fix(ui): rapikan layout mobile dan overflow`
- `39d9c62 fix(ui): tampilkan navigasi setelah login`
- `b787e62 feat(integrations): perkuat layanan eksternal`

## Perubahan Utama Sesi Ini

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

Migrasi berikut baru diterapkan dan diverifikasi di D1 lokal; belum remote:

- `0017_external_integrations.sql`
- `0018_relational_academic_data.sql`

Migrasi `0009` membuat tabel:

- `guardian_contacts`
- `teacher_whatsapp_settings`
- `whatsapp_settings`
- `whatsapp_outbox`
- `whatsapp_daily_stats`
- `whatsapp_job_runs`

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

### Langkah Aktivasi Berikutnya

1. Pastikan Google Chrome terpasang di komputer operator.
2. Jika perlu, isi `CHROME_PATH` di `whatsapp-gateway/.env`.
3. Jalankan:

   ```bash
   cd whatsapp-gateway
   npm start
   ```

4. Scan QR dengan nomor WhatsApp yang akan menjadi nomor pengirim.
5. Login Super Admin di website, buka menu `WhatsApp` melalui `Lainnya`.
6. Isi satu siswa dan satu nomor wali untuk uji terbatas; catat consent.
7. Isi satu nomor guru untuk uji reminder.
8. Pada tab Pengaturan, aktifkan pengiriman otomatis.
9. Uji satu presensi dan cek tab Riwayat sebelum memasukkan seluruh nomor wali.
10. Jika stabil, impor/input seluruh kontak secara bertahap.

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
- Perlu sesi berikutnya: cek apakah `smk-absensi-sync` sudah dideploy, jalankan trigger manual, lihat log Worker, dan pastikan data benar-benar masuk ke Sheet/Drive.

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

Hasil terakhir:

- 39 test files aplikasi lulus.
- 197 tests aplikasi lulus.
- 8 tests sync-worker lulus.
- TypeScript lulus.
- Typecheck sync-worker lulus.
- Production build lulus.
- Migrasi D1 remote sampai `0016` berhasil.
- Migrasi `0017` dan `0018` berhasil secara lokal dan belum diterapkan ke remote.
- Roundtrip 87 siswa produksi melalui proyeksi relasional terverifikasi presisi (tidak ada field hilang/berubah).
- Wrangler sync-worker dry-run lulus.
- Browser guest/authenticated pada 320, 375, 768, dan 1366 px tidak memiliki document overflow.
- Guest: header/dock tidak ada dan CTA login tampil. Authenticated: header/dock tampil di Beranda dan CTA login hilang.
- Klik CTA login membuka modal; logout menghapus header/dock dan mengembalikan CTA login.
- `npm test` dapat sesekali membuat test forum melewati timeout default 5 detik ketika mesin sibuk. Test tersebut lulus terisolasi; full suite terakhir lulus dengan `npx vitest run --testTimeout=10000`.
- Deployment produksi untuk commit integrasi terbaru belum diverifikasi ulang; integrasi WhatsApp/Sync harus tetap OFF saat smoke test awal.
- Gateway claim diuji ketika sistem nonaktif: HTTP 200, `enabled=false`, antrean kosong.

## Urutan Aman Sesi Berikutnya

1. Jalankan `git status --short --branch` dan pastikan mulai dari `main` yang sinkron dengan `origin/main`.
2. Pastikan commit integrasi terbaru sudah terdeploy di Cloudflare Pages, lalu terapkan `0017_external_integrations.sql` dan `0018_relational_academic_data.sql` ke D1 remote.
3. Smoke test produksi untuk landing, login/logout, semua role, CBT, Forum, Notifikasi, presensi, upload, dan `/api/integrations/status` dalam kondisi WhatsApp/Sync tetap OFF.
4. Deploy ulang Apps Script, pasang `SYNC_TOKEN` sebagai Script Property dan Worker secret, lalu deploy sync-worker dengan `SYNC_DRY_RUN=true`.
5. Jalankan dry-run manual daily/weekly, kemudian non-dry-run staging; verifikasi tiga job harian dan satu mingguan tanpa duplikasi.
6. Jalankan gateway dengan `GATEWAY_ENABLED=false`, scan QR nomor khusus sekolah, dan pastikan heartbeat muncul.
7. Aktifkan canary hanya untuk 1-2 nomor ber-consent selama 7-14 hari; uji pause, restart, reconnect, dan rekonsiliasi `sent_unknown`.
8. Jika offline mode dibutuhkan, tambahkan service worker sebagai proyek terpisah tanpa menyimpan respons API/sesi sensitif.

## Keamanan dan Tindak Lanjut

- Jangan menaruh nilai `WHATSAPP_GATEWAY_KEY`, token Cloudflare, token sesi, atau file `.env` di dokumentasi/commit.
- Token Cloudflare pernah terlihat selama sesi sebelumnya; rotasi token Cloudflare sangat disarankan.
- Password admin pernah disebut dalam percakapan dan tersimpan pada file kredensial lokal; ganti password Super Admin setelah pengujian.
- `SYNC_TOKEN` sudah dihapus dari konfigurasi statis. Pastikan nilainya dipasang sebagai secret Worker sebelum deploy ulang.
- Nilai `SYNC_TOKEN` lama pernah ada di riwayat Git. Rotasi token sebelum deploy ulang Worker.
- `.env`, data impor, kredensial lokal, `node_modules`, cache Wrangler, dan session WhatsApp tetap harus berada di luar commit.
