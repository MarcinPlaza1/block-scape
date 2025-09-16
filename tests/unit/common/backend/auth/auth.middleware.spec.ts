/* @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';

// Import prisma singleton first so we can stub its methods used by middleware
import prisma from 'server/config/database.js';
import config from 'server/config/config.js';

// Helper to create mock req/res/next
function createCtx(headers: Record<string, string|undefined> = {}) {
  const req: any = { headers, ip: '127.0.0.1' };
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('requireAuth middleware', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Provide default prisma.user.findUnique stub (overridable per test)
    // Ensure prisma has shape we need
    (prisma as any).user = (prisma as any).user || {};
    (prisma as any).user.findUnique = vi.fn();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const { requireAuth } = await import('server/middleware/auth.js');
    const { req, res, next } = createCtx({});
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 on invalid token', async () => {
    const { requireAuth } = await import('server/middleware/auth.js');
    const { req, res, next } = createCtx({ authorization: 'Bearer not-a-jwt' });
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    // Either Invalid token or Unauthorized depending on error
    const msg = (res.json as any).mock.calls[0][0].error;
    expect(['Invalid token','Unauthorized']).toContain(msg);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 on forged JWT signature', async () => {
    const { requireAuth } = await import('server/middleware/auth.js');
    // Token signed with a different secret -> invalid signature
    const forged = jwt.sign({ sub: 'u1', email: 'a@b.com', role: 'USER' }, 'wrong-secret', { expiresIn: '5m' });
    const { req, res, next } = createCtx({ authorization: `Bearer ${forged}` });
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    const msg = (res.json as any).mock.calls[0][0].error;
    expect(['Invalid token','Unauthorized']).toContain(msg);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is expired', async () => {
    const { requireAuth } = await import('server/middleware/auth.js');
    // Issue a token that is already expired
    const expired = jwt.sign({ sub: 'u1', email: 'a@b.com', role: 'USER' }, config.auth.jwtAccessSecret, { expiresIn: -1 });
    const { req, res, next } = createCtx({ authorization: `Bearer ${expired}` });
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    const msg = (res.json as any).mock.calls[0][0].error;
    expect(['Token expired','Unauthorized']).toContain(msg);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when user from token is not found', async () => {
    const { requireAuth } = await import('server/middleware/auth.js');
    const token = jwt.sign({ sub: 'u-missing', email: 'x@y.com', role: 'USER' }, config.auth.jwtAccessSecret, { expiresIn: '5m' });
    (prisma as any).user.findUnique = vi.fn().mockResolvedValue(null);
    const { req, res, next } = createCtx({ authorization: `Bearer ${token}` });
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches req.auth and req.user then calls next for valid token', async () => {
    const { requireAuth } = await import('server/middleware/auth.js');
    const token = jwt.sign({ sub: 'u-ok', email: 'ok@user.com', role: 'ADMIN' }, config.auth.jwtAccessSecret, { expiresIn: '5m' });
    (prisma as any).user.findUnique = vi.fn().mockResolvedValue({
      id: 'u-ok', email: 'ok@user.com', name: 'Ok', role: 'ADMIN', avatarUrl: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const { req, res, next } = createCtx({ authorization: `Bearer ${token}` });
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.auth).toEqual({ userId: 'u-ok', email: 'ok@user.com', role: 'ADMIN' });
    expect(req.user?.id).toBe('u-ok');
  });
});

describe('requireRole middleware', () => {
  it('forbids when req.auth missing', async () => {
    const { requireRole } = await import('server/middleware/auth.js');
    const guard = requireRole('ADMIN');
    const { req, res, next } = createCtx({});
    await guard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('forbids on role mismatch', async () => {
    const { requireRole } = await import('server/middleware/auth.js');
    const guard = requireRole(['ADMIN','MODERATOR']);
    const { req, res, next } = createCtx({});
    (req as any).auth = { userId: 'u1', email: 'a@b.com', role: 'USER' };
    await guard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
  });

  it('passes on allowed role', async () => {
    const { requireRole } = await import('server/middleware/auth.js');
    const guard = requireRole('ADMIN');
    const { req, res, next } = createCtx({});
    (req as any).auth = { userId: 'u2', email: 'x@y.com', role: 'ADMIN' };
    await guard(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});


