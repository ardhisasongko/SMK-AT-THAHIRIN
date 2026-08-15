import { afterEach, describe, expect, it, vi } from 'vitest';
import { cbtApi } from '../src/utils/cbt-api';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('CBT client API', () => {
  it('uses the shared auth headers when generating questions', async () => {
    localStorage.setItem('smk_auth', JSON.stringify({ token: 'session-token', user: { id: 'guru-1' } }));
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await cbtApi.generateQuestions('Kearsipan');

    expect(fetchMock).toHaveBeenCalledWith('/api/cbt/generate', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer session-token', 'Content-Type': 'application/json' }),
    }));
  });
});
