# AGENTS.md — Konteks Project SMKS PLUS AT THAHIRIN

Project: Sistem Informasi Sekolah — React 19 SPA (Vite) + Cloudflare Pages Functions + D1 (SQLite), domain `smk-at-tahirin.pages.dev`.

## WAJIB dibaca di awal setiap sesi

1. **`docs/HANDOFF.md`** — status proyek terbaru, perubahan sesi sebelumnya, verifikasi terakhir, tindak lanjut.
2. **`docs/rules.md`** — aturan kerja: perintah, migrasi, pola backend/frontend, keamanan, konvensi commit.
3. **`docs/architecture.md`** — arsitektur (auth, RBAC, rate limit, integrasi Gemini/WhatsApp/Google Sync).
4. **`docs/schema.md`** — skema D1 per domain (versi final dari 22 migrasi) + anomali yang perlu diingat.
5. **`docs/prd.md`** & **`docs/design.md`** — cakupan fitur dan pola UI/UX bila sesi menyentuh fitur/UI.

## Ringkasan singkat

- Stack: React 19 + Vite + Tailwind 4 | Cloudflare Pages Functions | D1 `DB` | Vitest | Wrangler.
- Verifikasi wajib sebelum selesai: `npm run verify` (lint + test + sync-worker + build).
- 5 role: `super_admin`, `admin`, `guru`, `ketua_kelas`, `siswa` — RBAC diperiksa di server.
- Jangan edit migrasi D1 yang sudah diterapkan; buat migrasi baru, backup D1 sebelum remote.
- Jangan commit `.env*`, `imported/`, `data/*.xlsx`.
- Di akhir sesi: perbarui `docs/HANDOFF.md`; commit per milestone kecil.
- Bahasa komunikasi: Indonesia (UI, error, docs).

Aturan global pengguna (di `~/.config/opencode/AGENTS.md`) juga tetap berlaku.