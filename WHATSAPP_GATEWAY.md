# WhatsApp Gateway Sekolah

Gateway ini memakai WhatsApp Web personal/tidak resmi. Gunakan nomor khusus sekolah jika sudah tersedia. Nomor pribadi dapat dipakai untuk uji terbatas, tetapi memiliki risiko sesi terputus atau akun dibatasi WhatsApp.

## Setup Cloudflare

1. Buat secret acak minimal 32 karakter.
2. Simpan sebagai Pages secret `WHATSAPP_GATEWAY_KEY`.
3. Jangan menaruh secret di Git atau frontend.

## Setup Komputer Gateway

```bash
cd whatsapp-gateway
npm install
cp .env.example .env
```

Isi `GATEWAY_KEY` pada `.env` dengan secret Cloudflare yang sama, lalu:

- Pastikan Google Chrome sudah terpasang.
- Jika Chrome tidak ditemukan otomatis, isi `CHROME_PATH`. Contoh Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`.
- Pertahankan `GATEWAY_ENABLED=false` sampai heartbeat, allowlist canary, dan emergency pause terverifikasi.

```bash
npm start
```

Scan QR menggunakan WhatsApp nomor pengirim. Sesi tersimpan lokal dalam folder `.wwebjs_auth` dan tidak masuk D1.

## Penggunaan Admin

- Login Super Admin/Admin.
- Buka menu `WhatsApp`.
- Isi maksimal dua nomor wali per siswa dan catat persetujuan.
- Isi nomor guru dan aktifkan reminder.
- Super Admin mengaktifkan pengiriman otomatis.
- Aktivasi lengkap dan rollback mengikuti `EXTERNAL_INTEGRATIONS.md`.

## Penghematan dan Anti-Spam

- Poll aktif setiap 60 detik dan melambat saat antrean kosong.
- Maksimal 25 pesan per batch.
- Jeda acak 5-7 detik per pesan.
- Maksimal dua percobaan otomatis.
- Deduplikasi unik per siswa, tanggal, status, dan nomor wali.
- Alpa dijadwalkan setelah pukul 09.00 WIB.
- Reminder guru satu pesan ringkas per hari dan hanya jika ada jadwal.
- Pesan berstatus `sent_unknown` tidak dikirim ulang otomatis; Super Admin merekonsiliasinya setelah verifikasi manual.
