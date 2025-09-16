import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, tryRefreshToken } from '@/shared/api/client';

const originalFetch = global.fetch;

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retries once after 401 using tryRefreshToken', async () => {
    const client = await import('@/shared/api/client');
    const refreshSpy = vi.spyOn(client, 'tryRefreshToken').mockResolvedValue(true);
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    // @ts-ignore
    global.fetch = mockFetch;

    const res = await apiFetch('/ping');
    expect(res).toEqual({ ok: true });
    expect(refreshSpy).toHaveBeenCalledOnce();

    global.fetch = originalFetch;
  });
});


