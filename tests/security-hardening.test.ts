import { describe, expect, it, vi } from 'vitest';
import { authHeaders, loadAuthSession, saveAuthSession } from '../src/utils/auth';
import { jsonResponse } from '../functions/_lib/response';

describe('security hardening', () => {
  it('does not persist or resend bearer session tokens', () => {
    saveAuthSession({ token: 'secret-token', user: { id: 'u1', name: 'Guru', email: 'guru@example.test', role: 'guru', avatar: '' } });
    expect(localStorage.getItem('smk_auth')).not.toContain('secret-token');
    expect(loadAuthSession()?.token).toBeUndefined();
    expect(authHeaders({ 'Content-Type': 'application/json' })).toEqual({ 'Content-Type': 'application/json' });
  });

  it('adds defensive headers to API responses', () => {
    const response = jsonResponse({ success: true });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');
    expect(response.headers.get('strict-transport-security')).toContain('max-age=31536000');
  });

  it('keeps crypto available in the test runtime', () => {
    expect(vi.isMockFunction(crypto.getRandomValues)).toBe(false);
  });
});
