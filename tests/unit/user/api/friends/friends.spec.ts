import { describe, it, expect, beforeEach, vi } from 'vitest';
import { friendsApi } from '@/shared/api/friends';

describe('friendsApi', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    (window as any).fetch = vi.fn();
  });

  it('getFriends returns list', async () => {
    (window as any).fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ friends: [{ id: 'f1', name: 'A', friendshipId: 'r1', createdAt: '', isOnline: false }] }) });
    const res = await friendsApi.getFriends();
    expect(res.friends[0].id).toBe('f1');
  });

  it('sendRequest posts payload', async () => {
    (window as any).fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ request: { id: 'rq1', user: { id: 'u2', name: 'Bob' }, createdAt: '' } }) });
    const res = await friendsApi.sendRequest('u2', 'hi');
    expect(res.request.id).toBe('rq1');
    const call = (window as any).fetch.mock.calls[0];
    expect(call[1].method).toBe('POST');
    expect(call[1].body).toContain('"receiverId":"u2"');
  });

  it('accept/reject/cancel call proper endpoints', async () => {
    (window as any).fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ message: 'ok' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ message: 'ok' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ message: 'ok' }) });
    await friendsApi.acceptRequest('r1');
    await friendsApi.rejectRequest('r1');
    await friendsApi.cancelRequest('r1');
    const urls = (window as any).fetch.mock.calls.map((c: any[]) => c[0]);
    expect(urls.some((u: string) => u.endsWith('/friends/requests/r1/accept'))).toBe(true);
    expect(urls.some((u: string) => u.endsWith('/friends/requests/r1/reject'))).toBe(true);
    expect(urls.some((u: string) => u.endsWith('/friends/requests/r1'))).toBe(true);
  });

  it('getFriendsGames builds query string', async () => {
    (window as any).fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ games: [], total: 0, page: 1, limit: 12 }) });
    await friendsApi.getFriendsGames({ page: 2, limit: 10, q: 'abc', sort: 'updated_desc' });
    const called = (window as any).fetch.mock.calls[0][0] as string;
    expect(called).toContain('page=2');
    expect(called).toContain('limit=10');
    expect(called).toContain('q=abc');
    expect(called).toContain('sort=updated_desc');
  });
});


