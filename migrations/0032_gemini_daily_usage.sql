-- Hardening Fase D: penghitung pemakaian AI (Gemini) harian per deployment.
-- Satu baris per hari kalender WIB (day = 'YYYY-MM-DD' Asia/Jakarta).
-- request_count dinaikkan atomik oleh setiap panggilan endpoint AI yang
-- lolos gerbang awal; batasnya dibaca dari env GEMINI_DAILY_LIMIT
-- (kosong/0 = tanpa batas). Baris hari lama dibiarkan sebagai riwayat
-- pemakaian dan tidak dihapus otomatis.
CREATE TABLE IF NOT EXISTS gemini_daily_usage (
  day TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
