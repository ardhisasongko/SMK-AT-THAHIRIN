// @vitest-environment node

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createSession, getUserFromRequest, hashPassword, type AuthUser } from '../functions/_lib/auth';
import { computeTotp } from '../functions/_lib/totp';
import { generateRandomPassword, validateNewPassword } from '../functions/_lib/password-policy';
import { onRequestPost as loginPost } from '../functions/api/auth/login';
import { onRequestPost as verifyTwoFactorPost } from '../functions/api/auth/login/verify-2fa';
import { onRequestGet as twoFactorStatusGet } from '../functions/api/auth/2fa/status';
import { onRequestPost as twoFactorSetupPost } from '../functions/api/auth/2fa/setup';
import { onRequestPost as twoFactorActivatePost } from '../functions/api/auth/2fa/activate';
import { onRequestPost as adminDisableTwoFactorPost } from '../functions/api/users/disable-2fa';
import { onRequestPost as createUserPost } from '../functions/api/users/index';
import { onRequestPost as changePasswordPost } from '../functions/api/auth/change-password';
import { onRequest as middlewareRequest } from '../functions/_middleware';

class TestD1Database {
  readonly sqlite = new DatabaseSync(':memory:');

  constructor() {
    this.sqlite.exec('PRAGMA foreign_keys=ON');
    const files = readdirSync(new URL('../migrations', import.meta.url)).sort();
    for (const file of files) {
      this.sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
    }
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

  run(query: string, ...values: unknown[]) {
    return this.sqlite.prepare(query).run(...values);
  }
}

const TEST_TOTP_KEY = 'kunci-enkripsi-totp-untuk-test-32karakter';

function makeUser(overrides: Partial<AuthUser> & { id: string; role: string }): AuthUser {
  return {
    name: overrides.id, email: `${overrides.id}@test.local`, nipNisn: null, nik: null,
    tanggalLahir: null, classId: null, ketuaStatus: 'none', jabatan: null,
    status: 'active', mustChangePassword: false, ...overrides,
  } as AuthUser;
}

const GURU_PASSWORD = 'MengajarAman2026';
const SISWA_PASSWORD = 'BelajarAman2026';

async function seed() {
  const db = new TestD1Database();
  const addUser = db.sqlite.prepare(
    'INSERT INTO users (id, name, email, nip_nisn, role, class_id, password_hash, status, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  addUser.run('g1', 'Pak Guru', 'guru@test.local', '198902152015', 'guru', null, await hashPassword(GURU_PASSWORD), 'active', 0);
  addUser.run('g2', 'Bu Guru Dua', 'guru2@test.local', '199001012020', 'guru', null, await hashPassword(GURU_PASSWORD), 'active', 0);
  addUser.run('a1', 'Admin Satu', 'admin@test.local', '9001', 'admin', null, await hashPassword(GURU_PASSWORD), 'active', 0);
  addUser.run('sa1', 'Super Admin', 'super@test.local', '9000', 'super_admin', null, await hashPassword(GURU_PASSWORD), 'active', 0);
  addUser.run('s1', 'Siswa Satu', 'siswa@test.local', '0068123491', 'siswa', null, await hashPassword(SISWA_PASSWORD), 'active', 0);
  addUser.run('m1', 'Siswa Wajib Ganti', 'wajib@test.local', '0068999999', 'siswa', null, await hashPassword(SISWA_PASSWORD), 'active', 1);
  const env = { DB: db as unknown as D1Database, TOTP_ENCRYPTION_KEY: TEST_TOTP_KEY, APP_NAME: 'Portal Test' };
  return { db, env };
}

function jsonRequest(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://school.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10', ...headers },
    body: JSON.stringify(body),
  });
}

async function login(env: any, identifier: string, password: string) {
  const res = await loginPost({ env, request: jsonRequest('/api/auth/login', { identifier, password }), data: {} } as any);
  return { res, json: await res.json() as any };
}

async function activateTwoFactor(env: any, db: TestD1Database, user: AuthUser, sessionToken?: string) {
  const setupRes = await twoFactorSetupPost({
    env, data: { user },
    request: jsonRequest('/api/auth/2fa/setup', {}),
  } as any);
  const setupJson = await setupRes.json() as any;
  expect(setupRes.status).toBe(200);
  const secret = String(setupJson.data.secret);
  const code = await computeTotp(secret);
  const headers = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
  const activateRes = await twoFactorActivatePost({
    env, data: { user },
    request: jsonRequest('/api/auth/2fa/activate', { code }, headers),
  } as any);
  const activateJson = await activateRes.json() as any;
  expect(activateRes.status).toBe(200);
  return { secret, recoveryCodes: activateJson.data.recoveryCodes as string[] };
}

describe('hardening Fase B — TOTP', () => {
  it('computeTotp menghasilkan kode stabil 6 digit per langkah waktu', async () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const step = 123456;
    const code = await computeTotp(secret, step);
    expect(code).toMatch(/^\d{6}$/);
    expect(await computeTotp(secret, step)).toBe(code);
    expect(await computeTotp(secret, step + 10)).not.toBe(code);
  });

  it('secret tersimpan terenkripsi di D1, bukan plaintext', async () => {
    const { db, env } = await seed();
    const guru = makeUser({ id: 'g1', role: 'guru', email: 'guru@test.local' });
    const setupRes = await twoFactorSetupPost({ env, data: { user: guru }, request: jsonRequest('/api/auth/2fa/setup', {}) } as any);
    const setupJson = await setupRes.json() as any;
    const row = db.get<{ totp_secret_enc: string; totp_enabled: number }>('SELECT totp_secret_enc, totp_enabled FROM users WHERE id = ?', 'g1');
    expect(row?.totp_secret_enc).toMatch(/^v1:/);
    expect(row?.totp_secret_enc).not.toContain(setupJson.data.secret);
    expect(row?.totp_enabled).toBe(0);
  });

  it('aktivasi lalu login mewajibkan kode; kode salah ditolak; sesi baru terbit setelah verifikasi', async () => {
    const { db, env } = await seed();
    const guru = makeUser({ id: 'g1', role: 'guru', email: 'guru@test.local' });
    const { secret } = await activateTwoFactor(env, db, guru);

    const step1 = await login(env, 'guru@test.local', GURU_PASSWORD);
    expect(step1.json.twoFactorRequired).toBe(true);
    expect(step1.json.challengeToken).toMatch(/^ct_[0-9a-f]{64}$/);
    expect(step1.res.headers.get('Set-Cookie')).toBeNull();

    const step2 = await login(env, 'guru@test.local', GURU_PASSWORD);
    const code = await computeTotp(secret);
    const wrongCode = code === '000000' ? '111111' : '000000';
    const rejected = await verifyTwoFactorPost({
      env, data: {},
      request: jsonRequest('/api/auth/login/verify-2fa', { challengeToken: step2.json.challengeToken, code: wrongCode }),
    } as any);
    expect(rejected.status).toBe(401);

    const verified = await verifyTwoFactorPost({
      env, data: {},
      request: jsonRequest('/api/auth/login/verify-2fa', { challengeToken: step2.json.challengeToken, code }),
    } as any);
    expect(verified.status).toBe(200);
    expect(verified.headers.get('Set-Cookie')).toContain('smk_session=');
    const verifiedJson = await verified.json() as any;
    expect(verifiedJson.user.id).toBe('g1');
  });

  it('token tantangan BUKAN sesi: tidak dapat dipakai mengakses API lain', async () => {
    const { db, env } = await seed();
    const guru = makeUser({ id: 'g1', role: 'guru', email: 'guru@test.local' });
    await activateTwoFactor(env, db, guru);
    const step1 = await login(env, 'guru@test.local', GURU_PASSWORD);
    const asBearer = new Request('https://school.test/api/auth/me', {
      headers: { Authorization: `Bearer ${step1.json.challengeToken}` },
    });
    const user = await getUserFromRequest(env as any, asBearer);
    expect(user).toBeNull();
  });

  it('kode pemulihan hanya berlaku satu kali', async () => {
    const { db, env } = await seed();
    const guru = makeUser({ id: 'g1', role: 'guru', email: 'guru@test.local' });
    const { recoveryCodes } = await activateTwoFactor(env, db, guru);
    expect(recoveryCodes).toHaveLength(10);

    const first = await login(env, 'guru@test.local', GURU_PASSWORD);
    const used = await verifyTwoFactorPost({
      env, data: {},
      request: jsonRequest('/api/auth/login/verify-2fa', { challengeToken: first.json.challengeToken, code: recoveryCodes[0] }),
    } as any);
    expect(used.status).toBe(200);

    const second = await login(env, 'guru@test.local', GURU_PASSWORD);
    const reused = await verifyTwoFactorPost({
      env, data: {},
      request: jsonRequest('/api/auth/login/verify-2fa', { challengeToken: second.json.challengeToken, code: recoveryCodes[0] }),
    } as any);
    expect(reused.status).toBe(401);

    const remaining = db.get<{ total: number }>('SELECT COUNT(*) AS total FROM totp_recovery_codes WHERE user_id = ? AND used_at IS NULL', 'g1');
    expect(remaining?.total).toBe(9);
  });

  it('tantangan dihancurkan setelah 5 kode salah', async () => {
    const { env } = await seed();
    const db = env.DB as unknown as TestD1Database;
    const guru = makeUser({ id: 'g1', role: 'guru', email: 'guru@test.local' });
    const { secret } = await activateTwoFactor(env, db, guru);
    const step1 = await login(env, 'guru@test.local', GURU_PASSWORD);
    const good = await computeTotp(secret);
    const bad = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const res = await verifyTwoFactorPost({
        env, data: {},
        request: jsonRequest('/api/auth/login/verify-2fa', { challengeToken: step1.json.challengeToken, code: bad }),
      } as any);
      expect(res.status).toBe(401);
    }
    const after = await verifyTwoFactorPost({
      env, data: {},
      request: jsonRequest('/api/auth/login/verify-2fa', { challengeToken: step1.json.challengeToken, code: good }),
    } as any);
    expect(after.status).toBe(401);
  });

  it('sesi lama pra-aktivasi dicabut; sesi yang dipakai aktivasi tetap hidup', async () => {
    const { db, env } = await seed();
    const oldToken = await createSession(env as any, 'g1');
    const currentToken = await createSession(env as any, 'g1');
    const guru = makeUser({ id: 'g1', role: 'guru', email: 'guru@test.local' });
    await activateTwoFactor(env, db, guru, currentToken);

    const oldRequest = new Request('https://school.test/api/auth/me', { headers: { Authorization: `Bearer ${oldToken}` } });
    expect(await getUserFromRequest(env as any, oldRequest)).toBeNull();
    const currentRequest = new Request('https://school.test/api/auth/me', { headers: { Authorization: `Bearer ${currentToken}` } });
    expect((await getUserFromRequest(env as any, currentRequest))?.id).toBe('g1');
  });

  it('non-staf (siswa) tidak ditawari 2FA', async () => {
    const { env } = await seed();
    const siswa = makeUser({ id: 's1', role: 'siswa', email: 'siswa@test.local' });
    const setupRes = await twoFactorSetupPost({ env, data: { user: siswa }, request: jsonRequest('/api/auth/2fa/setup', {}) } as any);
    expect(setupRes.status).toBe(403);
    const statusRes = await twoFactorStatusGet({ env, data: { user: siswa }, request: new Request('https://school.test/api/auth/2fa/status') } as any);
    const statusJson = await statusRes.json() as any;
    expect(statusJson.data.applicable).toBe(false);
    expect(statusJson.data.enabled).toBe(false);
  });

  it('admin dapat menonaktifkan 2FA guru terkunci (teraudit); admin tidak dapat menyentuh admin lain', async () => {
    const { db, env } = await seed();
    const guru = makeUser({ id: 'g1', role: 'guru', email: 'guru@test.local' });
    await activateTwoFactor(env, db, guru);
    const admin = makeUser({ id: 'a1', role: 'admin', email: 'admin@test.local' });

    const res = await adminDisableTwoFactorPost({
      env, data: { user: admin },
      request: jsonRequest('/api/users/disable-2fa', { id: 'g1', reason: 'Kehilangan authenticator' }),
    } as any);
    expect(res.status).toBe(200);
    const row = db.get<{ totp_enabled: number; totp_secret_enc: string | null }>('SELECT totp_enabled, totp_secret_enc FROM users WHERE id = ?', 'g1');
    expect(row?.totp_enabled).toBe(0);
    expect(row?.totp_secret_enc).toBeNull();
    const audit = db.get<{ action: string }>("SELECT action FROM user_audit_log WHERE action = 'DISABLE_2FA' AND target_user_id = 'g1'");
    expect(audit?.action).toBe('DISABLE_2FA');

    // Setelah dinonaktifkan, guru login cukup dengan password.
    const after = await login(env, 'guru@test.local', GURU_PASSWORD);
    expect(after.json.twoFactorRequired).toBeUndefined();
    expect(after.res.headers.get('Set-Cookie')).toContain('smk_session=');

    // Admin tidak boleh menonaktifkan 2FA admin LAIN; hanya super_admin.
    db.run(`INSERT INTO users (id, name, email, nip_nisn, role, password_hash, status, totp_secret_enc, totp_enabled)
      SELECT 'a2', 'Admin Dua', 'admin2@test.local', '9002', 'admin', password_hash, 'active', 'v1:x:y', 1 FROM users WHERE id = 'a1'`);
    const forbidden = await adminDisableTwoFactorPost({
      env, data: { user: admin },
      request: jsonRequest('/api/users/disable-2fa', { id: 'a2', reason: 'Uji batas kewenangan' }),
    } as any);
    expect(forbidden.status).toBe(403);

    // Super admin boleh, dan tercatat.
    const superAdmin = makeUser({ id: 'sa1', role: 'super_admin', email: 'super@test.local' });
    const allowed = await adminDisableTwoFactorPost({
      env, data: { user: superAdmin },
      request: jsonRequest('/api/users/disable-2fa', { id: 'a2', reason: 'Permintaan pemilik akun' }),
    } as any);
    expect(allowed.status).toBe(200);
  });
});

describe('hardening Fase B — kebijakan password', () => {
  it('validateNewPassword menolak password lemah dan yang ditebak dari data pengguna', () => {
    const ctx = { identifier: '0068123491', email: 'budi.santoso@smksplusatthahirin.sch.id', name: 'Budi Santoso' };
    expect(validateNewPassword('abc123', ctx)).toContain('minimal 10');
    expect(validateNewPassword('abcdefghij', ctx)).toContain('huruf dan angka');
    expect(validateNewPassword('1234567890', ctx)).toContain('huruf dan angka');
    expect(validateNewPassword('x0068123491y', ctx)).toContain('identitas');
    expect(validateNewPassword('Budi.Santoso99', ctx)).toContain('email');
    expect(validateNewPassword('KelasBaru2026', ctx)).toBeNull();
    expect(validateNewPassword('Rahasia!Sekolah9', {})).toBeNull();
  });

  it('generateRandomPassword selalu lolos kebijakan dan tidak pernah sama dengan identifier', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const password = generateRandomPassword();
      expect(password.length).toBe(16);
      expect(validateNewPassword(password, { identifier: '0068123491', email: 'siswa@sekolah.sch.id', name: 'Siswa' })).toBeNull();
      expect(password).not.toBe('0068123491');
      seen.add(password);
    }
    expect(seen.size).toBe(50);
  });

  it('pembuatan pengguna oleh admin menghasilkan password awal acak yang lolos kebijakan', async () => {
    const { env } = await seed();
    const admin = makeUser({ id: 'a1', role: 'admin', email: 'admin@test.local' });
    const res = await createUserPost({
      env, data: { user: admin },
      request: jsonRequest('/api/users', { name: 'Guru Baru', email: 'baru@test.local', identifier: '197505052000', role: 'guru' }),
    } as any);
    expect(res.status).toBe(201);
    const json = await res.json() as any;
    expect(typeof json.initialPassword).toBe('string');
    expect(json.initialPassword).not.toBe('197505052000');
    expect(validateNewPassword(json.initialPassword, { identifier: '197505052000', email: 'baru@test.local', name: 'Guru Baru' })).toBeNull();
    const row = (env.DB as unknown as TestD1Database).get<{ must_change_password: number }>(
      'SELECT must_change_password FROM users WHERE email = ?', 'baru@test.local');
    expect(row?.must_change_password).toBe(1);
  });

  it('ganti password menolak password = NISN dan menerima password yang sah', async () => {
    const { db, env } = await seed();
    const siswa = makeUser({ id: 'm1', role: 'siswa', email: 'wajib@test.local', nipNisn: '0068999999', mustChangePassword: true });
    const rejected = await changePasswordPost({
      env, data: { user: siswa },
      request: jsonRequest('/api/auth/change-password', { currentPassword: SISWA_PASSWORD, newPassword: 'x0068999999y' }),
    } as any);
    expect(rejected.status).toBe(400);

    const tooWeak = await changePasswordPost({
      env, data: { user: siswa },
      request: jsonRequest('/api/auth/change-password', { currentPassword: SISWA_PASSWORD, newPassword: 'abc123' }),
    } as any);
    expect(tooWeak.status).toBe(400);

    const accepted = await changePasswordPost({
      env, data: { user: siswa },
      request: jsonRequest('/api/auth/change-password', { currentPassword: SISWA_PASSWORD, newPassword: 'Prestasiku2026' }),
    } as any);
    expect(accepted.status).toBe(200);
    const row = db.get<{ must_change_password: number }>('SELECT must_change_password FROM users WHERE id = ?', 'm1');
    expect(row?.must_change_password).toBe(0);
  });

  it('kewajiban ganti password awal memblokir endpoint lain sampai diganti (middleware)', async () => {
    const { env } = await seed();
    const token = await createSession(env as any, 'm1');
    const next = vi.fn(async () => new Response('ok', { status: 200 }));

    const blocked = await middlewareRequest({
      env, data: {}, next,
      request: new Request('https://school.test/api/users', { headers: { Cookie: `smk_session=${token}` } }),
    } as any);
    expect(blocked.status).toBe(403);
    expect(next).not.toHaveBeenCalled();

    const allowed = await middlewareRequest({
      env, data: {}, next,
      request: new Request('https://school.test/api/auth/me', { headers: { Cookie: `smk_session=${token}` } }),
    } as any);
    expect(allowed.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('login pengguna tanpa 2FA tidak berubah perilakunya', async () => {
    const { env } = await seed();
    const result = await login(env, 'siswa@test.local', SISWA_PASSWORD);
    expect(result.json.success).toBe(true);
    expect(result.json.twoFactorRequired).toBeUndefined();
    expect(result.json.user.id).toBe('s1');
    expect(result.res.headers.get('Set-Cookie')).toContain('smk_session=');
  });
});
