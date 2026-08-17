# HANDOFF - Status Proyek

Tanggal pembaruan: Senin, 17 Agustus 2026
Project: SMK PLUS AT THAHIRIN (React/Vite + Cloudflare Pages Functions + D1)

## Status Umum

- Domain produksi utama: `https://smk-at-tahirin.pages.dev/`.
- Deployment produksi terakhir yang diverifikasi (16 Agustus 2026): fitur **waktu minimal pengerjaan ujian resmi** live (deploy `9476e578`, commit `f7c52ff`); smoke test produksi lulus (409/200, latihan bebas kirim, UI tombol terkunci).
- **Sesi 17 Agustus 2026 (belum di-deploy)**: 4 milestone baru siap deploy — analitik guru, service worker offline/PWA, template jadwal PTS/UAS massal, dan simpan profil sendiri ke server. Belum ada migrasi baru (tidak menyentuh skema D1).
- **Deploy 17 Agustus 2026 (dilakukan)**: analitik, PWA offline, template PTS/UAS, `PATCH /api/users/me`, ekspor nilai CBT + rapor siswa — semua live (`5e78e61c` lalu `47968d60`); smoke test produksi lulus (detail di bawah). **Smoke test UI e2e via Playwright 9/9 lulus** (analitik, ekspor nilai, modal kelas, rapor siswa, offline shell + banner). **Ujian simulasi produksi dibersihkan**: `UAS Kearsipan (Simulasi 45 Soal)` (`UAS01`) dan `Latihan Kearsipan (Simulasi 30 Soal)` (`LAT02`) dihapus via DELETE; tersisa `Latihan Kearsipan` permanen (`LATIH01`, aktif 16–30 Agustus) + PTS/Kuis historis. 10 commit sesi sudah di-push ke `origin/main` (`7abb135`).
- D1 remote: `smk-at-tahirin-db` (`e436d309-e92a-430d-8c48-c47752b3391b`).
- Verifikasi terakhir: `npm run lint` lulus, **269/269 test** lulus (49 file), production build berhasil; migrasi D1 remote tetap sampai `0022` (tidak ada migrasi baru di sesi ini).
- Bundle sudah dipisah menjadi chunk aplikasi, React, ikon, motion, dan vendor; warning ukuran bundle utama sudah hilang.
- Migrasi D1 remote sudah diterapkan sampai `0022_cbt_exam_type.sql` (live di produksi 16 Agustus 2026).
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

Hasil terakhir (17 Agustus 2026):

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
