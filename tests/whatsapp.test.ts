import { describe, expect, it, vi } from 'vitest';
import { attendanceMessage, enqueueMessage, maskPhone, normalizeIndonesianPhone } from '../functions/_lib/whatsapp';

describe('WhatsApp notification helpers', () => {
  it('normalizes Indonesian mobile numbers', () => {
    expect(normalizeIndonesianPhone('0812-3456-7890')).toBe('6281234567890');
    expect(normalizeIndonesianPhone('81234567890')).toBe('6281234567890');
    expect(normalizeIndonesianPhone('123')).toBeNull();
  });

  it('masks phone and builds attendance message', () => {
    expect(maskPhone('6281234567890')).toBe('62812****890');
    expect(attendanceMessage({ studentName: 'Budi', className: 'X MPLB 1', status: 'Terlambat', date: '2026-08-17', time: '08:10' })).toContain('TERLAMBAT');
  });

  it('counts queue only when dedupe insert succeeds', async () => {
    const run = vi.fn(async () => ({ meta: { changes: 1 } }));
    const prepare = vi.fn(() => ({ bind: vi.fn(() => ({ run })) }));
    expect(await enqueueMessage({ prepare } as any, { dedupeKey: 'd1', phone: '6281234567890', type: 'test', text: 'Test', scheduledAt: '2026-08-17T00:00:00.000Z' })).toBe(true);
    expect(prepare).toHaveBeenCalledTimes(2);
  });
});
