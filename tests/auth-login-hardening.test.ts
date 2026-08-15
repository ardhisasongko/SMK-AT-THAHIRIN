// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { onRequestPost } from '../functions/api/auth/login';
import { createSession, verifyPassword } from '../functions/_lib/auth';

vi.mock('../functions/_lib/auth', () => ({
  createSession: vi.fn(async () => 'raw-session-token'),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(async () => true),
}));

vi.mock('../functions/_lib/rate-limit', () => ({
  clearRateLimit: vi.fn(async () => undefined),
  consumeRateLimit: vi.fn(async () => true),
}));

describe('login hardening', () => {
  it('mengirim sesi lewat cookie HttpOnly tanpa token di body', async () => {
    const user = {
      id: 'user-1', name: 'Siswa', email: 'siswa@example.test', role: 'siswa', password_hash: 'pbkdf2$100000$salt$hash',
      status: 'active', nip_nisn: '0011223344', class_id: 'k1', ketua_status: 'none', must_change_password: 0,
    };
    const first = vi.fn(async () => user);
    const bind = vi.fn((..._args: unknown[]) => ({ first }));
    const db = { prepare: vi.fn(() => ({ bind })) };
    const request = new Request('https://school.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: user.email, password: 'correct-password' }),
    });

    const response = await onRequestPost({ env: { DB: db }, request } as any);
    const json = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(verifyPassword).toHaveBeenCalledWith('correct-password', user.password_hash);
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ DB: db }), user.id);
    expect(json).toMatchObject({ success: true, user: { id: user.id } });
    expect(json).not.toHaveProperty('token');
    expect(JSON.stringify(json)).not.toContain('raw-session-token');
    expect(response.headers.get('Set-Cookie')).toContain('smk_session=raw-session-token');
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
    expect(response.headers.get('Set-Cookie')).toContain('Secure');
  });
});
