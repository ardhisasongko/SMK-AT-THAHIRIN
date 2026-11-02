# SECURITY_OPERATIONS.md — SOP Operasi & Keamanan Multi-Sekolah

Dokumen operasional internal vendor untuk menjalankan platform ini di
banyak sekolah (satu deployment terpisah per sekolah: satu project
Cloudflare Pages + satu database D1 + kunci-kunci sendiri per sekolah).

Isi: (1) SOP update keamanan serentak, (2) SOP respons insiden termasuk
kewajiban notifikasi UU PDP 72 jam, (3) SOP backup & uji restore,
(4) aturan WAF siap-terap, (5) SOP kunci per sekolah & kuota AI,
(6) runbook monitoring, (7) checklist go-live sekolah baru.

Status hardening dan disclosure publik: lihat `SECURITY.md` di root repo.
Panduan deploy teknis sekolah baru: lihat `docs/DEPLOY_SCHOOL.md` —
dokumen ini tidak mengulanginya, hanya menambah lapisan keamanan &
operasinya.

---

## 1. SOP Update Keamanan Serentak ke Semua Deployment

Satu basis kode melayani semua sekolah: satu celah berdampak ke semua,
satu perbaikan juga menyembuhkan semua — asalkan digulirkan disiplin.

### 1.1 Klasifikasi urgensi

| Kelas | Contoh | Target mulai gulir | Target selesai |
|---|---|---|---|
| Kritis | RCE, bypass autentikasi, kebocoran data massal | ≤ 4 jam sejak perbaikan tersedia | ≤ 24 jam semua sekolah |
| Tinggi | Eskalasi privilege, injeksi, kebocoran terbatas | ≤ 1 hari kerja | ≤ 3 hari semua sekolah |
| Biasa | Hardening, perbaikan minor, dependensi | Siklus rilis rutin | ≤ 14 hari |

### 1.2 Urutan per deployment (WAJIB, jangan dibalik)

1. **Backup** D1 sekolah itu:
   `npx wrangler d1 export <db-sekolah> --remote --output=backup-<sekolah>-<tanggal>.sql`
   Simpan di penyimpanan vendor yang terenkripsi, beri nama memuat
   sekolah + tanggal + commit yang sedang berjalan.
2. **Catat** versi berjalan (commit/asset build) sekolah itu untuk
   kebutuhan rollback.
3. **Migrasi** (bila rilis membawa migrasi baru):
   `npm run db:migrate:remote` dari checkout pada commit rilis.
   Verifikasi: `npx wrangler d1 migrations list <db-sekolah> --remote`
   → "No migrations to apply!".
4. **Deploy**: `npm run pages:deploy` dari checkout yang sama.
5. **Verifikasi** (semua harus hijau sebelum lanjut ke sekolah berikutnya):
   - `GET https://<domain-sekolah>/api/health` → `status: "ok"`,
     `migration.latestKnown` sesuai rilis.
   - Login uji dengan akun staf sekolah (atau akun uji vendor yang
     disepakati), buka satu halaman data, satu aksi tulis ringan.
   - Buka panel status admin sekolah itu: DB sehat, tidak ada lonjakan
     login gagal yang aneh.
6. **Catat** hasil di log rilis vendor: sekolah, waktu, commit, hasil
   verifikasi, nama operator.

### 1.3 Urutan antar sekolah

- Gulirkan ke **satu sekolah percontohan (canary)** lebih dulu — pilih
  sekolah dengan trafik rendah — amati ≥ 2 jam (untuk kelas Biasa ≥ 1
  hari) sebelum menggulir ke sisanya.
- Untuk kelas Kritis/Tinggi, canary boleh dipersingkat menjadi verifikasi
  penuh langkah 1.2 saja, lalu gulir ke semua sekolah berurutan tanpa
  menunggu; jangan menggulir dua sekolah secara bersamaan oleh operator
  yang sama.
- Bila satu sekolah gagal verifikasi: berhenti untuk sekolah itu,
  rollback (1.4), sekolah lain lanjut hanya bila penyebab kegagalan
  terbukti khusus sekolah itu (mis. konfigurasi), bukan dari rilisnya.

### 1.4 Rollback

- **Kode**: deploy ulang build commit sebelumnya
  (`git checkout <commit-sebelumnya>` → `npm run verify` → `npm run pages:deploy`).
  Build Pages bersifat atomik per deploy; rollback kode tidak menyentuh D1.
- **Data/migrasi**: migrasi bersifat aditif (tabel/kolom baru) sehingga
  kode lama umumnya tetap jalan di skema baru. Bila migrasi terbukti
  merusak: hentikan, jangan menulis migrasi "pembalik" terburu-buru —
  pulihkan D1 dari backup langkah 1 (`wrangler d1 execute --file`) di
  jendela pemeliharaan yang diumumkan ke sekolah, karena restore menimpa
  data yang masuk setelah backup.
- Umumkan status ke sekolah terdampak maksimal 1 jam setelah keputusan
  rollback (lihat juga SOP insiden bila ada dampak data).

### 1.5 Larangan

- Tidak ada deploy produksi tanpa instruksi/catatan rilis yang jelas.
- Tidak ada migrasi remote tanpa backup pada hari yang sama.
- Tidak ada perubahan langsung (hotfix) di dashboard yang tidak kembali
  masuk ke repo.

---

## 2. SOP Respons Insiden & Notifikasi UU PDP 72 Jam

Mengacu UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP):
Pasal 46 mewajibkan pemberitahuan kegagalan pelindungan data pribadi
**paling lambat 3×24 jam (72 jam) sejak diketahui**, kepada (a) subjek
data yang terdampak dan (b) lembaga/otoritas yang berwenang. Data siswa
sebagian adalah data anak — termasuk kategori data pribadi spesifik —
perlakukan setiap insiden yang menyentuhnya sebagai prioritas tertinggi.

> Catatan: uraian ini adalah ringkasan operasional, bukan nasihat hukum.
> Untuk insiden nyata, libatkan penasihat hukum segera.

### 2.1 Peran

- **Operator vendor (penanggap pertama)**: menerima deteksi/laporan,
  membuka catatan insiden, menjalankan penahanan awal.
- **Penanggung jawab vendor**: keputusan eskalasi, komunikasi resmi,
  penandatanganan notifikasi.
- **Pihak sekolah (Pengendali Data)**: pemilik keputusan akhir atas data
  sekolahnya; notifikasi formal kepada subjek data & otoritas diterbitkan
  atas nama/bersama sekolah sesuai perjanjian pemrosesan data.

### 2.2 Linimasa jam-per-jam

| Waktu sejak diketahui | Tindakan |
|---|---|
| 0–1 jam | Buka catatan insiden (waktu, sumber deteksi, dugaan cakupan). Amankan bukti: ekspor log relevan, snapshot status panel, jangan menghapus apa pun. |
| 0–4 jam | **Penahanan**: cabut sesi/rotasi secret yang diduga bocor, nonaktifkan akun yang disalahgunakan, kunci IP/aturan WAF darurat, atau matikan fitur terkait (mis. `GEMINI_ENABLED=false`, pause WhatsApp). Beri tahu penanggung jawab vendor + kontak sekolah. |
| 4–24 jam | **Penilaian**: data apa, subjek siapa (apakah termasuk anak), berapa banyak, apakah data keluar ke pihak tak berhak. Tentukan apakah ambang notifikasi UU PDP terpenuhi (kegagalan pelindungan data pribadi). Libatkan penasihat hukum. |
| 24–48 jam | **Eradikasi & pemulihan**: tutup celah (ikuti SOP update §1), reset kredensial terdampak, pulihkan dari backup bersih bila integritas data diragukan. Susun draf notifikasi. |
| ≤ 72 jam | **Notifikasi WAJIB terkirim** bila ambang terpenuhi: kepada subjek data terdampak (wali siswa melalui sekolah) dan lembaga berwenang. Isi minimum: jenis data yang terungkap, kapan & bagaimana insiden terjadi, dampak yang mungkin timbul, upaya penanganan & pemulihan, kontak yang dapat dihubungi. |
| ≤ 7 hari | Laporan insiden internal lengkap + pelajaran (post-mortem tanpa menyalahkan): akar masalah, linimasa, tindakan perbaikan permanen, perubahan SOP bila perlu. |

### 2.3 Prinsip selama insiden

- Jangan menjanjikan "tidak ada data yang bocor" sebelum penilaian
  selesai; komunikasikan fakta yang sudah pasti saja.
- Jangan menghapus log/bukti. Jangan mengumumkan ke publik sebelum
  notifikasi subjek data berjalan, kecuali diwajibkan otoritas.
- Semua komunikasi eksternal satu pintu (penanggung jawab vendor +
  sekolah).
- Insiden di satu sekolah: periksa proaktif sekolah lain pada hari yang
  sama (basis kode & pola serangan yang sama) — periksa panel status,
  lonjakan login gagal, dan lockout di tiap deployment.

---

## 3. SOP Backup & Uji Restore

### 3.1 Jadwal backup

- **Sebelum setiap migrasi/deploy produksi**: wajib (lihat §1.2).
- **Rutin**: ekspor D1 mingguan per sekolah pada hari yang sama dengan
  cek mingguan (§6.4); retensi: 4 backup mingguan terakhir + backup
  pra-rilis selama 90 hari.
- Perintah: `npx wrangler d1 export <db-sekolah> --remote --output=backup-<sekolah>-<YYYYMMDD>.sql`.
- Simpan terenkripsi di penyimpanan vendor (bukan di repo, bukan di
  laptop pribadi tanpa enkripsi). File backup berisi data pribadi —
  perlakukan setara data produksi.

### 3.2 Uji restore (drill) — triwulanan per sekolah bergilir

1. Buat D1 sementara: `npx wrangler d1 create drill-<sekolah>`.
2. Terapkan migrasi: arahkan binding sementara, `npm run db:migrate:local`
   tidak berlaku untuk remote — gunakan `wrangler d1 migrations apply drill-<sekolah> --remote` dari checkout.
3. Impor backup: `npx wrangler d1 execute drill-<sekolah> --remote --file=backup-<sekolah>-<tanggal>.sql`.
4. Verifikasi: hitung baris tabel kunci (`users`, `students`,
   `attendance_records`, `cbt_exams`) dan bandingkan dengan angka yang
   dicatat saat backup dibuat; jalankan aplikasi lokal/staging terhadap
   D1 drill bila memungkinkan, login uji, buka rapor satu siswa.
5. Catat hasil drill (tanggal, backup yang dipakai, hasil hitung, durasi)
   di log operasional. Hapus D1 drill setelah selesai
   (`wrangler d1 delete drill-<sekolah>`).
6. Drill yang gagal = temuan prioritas: perbaiki prosedur sebelum drill
   berikutnya; backup yang tidak dapat direstore dianggap TIDAK ADA.

---

## 4. Aturan WAF & Edge — Siap Terap per Deployment

Aturan tingkat akun Cloudflare TIDAK dapat dibuat dari repo. Terapkan
persis daftar ini pada zona DNS setiap sekolah saat go-live dan audit
ulang tiap rilis besar (bandingkan dengan `SECURITY_HARDENING.md`):

1. **WAF Managed Rules**: aktif (Cloudflare Managed + OWASP Core Ruleset),
   sensitivitas bawaan.
2. **Bot Fight Mode**: aktif (paket gratis) / Super Bot Fight Mode bila
   berbayar.
3. **Rate limiting rules** (custom, urutan seperti tertulis):
   - Path mengandung `/api/auth/login`, metode POST — ambang 10
     request/menit/IP → **Managed Challenge**.
   - Path mengandung `/api/auth/login/verify-2fa`, metode POST — ambang
     30 request/10 menit/IP → **Managed Challenge**.
   - Path mengandung `/api/upload` — ambang 10 request/jam/IP → **Block**.
   - Path mengandung `/api/cbt/generate` atau `/api/modul-ajar/generate`
     — ambang 30 request/jam/IP → **Managed Challenge**.
4. **IP Access Rule**: path `/api/whatsapp/gateway` hanya dari IP
   komputer operator sekolah (Allowlist) bila IP-nya statis; selain itu
   **Block**. Bila IP operator dinamis, lewati aturan ini dan andalkan
   `X-Gateway-Key` + lapis saklar aplikasi.
5. **Cache rules**: Bypass cache untuk path `/api/*`; cache TTL panjang
   (≥ 30 hari, immutable) hanya untuk `/assets/*` ber-fingerprint.
6. **Deployment preview**: nonaktifkan akses publik ke preview
   deployments, atau lindungi Cloudflare Access; jangan beri binding D1
   produksi ke preview yang tidak dipercaya.
7. **Notifikasi dashboard**: aktifkan alert untuk lonjakan request,
   lonjakan status 429/5xx, pemakaian reads/writes D1 mendekati kuota,
   dan storage D1 — penerima: email operator vendor.
8. **SSL/TLS**: mode Full (Strict), Always Use HTTPS, minimum TLS 1.2,
   HSTS mengikuti header aplikasi.

Catatan: limiter aplikasi (rate limit D1, lockout) adalah lapisan kedua;
aturan edge di atas adalah lapisan pertama untuk beban volumetrik.

---

## 5. SOP Kunci per Sekolah & Kuota AI

### 5.1 Prinsip: satu sekolah = satu set kunci

Tidak ada kunci yang dipakai bersama antar sekolah. Kebocoran satu
sekolah tidak boleh menjalar; kuota pihak ketiga (Gemini) juga terpisah
per sekolah agar satu sekolah tidak menghabiskan anggaran sekolah lain.

| Kunci/variabel | Jenis | Cara memasang | Catatan |
|---|---|---|---|
| `GEMINI_API_KEY` | Pages Secret | `npx wrangler pages secret put GEMINI_API_KEY --project-name <project-sekolah>` | Buat project Google AI Studio TERPISAH per sekolah (idealnya akun Google khusus sekolah/vendor per sekolah). |
| `GEMINI_DAILY_LIMIT` | Vars ([vars]/dashboard) | Dashboard Pages → Settings → Variables | Kosong = tanpa batas. Rekomendasi awal: `200`/hari; sesuaikan dengan jumlah guru × 20 (batas per pengguna per hari). |
| `TOTP_ENCRYPTION_KEY` | Pages Secret | `wrangler pages secret put TOTP_ENCRYPTION_KEY` | String acak ≥ 32 karakter, dibuat sekali per sekolah, **WAJIB stabil**: menggantinya membuat secret 2FA tersimpan tak terbaca (staf harus dibantu admin menonaktifkan 2FA lalu mengaktifkan ulang). Simpan salinannya di pengelola kata sandi vendor. |
| `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` | Vars + Pages Secret | Dashboard Cloudflare Turnstile per domain sekolah | Satu widget Turnstile per domain sekolah. Keduanya kosong = fitur mati (bawaan). |
| `WHATSAPP_GATEWAY_KEY` | Pages Secret + `.env` gateway | Secret put + file `.env` komputer operator | Hanya bila fitur WhatsApp diaktifkan sekolah itu (jalur tidak resmi — persetujuan tertulis sekolah wajib; bawaan nonaktif). |
| `SYNC_TOKEN` | Worker Secret | `npx wrangler secret put SYNC_TOKEN` pada sync-worker sekolah itu | Pasangan token yang sama di Apps Script sekolah itu. |
| Kredensial Cloudflare | Akun vendor | — | Token API per operator, cakupan minimum (Pages + D1 project sekolah yang ditangani); aktifkan 2FA akun Cloudflare & GitHub semua operator. |

### 5.2 Rotasi kunci

- **Rutin**: `GEMINI_API_KEY`, `WHATSAPP_GATEWAY_KEY`, `SYNC_TOKEN`
  dirotasi ≤ 12 bulan atau saat operator berganti.
- **Segera**: dugaan bocor, perangkat operator hilang, atau insiden
  (§2) — rotasi dulu, investigasi kemudian.
- **Prosedur** (semua jenis): buat kunci baru → pasang di deployment →
  verifikasi fitur terkait (generate AI uji / heartbeat gateway) →
  cabut kunci lama di penyedia → catat di log (sekolah, jenis kunci,
  waktu, operator; TANPA menulis nilai kunci).
- `TOTP_ENCRYPTION_KEY` dikecualikan dari rotasi rutin (lihat tabel);
  rotasinya adalah operasi pemeliharaan terjadwal dengan pemberitahuan
  ke seluruh staf sekolah itu untuk menyiapkan ulang 2FA.

### 5.3 Kuota AI (Fase D) — panduan nilai

- Batas per pengguna (20/hari untuk CBT, 20/hari untuk Modul Ajar) sudah
  tetap di kode.
- `GEMINI_DAILY_LIMIT` adalah pagar tingkat sekolah. Titik awal:
  jumlah guru aktif × 10, dibulatkan ke atas (mis. 25 guru → 250).
  Tinjau dari panel status admin: bila pemakaian harian sah sering
  menyentuh > 80% sebelum sore, naikkan 50%; bila mendekati batas karena
  pola tak wajar, periksa dulu (SOP insiden ringan) sebelum menaikkan.
- Kuota pihak Google (AI Studio) tetap berlaku di atas semua ini —
  pantau di konsol Google per project sekolah.

---

## 6. Runbook Monitoring per Sekolah

### 6.1 Monitor uptime eksternal (pasang sekali saat go-live)

1. Buat akun UptimeRobot (gratis) atau Better Stack atas nama vendor;
   buat SATU monitor per sekolah: tipe HTTP(s), URL
   `https://<domain-sekolah>/api/health`, interval 5 menit, kata kunci
   wajib `"status":"ok"`, status code diterima 200.
2. Kontak alert: email operator vendor + satu kanal cepat (grup
   WhatsApp/Telegram internal vendor). Eskalasi: down > 5 menit → operator
   piket memeriksa; down > 15 menit → penanggung jawab + kabari sekolah.
3. Uji alert setiap pemasangan (matikan sesaat lewat URL salah pada
   monitor uji terpisah, jangan mengutak-atik produksi).

### 6.2 Yang dipantau panel status admin (di dalam aplikasi)

Tab Profil → Sistem (admin/super_admin): kesehatan DB + latensi, sesi
aktif, login gagal 24 jam, lockout aktif, kuota AI hari ini, migrasi
dikenal kode, status + heartbeat gateway WhatsApp.

### 6.3 Ambang tindak lanjut

| Sinyal | Ambang | Tindakan |
|---|---|---|
| Monitor uptime | down/503 > 5 menit | Cek dashboard Cloudflare (status Pages/D1), cek rilis terakhir, rollback bila berkaitan (§1.4). |
| Login gagal 24 jam | > 100, atau lockout aktif > 5 | Dugaan serangan tebak password: pastikan Turnstile aktif, terapkan/ketatkan aturan WAF §4, periksa pola IP di log Cloudflare. |
| Kuota AI hari ini | > 80% sebelum 12:00 WIB | Periksa pengguna terberat (log), hubungi sekolah; naikkan batas hanya bila pola sah. |
| Heartbeat WhatsApp | > 15 menit tanpa heartbeat saat fitur aktif | Hubungi operator sekolah: periksa komputer gateway (listrik, internet, sesi WhatsApp). |
| Kuota D1 (dashboard Cloudflare) | reads/writes harian > 70% kuota paket | Investigasi lonjakan (serangan/loop), pertimbangkan naik paket untuk sekolah itu. |
| Latensi DB di panel | > 500 ms berulang | Periksa ukuran D1 & query berat terbaru; catat sebagai temuan kinerja. |

### 6.4 Jadwal cek mingguan operator (per sekolah, ±10 menit)

1. Buka monitor uptime: tidak ada insiden tak tertangani minggu ini.
2. Buka panel status admin sekolah: DB sehat, catat login gagal 24 jam,
   lockout aktif, kuota AI.
3. Dashboard Cloudflare: grafik kuota D1 (reads/writes/storage) dan
   ringkasan keamanan (request diblokir WAF).
4. Pastikan backup mingguan (§3.1) selesai dan tercatat.
5. Catat ringkasan satu baris per sekolah di log operasional vendor.

---

## 7. Checklist Go-Live Sekolah Baru (lapisan keamanan & operasi)

Ikuti dulu seluruh langkah teknis `docs/DEPLOY_SCHOOL.md` (identitas,
aset, D1, migrasi, deploy, smoke test). Tambahkan lapisan ini sebelum
dinyatakan live:

- [ ] Semua migrasi terapan di D1 sekolah (`migrations list` bersih) dan
      backup awal (kondisi kosong + seed) tersimpan.
- [ ] Secret terpasang per sekolah (§5.1): `GEMINI_API_KEY` project
      sendiri; `TOTP_ENCRYPTION_KEY` acak ≥ 32 karakter dan tercatat di
      pengelola kata sandi vendor; `WHATSAPP_GATEWAY_KEY`/`SYNC_TOKEN`
      bila fitur terkait dipakai.
- [ ] `GEMINI_DAILY_LIMIT` diisi nilai awal (§5.3).
- [ ] Widget Turnstile dibuat untuk domain sekolah; site key + secret
      terpasang; uji login dengan token (widget tampil & login berhasil).
- [ ] Aturan WAF & edge §4 diterapkan pada zona domain sekolah dan
      diverifikasi (cek daftar aturan satu per satu).
- [ ] Monitor uptime §6.1 dibuat dan alert teruji.
- [ ] Akun super_admin pertama dibuat dengan password awal acak dari
      sistem; kredensial diserahkan lewat kanal pribadi; pemilik akun
      login, ganti password awal (kebijakan Fase B), lalu **mengaktifkan
      2FA** dan menyimpan kode pemulihan.
- [ ] Seluruh akun staf awal dibuat via panel/impor CSV (password awal
      acak otomatis — tidak pernah sama dengan NISN/NIP/email).
- [ ] Fitur WhatsApp tetap nonaktif sampai sekolah menandatangani
      persetujuan jalur tidak resmi dan tahap canary 1–2 nomor selama
      7–14 hari direncanakan.
- [ ] Dokumen legal ditandatangani: perjanjian pemrosesan data +
      kebijakan privasi diterbitkan sekolah (templat di
      `docs/legal-templates/`, setelah ditinjau penasihat hukum).
- [ ] Kontak insiden dua arah tercatat: operator vendor ↔ penanggung
      jawab sekolah (untuk kewajiban 72 jam §2).
- [ ] Sekolah dicatat di daftar deployment vendor: domain, project
      Pages, nama D1, tanggal go-live, versi/commit, kontak.
