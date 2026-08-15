import { describe, expect, it, vi } from 'vitest';
import { attendanceMessage, enqueueMessage, maskPhone, normalizeIndonesianPhone } from '../functions/_lib/whatsapp';
import { deliveryOutcome, isWithinActiveHours } from '../functions/api/whatsapp/gateway';
import { onRequestPut as saveContact } from '../functions/api/whatsapp/contacts';
import { onRequestPut as saveTeacher } from '../functions/api/whatsapp/teachers';

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

  it('counts a duplicate outbox message as skipped', async () => {
    const insertRun = vi.fn(async () => ({ meta: { changes: 0 } }));
    const statRun = vi.fn(async () => ({ meta: { changes: 1 } }));
    const prepare = vi.fn()
      .mockReturnValueOnce({ bind: vi.fn(() => ({ run: insertRun })) })
      .mockReturnValueOnce({ bind: vi.fn(() => ({ run: statRun })) });
    expect(await enqueueMessage({ prepare } as any, { dedupeKey: 'duplicate', phone: '6281234567890', type: 'test', text: 'Test', scheduledAt: '2026-08-17T00:00:00.000Z' })).toBe(false);
    expect(String(prepare.mock.calls[1][0])).toContain('skipped');
  });

  it('retries a normal failure once and makes the second failure terminal', () => {
    expect(deliveryOutcome(1, { success: false })).toBe('pending');
    expect(deliveryOutcome(2, { success: false })).toBe('failed');
    expect(deliveryOutcome(1, { success: true })).toBe('sent');
    expect(deliveryOutcome(1, { skipped: true })).toBe('skipped');
  });

  it('supports D1 active hours including a window across midnight', () => {
    expect(isWithinActiveHours('08:00', '05:00', '17:00')).toBe(true);
    expect(isWithinActiveHours('18:00', '05:00', '17:00')).toBe(false);
    expect(isWithinActiveHours('23:30', '22:00', '04:00')).toBe(true);
    expect(isWithinActiveHours('03:30', '22:00', '04:00')).toBe(true);
  });

  it('rejects a guardian contact for a student outside the roster', async () => {
    const prepare = vi.fn(() => ({ first: vi.fn(async () => ({ value: JSON.stringify([{ id: 'student-1' }]) })) }));
    const response = await saveContact({
      env: { DB: { prepare } },
      data: { user: { id: 'admin-1', role: 'admin' } },
      request: new Request('https://example.test/api/whatsapp/contacts', { method: 'PUT', body: JSON.stringify({ studentId: 'missing' }) }),
    } as any);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ success: false, error: 'Siswa tidak ditemukan.' });
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('rejects WhatsApp settings for a missing teacher', async () => {
    const first = vi.fn(async () => null);
    const prepare = vi.fn(() => ({ bind: vi.fn(() => ({ first })) }));
    const response = await saveTeacher({
      env: { DB: { prepare } },
      data: { user: { id: 'admin-1', role: 'admin' } },
      request: new Request('https://example.test/api/whatsapp/teachers', { method: 'PUT', body: JSON.stringify({ teacherId: 'missing', phone: '081234567890' }) }),
    } as any);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ success: false, error: 'Guru aktif tidak ditemukan.' });
    expect(prepare).toHaveBeenCalledTimes(1);
  });
});
