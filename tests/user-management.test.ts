import { describe, expect, it, vi } from 'vitest';
import { onRequestPost } from '../functions/api/users/index';

vi.mock('../functions/_lib/auth', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/auth')>('../functions/_lib/auth');
  return { ...actual, hashPassword: vi.fn(async () => 'hash') };
});

function request(role: string) {
  return new Request('http://test/api/users', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test', email: 'test@example.sch.id', identifier: '12345678', role }),
  });
}

const db = {
  prepare: vi.fn(() => ({
    bind: vi.fn(() => ({ first: vi.fn(async () => null), run: vi.fn(async () => ({ success: true })) })),
  })),
} as any;

describe('user management RBAC', () => {
  it('admin tidak boleh membuat admin lain', async () => {
    const res = await onRequestPost({ env: { DB: db }, request: request('admin'), data: { user: { id: 'a', name: 'Admin', role: 'admin' } } } as any);
    expect(res.status).toBe(400);
  });

  it('super admin boleh membuat admin', async () => {
    const res = await onRequestPost({ env: { DB: db }, request: request('admin'), data: { user: { id: 'sa', name: 'Super', role: 'super_admin' } } } as any);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ success: true, initialPassword: expect.any(String) });
  });
});
