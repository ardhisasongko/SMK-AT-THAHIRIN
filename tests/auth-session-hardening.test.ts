// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { createSession } from '../functions/_lib/auth';

describe('session hardening', () => {
  it('menyimpan hash token sesi, bukan raw token', async () => {
    const run = vi.fn(async () => ({ success: true }));
    const bind = vi.fn((..._args: unknown[]) => ({ run }));
    const db = { prepare: vi.fn(() => ({ bind })) };

    const rawToken = await createSession({ DB: db as unknown as D1Database }, 'user-1');
    const storedToken = bind.mock.calls[0][0];

    expect(rawToken).toMatch(/^st_[0-9a-f]{64}$/);
    expect(storedToken).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(storedToken).not.toBe(rawToken);
    expect(bind).toHaveBeenCalledWith(storedToken, 'user-1', expect.any(String));
  });
});
