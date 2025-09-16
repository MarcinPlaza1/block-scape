import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { apiFetch, setAuth, clearAuth, getAuthToken, tryRefreshToken, gamesApi, API_BASE } from '@/shared/api/client';

function mockFetchOnce(resp: Partial<Response> & { json?: any; text?: any }) {
  (window as any).fetch.mockResolvedValueOnce({
    ok: resp.ok ?? true,
    status: resp.status ?? 200,
    headers: {
      get: (k: string) => (resp as any).headers?.get?.(k) ?? (resp as any).headers?.[k] ?? 'application/json',
    },
    json: async () => (typeof resp.json === 'function' ? await (resp as any).json() : (resp.json ?? {})),
    text: async () => (typeof resp.text === 'function' ? await (resp as any).text() : (resp.text ?? '')),
    clone() { return this; },
  } as any);
}

describe('shared/api/client helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    (window as any).fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('setAuth/getAuthToken/clearAuth manage tokens and email', () => {
    expect(getAuthToken()).toBeNull();
    setAuth('t-123', 'user@example.com');
    expect(getAuthToken()).toBe('t-123');
    expect(localStorage.getItem('auth-email')).toBe('user@example.com');

    clearAuth();
    expect(getAuthToken()).toBeNull();
    expect(localStorage.getItem('auth-email')).toBeNull();
  });

  it('apiFetch attaches Authorization when token present and handles ok json', async () => {
    setAuth('token-abc');
    const payload = { ok: true };
    mockFetchOnce({ ok: true, status: 200, json: payload });

    const res = await apiFetch('/ping');
    expect(res).toEqual(payload);
    const call = (window as any).fetch.mock.calls[0];
    expect(call[0]).toBe(`${API_BASE}/ping`);
    expect(call[1].headers.Authorization).toBe('Bearer token-abc');
  });

  it('apiFetch retries on 401 with tryRefreshToken success', async () => {
    setAuth('expired-token');
    // First call 401
    (window as any).fetch
      .mockResolvedValueOnce({ ok: false, status: 401, headers: { get: () => 'application/json' }, clone() { return this; }, json: async () => ({}), text: async () => '' })
      // CSRF prefetch (may be attempted)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}), text: async () => '' })
      // Refresh call success
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ token: 'new-token' }), text: async () => '' })
      // Retry original succeeds
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }), text: async () => '' });

    const res = await apiFetch('/secure');
    expect(res).toEqual({ ok: true });
    // After refresh, token updated
    expect(getAuthToken()).toBe('new-token');
  });

  it('apiFetch throws error with message from server', async () => {
    mockFetchOnce({ ok: false, status: 400, json: { message: 'bad' }, headers: { get: () => 'application/json' } });
    await expect(apiFetch('/err')).rejects.toThrow('bad');
  });

  it('tryRefreshToken returns false on network error', async () => {
    (window as any).fetch.mockRejectedValueOnce(new Error('network'));
    const ok = await tryRefreshToken();
    expect(ok).toBe(false);
  });

  it('gamesApi.updateVisibility calls correct endpoint and returns data', async () => {
    mockFetchOnce({ ok: true, status: 200, json: { game: { id: 'g1', visibility: 'PUBLIC', updatedAt: 'now' } } });
    const res = await gamesApi.updateVisibility('g1', 'PUBLIC');
    expect(res.game.id).toBe('g1');
  });

  it('gamesApi.share/unshare call appropriate endpoints', async () => {
    mockFetchOnce({ ok: true, status: 200, json: { member: { id: 'm1', userId: 'u1', role: 'EDITOR' } } });
    const share = await gamesApi.share('g1', 'u1', 'EDITOR');
    expect(share.member.role).toBe('EDITOR');

    mockFetchOnce({ ok: true, status: 200, json: { ok: true } });
    const un = await gamesApi.unshare('g1', 'm1');
    expect(un.ok).toBe(true);
  });
});


