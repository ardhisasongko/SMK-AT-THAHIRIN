# HANDOFF — Progress Pekerjaan

Tanggal: Rabu, 5 Agustus 2026
Project: SMKS PLUS AT-THAHIRIN (Cloudflare Pages + D1)

## Status Umum
- Aplikasi berjalan normal. Deploy produksi terakhir sukses di `https://bc121cea.smk-at-tahirin.pages.dev`.
- 100/100 test lulus, `npm run lint` (tsc) hijau.
- D1 remote: `smk-at-tahirin-db`.

## Perubahan Kode (sudah di-commit sesi ini)
1. **RBAC guru** (`src/components/AbsensiSection.tsx`) — semua role `guru` kini bisa input absensi semua kelas (sebelumnya hanya kelas tempat ia wali). Admin & ketua kelas tidak berubah.
2. **Wali kelas baru** (`src/data/initialData.ts`) — X = `Ibu Nurul Faizah Ulfah`, XI = `Bpk Fahri Sujana`, XII = `Bpk Rudiyatno`. (Catatan: nama real di Excel wali XI = `M. FACHRI SUJANA`, ejaan FACHRI.)
3. **`normalizeName()`** (`src/components/ProfilSection.tsx`) — pencocokan nama guru (wali kelas & jadwal) kini abaikan sapaan Ibu/Bpk + case-insensitive.
4. **Cegah data-loss presensi** (`functions/api/data/[key].ts`) — saat PUT `presensi_v1`, rekaman yang sudah ada di server tapi tidak dikirim client kini tetap dipertahankan (di-merge). Client hanya menambah/mengubah, tidak menghapus (presensi memang tanpa fitur hapus).
5. **Error simpan tidak senyap** (`src/hooks/usePersistedCollection.ts` + `src/components/StudentAbsensiCard.tsx`) — HTTP non-OK kini log error + dispatch `persist:error`; kartu absensi menampilkan peringatan bila simpan `presensi_v1` ditolak server.
6. **Test regresi guru** (`tests/AbsensiSection.test.tsx`) — 3 test baru untuk view guru.
7. **Tooling** (`package.json`) — script `dev:watch` (nodemon), nodemon + bump wrangler.

## Pekerjaan Berjalan: Sinkronisasi Absensi → Google Drive & Spreadsheet
### Tujuan
Absensi harian (foto + rekap) otomatis dikirim ke Google Apps Script web app → disimpan ke Spreadsheet "Absensi SMK AT-THAHIRIN" (tab "Harian" & "Rekap") + foto ke Drive `/Absensi SMK AT-THAHIRIN/<Tahun>/W<mm>/<Nama_NISN>/` (link public).

### Status: BLOCKED di sisi Apps Script
Kode Apps Script sudah diberikan user (functions `doPost`/`handleDaily`/`handleWeekly`), isi:
- Token: `SMK_ABSEN_2026` (sama dengan yang akan dipakai SYNC_TOKEN di Cloudflare).
- Payload: `{action:'daily'|'weekly', token, entries:[{tanggal,kelas,nisn,siswaName,status,keterangan,waktu,fotoBase64,mime,photoId}]}`.
- `SpreadsheetApp.getActiveSpreadsheet()` → script HARUS bound ke spreadsheet (Extensions → Apps Script), bukan standalone.

### Temuan diagnosis (4 URL deployment berbeda diuji, hasil konsisten)
- `GET /exec` → 200 "Fungsi skrip tidak ditemukan: doGet" — normal untuk web app doPost-only (bukan indikasi masalah).
- `POST /exec` → **405 "Halaman Tidak Ditemukan"** — deployment tidak melayani `doPost`.
- Warm-up curl (302→echo, GET echo 200, POST ulang, dengan & tanpa cookie jar) tetap 405.
- Uji langsung di editor (fungsi `testDaily`) → **`Exception: Access denied: DriveApp.`** di `getOrCreateFolder` — **OAuth script belum diberi izin Google Drive**. Ini dugaan akar masalah: izin tidak lengkap → deployment pun tidak pernah "aktif".

### Langkah berikutnya (dikerjakan user di Apps Script)
1. Jalankan `testDaily` (file uji: `/tmp/opencode/appsscript-testDaily.gs`) → saat popup authorization muncul, klik **Review permissions → Allow** (grant Drive + Spreadsheet).
2. Verifikasi sukses: muncul tab **"Harian"** di spreadsheet + folder Drive `Absensi SMK AT-THAHIRIN/2026/W32/SISWA UJI_0000000001` berisi 1 file PNG.
3. Setelah izin OK: buat/update deployment → **Deploy → Manage deployments → Edit → Version: New version → Who has access: Anyone → Save** (lengkapi popup otorisasi saat deploy).
4. Kirim URL web app baru → dev tes POST payload kosong: `{"action":"daily","token":"SMK_ABSEN_2026","entries":[]}` → harus `{"ok":true,"results":[]}`.

### Pekerjaan Cloudflare (belum dimulai, menunggu step di atas)
- Bangun endpoint sinkron di `functions/` (mis. `functions/api/sync.ts`) memakai secret `APPS_SCRIPT_URL` + `SYNC_TOKEN=SMK_ABSEN_2026`.
- Kirim 1–2 contoh data (termasuk `fotoBase64`), verifikasi ke Spreadsheet & Drive, lalu hapus contoh.
- Opsional jika web app tetap gagal: ganti ke Google Sheets/Drive API via service account.

## Catatan lain
- Export rekap CSV sudah ada di UI: `AbsensiSection.tsx` → tab Rekap & Laporan (`handleExportCSV`).
- Tabel `photos` sekarang 0 baris (2 foto orphan dihapus; backup: `/tmp/opencode/student-photos/`).
- Record presensi GHINA NAILA hilang (hanya di `presensi_log`); user memilih TIDAK dipulihkan.
- Backup/foto uji SISWA UJI (jika berhasil dibuat) harus dibersihkan setelah verifikasi.
