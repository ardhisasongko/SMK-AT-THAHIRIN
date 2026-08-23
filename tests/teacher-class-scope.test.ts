// @vitest-environment node

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canEditClassScoped, getAssignedClassIds } from '../functions/_lib/auth';
import type { AuthUser } from '../functions/_lib/auth';

function buildDb(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:');
  const apply = (file: string) => sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  apply('0001_init.sql');
  apply('0002_auth.sql');
  apply('0018_relational_academic_data.sql');
  apply('0023_close_app_data_academic_writes.sql');
  apply('0026_teacher_class_assignments.sql');
  sqlite.prepare("INSERT INTO school_classes (id, position, name, jurusan_code, tingkat, ruang, wali_kelas, jumlah_siswa, fields, source_json) VALUES ('k1', 1, 'X MPLB', 'MPLB', 'X', 'R1', 'Guru Satu', 0, '{}', '{}'), ('k2', 2, 'XI MPLB', 'MPLB', 'XI', 'R2', 'Guru Dua', 0, '{}', '{}')").run();
  sqlite.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES ('g-1','Guru Satu','gs@x.test','','guru'), ('g-2','Guru Tanpa Tugas','gt@x.test','','guru'), ('a-1','Admin','adm@x.test','','admin'), ('k-1','Ketua','kt@x.test','','ketua_kelas')").run();
  // g-1 ditugaskan ke k1 saja.
  sqlite.prepare("INSERT INTO teacher_class_assignments (user_id, class_id) VALUES ('g-1','k1')").run();
  sqlite.prepare("UPDATE users SET ketua_status='approved', class_id='k1' WHERE id='k-1'").run();
  return sqlite;
}

const d1 = (sqlite: DatabaseSync) => new TestD1(sqlite) as unknown as D1Database;

class TestD1 {
  constructor(private readonly sqlite: DatabaseSync) {}

  prepare(query: string) {
    const statement = this.sqlite.prepare(query);
    let values: unknown[] = [];
    const prepared = {
      bind: (...bindings: unknown[]) => { values = bindings; return prepared; },
      first: async <T>() => (statement.get(...values) as T | undefined) ?? null,
      all: async <T>() => ({ results: statement.all(...values) as T[] }),
      run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } }),
    };
    return prepared;
  }
}

const guruAssigned: AuthUser = { id: 'g-1', name: 'Guru Satu', email: 'gs@x.test', role: 'guru', nipNisn: null, classId: null, jabatan: null, ketuaStatus: 'none' };
const guruFree: AuthUser = { id: 'g-2', name: 'Guru Tanpa Tugas', email: 'gt@x.test', role: 'guru', nipNisn: null, classId: null, jabatan: null, ketuaStatus: 'none' };
const admin: AuthUser = { id: 'a-1', name: 'Admin', email: 'adm@x.test', role: 'admin', nipNisn: null, classId: null, jabatan: null, ketuaStatus: 'none' };
const ketuaApproved: AuthUser = { id: 'k-1', name: 'Ketua', email: 'kt@x.test', role: 'ketua_kelas', nipNisn: null, classId: 'k1', jabatan: null, ketuaStatus: 'approved' };

describe('canEditClassScoped (penugasan wali kelas)', () => {
  it('guru dengan penugasan hanya boleh kelasnya', async () => {
    const db = buildDb();
    expect(await canEditClassScoped(d1(db), guruAssigned, 'k1')).toBe(true);
    expect(await canEditClassScoped(d1(db), guruAssigned, 'k2')).toBe(false);
  });

  it('guru tanpa penugasan memakai perilaku lama (semua kelas)', async () => {
    const db = buildDb();
    expect(await canEditClassScoped(d1(db), guruFree, 'k1')).toBe(true);
    expect(await canEditClassScoped(d1(db), guruFree, 'k2')).toBe(true);
  });

  it('admin selalu boleh dan ketua tetap terbatas ke kelasnya', async () => {
    const db = buildDb();
    expect(await canEditClassScoped(d1(db), admin, 'k2')).toBe(true);
    expect(await canEditClassScoped(d1(db), ketuaApproved, 'k1')).toBe(true);
    expect(await canEditClassScoped(d1(db), ketuaApproved, 'k2')).toBe(false);
  });

  it('getAssignedClassIds mengembalikan daftar kelas guru', async () => {
    const db = buildDb();
    expect(await getAssignedClassIds(d1(db), 'g-1')).toEqual(['k1']);
    expect(await getAssignedClassIds(d1(db), 'g-2')).toEqual([]);
  });
});
