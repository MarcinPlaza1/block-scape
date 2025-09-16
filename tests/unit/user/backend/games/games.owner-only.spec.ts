/* @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import prisma from 'server/config/database.js';

// We test controller logic by calling functions directly with mocked req/res
function createRes() {
  return {
    statusCode: 200,
    headers: {} as Record<string,string>,
    payload: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    setHeader(k: string, v: string) { this.headers[k] = v; },
    json(data: any) { this.payload = data; return this; },
  } as any;
}

describe('Games controllers owner-only guards', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (prisma as any).game = (prisma as any).game || {};
    (prisma as any).gameMember = (prisma as any).gameMember || {};
    (prisma as any).friend = (prisma as any).friend || {};
  });

  it('updateVisibility forbids non-owner', async () => {
    const { updateVisibility } = await import('server/controllers/gamesController.js');
    (prisma as any).game.findFirst = vi.fn().mockResolvedValue(null);
    const req: any = { params: { id: 'g1' }, body: { visibility: 'PUBLIC' }, auth: { userId: 'uX' } };
    const res: any = createRes();
    await expect(updateVisibility(req, res)).rejects.toThrow('Only owner can change visibility');
  });

  it('shareGame requires ownership and friendship', async () => {
    const { shareGame } = await import('server/controllers/gamesController.js');
    // First: not owner
    (prisma as any).game.findFirst = vi.fn().mockResolvedValue(null);
    const req1: any = { params: { id: 'g1' }, body: { userId: 'u2', role: 'EDITOR' }, auth: { userId: 'u1' } };
    const res1: any = createRes();
    await expect(shareGame(req1, res1)).rejects.toThrow('Only owner can share the game');

    // Then: owner but not friends
    (prisma as any).game.findFirst = vi.fn().mockResolvedValue({ id: 'g1' });
    ;(prisma as any).friend.findFirst = vi.fn().mockResolvedValue(null);
    const req2: any = { params: { id: 'g1' }, body: { userId: 'u2', role: 'EDITOR' }, auth: { userId: 'u1' } };
    const res2: any = createRes();
    await expect(shareGame(req2, res2)).rejects.toThrow('You can only share with friends');
  });

  it('unshareGame requires ownership', async () => {
    const { unshareGame } = await import('server/controllers/gamesController.js');
    (prisma as any).game.findFirst = vi.fn().mockResolvedValue(null);
    const req: any = { params: { id: 'g1', memberId: 'm1' }, auth: { userId: 'uX' } };
    const res: any = createRes();
    await expect(unshareGame(req, res)).rejects.toThrow('Only owner can unshare');
  });
});


