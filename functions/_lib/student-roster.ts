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

export function saveCollectionStatement(db: D1Database, key: string, value: unknown): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO app_data (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(key, JSON.stringify(value), Math.floor(Date.now() / 1000));
}

export function appendStudentStatement(db: D1Database, student: StudentRosterRecord): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO app_data (key, value, updated_at) VALUES ('siswa_v1', json_array(json(?)), unixepoch())
     ON CONFLICT(key) DO UPDATE
     SET value = json_insert(app_data.value, '$[#]', json(?)), updated_at = unixepoch()`
  ).bind(JSON.stringify(student), JSON.stringify(student));
}

export function replaceStudentStatement(db: D1Database, oldNisn: string, student: StudentRosterRecord): D1PreparedStatement {
  return db.prepare(
    `UPDATE app_data
     SET value = json_set(
       value,
       '$[' || (SELECT j.key FROM json_each(app_data.value) AS j WHERE json_extract(j.value, '$.nisn') = ? LIMIT 1) || ']',
       json(?)
     ), updated_at = unixepoch()
     WHERE key = 'siswa_v1'`
  ).bind(oldNisn, JSON.stringify(student));
}

export function removeStudentStatement(db: D1Database, nisn: string): D1PreparedStatement {
  return db.prepare(
    `UPDATE app_data
     SET value = (SELECT json_group_array(json(j.value)) FROM json_each(app_data.value) AS j WHERE json_extract(j.value, '$.nisn') != ?),
         updated_at = unixepoch()
     WHERE key = 'siswa_v1'`
  ).bind(nisn);
}
