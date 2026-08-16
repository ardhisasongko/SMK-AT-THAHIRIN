-- Jenis ujian CBT: 'latihan' (bebas kirim) vs 'ujian' (UAS/UTS — ada waktu minimal kirim).
-- min_submit_minutes = waktu minimal pengerjaan sebelum submit diizinkan (default 80% durasi untuk jenis 'ujian').
ALTER TABLE cbt_exams ADD COLUMN exam_type TEXT NOT NULL DEFAULT 'latihan';
ALTER TABLE cbt_exams ADD COLUMN min_submit_minutes INTEGER;