import { describe, expect, it, vi } from 'vitest';
import { getIntegrationStatus } from '../functions/api/integrations/status';

describe('integration status', () => {
  it('reports external state without exposing secret values', async () => {
    const first = vi.fn()
      .mockResolvedValueOnce({ enabled: 0, emergency_pause: 1, rollout_mode: 'off', gateway_status: 'never_seen', health_json: null })
      .mockResolvedValueOnce({ value: JSON.stringify({ status: 'dry-run', job: 'daily' }) });
    const all = vi.fn().mockResolvedValue({ results: [{ status: 'pending', count: 3 }] });
    const prepare = vi.fn((query: string) => ({
      bind: vi.fn(() => query.includes('GROUP BY') ? { all } : { first }),
      all,
    }));

    const result = await getIntegrationStatus({
      DB: { prepare } as unknown as D1Database,
      GEMINI_API_KEY: 'secret-value',
      GEMINI_ENABLED: 'true',
      GEMINI_MODEL: 'gemini-test',
    });

    expect(result.gemini).toEqual({ enabled: true, configured: true, model: 'gemini-test' });
    expect(result.whatsapp).toMatchObject({ enabled: false, emergencyPause: true, outbox: { pending: 3 } });
    expect(result.googleSync).toEqual({ status: 'dry-run', job: 'daily' });
    expect(JSON.stringify(result)).not.toContain('secret-value');
  });
});
