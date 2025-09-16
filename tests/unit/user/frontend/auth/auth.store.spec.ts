import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/features/auth/store';

function setupFetch() {
  (globalThis as any).fetch = vi.fn();
}

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Reset store by recreating state via set
    const store = useAuthStore.getState();
    useAuthStore.setState({ user: null, token: null, loading: false, error: null });
    // Clear storages
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    setupFetch();
  });

  it('login sets token and user on success', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ token: 't-1', user: { id: 'u1', email: 'a@b.com', name: 'A', role: 'USER' } }) });
    await useAuthStore.getState().login('a@b.com', 'pass');
    const s = useAuthStore.getState();
    expect(s.token).toBe('t-1');
    expect(s.user?.id).toBe('u1');
  });

  it('register sets token and user on success', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ token: 't-2', user: { id: 'u2', email: 'b@b.com', name: 'b', role: 'USER' } }) });
    await useAuthStore.getState().register('b@b.com', 'pass');
    const s = useAuthStore.getState();
    expect(s.token).toBe('t-2');
    expect(s.user?.email).toBe('b@b.com');
  });

  it('fetchMe populates user when token exists', async () => {
    useAuthStore.setState({ token: 't-3' } as any);
    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ user: { id: 'u3', email: 'c@b.com', name: 'C', role: 'ADMIN' } }) });
    await useAuthStore.getState().fetchMe();
    const s = useAuthStore.getState();
    expect(s.user?.role).toBe('ADMIN');
  });

  it('logout clears token and user and calls backend', async () => {
    useAuthStore.setState({ token: 't-x', user: { id: 'u', email: 'e@x.com', role: 'USER', name: 'E' } as any } as any);
    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.token).toBeNull();
    expect(s.user).toBeNull();
    expect((fetch as any).mock.calls[0][0]).toMatch(/\/auth\/logout$/);
  });
});


