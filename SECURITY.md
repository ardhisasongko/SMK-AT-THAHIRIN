# SECURITY.md — Keamanan Platform

Dokumen ini adalah rujukan keamanan publik untuk platform sistem informasi
sekolah ini: status hardening yang sudah diterapkan, cara melaporkan
kerentanan (responsible disclosure), dan praktik keamanan yang berjalan.
Detail operasional internal (SOP update, respons insiden, backup, aturan
WAF, kunci per sekolah, monitoring) ada di
[`docs/operations/SECURITY_OPERATIONS.md`](docs/operations/SECURITY_OPERATIONS.md).

Terakhir diperbarui: 2 November 2026 (program hardening Fase A–F).

---

## 1. Status Hardening

Platform menjalani program hardening enam fase (A–F) sebelum ditawarkan ke
banyak sekolah. Setiap fase terverifikasi dengan `npm run verify` (lint,
seluruh test, build) dan ter-merge sebagai pull request tersendiri.

### Fase A — Audit keamanan mendalam (PR #7)

Audit pola pikir penyerang atas autentikasi/sesi, matriks RBAC 5 role ×
seluruh endpoint, rate limit, CSRF, XSS, unggah file, endpoint AI, ekspor
CSV, header, pesan error, token CBT, dan perbandingan secret.
**8 temuan diperbaiki** (masing-masing dengan test regresi):

1. Formula injection CSV dinetralkan di semua jalur ekspor (server, klien,
   rekap absensi) — sel teks berawalan `=`/`+`/`-`/`@` diawali apostrof.
2. Perbandingan secret konstan-waktu (digest SHA-256) untuk X-Gateway-Key
   WhatsApp, hash token ujian CBT, dan SYNC_TOKEN sync-worker.
3. Fallback sesi legacy plaintext dihapus — sesi hanya diterima dari hash
   SHA-256.
4. PATCH `/api/users` memvalidasi enum status dan mencabut sesi target
   dalam batch yang sama saat akun menjadi non-aktif.
5. Pesan error 500 tidak lagi membocorkan `error.message` mentah; hanya
   pesan rancangan yang diteruskan, sisanya generik.
6. Ketua kelas yang belum `approved` hanya membaca data/foto dirinya
   sendiri (sebelumnya sekelas).
7. Upload lampiran thumbnail: ember rate limit sendiri (30/jam), cap
   512 KB, tidak menimpa mime foto penuh.
8. `Content-Security-Policy: default-src 'none'` pada respons JSON API.

**7 temuan terbuka** (keputusan produk — belum diubah, dicatat sadar):

1. Limit login per-IP 500/15 menit masih memungkinkan password spraying
   lintas akun; menurunkannya berisiko mengunci login massal satu sekolah
   di balik NAT. *(Dimitigasi sebagian oleh lockout per akun Fase C.)*
2. Guru dapat menulis ulang seluruh koleksi `modulAjar_v1` termasuk modul
   guru lain (otorisasi level koleksi; perlu desain kepemilikan per
   rekaman).
3. GET `kelas_v1`/`modulAjar_v1` dapat dibaca semua role terautentikasi.
4. Foto presensi dapat dibaca guru lintas kelas (sesuai desain
   `canEditClass`; belum mengikuti penugasan kelas migrasi 0026).
5. Bias modulo kecil pada generator password awal. *(DITUTUP Fase B —
   generator bersama baru memakai rejection sampling tanpa bias.)*
6. Sesi paralel per akun belum dibatasi.
7. Prompt injection AI oleh role yang sah dinilai diterima (tidak ada
   rahasia dalam prompt; output tervalidasi skema).

Terverifikasi aman tanpa perubahan pada Fase A: cookie
HttpOnly/Secure/SameSite=Strict, pencabutan sesi server-side pada
logout/reset/arsip/perubahan ketua, anti-enumerasi login, CSRF Origin pada
semua mutasi ber-cookie, tidak ada `dangerouslySetInnerHTML`/`innerHTML`,
unggah foto (magic bytes, 2 MB, kuota), token CBT (hash + rate limit +
rotasi), seluruh query D1 terparameterisasi, gateway WhatsApp fail-closed
berlapis, endpoint AI tergerbang role guru+ dengan kuota per pengguna dan
output tervalidasi skema.

### Fase B — 2FA TOTP staf + kebijakan password (PR #8, migrasi 0030)

- Verifikasi dua langkah TOTP (RFC 6238) untuk `guru`/`admin`/`super_admin`:
  secret terenkripsi AES-GCM (kunci dari secret server
  `TOTP_ENCRYPTION_KEY`), 10 kode pemulihan sekali pakai (hanya hash
  SHA-256 yang disimpan), login dua langkah via token tantangan yang
  BUKAN sesi, aktivasi dari Profil dengan bukti kode pertama, sesi pra-2FA
  dicabut saat aktivasi, penonaktifan oleh admin tercatat di audit.
- Kebijakan password tunggal di semua jalur penetapan: minimal 10 karakter
  huruf+angka; dilarang sama/mengandung NISN/NIP, email, atau nama
  pengguna; password awal/reset dari generator acak kriptografis bersama.

### Fase C — Turnstile + lockout + cakupan rate limit (PR #9, migrasi 0031)

- Turnstile pada login, siap-env: aktif hanya bila site key + secret
  terpasang per deployment; env kosong = perilaku login tidak berubah.
- Lockout login bertahap per akun (5 kegagalan beruntun) dan per IP (50),
  durasi 5→15→60→240→1440 menit, tidak pernah permanen; pemulihan via
  menunggu atau reset admin.
- Ekspor nilai CBT mendapat ember rate limit khusus 10/jam/pengguna
  (generate AI sudah 20/hari/pengguna; upload 10/jam).

### Fase D — Kuota AI per deployment (PR #10, migrasi 0032)

- Penghitung pemakaian Gemini harian (WIB) per deployment di D1; batas
  env `GEMINI_DAILY_LIMIT` (kosong/0 = tanpa batas); melewati batas = 429
  sampai besok. Satu kunci Gemini per sekolah (lihat SOP di dokumen
  operasi).

### Fase E — Monitoring (PR #11, migrasi 0033)

- `GET /api/health` diperkaya: latensi DB, versi migrasi terakhir yang
  dikenal kode, status komponen boolean, pemakaian kuota AI — tanpa
  membocorkan rahasia/identitas akun.
- Panel status admin/super_admin: kesehatan DB, sesi aktif, kegagalan
  login 24 jam (ember agregat anonim per jam), lockout aktif, kuota AI
  hari ini, status gateway WhatsApp.

### Fase F — Paket dokumen (PR ini)

- Dokumen ini, SOP operasi & keamanan
  (`docs/operations/SECURITY_OPERATIONS.md`), dan templat legal
  (`docs/legal-templates/`) yang wajib ditinjau penasihat hukum sebelum
  digunakan.

---

## 2. Responsible Disclosure — Melaporkan Kerentanan

Kami berterima kasih kepada peneliti keamanan yang melaporkan kerentanan
secara bertanggung jawab.

**Cara melaporkan:**

1. Kirim laporan ke pengelola sistem sekolah yang bersangkutan **dan**
   vendor platform melalui kanal resmi yang diterbitkan masing-masing
   (email tata usaha sekolah / kontak vendor pada perjanjian layanan).
   Jangan membuka isu publik (termasuk GitHub Issues) untuk kerentanan
   yang belum diperbaiki.
2. Sertakan: ringkasan kerentanan, langkah reproduksi, dampak yang
   diperkirakan, dan versi/commit yang terpengaruh bila diketahui.
3. Beri waktu perbaikan yang wajar sebelum publikasi apa pun — target
   kami: triase awal ≤ 3 hari kerja, perbaikan kritis ≤ 14 hari,
   jendela disclosure terkoordinasi 90 hari.

**Aturan main (safe harbor):** pengujian keamanan dengan itikad baik —
tanpa mengakses data pribadi di luar yang diperlukan untuk membuktikan
kerentanan, tanpa mengganggu layanan, tanpa menyimpan/menyebarkan data
yang ditemukan — tidak akan ditindaklanjuti secara hukum oleh pengelola.
Laporkan segera dan hapus salinan data apa pun yang terlanjur terambil.

Di luar cakupan: serangan volumetrik/DoS, social engineering terhadap
staf sekolah, dan kerentanan pada layanan pihak ketiga (Cloudflare,
Google) — laporkan yang terakhir ke penyedia masing-masing.

---

## 3. Praktik Keamanan yang Diterapkan

**Autentikasi & sesi**

- Password PBKDF2-SHA256 100.000 iterasi (batas WebCrypto Workers), salt
  acak per password.
- Token sesi acak 256-bit, disimpan sebagai hash SHA-256, TTL 7 hari,
  cookie `HttpOnly; Secure; SameSite=Strict`; sesi dicabut server-side
  pada logout, reset password, penonaktifan/arsip akun, dan perubahan
  role ketua kelas.
- Login anti-enumerasi (hash dummy + pesan generik), rate limit per IP
  dan per akun, lockout bertahap, Turnstile siap-aktif per deployment.
- 2FA TOTP untuk akun staf (guru/admin/super_admin) dengan kode pemulihan
  sekali pakai; secret TOTP terenkripsi saat disimpan.
- Kewajiban ganti password awal ditegakkan di middleware: endpoint lain
  tertutup sampai password awal diganti.

**Otorisasi & data**

- RBAC 5 role diperiksa di server pada setiap endpoint; ruang lingkup
  data per role (siswa hanya datanya sendiri; guru terikat penugasan
  kelas & kepemilikan ujian).
- Seluruh query D1 terparameterisasi; tidak ada injeksi SQL string.
- CSRF: mutasi ber-cookie wajib Origin host yang sama.
- Batas ukuran body per route; header keamanan global (CSP ketat pada
  aset, `default-src 'none'` pada JSON API, HSTS, nosniff, X-Frame-Options
  DENY).
- Unggah foto: validasi magic bytes, maks 2 MB, kuota per jam/hari,
  kompresi ulang (EXIF hilang).
- Ekspor CSV menetralkan formula injection.
- Token ujian CBT disimpan sebagai hash, ditebak dibatasi rate limit,
  dapat dirotasi pengawas; kunci jawaban tidak pernah dikirim ke siswa
  sebelum gerbang pembahasan terbuka.

**Rahasia & konfigurasi**

- Tidak ada secret di repo (`.env*` diabaikan Git; secret dipasang sebagai
  Cloudflare Pages Secret per deployment).
- Setiap deployment sekolah memakai kunci sendiri: Gemini, enkripsi
  TOTP, Turnstile, gateway WhatsApp, token sinkronisasi.
- Audit log tindakan administratif (`user_audit_log`) dan aksi ruang
  kontrol ujian.

**Operasional**

- Setiap perubahan keamanan melewati gerbang `npm run verify` penuh dan
  pull request; migrasi D1 selalu berkas baru bernomor runtut, tidak
  pernah mengedit migrasi yang sudah diterapkan.
- Backup D1 sebelum migrasi/deploy produksi; urutan rilis dan rollback
  didokumentasikan di SOP operasi.
- Pemantauan kesehatan per deployment lewat `/api/health` + panel status
  admin (runbook di dokumen operasi).

**Batasan yang diketahui:** perlindungan DDoS volumetrik bergantung pada
WAF Cloudflare tingkat akun (di luar repo — lihat SOP); gateway WhatsApp
memakai jalur tidak resmi (whatsapp-web.js) dan secara bawaan nonaktif;
daftar temuan terbuka Fase A di atas adalah risiko yang diterima sadar
sampai ada keputusan produk.
