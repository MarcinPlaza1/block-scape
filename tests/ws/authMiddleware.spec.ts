import { describe, it, expect, vi } from 'vitest';
import { authMiddleware } from 'server/websocket/services/auth/authMiddleware.js';

describe('ws authMiddleware', () => {
  it('calls next with error when token missing', async () => {
    const socket: any = { handshake: { auth: {}, headers: {} } };
    const next = vi.fn((err?: any) => err);
    await authMiddleware(socket, next);
    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(String(err?.message || err)).toMatch(/token/i);
  });
});


