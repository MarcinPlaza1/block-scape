/* @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import prisma from 'server/config/database.js';

describe('verifyGameAccess', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (prisma as any).game = (prisma as any).game || {};
    (prisma as any).game.findFirst = vi.fn();
  });

  it('returns null when no access path matches', async () => {
    const { verifyGameAccess } = await import('server/utils/auth.js');
    (prisma as any).game.findFirst = vi.fn().mockResolvedValue(null);
    const access = await verifyGameAccess('g1', 'u1');
    expect(access).toBeNull();
  });

  it('allows owner with canEdit', async () => {
    const { verifyGameAccess } = await import('server/utils/auth.js');
    (prisma as any).game.findFirst = vi.fn().mockResolvedValue({
      id: 'g1', ownerId: 'u1', visibility: 'PRIVATE', published: false, members: [],
    });
    const access = await verifyGameAccess('g1', 'u1');
    expect(access?.canEdit).toBe(true);
    expect(access?.isOwner).toBe(true);
  });

  it('allows member EDITOR to edit, VIEWER cannot', async () => {
    const { verifyGameAccess } = await import('server/utils/auth.js');
    (prisma as any).game.findFirst = vi.fn().mockResolvedValue({
      id: 'g1', ownerId: 'owner', visibility: 'PRIVATE', published: false, members: [{ role: 'EDITOR' }],
    });
    const accessEditor = await verifyGameAccess('g1', 'u2');
    expect(accessEditor?.canEdit).toBe(true);

    (prisma as any).game.findFirst = vi.fn().mockResolvedValue({
      id: 'g1', ownerId: 'owner', visibility: 'PRIVATE', published: false, members: [{ role: 'VIEWER' }],
    });
    const accessViewer = await verifyGameAccess('g1', 'u3');
    expect(accessViewer?.canEdit).toBe(false);
  });

  it('treats PUBLIC visibility as viewable', async () => {
    const { verifyGameAccess } = await import('server/utils/auth.js');
    (prisma as any).game.findFirst = vi.fn().mockResolvedValue({
      id: 'g1', ownerId: 'owner', visibility: 'PUBLIC', published: true, members: [],
    });
    const access = await verifyGameAccess('g1', 'random');
    expect(access?.canView).toBe(true);
  });
});


