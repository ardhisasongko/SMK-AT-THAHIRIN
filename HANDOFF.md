# HANDOFF - Status Proyek

Tanggal pembaruan: Sabtu, 15 Agustus 2026
Project: SMK PLUS AT THAHIRIN (React/Vite + Cloudflare Pages Functions + D1)

## Status Umum

- Domain produksi utama: `https://smk-at-tahirin.pages.dev/`.
- Deployment produksi terakhir yang terverifikasi: `https://c1ba6404.smk-at-tahirin.pages.dev`. Deployment ini dibuat sebelum commit terbaru.
- D1 remote: `smk-at-tahirin-db` (`e436d309-e92a-430d-8c48-c47752b3391b`).
- Verifikasi terakhir: `npm run lint` lulus, 144/144 test lulus, dan production build berhasil.
- Bundle sudah dipisah menjadi chunk aplikasi, React, ikon, motion, dan vendor; warning ukuran bundle utama sudah hilang.
- Commit terbaru: `4956096 feat(platform): tambah domain API, manajemen pengguna, dan WhatsApp`.
- Perubahan lanjutan sesi ini masih berada di worktree dan belum di-commit atau di-push.
- Migrasi `0010`-`0015` dan perubahan terbaru belum dideploy ke produksi.

## Perubahan Utama Sesi Ini

### Lanjutan Audit Domain

- Migrasi data legacy CBT, forum, dan notifikasi kini memakai marker idempotent, bukan asumsi tabel target kosong. POST pertama tidak lagi dapat menyebabkan data legacy terlewat permanen.
- Guru hanya dapat melihat kunci soal dan hasil CBT untuk ujian miliknya. Admin dan Super Admin tetap memiliki akses pengawasan global.
- Attempt CBT yang sudah kedaluwarsa ditutup dengan respons eksplisit dan tidak lagi membuka runner dalam keadaan macet.
- Hapus permanen pengguna kini memeriksa histori CBT, forum, notifikasi, dan WhatsApp serta membersihkan relasi read/like/setting yang tidak bersifat historis.
- Test ownership CBT ditambahkan.

### UI Responsif

- Landing page, hero, header, kartu sambutan, program keahlian, berita, dan footer dirapikan untuk viewport 320 px serta desktop.
- Dock bawah tidak ditampilkan di landing page.
- Dock mobile memakai menu utama + tombol `Lainnya`, sehingga tidak lagi overflow horizontal saat role memiliki banyak menu.
- Jadwal siswa memakai kartu pada mobile dan tabel pada desktop.
- Form Modul Ajar menjadi satu kolom pada mobile.
- Kartu Kelas, Notifikasi, dan Manajemen Pengguna menangani teks/email panjang tanpa keluar viewport.
- Global `overflow-x` guard ditambahkan di `src/index.css`.

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
- Test domain/API/UI ditambah; total saat ini 144 test.

## Migrasi D1

Migrasi berikut sudah berhasil diterapkan ke D1 remote:

- `0007_fix_principal_name.sql`
- `0008_user_management.sql`
- `0009_whatsapp_notifications.sql`

Migrasi domain berikut sudah diterapkan secara lokal tetapi masih harus diterapkan ke D1 remote sebelum kode terbaru dideploy:

- `0010_domain_architecture.sql`
- `0011_api_rate_limits.sql`
- `0012_domain_migration_markers.sql`
- `0013_cbt_exam_lifecycle.sql`
- `0014_rate_limit_expiration.sql`
- `0015_domain_integrity.sql`

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

### Hemat D1 dan Anti-Spam

- Deduplikasi unik per siswa + tanggal + status + slot wali.
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

Panduan gateway: `WHATSAPP_GATEWAY.md`.

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
- `GET /exec` yang menampilkan `Fungsi skrip tidak ditemukan: doGet` adalah normal karena script hanya memiliki `doPost`.
- Pengujian POST eksternal dari terminal sebelumnya masih menghasilkan halaman Google/redirect, sedangkan pengujian manual dari editor Apps Script berhasil. Jangan menyatakan integrasi eksternal end-to-end selesai tanpa verifikasi data nyata dari Worker ke Sheet/Drive.
- Perlu sesi berikutnya: cek apakah `smk-absensi-sync` sudah dideploy, jalankan trigger manual, lihat log Worker, dan pastikan data benar-benar masuk ke Sheet/Drive.

## File Penting

- `src/navItems.ts`: menu dan akses tab per role.
- `src/components/UserManagementSection.tsx`: panel manajemen akun.
- `src/components/WhatsAppAdminSection.tsx`: panel WhatsApp Admin.
- `functions/api/users/`: API pengguna, reset password, audit.
- `functions/api/whatsapp/`: API kontak, guru, setting, history, dan gateway.
- `functions/_lib/whatsapp.ts`: normalisasi nomor, template pesan, enqueue/dedupe.
- `functions/api/data/[key].ts`: validasi presensi dan enqueue notifikasi WhatsApp.
- `whatsapp-gateway/src/index.js`: gateway WhatsApp Web lokal.
- `WHATSAPP_GATEWAY.md`: panduan setup.
- `sync-worker/`: sinkronisasi Google Drive/Spreadsheet.
- `imported/kredensial-akun.txt`: kredensial awal produksi; file sensitif, jangan dipublikasikan.

## Verifikasi Terakhir

Perintah yang berhasil:

```bash
npm run lint
npm test
npm run build
npm run db:migrate:local
node --check whatsapp-gateway/src/index.js
```

Hasil terakhir:

- 26 test files lulus.
- 144 tests lulus.
- TypeScript lulus.
- Production build lulus.
- Migrasi lokal sampai `0015` berhasil dan tidak ada migrasi lokal tertunda.
- D1 remote baru terverifikasi sampai `0009`; jangan deploy kode terbaru sebelum `0010`-`0015` diterapkan.
- Deployment produksi yang tercatat berhasil adalah versi sebelum commit `4956096`.
- Gateway claim diuji ketika sistem nonaktif: HTTP 200, `enabled=false`, antrean kosong.

## Urutan Aman Sesi Berikutnya

1. Jalankan `git status --short --branch` dan pastikan mulai dari `main` yang sinkron dengan `origin/main`.
2. Pastikan secret Pages/Worker tersedia tanpa menuliskan nilainya ke Git.
3. Terapkan migrasi remote dengan `npm run db:migrate:remote` dan pastikan `0010`-`0015` sukses.
4. Deploy Pages dengan `npm run pages:deploy`.
5. Smoke test login serta menu untuk `super_admin`, `admin`, `guru`, `ketua_kelas`, dan `siswa`.
6. Smoke test CBT, Forum, Notifikasi, Manajemen Pengguna, presensi, upload foto, dan endpoint WhatsApp dalam kondisi pengiriman otomatis masih `OFF`.
7. Deploy dan verifikasi `sync-worker` setelah `SYNC_TOKEN` dipasang sebagai secret.
8. Aktifkan gateway WhatsApp hanya setelah uji terbatas 1-2 penerima berhasil.

## Keamanan dan Tindak Lanjut

- Jangan menaruh nilai `WHATSAPP_GATEWAY_KEY`, token Cloudflare, token sesi, atau file `.env` di dokumentasi/commit.
- Token Cloudflare pernah terlihat selama sesi sebelumnya; rotasi token Cloudflare sangat disarankan.
- Password admin pernah disebut dalam percakapan dan tersimpan pada file kredensial lokal; ganti password Super Admin setelah pengujian.
- `SYNC_TOKEN` sudah dihapus dari konfigurasi statis. Pastikan nilainya dipasang sebagai secret Worker sebelum deploy ulang.
- Nilai `SYNC_TOKEN` lama pernah ada di riwayat Git. Rotasi token sebelum deploy ulang Worker.
- `.env`, data impor, kredensial lokal, `node_modules`, cache Wrangler, dan session WhatsApp tetap harus berada di luar commit.
