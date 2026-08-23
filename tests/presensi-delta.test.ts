// @vitest-environment node

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { onRequestPut } from '../functions/api/data/[key]';
import type { AuthUser } from '../functions/_lib/auth';

const classes = [
  { id: 'k1', name: 'X MPLB', jurusanCode: 'MPLB', tingkat: 'X', ruang: 'R1', waliKelas: 'Guru 1', jumlahSiswa: 2, jadwal: [] },
];
const students = [
  { id: 's1', nisn: '0000000001', name: 'Siswa Satu', classId: 'k1', gender: 'L', foto: '/satu.jpg' },
  { id: 's2', nisn: '0000000002', name: 'Siswa Dua', classId: 'k1', gender: 'P', foto: '/dua.jpg' },
];
// Simulasi database besar: 2 rekaman lama dengan inputBy historis berbeda.
const attendance = [
  { id: 'p1', tanggal: '2026-08-14', classId: 'k1', siswaId: 's1', siswaName: 'Siswa Satu', nisn: '0000000001',
    status: 'Hadir', waktuInput: '07:00:00', inputBy: { id: 'g1', name: 'Guru Lama', role: 'guru' } },
  { id: 'p2', tanggal: '2026-08-14', classId: 'k1', siswaId: 's2', siswaName: 'Siswa Dua', nisn: '0000000002',
    status: 'Izin', waktuInput: '07:01:00', keterangan: 'Surat dokter' },
];

class TestD1Database {
  readonly sqlite = new DatabaseSync(':memory:');

  constructor() {
    this.sqlite.exec('PRAGMA foreign_keys=ON');
    this.sqlite.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
    this.sqlite.exec(readFileSync(new URL('../migrations/0005_presensi_log.sql', import.meta.url), 'utf8'));
    this.sqlite.exec(readFileSync(new URL('../migrations/0009_whatsapp_notifications.sql', import.meta.url), 'utf8'));
    const insert = this.sqlite.prepare('INSERT INTO app_data(key,value) VALUES(?,?)');
    insert.run('kelas_v1', JSON.stringify(classes));
    insert.run('siswa_v1', JSON.stringify(students));
    insert.run('presensi_v1', JSON.stringify(attendance));
    this.sqlite.exec(readFileSync(new URL('../migrations/0018_relational_academic_data.sql', import.meta.url), 'utf8'));
    this.sqlite.exec(readFileSync(new URL('../migrations/0023_close_app_data_academic_writes.sql', import.meta.url), 'utf8'));
    // Rekaman p1 diberi inputBy historis setelah proyeksi terbentuk.
    this.sqlite.prepare("UPDATE attendance_records SET input_by_json=? WHERE id='p1'")
      .run(JSON.stringify(attendance[0].inputBy));
  }

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

  async batch(statements: Array<{ run: () => Promise<unknown> }>) {
    this.sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const stmt of statements) results.push(await stmt.run());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }

  get<T>(query: string, ...values: unknown[]): T | undefined {
    return this.sqlite.prepare(query).get(...values) as T | undefined;
  }
}

const admin: AuthUser = {
  id: 'a1', name: 'Admin', email: 'admin@example.test', role: 'admin', nipNisn: null,
  classId: null, jabatan: null, ketuaStatus: 'none',
};

function put(db: TestD1Database, body: unknown, revision?: string) {
  return onRequestPut({
    env: { DB: db as unknown as D1Database },
    params: { key: 'presensi_v1' },
    request: new Request('https://local/api/data/presensi_v1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(revision ? { 'X-Collection-Revision': revision } : {}),
      },
      body: JSON.stringify(body),
    }),
    data: { user: admin },
  } as any);
}

describe('presensi delta write model', () => {
  it('hanya meng-upsert rekaman yang berubah — baris lain tidak disentuh', async () => {
    const db = new TestD1Database();
    // Hanya p1 yang diubah (Hadir -> Terlambat); p2 dikirim ulang identik.
    const next = [
      { ...attendance[0], status: 'Terlambat', waktuInput: '07:30:00' },
      { ...attendance[1] },
    ];
    const response = await put(db, next);
    expect(response.status).toBe(200);
    const payload = await response.json() as any;
    expect(payload.success).toBe(true);
    expect(payload.changed).toBe(1);

    // Jumlah baris tetap 2 (tidak ada DELETE-all + INSERT-all).
    expect(db.get<{ count: number }>('SELECT count(*) AS count FROM attendance_records')?.count).toBe(2);
    // Baris berubah: status baru + stamp inputBy admin.
    const p1 = db.get<any>("SELECT * FROM attendance_records WHERE id='p1'");
    expect(p1.status).toBe('Terlambat');
    expect(p1.waktu_input).toBe('07:30:00');
    expect(JSON.parse(String(p1.input_by_json))).toMatchObject({ id: 'a1', role: 'admin' });
    // Baris tidak berubah: benar-benar utuh (inputBy historis Guru Lama dipertahankan,
    // bukan hasil tulis-ulang oleh admin).
    const p2 = db.get<any>("SELECT * FROM attendance_records WHERE id='p2'");
    expect(p2.status).toBe('Izin');
    expect(p2.keterangan).toBe('Surat dokter');
    expect(p2.input_by_json).toBeNull();
    // Revisi naik dan mirror ikut terbarui.
    expect(payload.revision).toBe(2);
    const mirror = JSON.parse(String(db.get<{ value: string }>("SELECT value FROM app_data WHERE key='presensi_v1'")?.value));
    expect(mirror).toHaveLength(2);
  });

  it('menambah rekaman baru tanpa menghapus yang lama', async () => {
    const db = new TestD1Database();
    const next = [
      ...attendance,
      { id: 'p3', tanggal: '2026-08-15', classId: 'k1', siswaId: 's1', siswaName: 'Siswa Satu',
        nisn: '0000000001', status: 'Hadir', waktuInput: '07:05:00' },
    ];
    const response = await put(db, next);
    expect(response.status).toBe(200);
    expect(db.get<{ count: number }>('SELECT count(*) AS count FROM attendance_records')?.count).toBe(3);
    const p3 = db.get<any>("SELECT * FROM attendance_records WHERE id='p3'");
    expect(p3.tanggal).toBe('2026-08-15');
    // Baris lama tetap ada.
    expect(db.get<any>("SELECT * FROM attendance_records WHERE id='p1'").status).toBe('Hadir');
  });

  it('menolak tulisan usang dengan 409 (CAS tetap aktif pada jalur delta)', async () => {
    const db = new TestD1Database();
    const next = [{ ...attendance[0], status: 'Alpa' }, { ...attendance[1] }];
    const response = await put(db, next, '0'); // revisi server = 1 -> '0' stale
    expect(response.status).toBe(409);
    // Data tidak berubah.
    expect(db.get<any>("SELECT * FROM attendance_records WHERE id='p1'").status).toBe('Hadir');
  });

  it('audit log presensi tertulis atomik dalam batch yang sama', async () => {
    const db = new TestD1Database();
    const next = [{ ...attendance[0], status: 'Alpa' }, { ...attendance[1] }];
    const response = await put(db, next);
    expect(response.status).toBe(200);
    const log = db.get<any>("SELECT * FROM presensi_log WHERE siswa_id='s1' AND field_changed='status'");
    expect(log).toBeTruthy();
    expect(log.old_value).toBe('Hadir');
    expect(log.new_value).toBe('Alpa');
    expect(log.changed_by_name).toBe('Admin');
  });

  it('simpan tanpa perubahan tetap sukses tanpa menulis ulang baris', async () => {
    const db = new TestD1Database();
    const before = db.get<any>("SELECT id, status, input_by_json FROM attendance_records WHERE id='p2'");
    const response = await put(db, [...attendance]);
    expect(response.status).toBe(200);
    const payload = await response.json() as any;
    expect(payload.changed).toBe(0);
    const after = db.get<any>("SELECT id, status, input_by_json FROM attendance_records WHERE id='p2'");
    expect(after).toEqual(before);
  });
});
