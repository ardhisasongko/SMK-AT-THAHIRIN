# Operasional Integrasi Eksternal

Dokumen ini mencakup Gemini, WhatsApp Web, dan sinkronisasi Google Drive/Spreadsheet. Integrasi tidak menjadi syarat agar fitur inti sekolah tetap berjalan.

## Guardrail

- Jangan mengaktifkan integrasi langsung di produksi sebelum dry-run dan canary selesai.
- Gunakan secret berbeda untuk staging dan production.
- Jangan menyimpan API key, token, session WhatsApp, atau kredensial operator di Git.
- Periksa status teragregasi melalui `GET /api/integrations/status` sebagai Admin/Super Admin.
- Presensi tetap menjadi sumber kebenaran. Kegagalan notifikasi/sinkronisasi tidak boleh membatalkan penyimpanan presensi.

## Gemini

Gemini hanya aktif jika API key tersedia dan `GEMINI_ENABLED` bernilai `true`, `1`, `yes`, atau `on`.

Konfigurasi Pages:

```text
GEMINI_ENABLED=true
GEMINI_MODEL=gemini-3.6-flash
GEMINI_API_KEY=<Cloudflare secret>
```

Endpoint memiliki timeout, retry terbatas untuk kegagalan jaringan/429/5xx, pemeriksaan safety/finish reason, batas output, dan validasi schema sebelum hasil dikirim ke UI.

Rollback: ubah `GEMINI_ENABLED=false`. Form manual tetap dapat digunakan.

## Google Drive dan Spreadsheet

Worker default aman:

```text
SYNC_ENABLED=false
SYNC_DRY_RUN=true
SYNC_BATCH_SIZE=5
```

Apps Script membutuhkan Script Property `SYNC_TOKEN`. Jangan menulis token ke source `sync.gs`.

### Rollout

1. Deploy Apps Script baru sebagai Web App dan gunakan Spreadsheet/folder Drive staging.
2. Pasang secret Worker: `npx wrangler secret put SYNC_TOKEN` dari direktori `sync-worker`.
3. Set `SYNC_ENABLED=true`, pertahankan `SYNC_DRY_RUN=true`, lalu deploy Worker.
4. Jalankan `POST /?job=daily` dan `POST /?job=weekly` memakai Bearer token.
5. Pastikan respons `dry-run`, job status tercatat, dan tidak ada perubahan Drive/Sheet.
6. Set `SYNC_DRY_RUN=false` hanya setelah data dry-run sesuai.
7. Ulangi job yang sama untuk memastikan idempotensi dan tidak ada baris/file duplikat.
8. Verifikasi minimal tiga job harian dan satu job mingguan sebelum mengandalkan cron.

Worker menggunakan batch maksimal 10, lock ber-lease, stable key/fingerprint, retry bounded, dan sheet versi baru (`Harian Sync v2`, `Rekap Sync v2`). Data foto penuh di D1 tidak pernah dihapus oleh Worker.

Rollback: set `SYNC_ENABLED=false`, deploy Worker, lalu audit status `google_sync_status_v1`. Sheet lama tidak dimodifikasi.

## WhatsApp Web

Gateway memakai `whatsapp-web.js`, bukan API resmi Meta. Gunakan nomor khusus sekolah dan mulai dari allowlist 1-2 penerima yang telah memberi persetujuan.

### Lapisan Aktivasi

Semua lapisan berikut harus aktif sebelum pesan dapat dikirim:

1. `whatsapp_settings.enabled` aktif.
2. Integration gate `external_integrations.enabled` aktif.
3. Emergency pause nonaktif.
4. Rollout `canary` dengan allowlist atau `all`.
5. Environment gateway `GATEWAY_ENABLED=true`.

Gateway tetap tidak mengirim bila salah satu lapisan di atas belum terpenuhi. `begin_send` memeriksa ulang kill switch agar emergency pause dapat menghentikan batch yang sudah diklaim.

### Canary

1. Terapkan migrasi `0017_external_integrations.sql`.
2. Jalankan gateway dengan `GATEWAY_ENABLED=false`, scan QR, dan pastikan heartbeat terlihat di panel.
3. Masukkan 1-2 nomor internal ke allowlist dan pilih rollout `canary`.
4. Aktifkan automatic sending dan integration gate, lalu nonaktifkan emergency pause.
5. Terakhir ubah gateway menjadi `GATEWAY_ENABLED=true` dan restart.
6. Uji disconnect/reconnect, restart, retry, consent revoke, dan emergency pause.
7. Pantau `pending`, `processing`, `sent_unknown`, `sent`, dan `failed`.

Status `sent_unknown` tidak dikirim ulang otomatis karena provider mungkin sudah menerima pesan. Super Admin harus memverifikasi secara manual lalu menandainya `sent` atau `failed` melalui panel.

Cleanup retensi merupakan aksi eksplisit Admin melalui `POST /api/whatsapp/history` dengan body:

```json
{ "action": "cleanup" }
```

Rollback darurat: aktifkan emergency pause, set integration gate OFF, set `GATEWAY_ENABLED=false`, lalu restart gateway. Jangan langsung menghapus outbox karena diperlukan untuk audit.

## Verifikasi Lokal

```bash
npm run verify
node --check whatsapp-gateway/src/index.js
```

`npm run verify` menjalankan typecheck aplikasi, seluruh test utama, test/typecheck sync-worker, dan production build. CI menjalankan verifikasi yang sama serta Wrangler dry-run untuk sync-worker.

## Batasan Eksternal

- Aktivasi produksi memerlukan secret Cloudflare, deployment Apps Script, Chrome operator, scan QR, serta penerima canary. Langkah ini tidak dapat diselesaikan hanya dengan perubahan codebase.
- WhatsApp Web dapat mengalami pemutusan sesi atau pembatasan akun oleh WhatsApp.
- Nilai integrasi A baru layak diberikan setelah bukti canary 7-14 hari: tanpa kehilangan data/duplikasi, heartbeat dan rollback terbukti, serta minimal tiga sinkronisasi harian dan satu mingguan berhasil.
