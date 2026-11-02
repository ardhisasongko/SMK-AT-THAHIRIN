// @vitest-environment node
//
// Absensi QR Model A: payload kartu bertanda tangan HMAC (QR_CARD_SECRET),
// endpoint kartu (RBAC), dan endpoint pindai yang mencatat presensi lewat
// jalur tulis presensi asli (applyPresensiWrite) — diuji pada handler asli
// dengan D1 uji (node:sqlite + migrasi asli), mencontoh presensi-delta.test.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildQrCardPayload,
  isQrCardConfigured,
  parseQrCardPayload,
  verifyQrCardPayload,
} from '../functions/_lib/qr-card';
import { onRequestGet as qrCardGet } from '../functions/api/presensi/qr-card';
import { onRequestGet as qrCardsGet } from '../functions/api/presensi/qr-cards';
import { onRequestPost as qrScanPost } from '../functions/api/presensi/qr-scan';
import type { AuthUser } from '../functions/_lib/auth';

const SECRET = 'qr-test-secret-yang-cukup-panjang-32karakter';
const OTHER_SECRET = 'qr-secret-lain-yang-juga-panjang-32karakter';

const classes = [
  { id: 'k1', name: 'X MPLB 1', jurusanCode: 'MPLB', tingkat: 'X', ruang: 'R1', waliKelas: 'Guru 1', jumlahSiswa: 2, jadwal: [] },
  { id: 'k2', name: 'XI MPLB 1', jurusanCode: 'MPLB', tingkat: 'XI', ruang: 'R2', waliKelas: 'Guru 2', jumlahSiswa: 1, jadwal: [] },
];
const students = [
  { id: 's1', nisn: '0000000001', name: 'Siswa Satu', classId: 'k1', gender: 'L', foto: '/satu.jpg' },
  { id: 's2', nisn: '0000000002', name: 'Siswa Dua', classId: 'k1', gender: 'P', foto: '/dua.jpg' },
  { id: 's3', nisn: '0000000003', name: 'Siswa Tiga', classId: 'k2', gender: 'L', foto: '/tiga.jpg' },
];

function todayWIB(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

class TestD1Database {
  readonly sqlite = new DatabaseSync(':memory:');

  constructor(seedPresensi: unknown[] = []) {
    this.sqlite.exec('PRAGMA foreign_keys=ON');
    const apply = (file: string) =>
      this.sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
    apply('0001_init.sql');
    apply('0002_auth.sql');
    apply('0005_presensi_log.sql');
    apply('0009_whatsapp_notifications.sql');
    apply('0017_external_integrations.sql');
    const insert = this.sqlite.prepare('INSERT INTO app_data(key,value) VALUES(?,?)');
    insert.run('kelas_v1', JSON.stringify(classes));
    insert.run('siswa_v1', JSON.stringify(students));
    insert.run('presensi_v1', JSON.stringify(seedPresensi));
    apply('0018_relational_academic_data.sql');
    apply('0023_close_app_data_academic_writes.sql');
    apply('0026_teacher_class_assignments.sql');
    // Guru terbatas: hanya ditugaskan ke k2.
    this.sqlite.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES ('g-scoped','Guru Terbatas','gt@x.test','','guru')").run();
    this.sqlite.prepare("INSERT INTO teacher_class_assignments (user_id, class_id) VALUES ('g-scoped','k2')").run();
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

  exec(sql: string) {
    this.sqlite.exec(sql);
  }
}

const admin: AuthUser = { id: 'a1', name: 'Admin', email: 'admin@x.test', role: 'admin', nipNisn: null, classId: null, jabatan: null, ketuaStatus: 'none' };
const guru: AuthUser = { id: 'g1', name: 'Guru Bebas', email: 'guru@x.test', role: 'guru', nipNisn: '111111', classId: null, jabatan: null, ketuaStatus: 'none' };
const guruScoped: AuthUser = { id: 'g-scoped', name: 'Guru Terbatas', email: 'gt@x.test', role: 'guru', nipNisn: '222222', classId: null, jabatan: null, ketuaStatus: 'none' };
const siswa1: AuthUser = { id: 'u-s1', name: 'Siswa Satu', email: 's1@x.test', role: 'siswa', nipNisn: '0000000001', classId: 'k1', jabatan: null, ketuaStatus: 'none' };
const ketua1: AuthUser = { id: 'u-s2', name: 'Siswa Dua', email: 's2@x.test', role: 'ketua_kelas', nipNisn: '0000000002', classId: 'k1', jabatan: null, ketuaStatus: 'approved' };

function envFor(db: TestD1Database, secret?: string | null) {
  return {
    DB: db as unknown as D1Database,
    SCHOOL_NAME: 'SMK PLUS AT-THAHIRIN',
    ...(secret ? { QR_CARD_SECRET: secret } : {}),
  };
}

function getCard(db: TestD1Database, user: AuthUser, query = '', secret: string | null = SECRET) {
  return qrCardGet({
    env: envFor(db, secret),
    request: new Request(`https://local/api/presensi/qr-card${query}`),
    data: { user },
  } as any);
}

function getCards(db: TestD1Database, user: AuthUser, classId: string, secret: string | null = SECRET) {
  return qrCardsGet({
    env: envFor(db, secret),
    request: new Request(`https://local/api/presensi/qr-cards?classId=${classId}`),
    data: { user },
  } as any);
}

function scan(db: TestD1Database, user: AuthUser, body: unknown, secret: string | null = SECRET) {
  return qrScanPost({
    env: envFor(db, secret),
    request: new Request('https://local/api/presensi/qr-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    data: { user },
  } as any);
}

describe('lib kartu QR (tanda tangan HMAC)', () => {
  it('roundtrip: payload yang dibuat server lolos verifikasi', async () => {
    const env = { QR_CARD_SECRET: SECRET };
    const payload = await buildQrCardPayload(env, '0000000001');
    expect(payload.startsWith('SMKQR1:0000000001:')).toBe(true);
    expect(parseQrCardPayload(payload)?.nisn).toBe('0000000001');
    await expect(verifyQrCardPayload(env, payload)).resolves.toEqual({ nisn: '0000000001' });
  });

  it('payload yang diubah satu karakter ditolak', async () => {
    const env = { QR_CARD_SECRET: SECRET };
    const payload = await buildQrCardPayload(env, '0000000001');
    const tampered = payload.slice(0, -1) + (payload.endsWith('A') ? 'B' : 'A');
    await expect(verifyQrCardPayload(env, tampered)).resolves.toBeNull();
    // NISN diganti tetapi tanda tangan lama dipertahankan.
    const swapped = payload.replace('0000000001', '0000000002');
    await expect(verifyQrCardPayload(env, swapped)).resolves.toBeNull();
  });

  it('payload bertanda tangan secret lain (kartu palsu) ditolak', async () => {
    const forged = await buildQrCardPayload({ QR_CARD_SECRET: OTHER_SECRET }, '0000000002');
    await expect(verifyQrCardPayload({ QR_CARD_SECRET: SECRET }, forged)).resolves.toBeNull();
  });

  it('format asing/rusak ditolak sejak parse', async () => {
    const env = { QR_CARD_SECRET: SECRET };
    for (const raw of ['SMKQR1:123:', 'LAIN:0000000001:abcdefghijklmnopqrstuv', 'SMKQR1:abcd:abcdefghijklmnopqrstuv', 'SMKQR1:0000000001:pendek', '', 42, null]) {
      expect(parseQrCardPayload(raw)).toBeNull();
      await expect(verifyQrCardPayload(env, raw)).resolves.toBeNull();
    }
  });

  it('konfigurasi: secret kosong/pendek = nonaktif', () => {
    expect(isQrCardConfigured({})).toBe(false);
    expect(isQrCardConfigured({ QR_CARD_SECRET: '' })).toBe(false);
    expect(isQrCardConfigured({ QR_CARD_SECRET: 'pendek' })).toBe(false);
    expect(isQrCardConfigured({ QR_CARD_SECRET: SECRET })).toBe(true);
  });
});

describe('endpoint kartu QR (qr-card)', () => {
  it('siswa mengambil payload dirinya sendiri; payload terverifikasi', async () => {
    const db = new TestD1Database();
    const res = await getCard(db, siswa1);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.configured).toBe(true);
    expect(json.data.nisn).toBe('0000000001');
    expect(json.data.className).toBe('X MPLB 1');
    await expect(verifyQrCardPayload({ QR_CARD_SECRET: SECRET }, json.data.payload))
      .resolves.toEqual({ nisn: '0000000001' });
  });

  it('siswa meminta payload orang lain -> 403; ketua kelas juga hanya milik sendiri', async () => {
    const db = new TestD1Database();
    expect((await getCard(db, siswa1, '?nisn=0000000002')).status).toBe(403);
    expect((await getCard(db, ketua1, '?nisn=0000000001')).status).toBe(403);
    const own = await getCard(db, ketua1, '?nisn=0000000002');
    expect(own.status).toBe(200);
  });

  it('staf mengikuti cakupan kelas: guru terbatas ditolak di luar kelas tugasnya', async () => {
    const db = new TestD1Database();
    expect((await getCard(db, guruScoped, '?nisn=0000000001')).status).toBe(403); // s1 di k1
    expect((await getCard(db, guruScoped, '?nisn=0000000003')).status).toBe(200); // s3 di k2
    expect((await getCard(db, admin, '?nisn=0000000003')).status).toBe(200);
    expect((await getCard(db, admin, '?nisn=9999999999')).status).toBe(404);
  });

  it('staf tanpa ?nisn hanya menerima status konfigurasi (probe tab pemindai)', async () => {
    const db = new TestD1Database();
    const json = await (await getCard(db, guru)).json() as any;
    expect(json.data).toEqual({ configured: true });
  });

  it('belum terkonfigurasi: configured:false tanpa payload, bukan error rusak', async () => {
    const db = new TestD1Database();
    const res = await getCard(db, siswa1, '', null);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.configured).toBe(false);
    expect(json.data.payload).toBeUndefined();
  });
});

describe('endpoint kartu QR kelas (qr-cards)', () => {
  it('admin menerima payload seluruh siswa aktif kelas; semuanya terverifikasi', async () => {
    const db = new TestD1Database();
    const res = await getCards(db, admin, 'k1');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.configured).toBe(true);
    expect(json.data.className).toBe('X MPLB 1');
    expect(json.data.cards).toHaveLength(2);
    for (const card of json.data.cards) {
      await expect(verifyQrCardPayload({ QR_CARD_SECRET: SECRET }, card.payload))
        .resolves.toEqual({ nisn: card.nisn });
    }
  });

  it('cakupan kelas ditegakkan: guru terbatas & siswa ditolak untuk kelas lain', async () => {
    const db = new TestD1Database();
    expect((await getCards(db, guruScoped, 'k1')).status).toBe(403);
    expect((await getCards(db, guruScoped, 'k2')).status).toBe(200);
    expect((await getCards(db, siswa1, 'k1')).status).toBe(403);
  });

  it('belum terkonfigurasi: cards kosong + configured:false', async () => {
    const db = new TestD1Database();
    const json = await (await getCards(db, admin, 'k1', null)).json() as any;
    expect(json.data.configured).toBe(false);
    expect(json.data.cards).toEqual([]);
  });
});

describe('endpoint pindai QR (qr-scan) — jalur tulis presensi asli', () => {
  it('pindai valid mencatat Hadir hari ini + audit presensi_log + stempel inputBy', async () => {
    const db = new TestD1Database();
    const payload = await buildQrCardPayload({ QR_CARD_SECRET: SECRET }, '0000000001');
    const res = await scan(db, guru, { payload });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.recorded).toBe(true);
    expect(json.data.name).toBe('Siswa Satu');
    expect(json.data.tanggal).toBe(todayWIB());

    const row = db.get<{ status: string; input_by_json: string }>(
      'SELECT status, input_by_json FROM attendance_records WHERE student_id = ? AND tanggal = ?',
      's1', todayWIB(),
    );
    expect(row?.status).toBe('Hadir');
    expect(JSON.parse(row!.input_by_json)).toMatchObject({ id: 'g1', role: 'guru' });

    const log = db.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM presensi_log WHERE siswa_id = ? AND tanggal = ?',
      's1', todayWIB(),
    );
    expect(log?.count).toBe(1);
  });

  it('pindai kedua pada hari yang sama ditolak 409 dan tidak menulis ulang', async () => {
    const db = new TestD1Database();
    const payload = await buildQrCardPayload({ QR_CARD_SECRET: SECRET }, '0000000001');
    expect((await scan(db, guru, { payload })).status).toBe(200);
    const second = await scan(db, guru, { payload });
    expect(second.status).toBe(409);
    const json = await second.json() as any;
    expect(json.data.alreadyRecorded).toBe(true);
    expect(db.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM attendance_records WHERE student_id = ? AND tanggal = ?',
      's1', todayWIB(),
    )?.count).toBe(1);
    expect(db.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM presensi_log WHERE siswa_id = ?', 's1',
    )?.count).toBe(1);
  });

  it('payload rusak/palsu ditolak 400 dan tidak mencatat apa pun', async () => {
    const db = new TestD1Database();
    const valid = await buildQrCardPayload({ QR_CARD_SECRET: SECRET }, '0000000001');
    const tampered = valid.slice(0, -1) + (valid.endsWith('A') ? 'B' : 'A');
    expect((await scan(db, guru, { payload: tampered })).status).toBe(400);
    const forged = await buildQrCardPayload({ QR_CARD_SECRET: OTHER_SECRET }, '0000000001');
    expect((await scan(db, guru, { payload: forged })).status).toBe(400);
    expect((await scan(db, guru, { payload: '0000000001' })).status).toBe(400);
    expect(db.get<{ count: number }>('SELECT COUNT(*) AS count FROM attendance_records')?.count).toBe(0);
  });

  it('siswa tidak boleh memindai (403); secret belum terpasang -> 503 sopan', async () => {
    const db = new TestD1Database();
    const payload = await buildQrCardPayload({ QR_CARD_SECRET: SECRET }, '0000000001');
    expect((await scan(db, siswa1, { payload })).status).toBe(403);
    expect((await scan(db, guru, { payload }, null)).status).toBe(503);
    expect(db.get<{ count: number }>('SELECT COUNT(*) AS count FROM attendance_records')?.count).toBe(0);
  });

  it('guru di luar cakupan kelas ditolak oleh validasi presensi yang sama (403)', async () => {
    const db = new TestD1Database();
    // s1 berada di k1; guruScoped hanya ditugaskan ke k2.
    const payload = await buildQrCardPayload({ QR_CARD_SECRET: SECRET }, '0000000001');
    expect((await scan(db, guruScoped, { payload })).status).toBe(403);
    expect(db.get<{ count: number }>('SELECT COUNT(*) AS count FROM attendance_records')?.count).toBe(0);
  });

  it('mengoreksi status lain menjadi Hadir — sama seperti penandaan manual guru', async () => {
    const sickToday = [{
      id: 'px-s2', tanggal: todayWIB(), classId: 'k1', siswaId: 's2', siswaName: 'Siswa Dua',
      nisn: '0000000002', status: 'Sakit', keterangan: 'Surat dokter', waktuInput: '06:55:00',
    }];
    const db = new TestD1Database(sickToday);
    const payload = await buildQrCardPayload({ QR_CARD_SECRET: SECRET }, '0000000002');
    const res = await scan(db, guru, { payload });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.correctedFrom).toBe('Sakit');
    const row = db.get<{ status: string; keterangan: string }>(
      'SELECT status, keterangan FROM attendance_records WHERE student_id = ? AND tanggal = ?',
      's2', todayWIB(),
    );
    expect(row?.status).toBe('Hadir');
    expect(row?.keterangan).toBe('Surat dokter'); // keterangan lama dipertahankan, seperti jalur manual
    const log = db.get<{ old_value: string; new_value: string }>(
      "SELECT old_value, new_value FROM presensi_log WHERE siswa_id = ? AND field_changed = 'status' ORDER BY changed_at DESC LIMIT 1",
      's2',
    );
    expect(log).toMatchObject({ old_value: 'Sakit', new_value: 'Hadir' });
  });

  it('tanggal masa depan ditolak 400', async () => {
    const db = new TestD1Database();
    const payload = await buildQrCardPayload({ QR_CARD_SECRET: SECRET }, '0000000001');
    expect((await scan(db, guru, { payload, tanggal: '2999-01-01' })).status).toBe(400);
  });

  it('notifikasi WhatsApp orang tua ikut terantre — pipa yang sama dengan input manual', async () => {
    const db = new TestD1Database();
    db.exec('UPDATE whatsapp_settings SET enabled = 1 WHERE id = 1');
    db.exec("INSERT INTO guardian_contacts (student_id, guardian_1_name, guardian_1_phone, guardian_1_enabled, guardian_2_enabled) VALUES ('s1', 'Orang Tua Satu', '6281234567890', 1, 0)");
    const payload = await buildQrCardPayload({ QR_CARD_SECRET: SECRET }, '0000000001');
    expect((await scan(db, guru, { payload })).status).toBe(200);
    const outbox = db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM whatsapp_outbox WHERE message_type = 'attendance' AND student_id = 's1'",
    );
    expect(outbox?.count).toBe(1);
  });
});
