export interface StudentRosterRecord {
  id: string;
  nisn: string;
  name: string;
  classId: string;
  gender: 'L' | 'P';
  foto: string;
  [key: string]: unknown;
}

const DEFAULT_STUDENT_PHOTO =
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80';

export async function readCollection(db: D1Database, key: string): Promise<unknown[] | null> {
  const row = await db.prepare('SELECT value FROM app_data WHERE key = ?').bind(key).first<{ value: string }>();
  if (!row) return null;
  let value: unknown;
  try {
    value = JSON.parse(String(row.value));
  } catch {
    throw new Error(`Data ${key} rusak dan tidak dapat diproses.`);
  }
  if (!Array.isArray(value)) throw new Error(`Data ${key} harus berupa array.`);
  return value;
}

export function classExists(classes: unknown[] | null, classId: string): boolean {
  return Boolean(classes?.some(item => item && typeof item === 'object' && String((item as any).id) === classId));
}

export function syncStudentRoster(
  roster: unknown[] | null,
  student: { oldNisn?: string; nisn: string; name: string; classId: string; gender?: 'L' | 'P' }
): StudentRosterRecord[] {
  const next = [...(roster || [])] as StudentRosterRecord[];
  const index = next.findIndex(item => item?.nisn === (student.oldNisn || student.nisn));
  if (index >= 0) {
    next[index] = { ...next[index], nisn: student.nisn, name: student.name, classId: student.classId };
    return next;
  }
  next.push({
    id: `s-${crypto.randomUUID()}`,
    nisn: student.nisn,
    name: student.name,
    classId: student.classId,
    gender: student.gender || 'L',
    foto: DEFAULT_STUDENT_PHOTO,
  });
  return next;
}

// Sejak migrasi 0023, penulisan siswa_v1 memperbarui DUA lapisan sekaligus
// dalam satu batch atomik: proyeksi tabel students (sumber kebenaran) +
// mirror app_data (kompatibilitas pembaca legacy) + revisi. Seluruh roster
// ditulis ulang (soft-disable lama, upsert baru) — pola sama dengan trigger
// lama, tapi kini dipegang aplikasi.
export function rosterReplaceStatements(db: D1Database, roster: unknown[]): D1PreparedStatement[] {
  const serialized = JSON.stringify(roster);
  return [
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
    db.prepare(
      `INSERT INTO app_data (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).bind('siswa_v1', serialized, Math.floor(Date.now() / 1000)),
    db.prepare(
      `INSERT INTO academic_collection_revisions(key, revision, initialized, updated_at)
       VALUES ('siswa_v1', 1, 1, unixepoch())
       ON CONFLICT(key) DO UPDATE SET revision = revision + 1, initialized = 1, updated_at = unixepoch()`
    ),
  ];
}