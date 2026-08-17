# PRD — Sistem Informasi SMKS PLUS AT THAHIRIN

Produk: Portal sekolah digital (SPA) untuk siswa, guru, dan pengelola — akses dari HP dan desktop.

## 1. Tujuan

1. Digitalisasi layanan sekolah: ujian (CBT), presensi, materi (modul ajar), forum diskusi, dan pengumuman.
2. Satu pintu login untuk semua peran (siswa, ketua kelas, guru, admin, super admin) dengan kontrol akses ketat.
3. Operasional hemat biaya: berjalan di Cloudflare free tier (Pages + D1), tanpa server tradisional.
4. Notifikasi orang tua (WhatsApp) dan rekonsiliasi data ke Google Sheets untuk pelaporan.

## 2. Persona & Peran

| Role | Kebutuhan utama |
|---|---|
| **Siswa** | Mengerjakan ujian CBT (token, jadwal, waktu minimal), melihat nilai, presensi diri, forum kelas/mapel, notifikasi, profil |
| **Ketua Kelas** | Semua hak siswa + input/edit presensi kelasnya (status approved), kelola topik forum kelas |
| **Guru** | Kelola ujian CBT miliknya + generate soal AI, input presensi semua kelas, modul ajar (generate AI), moderasi forum, kirim notifikasi |
| **Admin** | Manajemen user (CRUD, reset password, penetapan ketua kelas, audit), pengaturan WhatsApp, integrasi |
| **Super Admin** | Semua hak admin + hapus permanen user, setting WhatsApp/gateway (rollout), rekonsiliasi pengiriman |

## 3. Fitur per Modul

### 3.1 Autentikasi & Profil (P0)
- Login dengan email/NIP/NISN + password (PBKDF2), sesi 7 hari (cookie HttpOnly / Bearer).
- Wajib ganti password awal (`must_change_password`) — diblokir dari semua fitur sampai ganti.
- Logout, lihat/ubah profil, ganti password (mengakhiri semua sesi lama).
- Status akun: active / inactive / archived. Anti user-enumeration + rate limit login.

### 3.2 CBT — Ujian & Latihan (P0)
- Guru: buat ujian (judul, mapel, kelas target, durasi 1–300 mnt, jadwal tanggal + jam buka/tutup, token), kelola soal PG/essai, kunci jawaban + pembahasan, rotasi token.
- **Jenis ujian**: `latihan` (bebas kirim) vs `ujian` (resmi) dengan **waktu minimal kirim** (default 80% durasi) — anti jawaban asal-asalan; enforce di server (409) + UI tombol terkunci.
- Siswa: kerjakan dengan token, tab Hari Ini/Semua, auto-save jawaban (debounce + pagehide + sebelum submit), tandai ragu, countdown, penilaian otomatis (PG exact, essai substring), riwayat "Nilai Saya" + rekap lintas ujian.
- Generate soal PG via Gemini (1–50 soal), rate limit 20/hari.
- Integritas: soal tak bisa diubah setelah ada attempt (trigger DB), 1 attempt/siswa/ujian, attempt expired ditutup eksplisit.

### 3.3 Absensi (P0)
- Input presensi per kelas/hari (Hadir/Terlambat/Sakit/Izin/Alpa) + foto + lokasi, validasi hak kelas.
- Siswa: input record sendiri sebelum 08:00 WIB.
- Audit trail `presensi_log` (siapa mengubah apa kapan), stamp inputBy.
- Rekap per siswa/kelas; sinkron ke Google Sheets (worker, dry-run default).

### 3.4 Kelas (P1)
- Profil kelas (tingkat, jurusan, ruang, wali kelas, jumlah siswa), jadwal mingguan (hari, jam, mapel, guru, ruangan).
- Visibilitas per role; siswa/ketua hanya kelasnya.

### 3.5 Modul Ajar (P1)
- Kelola modul ajar Kurikulum Merdeka (identitas, profil pelajar Pancasila, komponen inti, asesmen, lampiran).
- Generate otomatis via Gemini, rate limit 20/hari.

### 3.6 Forum (P1)
- Topik kategori mapel/kelas, balasan, like, tag, lampiran, pin (guru+), resolved, soft delete.
- Rate limit: 5 topik/jam, 30 balasan/jam. Notifikasi otomatis saat topik dibuat.

### 3.7 Notifikasi (P0)
- Kirim ke role/kelas tertentu, kategori (Ujian/Tugas/Absensi/Forum/Pengumuman/Sistem), read/unread, dedup per sumber, notifikasi sistem saat topik forum dibuat.

### 3.8 Manajemen User (P0, admin+)
- CRUD user (guru/siswa/ketua kelas), sinkron otomatis dengan roster siswa (`siswa_v1`).
- Reset password (wajib ganti), penetapan/cabut ketua kelas (akun dibuat otomatis bila belum ada), sinkron NISN, audit log 300 terakhir.
- Arsip (soft) vs hapus permanen (super admin, butuh password, hanya user tanpa referensi historis).

### 3.9 WhatsApp (P2, gate off)
- Kontak wali per siswa + consent (granted/revoked tercatat), notifikasi alpa/reminder ke orang tua & guru.
- Outbox queue dengan dedupe, jadwal 05:00–17:00 WIB, cutoff absen 09:00, batch ≤25, retention 30 hari.
- Rollout canary/all + allowlist + emergency pause; status pengiriman (sent/sent_unknown/failed) + rekonsiliasi manual.

### 3.10 Integrasi Google (P2, dry-run)
- Harian: presensi + foto → Google Sheets & Drive. Mingguan: rekap per siswa.
- Foto full di Drive, thumbnail di D1; worker tidak pernah menghapus data D1.

### 3.11 PWA & Aksesibilitas (P1)
- Manifest `display: standalone`, ikon 192/512, theme-color, apple-touch-icon → "Install aplikasi" di HP.
- Belum ada service worker (butuh internet; tidak ada offline mode).

## 4. Prioritas

- **P0 (sudah live)**: auth+RBAC, CBT lengkap, absensi, notifikasi, manajemen user, profil, health/status integrasi, keamanan (rate limit, audit, hardening).
- **P1 (sudah live, bisa dikembangkan)**: kelas, modul ajar, forum, PWA install, UI responsif.
- **P2 (belum aktif operasional)**: WhatsApp gateway, Google Sheets/Drive sync.

## 5. Non-Functional Requirements

- **Keamanan**: sesi hash + cookie aman, CSRF origin check, body limit, rate limit, RBAC per endpoint, audit log, password PBKDF2, CSP/HSTS, WAF Cloudflare.
- **Kinerja**: bundle di-chunk (React, ikon, motion, vendor terpisah); tanpa gambar berat di halaman utama; foto base64 dibatasi (2MB/upload, 20/hari).
- **Mobile-first**: layout 320px–1366px tanpa overflow (`scrollWidth === clientWidth`), dock bawah untuk navigasi, tabel scroll lokal.
- **Reliability**: 235 test vitest + CI verify; migrasi D1 idempotent/backup sebelum remote; fail-closed AI; optimistic concurrency (If-Match).
- **Biaya**: free tier Cloudflare; rate limit melindungi D1 dari lonjakan; AI hemat (2×20 generate/hari).
- **Bahasa**: UI & pesan error Bahasa Indonesia.

## 6. Roadmap (usulan, belum dikerjakan)

1. **Service worker + offline mode** — cache shell SPA, antrean mutasi offline.
2. **Analitik guru** — grafik distribusi nilai per ujian/kelas, deteksi jawaban cepat (curang).
3. **Bank soal** — kumpulan soal reusable lintas ujian (impor/ekspor JSON).
4. **Jadwal PTS/UAS resmi penuh** — template 5 hari × 4 mapel dengan token per mapel.
5. **Email/SMS fallback** untuk notifikasi bila WhatsApp tidak tersedia.
6. **Import/ekspor nilai** ke Excel, cetak rapor digital (print styles sudah siap).
7. **Migrasi penuh ke relasional** — menutup lapisan `app_data` JSON untuk koleksi akademik (transisi bertahap, verifikasi trigger sync).
8. **Uji beban & hardening D1** — index tambahan sesuai pola query produksi; monitor D1 usage dashboard.

> Catatan: roadmap adalah usulan; pilih prioritas bersama pemilik project di sesi berikutnya.