# Security Hardening

## Proteksi Aplikasi

- Sesi browser menggunakan cookie `HttpOnly`, `Secure`, dan `SameSite=Strict`.
- Token sesi disimpan sebagai hash SHA-256 di D1; sesi legacy dimigrasikan saat digunakan.
- Password baru menggunakan PBKDF2-SHA256 600.000 iterasi dan hash lama di-upgrade saat login.
- Login dibatasi per IP dan per akun dengan respons kegagalan generik.
- Request mutasi berbasis cookie wajib berasal dari origin website yang sama.
- Ukuran body dibatasi berdasarkan route dan diverifikasi dari stream aktual.
- Mutation API, upload foto, topik Forum, dan balasan Forum memiliki rate limit.
- Upload foto dibatasi 2 MB, 10 kali per jam, dan 20 foto baru per hari per pengguna.
- Header keamanan diterapkan pada respons API dan aset statis.
- Foto Google Drive baru bersifat privat dan nilai Spreadsheet dinetralisasi dari formula injection.
- Endpoint pengelolaan ketua kelas memvalidasi role target dan mencabut sesi setelah perubahan role.

## Wajib Di Dashboard Cloudflare

Proteksi volumetrik DDoS berada di edge Cloudflare dan tidak dapat digantikan oleh limiter D1. Terapkan aturan berikut pada domain produksi:

1. Aktifkan Cloudflare WAF Managed Rules dan Bot Fight Mode.
2. Buat rate limiting rule untuk `/api/auth/login`: Managed Challenge setelah 10 request per menit per IP.
3. Buat rate limiting rule untuk `/api/upload`: blokir setelah 10 request per jam per IP.
4. Batasi `/api/whatsapp/gateway` ke IP operator jika IP statis tersedia.
5. Bypass cache untuk `/api/*`; cache aset fingerprinted di `/assets/*` dengan TTL panjang.
6. Batasi akses deployment preview dan jangan berikan binding D1 produksi ke preview yang tidak dipercaya.
7. Aktifkan notifikasi lonjakan request, respons 429/5xx, D1 reads/writes, dan penggunaan storage.

## Operasional Rahasia

- File `.env`, kredensial impor, dan sesi WhatsApp wajib berizin `0600` dan tidak masuk Git.
- Rotasi `SYNC_TOKEN`, `WHATSAPP_GATEWAY_KEY`, token Cloudflare, dan password yang pernah dibagikan.
- Cabut sharing publik file/folder Google Drive lama; `SET_PUBLIC_LINKS=false` hanya melindungi file baru.
- Kirim password awal secara pribadi dan wajibkan penggantian pada login pertama.
- Gateway WhatsApp dijalankan sebagai user non-root dengan Chromium sandbox aktif.

## Risiko Residual

- `whatsapp-web.js` masih membawa advisory pada dependency Chromium upstream yang belum memiliki rilis perbaikan. Gateway harus tetap terisolasi dari server produksi dan hanya dijalankan saat diperlukan.
- Rate limiter aplikasi melindungi abuse setelah request mencapai Functions. Serangan DDoS volumetrik tetap harus diblokir oleh WAF/rate limiting Cloudflare di edge.
