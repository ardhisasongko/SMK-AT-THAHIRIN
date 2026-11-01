import { describe, expect, it } from 'vitest';
import { secretEquals } from '../src/secret-compare';

// Regresi Fase A: SYNC_TOKEN sync-worker kini dibandingkan konstan-waktu.
describe('secretEquals (sync-worker)', () => {
  it('benar hanya untuk nilai identik', async () => {
    await expect(secretEquals('Bearer token-abc', 'Bearer token-abc')).resolves.toBe(true);
    await expect(secretEquals('Bearer token-abc', 'Bearer token-abd')).resolves.toBe(false);
    await expect(secretEquals('Bearer token-abc', 'Bearer token-abc-lebih')).resolves.toBe(false);
    await expect(secretEquals('', 'Bearer token-abc')).resolves.toBe(false);
  });
});
