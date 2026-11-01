// @vitest-environment node
// Test regresi Fase A — audit keamanan mendalam (hardening A).
// Setiap describe membuktikan satu celah yang ditutup pada fase ini.

import { describe, expect, it, vi } from 'vitest';
import { csvEscape, neutralizeCsvFormula, toCsv } from '../functions/_lib/csv';
import { buildCsv, escapeCsvCell } from '../src/utils/download';
import { secretEquals } from '../functions/_lib/secret-compare';
import { getUserFromRequest } from '../functions/_lib/auth';
import { onRequestPost as gatewayPost } from '../functions/api/whatsapp/gateway';
import { onRequestPatch as patchUser } from '../functions/api/users/index';
import { onRequestPost as upload } from '../functions/api/upload';
import { onRequestGet as getPhoto } from '../functions/api/photo/[id]';
import { filterCollectionForUser } from '../functions/api/data/[key]';
import { consumeRateLimit } from '../functions/_lib/rate-limit';

vi.mock('../functions/_lib/rate-limit', () => ({
  consumeRateLimit: vi.fn(async () => true),
  clearRateLimit: vi.fn(async () => undefined),
}));

const ADMIN = { id: 'admin-1', name: 'Admin', role: 'admin' } as any;

describe('CSV formula injection (server)', () => {
  it('menetralkan sel teks berawalan =, +, -, @ termasuk setelah spasi/tab', () => {
    expect(csvEscape('=2+5')).toBe("'=2+5");
    expect(csvEscape('  +SUM(A1:A9)')).toBe("'  +SUM(A1:A9)");
    expect(csvEscape('\t-HYPERLINK(x)')).toBe("'\t-HYPERLINK(x)");
    expect(csvEscape('@mention')).toBe("'@mention");
    expect(neutralizeCsvFormula(' =cmd')).toBe("' =cmd");
  });

  it('tidak mengubah teks biasa dan nilai numerik', () => {
    expect(csvEscape('Budi Santoso')).toBe('Budi Santoso');
    expect(csvEscape(-5)).toBe('-5');
    expect(csvEscape(0)).toBe('0');
    expect(csvEscape(null)).toBe('');
  });

  it('tetap mengutip sel berkoma/kutip setelah netralisasi', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(toCsv([['Nama', 'Nilai'], ['=jahat', 90]])).toContain("'=jahat,90");
  });
});

describe('CSV formula injection (klien)', () => {
  it('buildCsv menetralkan nama berawalan formula', () => {
    const csv = buildCsv([{ nama: '=2+5', nilai: 90 }, { nama: ' Budi', nilai: 80 }]);
    expect(csv).toContain("'=2+5");
    expect(csv).toContain(' Budi');
  });

  it('escapeCsvCell mengutip koma dan menetralkan awalan @', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('@x')).toBe("'@x");
    expect(escapeCsvCell(42)).toBe('42');
  });
});

describe('secretEquals konstan-waktu', () => {
  it('benar hanya untuk nilai identik', async () => {
    await expect(secretEquals('kunci-rahasia', 'kunci-rahasia')).resolves.toBe(true);
    await expect(secretEquals('kunci-rahasia', 'kunci-lainnya')).resolves.toBe(false);
    await expect(secretEquals('pendek', 'pendek-namun-lebih-panjang')).resolves.toBe(false);
    await expect(secretEquals('', 'x')).resolves.toBe(false);
  });
});

describe('gateway WhatsApp memakai perbandingan kunci konstan-waktu', () => {
  const db = {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({ run: vi.fn(async () => ({ success: true })) })),
    })),
  } as any;

  it('menolak X-Gateway-Key yang salah', async () => {
    const response = await gatewayPost({
      env: { DB: db, WHATSAPP_GATEWAY_KEY: 'kunci-benar' },
      request: new Request('https://school.test/api/whatsapp/gateway', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Gateway-Key': 'kunci-salah' },
        body: JSON.stringify({ action: 'heartbeat', status: 'ready' }),
      }),
    } as any);
    expect(response.status).toBe(401);
  });

  it('menerima X-Gateway-Key yang benar', async () => {
    const response = await gatewayPost({
      env: { DB: db, WHATSAPP_GATEWAY_KEY: 'kunci-benar' },
      request: new Request('https://school.test/api/whatsapp/gateway', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Gateway-Key': 'kunci-benar' },
        body: JSON.stringify({ action: 'heartbeat', status: 'ready' }),
      }),
    } as any);
    expect(response.status).toBe(200);
  });
});

describe('sesi legacy plaintext tidak lagi diterima', () => {
  const rawToken = `st_${'a'.repeat(64)}`;

  function dbKeyedBy(storedKey: string, seen: string[]) {
    return {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...args: unknown[]) => ({
          first: vi.fn(async () => {
            if (sql.includes('FROM sessions')) {
              seen.push(String(args[0]));
              return args[0] === storedKey
                ? { token: storedKey, user_id: 'u1', expires_at: new Date(Date.now() + 3600_000).toISOString() }
                : null;
            }
            if (sql.includes('FROM users')) {
              return { id: 'u1', name: 'Siswa', email: 's@x.test', nip_nisn: '001', nik: null, tanggal_lahir: null, role: 'siswa', class_id: 'k1', ketua_status: 'none', jabatan: null, status: 'active', must_change_password: 0 };
            }
            return null;
          }),
          run: vi.fn(async () => ({ success: true })),
        })),
      })),
    } as any;
  }

  it('baris sesi yang menyimpan token mentah TIDAK mengautentikasi', async () => {
    const seen: string[] = [];
    const user = await getUserFromRequest(
      { DB: dbKeyedBy(rawToken, seen) },
      new Request('https://school.test/api/auth/me', { headers: { Authorization: `Bearer ${rawToken}` } }),
    );
    expect(user).toBeNull();
    // Hanya SATU pencarian sesi (berdasarkan hash); tidak ada fallback mentah.
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/^sha256:/);
  });

  it('baris sesi hash tetap mengautentikasi seperti biasa', async () => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken));
    const hash = `sha256:${Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
    const user = await getUserFromRequest(
      { DB: dbKeyedBy(hash, []) },
      new Request('https://school.test/api/auth/me', { headers: { Authorization: `Bearer ${rawToken}` } }),
    );
    expect(user?.id).toBe('u1');
  });
});

describe('PATCH users: nonaktifkan akun mencabut sesi', () => {
  function makeDb() {
    const batches: any[][] = [];
    const target = {
      id: 'u-guru', name: 'Guru Satu', email: 'guru@x.test', nip_nisn: '19800101', role: 'guru',
      class_id: null, jabatan: null, status: 'active', must_change_password: 0, archived_at: null,
      created_at: '2026-01-01', password_hash: 'hash',
    };
    const prepare = (sql: string) => {
      const stmt: any = {
        sql, args: [] as unknown[],
        bind: (...args: unknown[]) => { stmt.args = args; return stmt; },
        first: async () => (sql.includes('password_hash FROM users WHERE id') ? target : null),
        run: async () => ({ success: true }),
      };
      return stmt;
    };
    const db = {
      prepare,
      batch: vi.fn(async (statements: any[]) => { batches.push(statements); return statements.map(() => ({})); }),
    } as any;
    return { db, batches };
  }

  function patch(body: unknown) {
    return new Request('https://school.test/api/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  }

  it('status inactive menyisipkan DELETE sessions dalam batch yang sama', async () => {
    const { db, batches } = makeDb();
    const response = await patchUser({ env: { DB: db }, data: { user: ADMIN }, request: patch({ id: 'u-guru', status: 'inactive', reason: 'Uji' }) } as any);
    expect(response.status).toBe(200);
    const sqls = batches[0].map(stmt => stmt.sql);
    expect(sqls.some(sql => sql.includes('DELETE FROM sessions WHERE user_id'))).toBe(true);
  });

  it('status tidak dikenal ditolak 400', async () => {
    const { db, batches } = makeDb();
    const response = await patchUser({ env: { DB: db }, data: { user: ADMIN }, request: patch({ id: 'u-guru', status: 'banned' }) } as any);
    expect(response.status).toBe(400);
    expect(batches).toHaveLength(0);
  });
});

describe('ketua belum approved hanya membaca data sendiri', () => {
  const rows = [
    { nisn: '001', classId: 'k1', siswaName: 'Ketua' },
    { nisn: '002', classId: 'k1', siswaName: 'Teman' },
    { nisn: '003', classId: 'k2', siswaName: 'Lain Kelas' },
  ];
  const base = { id: 'u-ketua', name: 'Ketua', email: 'k@x.test', nipNisn: '001', nik: null, tanggalLahir: null, classId: 'k1', jabatan: null, status: 'active', mustChangePassword: false } as const;

  it('ketua approved membaca seluruh kelasnya', () => {
    const user = { ...base, role: 'ketua_kelas', ketuaStatus: 'approved' } as any;
    const filtered = filterCollectionForUser(rows, 'presensi_v1', user) as any[];
    expect(filtered.map(r => r.nisn)).toEqual(['001', '002']);
  });

  it('ketua TANPA approval hanya membaca rekamannya sendiri', () => {
    const user = { ...base, role: 'ketua_kelas', ketuaStatus: 'none' } as any;
    const filtered = filterCollectionForUser(rows, 'presensi_v1', user) as any[];
    expect(filtered.map(r => r.nisn)).toEqual(['001']);
  });
});

describe('foto: ketua belum approved tidak melihat foto teman sekelas', () => {
  function photoDb() {
    const firstFor = (sql: string) => async () => {
      if (sql.includes('FROM photos')) {
        return { data: btoa('hello'), thumb: btoa('hello'), mime: 'image/jpeg', drive_link: null, created_by: 'pemilik-lain' };
      }
      if (sql.includes('presensi_v1')) {
        return { value: JSON.stringify([{ classId: 'k1', fotoUrl: '/api/photo/foto-1' }]) };
      }
      return null;
    };
    return {
      prepare: vi.fn((sql: string) => ({
        first: vi.fn(firstFor(sql)),
        bind: vi.fn(() => ({ first: vi.fn(firstFor(sql)) })),
      })),
    } as any;
  }
  const ketua = (ketuaStatus: string) => ({
    id: 'u-ketua', name: 'Ketua', role: 'ketua_kelas', classId: 'k1', ketuaStatus,
  }) as any;

  it('ketua none -> 403 walau presensi kelas menautkan foto itu', async () => {
    const response = await getPhoto({
      env: { DB: photoDb() }, params: { id: 'foto-1' },
      request: new Request('https://school.test/api/photo/foto-1'), data: { user: ketua('none') },
    } as any);
    expect(response.status).toBe(403);
  });

  it('ketua approved -> 200 untuk foto sekelasnya', async () => {
    const response = await getPhoto({
      env: { DB: photoDb() }, params: { id: 'foto-1' },
      request: new Request('https://school.test/api/photo/foto-1'), data: { user: ketua('approved') },
    } as any);
    expect(response.status).toBe(200);
  });
});

describe('upload jalur lampiran thumbnail', () => {
  const jpeg = (size: number) => {
    const bytes = new Uint8Array(size);
    bytes.set([0xff, 0xd8, 0xff]);
    return bytes;
  };

  function attachDb(captured: { sql?: string }) {
    return {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => ({ id: 'foto-1' })),
          run: vi.fn(async () => { captured.sql = sql; return { success: true }; }),
        })),
      })),
    } as any;
  }

  it('rate limit thumbnail habis -> 429', async () => {
    vi.mocked(consumeRateLimit).mockImplementation(async (_db: unknown, key: string) => !key.startsWith('upload-thumb:'));
    const response = await upload({
      env: { DB: attachDb({}) },
      request: new Request('https://school.test/api/upload?id=foto-1', { method: 'POST', body: jpeg(64) }),
      data: { user: { id: 'user-1' } },
    } as any);
    expect(response.status).toBe(429);
    vi.mocked(consumeRateLimit).mockImplementation(async () => true);
  });

  it('thumbnail di atas 512KB ditolak 413', async () => {
    const response = await upload({
      env: { DB: attachDb({}) },
      request: new Request('https://school.test/api/upload?id=foto-1', { method: 'POST', body: jpeg(512 * 1024 + 1) }),
      data: { user: { id: 'user-1' } },
    } as any);
    expect(response.status).toBe(413);
  });

  it('lampiran sah tidak menimpa mime foto penuh', async () => {
    const captured: { sql?: string } = {};
    const response = await upload({
      env: { DB: attachDb(captured) },
      request: new Request('https://school.test/api/upload?id=foto-1', { method: 'POST', body: jpeg(64) }),
      data: { user: { id: 'user-1' } },
    } as any);
    expect(response.status).toBe(200);
    expect(captured.sql).toContain('SET thumb');
    expect(captured.sql).not.toContain('mime');
  });
});
