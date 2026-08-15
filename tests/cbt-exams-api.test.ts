import { describe, expect, it, vi } from 'vitest';
import { onRequestDelete, onRequestPatch } from '../functions/api/cbt/exams/index';
import type { AuthUser } from '../functions/_lib/auth';

const teacher = {
  id: 'guru-1', name: 'Guru Satu', role: 'guru', email: '', nipNisn: null, nik: null,
  tanggalLahir: null, classId: null, ketuaStatus: 'none', jabatan: null, status: 'active', mustChangePassword: false,
} as AuthUser;

function request(method: string, body: object) {
  return new Request('http://test/api/cbt/exams', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

function dbWith(exam: any, attempt: any = null) {
  const run = vi.fn(async () => ({ success: true }));
  const prepare = vi.fn((sql: string) => ({
    bind: vi.fn(() => ({
      first: vi.fn(async () => sql.includes('cbt_attempts') ? attempt : exam),
      run,
    })),
  }));
  return { prepare, batch: vi.fn(async () => []) } as any;
}

describe('CBT exam lifecycle API', () => {
  it('rejects a teacher changing another teacher exam', async () => {
    const db = dbWith({ id: 'exam-1', teacher_user_id: 'guru-2', teacher_name: 'Guru Dua', status: 'active' });
    const response = await onRequestPatch({ env: { DB: db }, data: { user: teacher }, request: request('PATCH', { id: 'exam-1', status: 'inactive' }) } as any);
    expect(response.status).toBe(403);
  });

  it('allows the owner to deactivate their exam', async () => {
    const db = dbWith({ id: 'exam-1', teacher_user_id: teacher.id, teacher_name: teacher.name, status: 'active' });
    const response = await onRequestPatch({ env: { DB: db }, data: { user: teacher }, request: request('PATCH', { id: 'exam-1', status: 'inactive' }) } as any);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { status: 'inactive' } });
  });

  it('preserves attempts by refusing permanent deletion', async () => {
    const db = dbWith({ id: 'exam-1', teacher_user_id: teacher.id, teacher_name: teacher.name }, { id: 'attempt-1' });
    const response = await onRequestDelete({ env: { DB: db }, data: { user: teacher }, request: request('DELETE', { id: 'exam-1' }) } as any);
    expect(response.status).toBe(409);
  });
});
