import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService, ProjectService, FriendsService, ChatService, NewsService } from '@/services/api.service';
import * as client from '@/shared/api/client';

describe('services/api.service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(client, 'apiFetch').mockResolvedValue({} as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AuthService.login posts credentials and returns data', async () => {
    (client.apiFetch as any).mockResolvedValueOnce({ token: 't', user: { id: 'u1' } });
    const res = await AuthService.login('a@example.com', 'pass');
    expect(res.token).toBe('t');
    expect((client.apiFetch as any).mock.calls[0][0]).toBe('/auth/login');
    const body = JSON.parse((client.apiFetch as any).mock.calls[0][1].body);
    expect(body).toEqual({ email: 'a@example.com', password: 'pass' });
  });

  it('AuthService.register uses email prefix as default name', async () => {
    (client.apiFetch as any).mockResolvedValueOnce({ token: 't', user: { id: 'u1' } });
    await AuthService.register('john.doe@example.com', 'secret');
    const [path, init] = (client.apiFetch as any).mock.calls[0];
    expect(path).toBe('/auth/register');
    const body = JSON.parse(init.body);
    expect(body.name).toBe('john.doe');
  });

  it('AuthService.register keeps provided name', async () => {
    (client.apiFetch as any).mockResolvedValueOnce({ token: 't', user: { id: 'u1' } });
    await AuthService.register('jane@example.com', 'secret', 'Jane');
    const body = JSON.parse((client.apiFetch as any).mock.calls[0][1].body);
    expect(body).toEqual({ email: 'jane@example.com', password: 'secret', name: 'Jane' });
  });

  it('ProjectService.createProject posts payload to /games', async () => {
    (client.apiFetch as any).mockResolvedValueOnce({ game: { id: 'g1', name: 'P' } });
    const data = { name: 'P', blocks: [], mode: 'SANDBOX' as const };
    const res = await ProjectService.createProject(data);
    expect(res.game.id).toBe('g1');
    const [path, init] = (client.apiFetch as any).mock.calls[0];
    expect(path).toBe('/games');
    expect(JSON.parse(init.body)).toMatchObject(data);
  });

  it('ProjectService.updateProject puts to /games/:id', async () => {
    (client.apiFetch as any).mockResolvedValueOnce({ game: { id: 'g2', name: 'X', published: true } });
    const res = await ProjectService.updateProject('g2', { published: true });
    expect(res.game.published).toBe(true);
    const [path, init] = (client.apiFetch as any).mock.calls[0];
    expect(path).toBe('/games/g2');
    expect(init.method).toBe('PUT');
  });

  it('ProjectService.publishProject delegates to updateProject', async () => {
    const spy = vi.spyOn(ProjectService, 'updateProject').mockResolvedValue({ game: { id: 'g3', name: 'N', published: true } } as any);
    const res = await ProjectService.publishProject('g3', true);
    expect(spy).toHaveBeenCalledWith('g3', { published: true });
    expect(res.game.published).toBe(true);
  });

  it('FriendsService endpoints send correct payloads', async () => {
    (client.apiFetch as any)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    await FriendsService.sendFriendRequest('u2');
    await FriendsService.acceptFriendRequest('r1');
    await FriendsService.rejectFriendRequest('r2');

    expect((client.apiFetch as any).mock.calls[0][0]).toBe('/friends/request');
    expect(JSON.parse((client.apiFetch as any).mock.calls[0][1].body)).toEqual({ userId: 'u2' });
    expect((client.apiFetch as any).mock.calls[1][0]).toBe('/friends/accept');
    expect(JSON.parse((client.apiFetch as any).mock.calls[1][1].body)).toEqual({ requestId: 'r1' });
    expect((client.apiFetch as any).mock.calls[2][0]).toBe('/friends/reject');
    expect(JSON.parse((client.apiFetch as any).mock.calls[2][1].body)).toEqual({ requestId: 'r2' });
  });

  it('ChatService.sendMessage posts to /chat/send', async () => {
    (client.apiFetch as any).mockResolvedValueOnce({ ok: true });
    await ChatService.sendMessage('hello', 'u3');
    const [path, init] = (client.apiFetch as any).mock.calls[0];
    expect(path).toBe('/chat/send');
    expect(JSON.parse(init.body)).toEqual({ content: 'hello', recipientId: 'u3' });
  });

  it('NewsService endpoints call correct routes', async () => {
    (client.apiFetch as any).mockResolvedValue({ ok: true });
    await NewsService.getNews();
    await NewsService.getNewsItem('id-1');
    expect((client.apiFetch as any).mock.calls[0][0]).toBe('/news');
    expect((client.apiFetch as any).mock.calls[1][0]).toBe('/news/id-1');
  });
});


