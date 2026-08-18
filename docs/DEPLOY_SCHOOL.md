# DEPLOY_SCHOOL.md — Panduan Deploy Sekolah Baru dari Template

Panduan step-by-step menyalin template SIS ini untuk sekolah baru.
Durasi: ~30 menit (termasuk deploy & smoke test).

## Prasyarat

- Node.js 18+ & npm
- Cloudflare account (Pages + D1)
- Wrangler CLI (`npx wrangler` sudah ada di project)
- Git

## Langkah

### 1. Fork &克隆 repo

```bash
git clone https://github.com/<owner>/SMK-AT-THAHIRIN.git smk-<nama-sekolah>
cd smk-<nama-sekolah>
rm -rf .git && git init
npm install
```

### 2. Edit `src/data/schoolConfig.ts`

Ganti SEMUA field identitas sekolah:

| Field | Contoh |
|---|---|
| `SCHOOL_INFO.name` | `'SMK NEGERI TEKNOLOGI'` |
| `SCHOOL_INFO.npsn` | NPSN resmi dari Kemendikbud |
| `SCHOOL_INFO.akreditasi` | Status akreditasi |
| `SCHOOL_INFO.alamat` | Alamat lengkap |
| `SCHOOL_INFO.telepon` | Telepon lokal |
| `SCHOOL_INFO.whatsapp` | Nomor WA aktif |
| `SCHOOL_INFO.email` | Email resmi sekolah |
| `SCHOOL_INFO.website` | Domain sekolah |
| `SCHOOL_INFO.kepalaSekolah` | Nama kepala sekolah |
| `SCHOOL_INFO.address` | Alamat terstruktur (street, locality, region, postalCode, country) |
| `SCHOOL_INFO.sambutan` | Sambutan kepala sekolah |
| `SCHOOL_INFO.stats` | Data statistik (siswa, guru, jurusan, mitra, persenKerja) |
| `INITIAL_USERS` | Data user awal (admin, guru, siswa) — minimal 1 admin |
| `JURUSAN_LIST` | Daftar jurusan (id, code, name, description, kepalaJurusan, prospekKerja, fasilitas, color) |
| `BERITA_LIST` | Berita awal (judul, tanggal, kategori, ringkasan, konten, gambar URL, penulis) |
| `SCHOOL_BRAND.themeColor` | Warna hex (misal `'#1e40af'` untuk biru) |
| `SCHOOL_BRAND.domain` | Domain Cloudflare Pages (misal `'smkn1.pages.dev'`) |
| `SCHOOL_BRAND.ogImage` | Nama file OG image (harus ada di `public/school/`) |
| `SCHOOL_BRAND.manifestName` | Nama singkat untuk manifest PWA |
| `SCHOOL_BRAND.manifestShortName` | Nama sangat pendek (max 12 char) |
| `SCHOOL_FEATURES` | Aktifkan/nonaktifkan fitur: `cbt`, `whatsapp`, `gemini`, `googleSync` |

### 3. Ganti aset sekolah di `public/school/`

Ganti file berikut (nama TIDAK berubah):

| File | Deskripsi | Ukuran ideal |
|---|---|---|
| `school-mark.svg` | Logo sekolah (SVG) | Any |
| `icon-192.png` | Ikon PWA 192×192 | 192×192 px |
| `icon-512.png` | Ikon PWA 512×512 | 512×512 px |
| `og-smk-at-thahirin.png` | OG image (1200×630) | 1200×630 px |

> **Penting**: Jika nama OG image berubah, update `SCHOOL_BRAND.ogImage`.
> File OG lama (`og-smk-at-thahirin.png/.svg`) bisa dihapus.

### 4. (Opsional) Ubah tema warna

Edit `src/theme.css` — ganti nilai `--color-emerald-*` ke warna baru.
Contoh untuk biru:

```css
@theme {
  --color-emerald-50: oklch(0.97 0.02 250);
  --color-emerald-100: oklch(0.93 0.04 250);
  /* ... sesuaikan semua stop ... */
}
```

> Warna `emerald` dipakai di seluruh UI. Ganti SEMUA stop agar konsisten.

### 5. Generate file situs

```bash
npm run generate:site
```

Output: `index.html`, `public/site.webmanifest`, `public/robots.txt`, `public/sitemap.xml`.
Semua data diambil dari `schoolConfig.ts`.

### 6. Buat D1 Database

```bash
# Buat database baru
npx wrangler d1 create smk-<nama-sekolah>-db
```

Catat `database_id` dari output.

### 7. Update `wrangler.toml`

Edit:
- `name` → nama project Pages
- `database_name` → nama D1 baru
- `database_id` → ID dari langkah 6
- `[vars].APP_NAME` → nama sekolah
- `[vars].SCHOOL_NAME` → nama sekolah
- `[vars].SCHOOL_EMAIL_DOMAIN` → domain email

### 8. Jalankan migrasi

```bash
# Local (testing)
npx wrangler d1 migrations apply <database-name> --local

# Remote (production)
npx wrangler d1 migrations apply <database-name> --remote
```

### 9. Set secrets (opsional)

```bash
npx wrangler pages secret put GEMINI_API_KEY --project-name <project-name>
```

### 10. Build & Deploy

```bash
npm run pages:deploy
```

### 11. Smoke test

```bash
# Ganti URL dengan domain Pages sekolah baru
curl -s https://<project>.pages.dev/ | grep '<title>'
curl -s https://<project>.pages.dev/api/health
curl -s https://<project>.pages.dev/robots.txt
```

## Checklist

- [ ] `schoolConfig.ts` — semua field terisi
- [ ] `public/school/` — 4 file aset diganti
- [ ] `npm run generate:site` — sukses
- [ ] `wrangler.toml` — database_id benar
- [ ] Migrasi remote diterapkan
- [ ] `npm run pages:deploy` — deploy sukses
- [ ] Smoke test lulus (title, health, robots)

## Rollback

Jika deploy bermasalah:
```bash
git log --oneline -5          # cari commit terakhir yang bagus
git revert <commit>           # revert perubahan
npm run pages:deploy          # deploy ulang
```

## Catatan

- Domain email sekolah (misal `@smkn1.sch.id`) **tidak diubah di config ini** — hanya `SCHOOL_EMAIL_DOMAIN` yang diperbarui untuk fungsi backend.
- `SCHOOL_FEATURES.googleSync` default `false` — aktifkan hanya jika sekolah pakai Google Classroom Sync.
- Setiap sekolah baru = repo sendiri. Fitur umum di-merge dari template upstream; fitur khusus cukup di repo sekolah itu.
