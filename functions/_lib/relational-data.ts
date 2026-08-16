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

export async function readRelationalCollection(db: D1Database, key: CollectionKey): Promise<CollectionReadResult> {
  const sourceRow = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(key).first<{ value: string }>();
  let source: JsonObject[] | null = null;
  if (sourceRow) source = validateCollection(key, parseJson(sourceRow.value, `Data ${key}`));

  try {
    const revisionRow = await db.prepare(
      'SELECT revision FROM academic_collection_revisions WHERE key = ?'
    ).bind(key).first<{ revision: number }>();
    if (!source) return { data: null, revision: Number(revisionRow?.revision || 0) };

    let data: JsonObject[];
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
      data = classes.results.map(row => ({ ...fromSource(row), id: row.id, name: row.name,
        jurusanCode: row.jurusan_code, tingkat: row.tingkat, ruang: row.ruang, waliKelas: row.wali_kelas,
        jumlahSiswa: Number(row.jumlah_siswa), jadwal: byClass.get(String(row.id)) || [] }));
    } else if (key === 'siswa_v1') {
      const rows = await db.prepare('SELECT * FROM students WHERE active = 1 ORDER BY position').all<Record<string, unknown>>();
      data = rows.results.map(row => ({ ...fromSource(row), id: row.id, nisn: row.nisn, name: row.name,
        classId: row.class_id, gender: row.gender, foto: row.foto }));
    } else if (key === 'presensi_v1') {
      const rows = await db.prepare('SELECT * FROM attendance_records ORDER BY position').all<Record<string, unknown>>();
      data = rows.results.map(row => {
        const item: JsonObject = { ...fromSource(row), id: row.id, tanggal: row.tanggal, classId: row.class_id,
          siswaId: row.student_id, siswaName: row.student_name, nisn: row.nisn, status: row.status,
          waktuInput: row.waktu_input };
        if (Object.hasOwn(item, 'keterangan')) item.keterangan = row.keterangan;
        if (Object.hasOwn(item, 'fotoUrl')) item.fotoUrl = row.foto_url;
        if (Object.hasOwn(item, 'inputBy')) item.inputBy = row.input_by_json == null ? null : parseJson(row.input_by_json, 'inputBy');
        if (Object.hasOwn(item, 'lokasi')) item.lokasi = row.lokasi_json == null ? null : parseJson(row.lokasi_json, 'lokasi');
        return item;
      });
    } else {
      const rows = await db.prepare('SELECT * FROM teaching_modules WHERE active = 1 ORDER BY position').all<Record<string, unknown>>();
      data = rows.results.map(row => ({ ...fromSource(row), id: row.id, judul: row.judul,
        mataPelajaran: row.mata_pelajaran, jurusan: row.jurusan, faseKelas: row.fase_kelas,
        alokasiWaktu: row.alokasi_waktu, tanggalDibuat: row.tanggal_dibuat, pembuat: row.pembuat,
        data: parseJson(row.data_json, 'Data modul') }));
    }
    validateCollection(key, data);
    if (JSON.stringify(data) !== JSON.stringify(source)) {
      throw new CollectionDataError(`Projection ${key} tidak sinkron dengan data sumber.`);
    }
    return { data, revision: Number(revisionRow?.revision || 0) };
  } catch (error) {
    if (isMissingProjection(error)) return { data: source, revision: 0 };
    throw error;
  }
}

export interface CollectionWriteResult {
  conflict: boolean;
  revision: number;
}

export async function writeRelationalCollection(
  db: D1Database,
  key: CollectionKey,
  value: unknown,
  expectedRevision?: number,
): Promise<CollectionWriteResult> {
  validateCollection(key, value);
  const serialized = JSON.stringify(value);
  const now = Math.floor(Date.now() / 1000);
  try {
    let result: D1Result;
    if (expectedRevision === undefined) {
      result = await db.prepare(
        `INSERT INTO app_data (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
      ).bind(key, serialized, now).run();
    } else {
      result = await db.prepare(
        `INSERT INTO app_data (key, value, updated_at)
         SELECT ?, ?, ? WHERE (SELECT revision FROM academic_collection_revisions WHERE key = ?) = ?
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
         WHERE (SELECT revision FROM academic_collection_revisions WHERE key = ?) = ?`
      ).bind(key, serialized, now, key, expectedRevision, key, expectedRevision).run();
      if (Number(result.meta?.changes || 0) === 0) {
        const current = await db.prepare('SELECT revision FROM academic_collection_revisions WHERE key=?')
          .bind(key).first<{ revision: number }>();
        return { conflict: true, revision: Number(current?.revision || 0) };
      }
    }
    const revision = await db.prepare('SELECT revision FROM academic_collection_revisions WHERE key=?')
      .bind(key).first<{ revision: number }>();
    return { conflict: false, revision: Number(revision?.revision || 0) };
  } catch (error) {
    if (!isMissingProjection(error)) throw error;
    await db.prepare(
      `INSERT INTO app_data (key,value,updated_at) VALUES (?,?,?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`
    ).bind(key, serialized, now).run();
    return { conflict: false, revision: 0 };
  }
}
