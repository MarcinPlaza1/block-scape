import { describe, it, expect, beforeEach, vi } from 'vitest';
import { privateChatApi } from '@/shared/api/privateChat';

describe('privateChatApi', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    (window as any).fetch = vi.fn();
  });

  it('getConversations returns array', async () => {
    (window as any).fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ conversations: [{ id: 'c1', otherUser: { id: 'u2', name: 'Bob' }, updatedAt: '', unreadCount: 0 }] }) });
    const res = await privateChatApi.getConversations();
    expect(res.conversations[0].id).toBe('c1');
  });

  it('createConversation posts friendId', async () => {
    (window as any).fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ conversation: { id: 'c2', otherUser: { id: 'u3', name: 'Eve' }, createdAt: '' } }) });
    const res = await privateChatApi.createConversation('u3');
    expect(res.conversation.id).toBe('c2');
    const body = (window as any).fetch.mock.calls[0][1].body as string;
    expect(body).toContain('"friendId":"u3"');
  });

  it('getMessages attaches limit and offset', async () => {
    (window as any).fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ messages: [], hasMore: false }) });
    await privateChatApi.getMessages('c1', 25, 100);
    const url = (window as any).fetch.mock.calls[0][0] as string;
    expect(url).toContain('/chat/conversations/c1/messages');
    expect(url).toContain('limit=25');
    expect(url).toContain('offset=100');
  });

  it('sendMessage posts content and type', async () => {
    (window as any).fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ message: { id: 'm1', content: 'hi', senderId: 'me', messageType: 'text', isRead: false, createdAt: '', sender: { id: 'me', name: 'Me' } } }) });
    const res = await privateChatApi.sendMessage('c1', 'hi', 'text');
    expect(res.message.id).toBe('m1');
    const body = (window as any).fetch.mock.calls[0][1].body as string;
    expect(body).toContain('"content":"hi"');
    expect(body).toContain('"messageType":"text"');
  });

  it('getUnreadCount returns number', async () => {
    (window as any).fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ unreadCount: 5 }) });
    const res = await privateChatApi.getUnreadCount();
    expect(res.unreadCount).toBe(5);
  });
});


