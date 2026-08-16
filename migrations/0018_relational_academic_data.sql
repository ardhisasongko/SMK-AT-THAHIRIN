-- Indexed relational projection for the legacy academic JSON collections.
-- app_data remains the compatibility write surface; triggers keep this projection current.

CREATE TABLE IF NOT EXISTS academic_collection_revisions (
  key TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  initialized INTEGER NOT NULL DEFAULT 0 CHECK (initialized IN (0, 1)),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS school_classes (
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  jurusan_code TEXT NOT NULL,
  tingkat TEXT NOT NULL,
  ruang TEXT NOT NULL,
  wali_kelas TEXT NOT NULL,
  jumlah_siswa INTEGER NOT NULL,
  fields TEXT NOT NULL,
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_school_classes_active_position
ON school_classes(active, position);

CREATE TABLE IF NOT EXISTS class_schedule_items (
  class_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  hari TEXT NOT NULL,
  jam_ke TEXT NOT NULL,
  jam_rentan TEXT NOT NULL,
  mata_pelajaran TEXT NOT NULL,
  guru TEXT NOT NULL,
  ruangan TEXT NOT NULL,
  fields TEXT NOT NULL,
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  PRIMARY KEY (class_id, position),
  FOREIGN KEY (class_id) REFERENCES school_classes(id)
);

CREATE INDEX IF NOT EXISTS idx_class_schedule_class_position
ON class_schedule_items(class_id, position);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  nisn TEXT NOT NULL,
  class_id TEXT NOT NULL,
  name TEXT NOT NULL,
  gender TEXT NOT NULL,
  foto TEXT NOT NULL,
  fields TEXT NOT NULL,
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  FOREIGN KEY (class_id) REFERENCES school_classes(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_active_nisn_unique
ON students(nisn) WHERE active = 1;
CREATE INDEX IF NOT EXISTS idx_students_active_position ON students(active, position);
CREATE INDEX IF NOT EXISTS idx_students_class_active ON students(class_id, active, position);

CREATE TABLE IF NOT EXISTS attendance_records (
  tanggal TEXT NOT NULL,
  student_id TEXT NOT NULL,
  id TEXT NOT NULL UNIQUE,
  position INTEGER NOT NULL,
  class_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  nisn TEXT NOT NULL,
  status TEXT NOT NULL,
  keterangan TEXT,
  waktu_input TEXT NOT NULL,
  foto_url TEXT,
  input_by_json TEXT,
  lokasi_json TEXT,
  fields TEXT NOT NULL,
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  PRIMARY KEY (tanggal, student_id),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance_records(class_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(tanggal);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance_records(student_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_attendance_status_date ON attendance_records(status, tanggal);
CREATE INDEX IF NOT EXISTS idx_attendance_photo ON attendance_records(foto_url) WHERE foto_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_position ON attendance_records(position);

CREATE TABLE IF NOT EXISTS teaching_modules (
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  judul TEXT NOT NULL,
  mata_pelajaran TEXT NOT NULL,
  jurusan TEXT NOT NULL,
  fase_kelas TEXT NOT NULL,
  alokasi_waktu TEXT NOT NULL,
  tanggal_dibuat TEXT NOT NULL,
  pembuat TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK (json_valid(data_json)),
  fields TEXT NOT NULL,
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_modules_active_position ON teaching_modules(active, position);
CREATE INDEX IF NOT EXISTS idx_modules_subject ON teaching_modules(mata_pelajaran, active);
CREATE INDEX IF NOT EXISTS idx_modules_program_phase ON teaching_modules(jurusan, fase_kelas, active);
CREATE INDEX IF NOT EXISTS idx_modules_created ON teaching_modules(tanggal_dibuat, active);
CREATE INDEX IF NOT EXISTS idx_modules_author ON teaching_modules(pembuat, active);

INSERT OR IGNORE INTO academic_collection_revisions (key, revision, initialized, updated_at)
SELECT wanted.key, CASE WHEN app_data.key IS NULL THEN 0 ELSE 1 END,
       CASE WHEN app_data.key IS NULL THEN 0 ELSE 1 END, unixepoch()
FROM (
  SELECT 'kelas_v1' AS key UNION ALL SELECT 'siswa_v1' UNION ALL
  SELECT 'presensi_v1' UNION ALL SELECT 'modulAjar_v1'
) AS wanted
LEFT JOIN app_data ON app_data.key = wanted.key;

-- Backfill only valid arrays. Invalid legacy JSON remains untouched and is surfaced by the API.
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

INSERT INTO students (id, position, nisn, class_id, name, gender, foto, fields, source_json, active)
SELECT json_extract(j.value, '$.id'), CAST(j.key AS INTEGER), json_extract(j.value, '$.nisn'),
       json_extract(j.value, '$.classId'), json_extract(j.value, '$.name'),
       json_extract(j.value, '$.gender'), json_extract(j.value, '$.foto'), json(j.value), json(j.value), 1
FROM app_data AS a, json_each(a.value) AS j
WHERE a.key = 'siswa_v1' AND json_valid(a.value) AND json_type(a.value) = 'array'
ON CONFLICT(id) DO UPDATE SET position=excluded.position, nisn=excluded.nisn,
  class_id=excluded.class_id, name=excluded.name, gender=excluded.gender, foto=excluded.foto,
  fields=excluded.fields, source_json=excluded.source_json, active=1;

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
ON CONFLICT(tanggal, student_id) DO UPDATE SET id=excluded.id, position=excluded.position,
  class_id=excluded.class_id, student_name=excluded.student_name, nisn=excluded.nisn,
  status=excluded.status, keterangan=excluded.keterangan, waktu_input=excluded.waktu_input,
  foto_url=excluded.foto_url, input_by_json=excluded.input_by_json, lokasi_json=excluded.lokasi_json,
  fields=excluded.fields, source_json=excluded.source_json;

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

CREATE TRIGGER IF NOT EXISTS sync_kelas_projection_insert
AFTER INSERT ON app_data
WHEN NEW.key = 'kelas_v1' AND json_valid(NEW.value) AND json_type(NEW.value) = 'array'
BEGIN
  UPDATE school_classes SET active = 0;
  DELETE FROM class_schedule_items;
  INSERT INTO school_classes
    (id, position, name, jurusan_code, tingkat, ruang, wali_kelas, jumlah_siswa, fields, source_json, active)
  SELECT json_extract(value,'$.id'), CAST(key AS INTEGER), json_extract(value,'$.name'),
    json_extract(value,'$.jurusanCode'), json_extract(value,'$.tingkat'), json_extract(value,'$.ruang'),
    json_extract(value,'$.waliKelas'), json_extract(value,'$.jumlahSiswa'), json(value), json(value), 1
  FROM json_each(NEW.value) WHERE 1
  ON CONFLICT(id) DO UPDATE SET position=excluded.position,name=excluded.name,jurusan_code=excluded.jurusan_code,
    tingkat=excluded.tingkat,ruang=excluded.ruang,wali_kelas=excluded.wali_kelas,
    jumlah_siswa=excluded.jumlah_siswa,fields=excluded.fields,source_json=excluded.source_json,active=1;
  INSERT INTO class_schedule_items
    (class_id, position, hari, jam_ke, jam_rentan, mata_pelajaran, guru, ruangan, fields, source_json)
  SELECT json_extract(c.value,'$.id'), CAST(s.key AS INTEGER), json_extract(s.value,'$.hari'),
    json_extract(s.value,'$.jamKe'), json_extract(s.value,'$.jamRentan'), json_extract(s.value,'$.mataPelajaran'),
    json_extract(s.value,'$.guru'), json_extract(s.value,'$.ruangan'), json(s.value), json(s.value)
  FROM json_each(NEW.value) c, json_each(json_extract(c.value,'$.jadwal')) s;
  INSERT INTO academic_collection_revisions(key,revision,initialized,updated_at) VALUES(NEW.key,1,1,unixepoch())
    ON CONFLICT(key) DO UPDATE SET revision=revision+1,initialized=1,updated_at=unixepoch();
END;

CREATE TRIGGER IF NOT EXISTS sync_kelas_projection_update
AFTER UPDATE OF value ON app_data
WHEN NEW.key = 'kelas_v1' AND json_valid(NEW.value) AND json_type(NEW.value) = 'array'
BEGIN
  UPDATE school_classes SET active = 0;
  DELETE FROM class_schedule_items;
  INSERT INTO school_classes
    (id, position, name, jurusan_code, tingkat, ruang, wali_kelas, jumlah_siswa, fields, source_json, active)
  SELECT json_extract(value,'$.id'), CAST(key AS INTEGER), json_extract(value,'$.name'),
    json_extract(value,'$.jurusanCode'), json_extract(value,'$.tingkat'), json_extract(value,'$.ruang'),
    json_extract(value,'$.waliKelas'), json_extract(value,'$.jumlahSiswa'), json(value), json(value), 1
  FROM json_each(NEW.value) WHERE 1
  ON CONFLICT(id) DO UPDATE SET position=excluded.position,name=excluded.name,jurusan_code=excluded.jurusan_code,
    tingkat=excluded.tingkat,ruang=excluded.ruang,wali_kelas=excluded.wali_kelas,
    jumlah_siswa=excluded.jumlah_siswa,fields=excluded.fields,source_json=excluded.source_json,active=1;
  INSERT INTO class_schedule_items
    (class_id, position, hari, jam_ke, jam_rentan, mata_pelajaran, guru, ruangan, fields, source_json)
  SELECT json_extract(c.value,'$.id'), CAST(s.key AS INTEGER), json_extract(s.value,'$.hari'),
    json_extract(s.value,'$.jamKe'), json_extract(s.value,'$.jamRentan'), json_extract(s.value,'$.mataPelajaran'),
    json_extract(s.value,'$.guru'), json_extract(s.value,'$.ruangan'), json(s.value), json(s.value)
  FROM json_each(NEW.value) c, json_each(json_extract(c.value,'$.jadwal')) s;
  UPDATE academic_collection_revisions SET revision=revision+1,initialized=1,updated_at=unixepoch() WHERE key=NEW.key;
END;

CREATE TRIGGER IF NOT EXISTS sync_siswa_projection_insert
AFTER INSERT ON app_data
WHEN NEW.key = 'siswa_v1' AND json_valid(NEW.value) AND json_type(NEW.value) = 'array'
BEGIN
  UPDATE students SET active = 0;
  INSERT INTO students(id,position,nisn,class_id,name,gender,foto,fields,source_json,active)
  SELECT json_extract(value,'$.id'),CAST(key AS INTEGER),json_extract(value,'$.nisn'),json_extract(value,'$.classId'),
    json_extract(value,'$.name'),json_extract(value,'$.gender'),json_extract(value,'$.foto'),json(value),json(value),1
  FROM json_each(NEW.value) WHERE 1
  ON CONFLICT(id) DO UPDATE SET position=excluded.position,nisn=excluded.nisn,class_id=excluded.class_id,
    name=excluded.name,gender=excluded.gender,foto=excluded.foto,fields=excluded.fields,source_json=excluded.source_json,active=1;
  INSERT INTO academic_collection_revisions(key,revision,initialized,updated_at) VALUES(NEW.key,1,1,unixepoch())
    ON CONFLICT(key) DO UPDATE SET revision=revision+1,initialized=1,updated_at=unixepoch();
END;

CREATE TRIGGER IF NOT EXISTS sync_siswa_projection_update
AFTER UPDATE OF value ON app_data
WHEN NEW.key = 'siswa_v1' AND json_valid(NEW.value) AND json_type(NEW.value) = 'array'
BEGIN
  UPDATE students SET active = 0;
  INSERT INTO students(id,position,nisn,class_id,name,gender,foto,fields,source_json,active)
  SELECT json_extract(value,'$.id'),CAST(key AS INTEGER),json_extract(value,'$.nisn'),json_extract(value,'$.classId'),
    json_extract(value,'$.name'),json_extract(value,'$.gender'),json_extract(value,'$.foto'),json(value),json(value),1
  FROM json_each(NEW.value) WHERE 1
  ON CONFLICT(id) DO UPDATE SET position=excluded.position,nisn=excluded.nisn,class_id=excluded.class_id,
    name=excluded.name,gender=excluded.gender,foto=excluded.foto,fields=excluded.fields,source_json=excluded.source_json,active=1;
  UPDATE academic_collection_revisions SET revision=revision+1,initialized=1,updated_at=unixepoch() WHERE key=NEW.key;
END;

CREATE TRIGGER IF NOT EXISTS sync_presensi_projection_insert
AFTER INSERT ON app_data
WHEN NEW.key = 'presensi_v1' AND json_valid(NEW.value) AND json_type(NEW.value) = 'array'
BEGIN
  DELETE FROM attendance_records;
  INSERT INTO attendance_records(tanggal,student_id,id,position,class_id,student_name,nisn,status,keterangan,waktu_input,
    foto_url,input_by_json,lokasi_json,fields,source_json)
  SELECT json_extract(value,'$.tanggal'),json_extract(value,'$.siswaId'),json_extract(value,'$.id'),CAST(key AS INTEGER),
    json_extract(value,'$.classId'),json_extract(value,'$.siswaName'),json_extract(value,'$.nisn'),json_extract(value,'$.status'),
    json_extract(value,'$.keterangan'),json_extract(value,'$.waktuInput'),json_extract(value,'$.fotoUrl'),
    json_extract(value,'$.inputBy'),json_extract(value,'$.lokasi'),json(value),json(value) FROM json_each(NEW.value);
  INSERT INTO academic_collection_revisions(key,revision,initialized,updated_at) VALUES(NEW.key,1,1,unixepoch())
    ON CONFLICT(key) DO UPDATE SET revision=revision+1,initialized=1,updated_at=unixepoch();
END;

CREATE TRIGGER IF NOT EXISTS sync_presensi_projection_update
AFTER UPDATE OF value ON app_data
WHEN NEW.key = 'presensi_v1' AND json_valid(NEW.value) AND json_type(NEW.value) = 'array'
BEGIN
  DELETE FROM attendance_records;
  INSERT INTO attendance_records(tanggal,student_id,id,position,class_id,student_name,nisn,status,keterangan,waktu_input,
    foto_url,input_by_json,lokasi_json,fields,source_json)
  SELECT json_extract(value,'$.tanggal'),json_extract(value,'$.siswaId'),json_extract(value,'$.id'),CAST(key AS INTEGER),
    json_extract(value,'$.classId'),json_extract(value,'$.siswaName'),json_extract(value,'$.nisn'),json_extract(value,'$.status'),
    json_extract(value,'$.keterangan'),json_extract(value,'$.waktuInput'),json_extract(value,'$.fotoUrl'),
    json_extract(value,'$.inputBy'),json_extract(value,'$.lokasi'),json(value),json(value) FROM json_each(NEW.value);
  UPDATE academic_collection_revisions SET revision=revision+1,initialized=1,updated_at=unixepoch() WHERE key=NEW.key;
END;

CREATE TRIGGER IF NOT EXISTS sync_modules_projection_insert
AFTER INSERT ON app_data
WHEN NEW.key = 'modulAjar_v1' AND json_valid(NEW.value) AND json_type(NEW.value) = 'array'
BEGIN
  UPDATE teaching_modules SET active = 0;
  INSERT INTO teaching_modules(id,position,judul,mata_pelajaran,jurusan,fase_kelas,alokasi_waktu,tanggal_dibuat,pembuat,
    data_json,fields,source_json,active)
  SELECT json_extract(value,'$.id'),CAST(key AS INTEGER),json_extract(value,'$.judul'),json_extract(value,'$.mataPelajaran'),
    json_extract(value,'$.jurusan'),json_extract(value,'$.faseKelas'),json_extract(value,'$.alokasiWaktu'),
    json_extract(value,'$.tanggalDibuat'),json_extract(value,'$.pembuat'),json_extract(value,'$.data'),json(value),json(value),1
  FROM json_each(NEW.value) WHERE 1
  ON CONFLICT(id) DO UPDATE SET position=excluded.position,judul=excluded.judul,mata_pelajaran=excluded.mata_pelajaran,
    jurusan=excluded.jurusan,fase_kelas=excluded.fase_kelas,alokasi_waktu=excluded.alokasi_waktu,
    tanggal_dibuat=excluded.tanggal_dibuat,pembuat=excluded.pembuat,data_json=excluded.data_json,
    fields=excluded.fields,source_json=excluded.source_json,active=1;
  INSERT INTO academic_collection_revisions(key,revision,initialized,updated_at) VALUES(NEW.key,1,1,unixepoch())
    ON CONFLICT(key) DO UPDATE SET revision=revision+1,initialized=1,updated_at=unixepoch();
END;

CREATE TRIGGER IF NOT EXISTS sync_modules_projection_update
AFTER UPDATE OF value ON app_data
WHEN NEW.key = 'modulAjar_v1' AND json_valid(NEW.value) AND json_type(NEW.value) = 'array'
BEGIN
  UPDATE teaching_modules SET active = 0;
  INSERT INTO teaching_modules(id,position,judul,mata_pelajaran,jurusan,fase_kelas,alokasi_waktu,tanggal_dibuat,pembuat,
    data_json,fields,source_json,active)
  SELECT json_extract(value,'$.id'),CAST(key AS INTEGER),json_extract(value,'$.judul'),json_extract(value,'$.mataPelajaran'),
    json_extract(value,'$.jurusan'),json_extract(value,'$.faseKelas'),json_extract(value,'$.alokasiWaktu'),
    json_extract(value,'$.tanggalDibuat'),json_extract(value,'$.pembuat'),json_extract(value,'$.data'),json(value),json(value),1
  FROM json_each(NEW.value) WHERE 1
  ON CONFLICT(id) DO UPDATE SET position=excluded.position,judul=excluded.judul,mata_pelajaran=excluded.mata_pelajaran,
    jurusan=excluded.jurusan,fase_kelas=excluded.fase_kelas,alokasi_waktu=excluded.alokasi_waktu,
    tanggal_dibuat=excluded.tanggal_dibuat,pembuat=excluded.pembuat,data_json=excluded.data_json,
    fields=excluded.fields,source_json=excluded.source_json,active=1;
  UPDATE academic_collection_revisions SET revision=revision+1,initialized=1,updated_at=unixepoch() WHERE key=NEW.key;
END;
