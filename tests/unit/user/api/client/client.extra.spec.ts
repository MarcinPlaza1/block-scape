import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiFetch } from '@/shared/api/client';

describe('apiFetch extra', () => {
  beforeEach(() => {
    (window as any).fetch = vi.fn();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('returns error text when non-JSON response on error', async () => {
    (window as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: { get: () => 'text/plain' },
      clone() { return this; },
      text: async () => 'Server exploded',
    });
    await expect(apiFetch('/oops')).rejects.toThrow('Server exploded');
  });

  it('throws with status when no body available', async () => {
    (window as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => '' },
      clone() { return this; },
      text: async () => '',
    });
    await expect(apiFetch('/missing')).rejects.toThrow('Request failed with 404');
  });
});


