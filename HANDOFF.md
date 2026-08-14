# HANDOFF - Status Proyek

Tanggal pembaruan: Jumat, 14 Agustus 2026
Project: SMK PLUS AT THAHIRIN (React/Vite + Cloudflare Pages Functions + D1)

## Status Umum

- Domain produksi utama: `https://smk-at-tahirin.pages.dev/`.
- Deployment terakhir berhasil. URL deployment: `https://c1ba6404.smk-at-tahirin.pages.dev`.
- D1 remote: `smk-at-tahirin-db` (`e436d309-e92a-430d-8c48-c47752b3391b`).
- Verifikasi terakhir: `npm run lint` lulus, 114/114 test lulus, dan production build berhasil.
- Build memberi warning bundle utama sekitar 516 KB setelah minify. Ini warning, bukan error; code splitting belum dikerjakan.
- Worktree masih memiliki banyak perubahan belum di-commit. Jangan membuang perubahan yang ada.

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

## Migrasi D1

Migrasi berikut sudah berhasil diterapkan ke D1 remote:

- `0007_fix_principal_name.sql`
- `0008_user_management.sql`
- `0009_whatsapp_notifications.sql`

Migrasi domain berikut sudah diterapkan secara lokal tetapi masih harus diterapkan ke D1 remote sebelum kode terbaru dideploy:

- `0010_domain_architecture.sql`
- `0011_api_rate_limits.sql`
- `0012_domain_migration_markers.sql`

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
- Maksimal dua percobaan otomatis.
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
npm run db:migrate:remote
npm run pages:deploy
node --check whatsapp-gateway/src/index.js
```

Hasil terakhir:

- 17 test files lulus.
- 114 tests lulus.
- TypeScript lulus.
- Production build lulus.
- Migrasi D1 sampai `0009` berhasil.
- Deployment produksi berhasil.
- Gateway claim diuji ketika sistem nonaktif: HTTP 200, `enabled=false`, antrean kosong.

## Keamanan dan Tindak Lanjut

- Jangan menaruh nilai `WHATSAPP_GATEWAY_KEY`, token Cloudflare, token sesi, atau file `.env` di dokumentasi/commit.
- Token Cloudflare pernah terlihat selama sesi sebelumnya; rotasi token Cloudflare sangat disarankan.
- Password admin pernah disebut dalam percakapan dan tersimpan pada file kredensial lokal; ganti password Super Admin setelah pengujian.
- `SYNC_TOKEN` sudah dihapus dari konfigurasi statis. Pastikan nilainya dipasang sebagai secret Worker sebelum deploy ulang.
- Belum ada commit untuk kumpulan perubahan besar ini. Sebelum commit, tinjau `git diff`, pastikan `.env`, data pribadi, dan session WhatsApp tidak ikut staged.
