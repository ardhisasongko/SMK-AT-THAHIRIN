// @vitest-environment node

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CollectionDataError,
  readRelationalCollection,
  validateCollection,
  writeRelationalCollection,
} from '../functions/_lib/relational-data';
import { onRequestGet, onRequestPut } from '../functions/api/data/[key]';
import type { AuthUser } from '../functions/_lib/auth';

const classes = [
  { id: 'k2', name: 'XI MPLB', jurusanCode: 'MPLB', tingkat: 'XI', ruang: 'R2', waliKelas: 'Guru 2', jumlahSiswa: 1,
    custom: 'preserved', jadwal: [{ hari: 'Selasa', jamKe: '1', jamRentan: '07:00', mataPelajaran: 'Arsip', guru: 'Guru 2', ruangan: 'R2', extra: 2 }] },
  { id: 'k1', name: 'X MPLB', jurusanCode: 'MPLB', tingkat: 'X', ruang: 'R1', waliKelas: 'Guru 1', jumlahSiswa: 1, jadwal: [] },
];
const students = [
  { id: 's2', nisn: '0000000002', name: 'Siswa Dua', classId: 'k2', gender: 'P', foto: '/dua.jpg', unknown: true },
  { id: 's1', nisn: '0000000001', name: 'Siswa Satu', classId: 'k1', gender: 'L', foto: '/satu.jpg' },
];
const attendance = [
  { id: 'p2', tanggal: '2026-08-15', classId: 'k2', siswaId: 's2', siswaName: 'Siswa Dua', nisn: '0000000002', status: 'Hadir', waktuInput: '07:00:00' },
  { id: 'p1', tanggal: '2026-08-15', classId: 'k1', siswaId: 's1', siswaName: 'Siswa Satu', nisn: '0000000001', status: 'Izin', waktuInput: '07:01:00' },
];
const modules = [{
  id: 'm1', judul: 'Modul', mataPelajaran: 'Arsip', jurusan: 'MPLB', faseKelas: 'F', alokasiWaktu: '2 JP',
  tanggalDibuat: '2026-08-15', pembuat: 'Guru', unknown: 'kept', data: {
    judul: 'Modul', identitas: { sekolah: 'SMK', mataPelajaran: 'Arsip', jurusan: 'MPLB', faseKelas: 'F', alokasiWaktu: '2 JP', tahunAjaran: '2026' },
    profilPelajarPancasila: [], saranaPrasarana: [], targetPesertaDidik: 'Siswa', modelPembelajaran: 'PBL',
    komponenInti: { tujuanPembelajaran: [], pemahamanBermakna: 'Makna', pertanyaanPemantik: [],
      kegiatanPembelajaran: { pendahuluan: [], inti: [], penutup: [] },
      asesmen: { diagnostik: 'D', formatif: 'F', sumatif: 'S' }, pengayaanDanRemidial: 'R' },
  },
}];

class TestD1Database {
  readonly sqlite = new DatabaseSync(':memory:');

  constructor(withFixtures = true) {
    this.sqlite.exec('PRAGMA foreign_keys=ON');
    this.sqlite.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
    this.sqlite.exec(readFileSync(new URL('../migrations/0005_presensi_log.sql', import.meta.url), 'utf8'));
    this.sqlite.exec(readFileSync(new URL('../migrations/0009_whatsapp_notifications.sql', import.meta.url), 'utf8'));
    if (withFixtures) {
      const insert = this.sqlite.prepare('INSERT INTO app_data(key,value) VALUES(?,?)');
      insert.run('kelas_v1', JSON.stringify(classes));
      insert.run('siswa_v1', JSON.stringify(students));
      insert.run('presensi_v1', JSON.stringify(attendance));
      insert.run('modulAjar_v1', JSON.stringify(modules));
    }
    this.sqlite.exec(readFileSync(new URL('../migrations/0018_relational_academic_data.sql', import.meta.url), 'utf8'));
    this.sqlite.exec(readFileSync(new URL('../migrations/0023_close_app_data_academic_writes.sql', import.meta.url), 'utf8'));
  }

  prepare(query: string) {
    const statement = this.sqlite.prepare(query);
    let values: unknown[] = [];
    const prepared = {
      bind: (...bindings: unknown[]) => { values = bindings; return prepared; },
      first: async <T>() => (statement.get(...values) as T | undefined) ?? null,
      all: async <T>() => ({ results: statement.all(...values) as T[] }),
      run: async () => {
        const result = statement.run(...values);
        return { meta: { changes: Number(result.changes) } };
      },
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

  run(query: string, ...values: unknown[]) {
    return this.sqlite.prepare(query).run(...values);
  }
}

const admin: AuthUser = {
  id: 'a1', name: 'Admin', email: 'admin@example.test', role: 'admin', nipNisn: null,
  classId: null, jabatan: null, ketuaStatus: 'none',
};
const leader: AuthUser = {
  id: 'u1', name: 'Ketua', email: 'ketua@example.test', role: 'ketua_kelas', nipNisn: '0000000001',
  classId: 'k1', jabatan: null, ketuaStatus: 'approved',
};

describe('relational academic projection', () => {
  it('applies on a clean D1 database', () => {
    const db = new TestD1Database(false);
    expect(db.get<{ count: number }>('SELECT count(*) AS count FROM academic_collection_revisions')?.count).toBe(4);
    expect(db.get<{ count: number }>('SELECT count(*) AS count FROM students')?.count).toBe(0);
  });

  it('backfills fixtures and reconstructs exact order and unknown fields', async () => {
    const db = new TestD1Database();
    const classResult = await readRelationalCollection(db as unknown as D1Database, 'kelas_v1');
    const studentResult = await readRelationalCollection(db as unknown as D1Database, 'siswa_v1');
    const moduleResult = await readRelationalCollection(db as unknown as D1Database, 'modulAjar_v1');
    expect(classResult).toEqual({ data: classes, revision: 1 });
    expect(studentResult.data).toEqual(students);
    expect(moduleResult.data).toEqual(modules);
  });

  it('menutup lapisan app_data: tulis langsung ke proyeksi tidak lagi disinkronkan trigger', async () => {
    const db = new TestD1Database();
    const d1 = db as unknown as D1Database;
    const next = [students[1], { ...students[0], name: 'Nama Baru' }];
    db.run("UPDATE app_data SET value=?,updated_at=unixepoch() WHERE key='siswa_v1'", JSON.stringify(next));
    expect((await readRelationalCollection(d1, 'siswa_v1')).data).toEqual(students);
    expect(db.get<{ active: number }>("SELECT active FROM students WHERE id='s1'")?.active).toBe(1);
  });

  it('menulis kedua lapisan (proyeksi + mirror) lewat writeRelationalCollection', async () => {
    const db = new TestD1Database();
    const d1 = db as unknown as D1Database;
    const next = [students[1], { ...students[0], name: 'Nama Baru' }];
    await writeRelationalCollection(d1, 'siswa_v1', next);
    expect((await readRelationalCollection(d1, 'siswa_v1')).data).toEqual(next);
    const mirror = JSON.parse(String(db.get<{ value: string }>("SELECT value FROM app_data WHERE key='siswa_v1'")?.value));
    expect(mirror).toEqual(next);
  });

  it('tidak merusak pembacaan bila mirror app_data korup (proyeksi sumber kebenaran)', async () => {
    const db = new TestD1Database();
    db.run("UPDATE app_data SET value='{broken' WHERE key='kelas_v1'");
    expect((await readRelationalCollection(db as unknown as D1Database, 'kelas_v1')).data).toEqual(classes);
    expect(db.get<{ count: number }>('SELECT count(*) AS count FROM school_classes WHERE active=1')?.count).toBe(2);
  });

  it('menolak siswa dengan kelas tak dikenal dan presensi dengan siswa tak dikenal (FK)', async () => {
    const db = new TestD1Database();
    const d1 = db as unknown as D1Database;
    await expect(writeRelationalCollection(d1, 'siswa_v1', [{ ...students[0], classId: 'k99' }]))
      .rejects.toThrow(/Kelas k99 tidak ditemukan/);
    await expect(writeRelationalCollection(d1, 'presensi_v1', [{ ...attendance[0], siswaId: 's99' }]))
      .rejects.toThrow(/Presensi merujuk siswa s99/);
    expect((await readRelationalCollection(d1, 'siswa_v1')).data).toEqual(students);
  });

  it('rejects duplicate identities, NISN, attendance keys, and malformed records', () => {
    expect(() => validateCollection('kelas_v1', [classes[0], { ...classes[1], id: classes[0].id }])).toThrow(/ID kelas duplikat/);
    expect(() => validateCollection('presensi_v1', [attendance[0], { ...attendance[0], id: 'other' }])).toThrow(/Presensi duplikat/);
    expect(() => validateCollection('modulAjar_v1', [{ ...modules[0], data: {} }])).toThrow(CollectionDataError);
  });

  it('uses compare-and-swap revisions while accepting old clients', async () => {
    const db = new TestD1Database();
    const d1 = db as unknown as D1Database;
    const first = await writeRelationalCollection(d1, 'kelas_v1', classes, 1);
    const stale = await writeRelationalCollection(d1, 'kelas_v1', [...classes].reverse(), 1);
    const legacy = await writeRelationalCollection(d1, 'kelas_v1', [...classes].reverse());
    expect(first).toEqual({ conflict: false, revision: 2 });
    expect(stale).toEqual({ conflict: true, revision: 2 });
    expect(legacy).toEqual({ conflict: false, revision: 3 });
  });
});

describe('academic collection API', () => {
  it('returns revisions and a 409 for stale writes', async () => {
    const db = new TestD1Database();
    const env = { DB: db as unknown as D1Database };
    const getResponse = await onRequestGet({ env, params: { key: 'kelas_v1' }, request: new Request('https://local/api/data/kelas_v1'), data: { user: admin } } as any);
    expect(await getResponse.json()).toMatchObject({ success: true, revision: 1, data: classes });
    const putResponse = await onRequestPut({ env, params: { key: 'kelas_v1' }, request: new Request('https://local/api/data/kelas_v1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': '0' }, body: JSON.stringify(classes),
    }), data: { user: admin } } as any);
    expect(putResponse.status).toBe(409);
  });

  it('filters attendance PUT response exactly like GET for class leaders', async () => {
    const db = new TestD1Database();
    const env = { DB: db as unknown as D1Database };
    const response = await onRequestPut({ env, params: { key: 'presensi_v1' }, request: new Request('https://local/api/data/presensi_v1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Collection-Revision': '1' }, body: JSON.stringify(attendance),
    }), data: { user: leader } } as any);
    const payload = await response.json() as any;
    expect(response.status).toBe(200);
    expect(payload.data).toEqual([attendance[1]]);
    expect(payload.revision).toBe(2);
  });

  it('allows an old client PUT without a revision header', async () => {
    const db = new TestD1Database();
    const response = await onRequestPut({ env: { DB: db as unknown as D1Database }, params: { key: 'kelas_v1' }, request: new Request('https://local/api/data/kelas_v1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(classes),
    }), data: { user: admin } } as any);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, revision: 2 });
  });
});
