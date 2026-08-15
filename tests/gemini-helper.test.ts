import { describe, expect, it, vi } from 'vitest';
import {
  callGemini,
  GeminiError,
  isGeminiEnabled,
  parseGeminiJson,
} from '../functions/_lib/gemini';

function geminiResponse(text = '{"ok":true}', finishReason = 'STOP') {
  return new Response(JSON.stringify({
    candidates: [{
      finishReason,
      safetyRatings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', blocked: false }],
      content: { parts: [{ text }] },
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('Gemini helper', () => {
  it('fail-closed dan hanya menerima flag truthy eksplisit', () => {
    expect(isGeminiEnabled(undefined, 'key')).toBe(false);
    expect(isGeminiEnabled(undefined, undefined)).toBe(false);
    expect(isGeminiEnabled('', 'key')).toBe(false);
    expect(isGeminiEnabled('false', 'key')).toBe(false);
    expect(isGeminiEnabled('ON', 'key')).toBe(true);
    expect(isGeminiEnabled('unexpected', 'key')).toBe(false);
  });

  it('mem-parse JSON murni, fenced, dan JSON dengan pengantar secara ketat', () => {
    expect(parseGeminiJson('{"value":"}"}')).toEqual({ value: '}' });
    expect(parseGeminiJson('```json\n[1, 2]\n```')).toEqual([1, 2]);
    expect(parseGeminiJson('Berikut hasilnya: {"ok":true}')).toEqual({ ok: true });
    expect(() => parseGeminiJson('bukan json')).toThrow(GeminiError);
  });

  it('mengirim model dan generation config yang ditentukan', async () => {
    const fetchImpl = vi.fn(async () => geminiResponse('selesai'));

    await expect(callGemini('secret key', 'prompt', {
      model: 'gemini-custom',
      maxOutputTokens: 1234,
      fetchImpl,
    })).resolves.toBe('selesai');

    const [url, request] = fetchImpl.mock.calls[0];
    expect(url).toContain('/gemini-custom:generateContent?key=secret%20key');
    expect(JSON.parse(String(request?.body))).toMatchObject({
      generationConfig: { candidateCount: 1, maxOutputTokens: 1234 },
    });
  });

  it('retry hanya untuk 429/5xx dengan backoff dan jitter terkontrol', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(geminiResponse('berhasil'));
    const sleep = vi.fn(async () => undefined);

    await expect(callGemini('key', 'prompt', {
      fetchImpl,
      sleep,
      random: () => 0,
      retryBaseDelayMs: 100,
      maxRetries: 2,
    })).resolves.toBe('berhasil');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[100], [200]]);

    const badRequest = vi.fn(async () => new Response(null, { status: 400 }));
    await expect(callGemini('key', 'prompt', { fetchImpl: badRequest, sleep })).rejects.toMatchObject({ code: 'upstream' });
    expect(badRequest).toHaveBeenCalledOnce();
  });

  it('retry kegagalan jaringan non-abort secara terbatas', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockRejectedValueOnce(new TypeError('connection reset'))
      .mockResolvedValueOnce(geminiResponse('pulih'));
    const sleep = vi.fn(async () => undefined);

    await expect(callGemini('key', 'prompt', {
      fetchImpl,
      sleep,
      random: () => 0,
      retryBaseDelayMs: 50,
      maxRetries: 2,
    })).resolves.toBe('pulih');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[50], [100]]);

    const unavailable = vi.fn(async () => { throw new TypeError('offline'); });
    await expect(callGemini('key', 'prompt', {
      fetchImpl: unavailable,
      sleep,
      random: () => 0,
      maxRetries: 1,
    })).rejects.toMatchObject({ code: 'upstream' });
    expect(unavailable).toHaveBeenCalledTimes(2);
  });

  it('membatalkan request yang melewati timeout', async () => {
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));

    await expect(callGemini('key', 'prompt', { fetchImpl, timeoutMs: 5 })).rejects.toMatchObject({ code: 'timeout' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('menolak kandidat yang terpotong atau diblokir', async () => {
    await expect(callGemini('key', 'prompt', {
      fetchImpl: vi.fn(async () => geminiResponse('{}', 'MAX_TOKENS')),
    })).rejects.toMatchObject({ code: 'invalid_response' });

    const blocked = new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 });
    await expect(callGemini('key', 'prompt', {
      fetchImpl: vi.fn(async () => blocked),
    })).rejects.toMatchObject({ code: 'blocked' });

    const unsafeCandidate = new Response(JSON.stringify({
      candidates: [{
        finishReason: 'STOP',
        safetyRatings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', blocked: true }],
        content: { parts: [{ text: '{}' }] },
      }],
    }), { status: 200 });
    await expect(callGemini('key', 'prompt', {
      fetchImpl: vi.fn(async () => unsafeCandidate),
    })).rejects.toMatchObject({ code: 'blocked' });
  });
});
