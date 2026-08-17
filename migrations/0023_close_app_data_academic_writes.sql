-- 0023: tutup lapisan app_data sebagai permukaan tulis koleksi akademik.
-- Proyeksi relasional menjadi satu-satunya sumber kebenaran; aplikasi menulis
-- kedua lapisan (proyeksi + mirror app_data) dalam satu batch atomik.
-- Trigger sync lama dihapus agar tidak ada jalur tulis ganda.

-- Re-sync akhir (jaring pengaman): pastikan proyeksi == app_data persis
-- sebelum trigger dilepas. Urutan menghormati FK: kelas -> jadwal -> siswa -> presensi -> modul.
-- Presensi yang merujuk siswa yang tidak ada di tabel students dilewati
-- (tidak memblokir migrasi); mirror app_data tetap menyimpan datanya.

UPDATE school_classes SET active = 0;
DELETE FROM class_schedule_items;
INSERT INTO school_classes
  (id, position, name, jurusan_code, tingkat, ruang, wali_kelas, jumlah_siswa, fields, source_json, active)
SELECT json_extract(j.value, '$.id'), CAST(j.key AS INTEGER), json_extract(j.value, '$.name'),
       json_extract(j.value, '$.jurusanCode'), json_extract(j.value, '$.tingkat'),
       json_extract(j.value, '$.ruang'), json_extract(j.value, '$.waliKelas'),
       json_extract(j.value, '$.jumlahSiswa'), json(j.value), json(j.value), 1
FROM app_data AS a, json_each(a.value) AS j
WHERE a.key = 'kelas_v1' AND json_valid(a.value) AND json_type(a.value) = 'array'
ON CONFLICT(id) DO UPDATE SET position=excluded.position, name=excluded.name,
  jurusan_code=excluded.jurusan_code, tingkat=excluded.tingkat, ruang=excluded.ruang,
  wali_kelas=excluded.wali_kelas, jumlah_siswa=excluded.jumlah_siswa,
  fields=excluded.fields, source_json=excluded.source_json, active=1;

INSERT INTO class_schedule_items
  (class_id, position, hari, jam_ke, jam_rentan, mata_pelajaran, guru, ruangan, fields, source_json)
SELECT json_extract(c.value, '$.id'), CAST(s.key AS INTEGER), json_extract(s.value, '$.hari'),
       json_extract(s.value, '$.jamKe'), json_extract(s.value, '$.jamRentan'),
       json_extract(s.value, '$.mataPelajaran'), json_extract(s.value, '$.guru'),
       json_extract(s.value, '$.ruangan'), json(s.value), json(s.value)
FROM app_data AS a, json_each(a.value) AS c, json_each(json_extract(c.value, '$.jadwal')) AS s
WHERE a.key = 'kelas_v1' AND json_valid(a.value) AND json_type(a.value) = 'array'
ON CONFLICT(class_id, position) DO UPDATE SET hari=excluded.hari, jam_ke=excluded.jam_ke,
  jam_rentan=excluded.jam_rentan, mata_pelajaran=excluded.mata_pelajaran,
  guru=excluded.guru, ruangan=excluded.ruangan, fields=excluded.fields, source_json=excluded.source_json;

UPDATE students SET active = 0;
INSERT INTO students (id, position, nisn, class_id, name, gender, foto, fields, source_json, active)
SELECT json_extract(j.value, '$.id'), CAST(j.key AS INTEGER), json_extract(j.value, '$.nisn'),
       json_extract(j.value, '$.classId'), json_extract(j.value, '$.name'),
       json_extract(j.value, '$.gender'), json_extract(j.value, '$.foto'), json(j.value), json(j.value), 1
FROM app_data AS a, json_each(a.value) AS j
WHERE a.key = 'siswa_v1' AND json_valid(a.value) AND json_type(a.value) = 'array'
ON CONFLICT(id) DO UPDATE SET position=excluded.position, nisn=excluded.nisn,
  class_id=excluded.class_id, name=excluded.name, gender=excluded.gender, foto=excluded.foto,
  fields=excluded.fields, source_json=excluded.source_json, active=1;

DELETE FROM attendance_records;
INSERT INTO attendance_records
  (tanggal, student_id, id, position, class_id, student_name, nisn, status, keterangan,
   waktu_input, foto_url, input_by_json, lokasi_json, fields, source_json)
SELECT json_extract(j.value, '$.tanggal'), json_extract(j.value, '$.siswaId'),
       json_extract(j.value, '$.id'), CAST(j.key AS INTEGER), json_extract(j.value, '$.classId'),
       json_extract(j.value, '$.siswaName'), json_extract(j.value, '$.nisn'),
       json_extract(j.value, '$.status'), json_extract(j.value, '$.keterangan'),
       json_extract(j.value, '$.waktuInput'), json_extract(j.value, '$.fotoUrl'),
       json_extract(j.value, '$.inputBy'), json_extract(j.value, '$.lokasi'), json(j.value), json(j.value)
FROM app_data AS a, json_each(a.value) AS j
WHERE a.key = 'presensi_v1' AND json_valid(a.value) AND json_type(a.value) = 'array'
  AND EXISTS (SELECT 1 FROM students s WHERE s.id = json_extract(j.value, '$.siswaId'))
ON CONFLICT(tanggal, student_id) DO UPDATE SET id=excluded.id, position=excluded.position,
  class_id=excluded.class_id, student_name=excluded.student_name, nisn=excluded.nisn,
  status=excluded.status, keterangan=excluded.keterangan, waktu_input=excluded.waktu_input,
  foto_url=excluded.foto_url, input_by_json=excluded.input_by_json, lokasi_json=excluded.lokasi_json,
  fields=excluded.fields, source_json=excluded.source_json;

UPDATE teaching_modules SET active = 0;
INSERT INTO teaching_modules
  (id, position, judul, mata_pelajaran, jurusan, fase_kelas, alokasi_waktu,
   tanggal_dibuat, pembuat, data_json, fields, source_json, active)
SELECT json_extract(j.value, '$.id'), CAST(j.key AS INTEGER), json_extract(j.value, '$.judul'),
       json_extract(j.value, '$.mataPelajaran'), json_extract(j.value, '$.jurusan'),
       json_extract(j.value, '$.faseKelas'), json_extract(j.value, '$.alokasiWaktu'),
       json_extract(j.value, '$.tanggalDibuat'), json_extract(j.value, '$.pembuat'),
       json_extract(j.value, '$.data'), json(j.value), json(j.value), 1
FROM app_data AS a, json_each(a.value) AS j
WHERE a.key = 'modulAjar_v1' AND json_valid(a.value) AND json_type(a.value) = 'array'
ON CONFLICT(id) DO UPDATE SET position=excluded.position, judul=excluded.judul,
  mata_pelajaran=excluded.mata_pelajaran, jurusan=excluded.jurusan, fase_kelas=excluded.fase_kelas,
  alokasi_waktu=excluded.alokasi_waktu, tanggal_dibuat=excluded.tanggal_dibuat,
  pembuat=excluded.pembuat, data_json=excluded.data_json, fields=excluded.fields,
  source_json=excluded.source_json, active=1;

-- Lepas trigger sinkronisasi: sejak migrasi ini, hanya writer aplikasi yang
-- memperbarui proyeksi (batch atomik dua lapisan).
DROP TRIGGER IF EXISTS sync_kelas_projection_insert;
DROP TRIGGER IF EXISTS sync_kelas_projection_update;
DROP TRIGGER IF EXISTS sync_siswa_projection_insert;
DROP TRIGGER IF EXISTS sync_siswa_projection_update;
DROP TRIGGER IF EXISTS sync_presensi_projection_insert;
DROP TRIGGER IF EXISTS sync_presensi_projection_update;
DROP TRIGGER IF EXISTS sync_modules_projection_insert;
DROP TRIGGER IF EXISTS sync_modules_projection_update;