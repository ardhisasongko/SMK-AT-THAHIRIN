# Deploy ke Cloudflare Pages + Database D1

Panduan ini menjelaskan cara deploy **SMKS PLUS AT THAHIRIN** ke Cloudflare Pages
dengan database **Cloudflare D1** (serverless SQLite).

## Persyaratan

- Akun Cloudflare (gratis).
- Node.js + npm.
- `wrangler` (bundled di package.json — tidak perlu install global).

---

## 1. Setup wrangler (login & konfigurasi)

```bash
npx wrangler login
```

> Membuka browser untuk autentikasi akun Cloudflare.

---

## 2. Buat database D1

```bash
npx wrangler d1 create smk-at-tahirin-db
```

Output-nya berisi `database_id`. Buka `wrangler.toml` dan ganti placeholder:

```toml
[[d1_databases]]
binding = "DB"
database_name = "smk-at-tahirin-db"
database_id = "ISI_DATABASE_ID_ASLI_DI_SINI"   # <-- ganti ini
migrations_dir = "migrations"
```

---

## 3. Jalankan migrasi database

Jalankan migrasi ke **local** (uji coba) lalu ke **remote** (production):

```bash
# Lokal (uji coba)
npx wrangler d1 migrations apply smk-at-tahirin-db --local

# Remote (production D1)
npx wrangler d1 migrations apply smk-at-tahirin-db --remote
```

Migrasi akan membuat tabel `app_data` (penyimpanan JSON per koleksi aplikasi).

---

## 4. Deploy ke Cloudflare Pages

```bash
npm run build
npx wrangler pages deploy dist --project-name smk-at-tahirin
```

- Project Pages dibuat otomatis bernama `smk-at-tahirin` (ganti jika sudah dipakai).
- `pages_build_output_dir = "dist"` di `wrangler.toml` mengarahkan ke hasil build Vite.
- Pages Functions di folder `functions/` otomatis ter-deploy sebagai API Worker.

### Deploy ulang setelah perubahan

```bash
npm run pages:deploy
```

---

## 5. Set Secret GEMINI_API_KEY (untuk fitur AI)

Fitur **Generate Modul Ajar AI** dan **Generate Soal CBT AI** membutuhkan API key Gemini.

### Opsi A: Dashboard Cloudflare
1. Cloudflare Dashboard → **Workers & Pages** → pilih project `smk-at-tahirin`.
2. **Settings → Variables and Secrets → Add secret**.
3. Nama: `GEMINI_API_KEY`, nilai: API key Gemini kamu.

### Opsi B: CLI
```bash
npx wrangler pages secret put GEMINI_API_KEY --project-name smk-at-tahirin
```

> Key diambil dari Google AI Studio: https://aistudio.google.com/apikey

---

## 6. Local development (dengan D1 + Functions)

Jalankan Pages Functions + D1 lokal + frontend build:

```bash
# Persiapan data lokal
npx wrangler d1 migrations apply smk-at-tahirin-db --local

# Jalankan dev server (http://localhost:8788)
npm run pages:dev
```

> Dev server tunggal: `npm run dev` (build Vite + Pages Functions + D1 lokal di port 8788).

---

## Arsitektur data

Semua data aplikasi disimpan di tabel `app_data` sebagai JSON per koleksi:

| Key (koleksi)           | Isi                                |
|--------------------------|------------------------------------|
| `kelas_v1`               | Daftar kelas + jadwal               |
| `siswa_v1`               | Data siswa                          |
| `presensi_v1`            | Rekap presensi                      |
| `modulAjar_v1`           | Modul ajar (termasuk hasil AI)      |
| `forumTopics_v1`         | Topik & balasan forum               |
| `notifications_v1`       | Notifikasi                          |
| `cbtExams_v1`            | Paket ujian CBT                     |
| `cbtSubmissions_v1`      | Hasil pengerjaan siswa              |

Saat deploy pertama (D1 kosong), aplikasi otomatis meng-*seed* data awal dari
`src/data/initialData.ts` ke D1 pada pemuatan pertama.

---

## Endpoint API (Pages Functions)

| Method | Endpoint                | Fungsi                          |
|--------|-------------------------|---------------------------------|
| GET    | `/api/health`           | Health check + status DB        |
| GET    | `/api/data/:key`        | Ambil koleksi data              |
| PUT    | `/api/data/:key`        | Simpan koleksi data             |
| DELETE | `/api/data/:key`        | Hapus koleksi                   |
| POST   | `/api/modul-ajar/generate` | Generate modul ajar dengan AI |
| POST   | `/api/cbt/generate`     | Generate soal CBT dengan AI     |

---

## Troubleshooting

- **`database_id` masih placeholder** → Ganti dengan ID asli hasil `wrangler d1 create`.
- **AI tidak berfungsi** → Pastikan `GEMINI_API_KEY` sudah di-set sebagai Secret (bukan Variable).
- **Deploy pertama data kosong** → Buka aplikasi sekali; data awal otomatis di-seed ke D1.
- **Error CORS / 404 API** → Pastikan halaman diakses lewat URL Pages (bukan file://).
- **Migrasi remote gagal** → Cek bahwa D1 database sudah dibuat & `database_id` benar.
