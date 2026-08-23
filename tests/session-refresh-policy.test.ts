import { describe, expect, it } from 'vitest';
import { shouldClearSessionOnAuthCheck } from '../src/utils/auth';

describe('kebijakan refresh sesi saat /api/auth/me gagal', () => {
  it('hanya 401 yang menghapus sesi lokal', () => {
    expect(shouldClearSessionOnAuthCheck(401)).toBe(true);
  });

  it('error jaringan/gangguan server mempertahankan sesi lokal', () => {
    // 0 = network error di beberapa lingkungan; 5xx = server bermasalah;
    // 403 = bukan alasan menghapus sesi login yang sah.
    for (const status of [0, 403, 404, 500, 502, 503, 504]) {
      expect(shouldClearSessionOnAuthCheck(status)).toBe(false);
    }
  });
});
