// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../functions/_middleware';
import { getUserFromRequest } from '../functions/_lib/auth';

vi.mock('../functions/_lib/auth', () => ({
  getUserFromRequest: vi.fn(async () => null),
}));

vi.mock('../functions/_lib/rate-limit', () => ({
  consumeRateLimit: vi.fn(async () => true),
}));

describe('middleware hardening', () => {
  beforeEach(() => {
    vi.mocked(getUserFromRequest).mockClear();
  });

  it('menolak mutation cookie-session dari Origin berbeda', async () => {
    const next = vi.fn();
    const request = new Request('https://school.test/api/users', {
      method: 'POST',
      headers: { Cookie: 'smk_session=secret', Origin: 'https://evil.test' },
      body: '{}',
    });

    const response = await onRequest({ request, env: { DB: {} }, data: {}, next } as any);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('Origin') });
    expect(next).not.toHaveBeenCalled();
    expect(getUserFromRequest).not.toHaveBeenCalled();
  });

  it('menolak body mutation dengan Content-Length di atas batas', async () => {
    const next = vi.fn();
    const request = new Request('https://school.test/api/users', {
      method: 'POST',
      headers: { 'Content-Length': String(128 * 1024 + 1) },
      body: '{}',
    });

    const response = await onRequest({ request, env: { DB: {} }, data: {}, next } as any);

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('terlalu besar') });
    expect(next).not.toHaveBeenCalled();
    expect(getUserFromRequest).not.toHaveBeenCalled();
  });
});
