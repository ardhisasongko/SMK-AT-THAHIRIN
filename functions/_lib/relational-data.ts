export const RELATIONAL_COLLECTIONS = new Set([
  'kelas_v1',
  'siswa_v1',
  'presensi_v1',
  'modulAjar_v1',
]);

type CollectionKey = 'kelas_v1' | 'siswa_v1' | 'presensi_v1' | 'modulAjar_v1';
type JsonObject = Record<string, unknown>;

export class CollectionDataError extends Error {}

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CollectionDataError(`${label} harus berupa objek.`);
  }
  return value as JsonObject;
}

function string(value: unknown, label: string, max = 500): string {
  if (typeof value !== 'string' || !value || value.length > max) {
    throw new CollectionDataError(`${label} tidak valid.`);
  }
  return value;
}

function number(value: unknown, label: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || Number(value) < 0) {
    throw new CollectionDataError(`${label} tidak valid.`);
  }
  return Number(value);
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new CollectionDataError(`${label} harus berupa array string.`);
  }
  return value;
}

function unique(records: JsonObject[], field: string, label: string): void {
  const seen = new Set<string>();
  for (const record of records) {
    const value = string(record[field], label, 100);
    if (seen.has(value)) throw new CollectionDataError(`${label} duplikat: ${value}.`);
    seen.add(value);
  }
}

function validateClasses(records: JsonObject[]): void {
  unique(records, 'id', 'ID kelas');
  for (const [index, record] of records.entries()) {
    const label = `Kelas ke-${index + 1}`;
    string(record.name, `${label} nama`);
    string(record.jurusanCode, `${label} jurusanCode`, 50);
    if (!['X', 'XI', 'XII'].includes(string(record.tingkat, `${label} tingkat`, 3))) {
      throw new CollectionDataError(`${label} tingkat tidak valid.`);
    }
    string(record.ruang, `${label} ruang`);
    string(record.waliKelas, `${label} waliKelas`);
    number(record.jumlahSiswa, `${label} jumlahSiswa`);
    if (!Array.isArray(record.jadwal)) throw new CollectionDataError(`${label} jadwal harus berupa array.`);
    for (const [scheduleIndex, rawSchedule] of record.jadwal.entries()) {
      const schedule = object(rawSchedule, `${label} jadwal ke-${scheduleIndex + 1}`);
      const day = string(schedule.hari, `${label} hari`, 10);
      if (!['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].includes(day)) {
        throw new CollectionDataError(`${label} hari tidak valid.`);
      }
      for (const field of ['jamKe', 'jamRentan', 'mataPelajaran', 'guru', 'ruangan']) {
        string(schedule[field], `${label} ${field}`);
      }
    }
  }
}

function validateStudents(records: JsonObject[]): void {
  unique(records, 'id', 'ID siswa');
  unique(records, 'nisn', 'NISN');
  for (const [index, record] of records.entries()) {
    const label = `Siswa ke-${index + 1}`;
    string(record.name, `${label} nama`);
    string(record.classId, `${label} classId`, 100);
    if (!['L', 'P'].includes(string(record.gender, `${label} gender`, 1))) {
      throw new CollectionDataError(`${label} gender tidak valid.`);
    }
    string(record.foto, `${label} foto`, 2_000);
    for (const field of ['nik', 'tanggalLahir', 'noHpOrangTua']) {
      if (record[field] != null && typeof record[field] !== 'string') {
        throw new CollectionDataError(`${label} ${field} tidak valid.`);
      }
    }
  }
}

function validateAttendance(records: JsonObject[]): void {
  unique(records, 'id', 'ID presensi');
  const composites = new Set<string>();
  for (const [index, record] of records.entries()) {
    const label = `Presensi ke-${index + 1}`;
    const tanggal = string(record.tanggal, `${label} tanggal`, 10);
    const studentId = string(record.siswaId, `${label} siswaId`, 100);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw new CollectionDataError(`${label} tanggal tidak valid.`);
    const composite = `${tanggal}|${studentId}`;
    if (composites.has(composite)) throw new CollectionDataError(`Presensi duplikat untuk ${composite}.`);
    composites.add(composite);
    string(record.classId, `${label} classId`, 100);
    string(record.siswaName, `${label} siswaName`);
    string(record.nisn, `${label} NISN`, 30);
    if (!['Hadir', 'Terlambat', 'Sakit', 'Izin', 'Alpa'].includes(string(record.status, `${label} status`, 20))) {
      throw new CollectionDataError(`${label} status tidak valid.`);
    }
    if (!/^\d{2}:\d{2}:\d{2}$/.test(string(record.waktuInput, `${label} waktuInput`, 8))) {
      throw new CollectionDataError(`${label} waktuInput tidak valid.`);
    }
    if (record.keterangan != null && (typeof record.keterangan !== 'string' || record.keterangan.length > 500)) {
      throw new CollectionDataError(`${label} keterangan tidak valid.`);
    }
    if (record.fotoUrl != null && typeof record.fotoUrl !== 'string') throw new CollectionDataError(`${label} fotoUrl tidak valid.`);
    if (record.inputBy != null) {
      const inputBy = object(record.inputBy, `${label} inputBy`);
      string(inputBy.id, `${label} inputBy.id`, 100);
      string(inputBy.name, `${label} inputBy.name`);
      string(inputBy.role, `${label} inputBy.role`, 30);
    }
    if (record.lokasi != null) {
      const lokasi = object(record.lokasi, `${label} lokasi`);
      if (!Number.isFinite(lokasi.lat) || !Number.isFinite(lokasi.lng)
        || Number(lokasi.lat) < -90 || Number(lokasi.lat) > 90
        || Number(lokasi.lng) < -180 || Number(lokasi.lng) > 180) {
        throw new CollectionDataError(`${label} lokasi tidak valid.`);
      }
    }
  }
}

function validateModules(records: JsonObject[]): void {
  unique(records, 'id', 'ID modul');
  for (const [index, record] of records.entries()) {
    const label = `Modul ke-${index + 1}`;
    for (const field of ['judul', 'mataPelajaran', 'jurusan', 'faseKelas', 'alokasiWaktu', 'tanggalDibuat', 'pembuat']) {
      string(record[field], `${label} ${field}`, 1_000);
    }
    const data = object(record.data, `${label} data`);
    string(data.judul, `${label} data.judul`, 1_000);
    const identity = object(data.identitas, `${label} identitas`);
    for (const field of ['sekolah', 'mataPelajaran', 'jurusan', 'faseKelas', 'alokasiWaktu', 'tahunAjaran']) {
      string(identity[field], `${label} identitas.${field}`, 1_000);
    }
    strings(data.profilPelajarPancasila, `${label} profilPelajarPancasila`);
    strings(data.saranaPrasarana, `${label} saranaPrasarana`);
    string(data.targetPesertaDidik, `${label} targetPesertaDidik`, 5_000);
    string(data.modelPembelajaran, `${label} modelPembelajaran`, 1_000);
    const core = object(data.komponenInti, `${label} komponenInti`);
    strings(core.tujuanPembelajaran, `${label} tujuanPembelajaran`);
    string(core.pemahamanBermakna, `${label} pemahamanBermakna`, 10_000);
    strings(core.pertanyaanPemantik, `${label} pertanyaanPemantik`);
    const activities = object(core.kegiatanPembelajaran, `${label} kegiatanPembelajaran`);
    strings(activities.pendahuluan, `${label} pendahuluan`);
    strings(activities.inti, `${label} inti`);
    strings(activities.penutup, `${label} penutup`);
    const assessment = object(core.asesmen, `${label} asesmen`);
    for (const field of ['diagnostik', 'formatif', 'sumatif']) string(assessment[field], `${label} asesmen.${field}`, 10_000);
    string(core.pengayaanDanRemidial, `${label} pengayaanDanRemidial`, 10_000);
    if (data.lampiran != null) {
      const attachment = object(data.lampiran, `${label} lampiran`);
      for (const field of ['lembarKerjaSiswa', 'bahanBacaanGuruSiswa']) {
        if (attachment[field] != null && typeof attachment[field] !== 'string') throw new CollectionDataError(`${label} ${field} tidak valid.`);
      }
      if (attachment.glosarium != null) strings(attachment.glosarium, `${label} glosarium`);
    }
  }
}

export function validateCollection(key: string, value: unknown): JsonObject[] {
  if (!RELATIONAL_COLLECTIONS.has(key)) throw new CollectionDataError('Koleksi relational tidak dikenal.');
  if (!Array.isArray(value)) throw new CollectionDataError(`${key} harus berupa array.`);
  if (value.length > 10_000) throw new CollectionDataError(`Jumlah data ${key} terlalu besar.`);
  const records = value.map((item, index) => object(item, `${key} item ke-${index + 1}`));
  if (key === 'kelas_v1') validateClasses(records);
  if (key === 'siswa_v1') validateStudents(records);
  if (key === 'presensi_v1') validateAttendance(records);
  if (key === 'modulAjar_v1') validateModules(records);
  return records;
}

function parseJson(value: unknown, label: string): unknown {
  try {
    return JSON.parse(String(value));
  } catch {
    throw new CollectionDataError(`${label} rusak dan tidak dapat diproses.`);
  }
}

function isMissingProjection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such table: (academic_collection_revisions|school_classes|students|attendance_records|teaching_modules)/i.test(message);
}

function fromSource(row: Record<string, unknown>): JsonObject {
  return object(parseJson(row.source_json, 'Data projection'), 'Data projection');
}

export interface CollectionReadResult {
  data: JsonObject[] | null;
  revision: number;
}

async function readProjection(db: D1Database, key: CollectionKey): Promise<JsonObject[]> {
  if (key === 'kelas_v1') {
    const [classes, schedules] = await Promise.all([
      db.prepare('SELECT * FROM school_classes WHERE active = 1 ORDER BY position').all<Record<string, unknown>>(),
      db.prepare('SELECT * FROM class_schedule_items ORDER BY class_id, position').all<Record<string, unknown>>(),
    ]);
    const byClass = new Map<string, JsonObject[]>();
    for (const row of schedules.results) {
      const item = { ...fromSource(row), hari: row.hari, jamKe: row.jam_ke, jamRentan: row.jam_rentan,
        mataPelajaran: row.mata_pelajaran, guru: row.guru, ruangan: row.ruangan };
      const list = byClass.get(String(row.class_id)) || [];
      list.push(item);
      byClass.set(String(row.class_id), list);
    }
    return classes.results.map(row => ({ ...fromSource(row), id: row.id, name: row.name,
      jurusanCode: row.jurusan_code, tingkat: row.tingkat, ruang: row.ruang, waliKelas: row.wali_kelas,
      jumlahSiswa: Number(row.jumlah_siswa), jadwal: byClass.get(String(row.id)) || [] }));
  }
  if (key === 'siswa_v1') {
    const rows = await db.prepare('SELECT * FROM students WHERE active = 1 ORDER BY position').all<Record<string, unknown>>();
    return rows.results.map(row => ({ ...fromSource(row), id: row.id, nisn: row.nisn, name: row.name,
      classId: row.class_id, gender: row.gender, foto: row.foto }));
  }
  if (key === 'presensi_v1') {
    const rows = await db.prepare('SELECT * FROM attendance_records ORDER BY position').all<Record<string, unknown>>();
    return rows.results.map(row => {
      const item: JsonObject = { ...fromSource(row), id: row.id, tanggal: row.tanggal, classId: row.class_id,
        siswaId: row.student_id, siswaName: row.student_name, nisn: row.nisn, status: row.status,
        waktuInput: row.waktu_input };
      if (Object.hasOwn(item, 'keterangan')) item.keterangan = row.keterangan;
      if (Object.hasOwn(item, 'fotoUrl')) item.fotoUrl = row.foto_url;
      if (Object.hasOwn(item, 'inputBy')) item.inputBy = row.input_by_json == null ? null : parseJson(row.input_by_json, 'inputBy');
      if (Object.hasOwn(item, 'lokasi')) item.lokasi = row.lokasi_json == null ? null : parseJson(row.lokasi_json, 'lokasi');
      return item;
    });
  }
  const rows = await db.prepare('SELECT * FROM teaching_modules WHERE active = 1 ORDER BY position').all<Record<string, unknown>>();
  return rows.results.map(row => ({ ...fromSource(row), id: row.id, judul: row.judul,
    mataPelajaran: row.mata_pelajaran, jurusan: row.jurusan, faseKelas: row.fase_kelas,
    alokasiWaktu: row.alokasi_waktu, tanggalDibuat: row.tanggal_dibuat, pembuat: row.pembuat,
    data: parseJson(row.data_json, 'Data modul') }));
}

// Sejak migrasi 0023, proyeksi relasional adalah satu-satunya sumber kebenaran
// (app_data hanya mirror). Fallback ke app_data hanya untuk deploy yang belum
// menjalankan migrasi atau koleksi yang proyeksinya belum diinisialisasi.
export async function readRelationalCollection(db: D1Database, key: CollectionKey): Promise<CollectionReadResult> {
  const revisionRow = await db.prepare(
    'SELECT revision, initialized FROM academic_collection_revisions WHERE key = ?'
  ).bind(key).first<{ revision: number; initialized: number }>();
  const initialized = Boolean(revisionRow && Number(revisionRow.initialized) === 1);

  if (initialized) {
    const data = await readProjection(db, key);
    validateCollection(key, data);
    return { data, revision: Number(revisionRow.revision) };
  }

  const sourceRow = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(key).first<{ value: string }>();
  if (!sourceRow) return { data: null, revision: Number(revisionRow?.revision || 0) };
  const source = validateCollection(key, parseJson(sourceRow.value, `Data ${key}`));
  return { data: source, revision: Number(revisionRow?.revision || 0) };
}

export interface CollectionWriteResult {
  conflict: boolean;
  revision: number;
}

const REVISION_GUARD_CHECK = 'CHECK constraint failed: revision >= 0';

function projectionReplaceStatements(db: D1Database, key: CollectionKey, serialized: string): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  if (key === 'kelas_v1') {
    statements.push(
      db.prepare('UPDATE school_classes SET active = 0'),
      db.prepare('DELETE FROM class_schedule_items'),
      db.prepare(
        `INSERT INTO school_classes
           (id, position, name, jurusan_code, tingkat, ruang, wali_kelas, jumlah_siswa, fields, source_json, active)
         SELECT json_extract(value,'$.id'), CAST(key AS INTEGER), json_extract(value,'$.name'),
           json_extract(value,'$.jurusanCode'), json_extract(value,'$.tingkat'), json_extract(value,'$.ruang'),
           json_extract(value,'$.waliKelas'), json_extract(value,'$.jumlahSiswa'), json(value), json(value), 1
         FROM json_each(?) WHERE 1
         ON CONFLICT(id) DO UPDATE SET position=excluded.position, name=excluded.name, jurusan_code=excluded.jurusan_code,
           tingkat=excluded.tingkat, ruang=excluded.ruang, wali_kelas=excluded.wali_kelas,
           jumlah_siswa=excluded.jumlah_siswa, fields=excluded.fields, source_json=excluded.source_json, active=1`
      ).bind(serialized),
      db.prepare(
        `INSERT INTO class_schedule_items
           (class_id, position, hari, jam_ke, jam_rentan, mata_pelajaran, guru, ruangan, fields, source_json)
         SELECT json_extract(c.value,'$.id'), CAST(s.key AS INTEGER), json_extract(s.value,'$.hari'),
           json_extract(s.value,'$.jamKe'), json_extract(s.value,'$.jamRentan'), json_extract(s.value,'$.mataPelajaran'),
           json_extract(s.value,'$.guru'), json_extract(s.value,'$.ruangan'), json(s.value), json(s.value)
         FROM json_each(?) c, json_each(json_extract(c.value,'$.jadwal')) s`
      ).bind(serialized),
    );
  } else if (key === 'siswa_v1') {
    statements.push(
      db.prepare('UPDATE students SET active = 0'),
      db.prepare(
        `INSERT INTO students (id, position, nisn, class_id, name, gender, foto, fields, source_json, active)
         SELECT json_extract(value,'$.id'), CAST(key AS INTEGER), json_extract(value,'$.nisn'),
           json_extract(value,'$.classId'), json_extract(value,'$.name'), json_extract(value,'$.gender'),
           json_extract(value,'$.foto'), json(value), json(value), 1
         FROM json_each(?) WHERE 1
         ON CONFLICT(id) DO UPDATE SET position=excluded.position, nisn=excluded.nisn, class_id=excluded.class_id,
           name=excluded.name, gender=excluded.gender, foto=excluded.foto,
           fields=excluded.fields, source_json=excluded.source_json, active=1`
      ).bind(serialized),
    );
  } else if (key === 'presensi_v1') {
    statements.push(
      db.prepare('DELETE FROM attendance_records'),
      db.prepare(
        `INSERT INTO attendance_records
           (tanggal, student_id, id, position, class_id, student_name, nisn, status, keterangan,
            waktu_input, foto_url, input_by_json, lokasi_json, fields, source_json)
         SELECT json_extract(value,'$.tanggal'), json_extract(value,'$.siswaId'), json_extract(value,'$.id'),
           CAST(key AS INTEGER), json_extract(value,'$.classId'), json_extract(value,'$.siswaName'),
           json_extract(value,'$.nisn'), json_extract(value,'$.status'), json_extract(value,'$.keterangan'),
           json_extract(value,'$.waktuInput'), json_extract(value,'$.fotoUrl'),
           json_extract(value,'$.inputBy'), json_extract(value,'$.lokasi'), json(value), json(value)
         FROM json_each(?) WHERE 1
         ON CONFLICT(tanggal, student_id) DO UPDATE SET id=excluded.id, position=excluded.position,
           class_id=excluded.class_id, student_name=excluded.student_name, nisn=excluded.nisn,
           status=excluded.status, keterangan=excluded.keterangan, waktu_input=excluded.waktu_input,
           foto_url=excluded.foto_url, input_by_json=excluded.input_by_json, lokasi_json=excluded.lokasi_json,
           fields=excluded.fields, source_json=excluded.source_json`
      ).bind(serialized),
    );
  } else {
    statements.push(
      db.prepare('UPDATE teaching_modules SET active = 0'),
      db.prepare(
        `INSERT INTO teaching_modules
           (id, position, judul, mata_pelajaran, jurusan, fase_kelas, alokasi_waktu,
            tanggal_dibuat, pembuat, data_json, fields, source_json, active)
         SELECT json_extract(value,'$.id'), CAST(key AS INTEGER), json_extract(value,'$.judul'),
           json_extract(value,'$.mataPelajaran'), json_extract(value,'$.jurusan'), json_extract(value,'$.faseKelas'),
           json_extract(value,'$.alokasiWaktu'), json_extract(value,'$.tanggalDibuat'), json_extract(value,'$.pembuat'),
           json_extract(value,'$.data'), json(value), json(value), 1
         FROM json_each(?) WHERE 1
         ON CONFLICT(id) DO UPDATE SET position=excluded.position, judul=excluded.judul,
           mata_pelajaran=excluded.mata_pelajaran, jurusan=excluded.jurusan, fase_kelas=excluded.fase_kelas,
           alokasi_waktu=excluded.alokasi_waktu, tanggal_dibuat=excluded.tanggal_dibuat,
           pembuat=excluded.pembuat, data_json=excluded.data_json, fields=excluded.fields,
           source_json=excluded.source_json, active=1`
      ).bind(serialized),
    );
  }
  return statements;
}

// Pravalidasi referensi FK agar batch tidak gagal di tengah dengan pesan yang
// tidak jelas. Kelas/ siswa yang dirujuk bisa saja non-aktif (soft-delete),
// barisnya tetap ada sehingga FK valid.
async function ensureReferencedIdsExist(db: D1Database, key: CollectionKey, records: JsonObject[]): Promise<void> {
  if (key === 'siswa_v1') {
    const classIds = [...new Set(records.map(r => String(r.classId)))];
    if (classIds.length === 0) return;
    const placeholders = classIds.map(() => '?').join(',');
    const rows = await db.prepare(`SELECT id FROM school_classes WHERE id IN (${placeholders})`)
      .bind(...classIds).all<{ id: string }>();
    const found = new Set(rows.results.map(r => String(r.id)));
    const missing = classIds.find(id => !found.has(id));
    if (missing) throw new CollectionDataError(`Kelas ${missing} tidak ditemukan pada data kelas.`);
  } else if (key === 'presensi_v1') {
    const studentIds = [...new Set(records.map(r => String(r.siswaId)))];
    if (studentIds.length === 0) return;
    const placeholders = studentIds.map(() => '?').join(',');
    const rows = await db.prepare(`SELECT id FROM students WHERE id IN (${placeholders})`)
      .bind(...studentIds).all<{ id: string }>();
    const found = new Set(rows.results.map(r => String(r.id)));
    const missing = studentIds.find(id => !found.has(id));
    if (missing) throw new CollectionDataError(`Presensi merujuk siswa ${missing} yang tidak ada pada data siswa.`);
  }
}

export async function writeRelationalCollection(
  db: D1Database,
  key: CollectionKey,
  value: unknown,
  expectedRevision?: number,
): Promise<CollectionWriteResult> {
  const records = validateCollection(key, value);
  const serialized = JSON.stringify(value);
  const now = Math.floor(Date.now() / 1000);

  try {
    await ensureReferencedIdsExist(db, key, records);
  } catch (error) {
    if (!isMissingProjection(error)) throw error;
    // Deploy sebelum migrasi 0023: tabel proyeksi belum ada, cek FK dilewati.
  }

  const statements: D1PreparedStatement[] = [];
  if (expectedRevision !== undefined) {
    // Guard CAS atomik: menyisipkan baris dengan revision -1 (melanggar
    // CHECK revision >= 0) bila revisi sudah berubah -> statement gagal ->
    // seluruh batch D1 di-rollback. RAISE() tidak bisa dipakai di luar trigger.
    statements.push(db.prepare(
      `INSERT INTO academic_collection_revisions(key, revision, initialized, updated_at)
       SELECT ?1, -1, 0, unixepoch()
       WHERE (SELECT revision FROM academic_collection_revisions WHERE key = ?1) IS NOT ?2`
    ).bind(key, expectedRevision));
  }
  statements.push(...projectionReplaceStatements(db, key, serialized));
  statements.push(db.prepare(
    `INSERT INTO app_data (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(key, serialized, now));
  statements.push(db.prepare(
    `INSERT INTO academic_collection_revisions(key, revision, initialized, updated_at)
     VALUES (?, 1, 1, unixepoch())
     ON CONFLICT(key) DO UPDATE SET revision = revision + 1, initialized = 1, updated_at = unixepoch()`
  ).bind(key));

  try {
    await db.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(REVISION_GUARD_CHECK)) {
      const current = await db.prepare('SELECT revision FROM academic_collection_revisions WHERE key=?')
        .bind(key).first<{ revision: number }>();
      return { conflict: true, revision: Number(current?.revision || 0) };
    }
    // Deploy sebelum migrasi 0023: tabel proyeksi belum ada -> tulis legacy
    // (trigger lama masih ada dan tetap menyinkronkan proyeksi).
    if (isMissingProjection(error)) {
      await db.prepare(
        `INSERT INTO app_data (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      ).bind(key, serialized, now).run();
      return { conflict: false, revision: 0 };
    }
    throw error;
  }

  const revision = await db.prepare('SELECT revision FROM academic_collection_revisions WHERE key=?')
    .bind(key).first<{ revision: number }>();
  return { conflict: false, revision: Number(revision?.revision || 0) };
}