# BLUEPRINT_PLAN — Blueprint SIS Multi-Sekolah

Disetujui pemilik project: 18 Agustus 2026.

## Tujuan

Jadikan repo ini template generik: identitas sekolah tersentral di satu tempat, sehingga
sekolah baru bisa dibuat dari template ini (fork per sekolah) tanpa menyentuh kode inti.

## Arsitektur

- `SMK-AT-THAHIRIN` = **template repo** (sumber kebenaran untuk fitur umum).
- Setiap sekolah baru = **repo sendiri** dibuat dari template (terisolasi, bebas fitur).
- **Aturan**: identitas sekolah tersentral di `src/data/schoolConfig.ts` + aset `public/school/` + `src/theme.css` → merge antar repo tidak bentrok.
- **Disiplin**: fitur umum dikerjakan di template lalu di-merge upstream oleh tiap sekolah;
  fitur khusus satu sekolah cukup di repo sekolah itu; fitur khusus yang laku → angkat ke template.

## Batasan keras

- Refactor hanya mengubah **lokasi** data identitas, bukan nilai/perilaku.
- Tanpa migrasi DB, tanpa perubahan skema/API.
- Setiap milestone: `npm run verify` wajib lulus sebelum lanjut; 1 commit per milestone.
- Produksi At-Thahirin berjalan normal sampai deploy final (Milestone 4).
- Rollback: `git revert` + redeploy.

## Milestone

### M1 — Config terpusat (nilai identik)
- Buat `src/data/schoolConfig.ts` berisi identitas sekolah: `SCHOOL_INFO`,
  `INITIAL_USERS`, `JURUSAN_LIST`, `BERITA_LIST`, `SCHOOL_BRAND`, `SCHOOL_FEATURES`.
- Isi = persis nilai `initialData.ts` sekarang.
- `initialData.ts` re-export dari config (pembaca lama tidak berubah).
- Verifikasi: `npm run verify` → semua test lulus.

### M2 — Generate site files + de-hardcode + bersihkan dokumen
- `index.template.html` + `scripts/generate-site-files.mjs`: generate `index.html`,
  `site.webmanifest`, `robots.txt`, `sitemap.xml` dari config — output identik dengan sekarang.
- De-hardcode UI/API/test yang menulis nama sekolah (`CbtSection`, `CbtTestRunner`,
  alt logo, `seo-metadata`, `import-data`, `gemini-endpoints`, `ModulAjarSection`).
- Dokumen: bersihkan header nama sekolah di `rules.md`, `architecture.md`, `schema.md`,
  `prd.md`, `design.md`; tetapkan peran per dokumen (template vs at-thahirin-only).
- Verifikasi: `npm run verify` + diff generated vs file sekarang (identik).

### M3 — Tema + aset generik
- `src/theme.css`: override palet `emerald` via Tailwind 4 `@theme` (tema A;
  default = warna sekarang `#047857`).
- Aset sekolah dipindah ke `public/school/` + dokumen cara ganti.
- Verifikasi: `npm run verify`.

### M4 — Deploy + smoke test produksi (At-Thahirin)
- `npm run pages:deploy` lalu smoke test: landing, login semua role, CBT, presensi, rapor —
  tampilan identik dengan sebelum refactor.
- Verifikasi: smoke test + e2e; rollback siap.

### M5 — Checklist sekolah baru
- Tulis `docs/DEPLOY_SCHOOL.md`: salin repo → edit config → ganti aset → D1 baru →
  migrate → deploy.
- Uji sekolah fiktif hanya setelah M4 selesai dan atas persetujuan pemilik.

## Peran dokumen docs/

| Dokumen | Peran | Di fork sekolah baru |
|---|---|---|
| `rules.md` | Aturan kerja + disiplin identitas (template) | Dipertahankan |
| `architecture.md` | Peta arsitektur (generik) | Dipertahankan |
| `schema.md` | Skema D1 final (generik) | Dipertahankan |
| `prd.md` | Default feature set yang ditawarkan | Dipertahankan, disesuaikan |
| `design.md` | Pola UI/UX + tema | Dipertahankan, disesuaikan |
| `HANDOFF.md` + `archive/` | Riwayat operasional At-Thahirin | Tidak disalin |

## Status

- [x] M1
- [ ] M2
- [ ] M3
- [ ] M4 (butuh persetujuan deploy)
- [ ] M5 (butuh persetujuan)
