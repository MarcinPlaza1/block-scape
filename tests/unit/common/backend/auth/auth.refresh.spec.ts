/* @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import config from 'server/config/config.js';
import prisma from 'server/config/database.js';
import { vi } from 'vitest';

// Avoid pulling real logger/pino and heavy error handler dependencies
vi.mock('server/utils/logger.js', () => ({ default: { error: () => {}, info: () => {}, warn: () => {}, debug: () => {} } }));
vi.mock('server/services/monitoring.js', () => ({ trackError: () => {} }));
vi.mock('server/middleware/errorHandler.js', () => ({
  AuthorizationError: class AuthorizationError extends Error {
    constructor(message = 'Unauthorized') { super(message); this.name = 'UnauthorizedError'; this.status = 401; }
  },
  ValidationError: class ValidationError extends Error {
    constructor(message = 'Validation Error') { super(message); this.name = 'ValidationError'; this.status = 400; }
  }
}));

function createReq(headers: Record<string, string|undefined> = {}, cookies: Record<string,string> = {}) {
  const lowered: Record<string,string|undefined> = {};
  for (const k of Object.keys(headers)) lowered[k.toLowerCase()] = headers[k];
  const req: any = {
    headers: lowered,
    cookies: { ...cookies },
    ip: '127.0.0.1',
    get(name: string) {
      return lowered[name.toLowerCase()];
    }
  };
  return req;
}

function createRes() {
  const res: any = {
    statusCode: 200,
    payload: undefined as any,
    cookies: {} as Record<string,{ value: string, options: any }>,
    cleared: [] as Array<{ name: string, options: any }>,
    status(code: number) { this.statusCode = code; return this; },
    json(data: any) { this.payload = data; return this; },
    cookie(name: string, value: string, options: any) { this.cookies[name] = { value, options }; return this; },
    clearCookie(name: string, options: any) { this.cleared.push({ name, options }); return this; }
  };
  return res;
}

describe('CSRF double-submit middleware', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects with 403 when cookie/header missing', async () => {
    const { requireDoubleSubmitCsrf } = await import('server/middleware/csrf.js');
    const req: any = createReq({}, {});
    const res: any = createRes();
    const next = vi.fn();
    await requireDoubleSubmitCsrf(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.payload).toEqual({ error: 'CSRF validation failed' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 403 when cookie/header mismatch', async () => {
    const { requireDoubleSubmitCsrf } = await import('server/middleware/csrf.js');
    const name = config.security.csrf.cookieName;
    const header = config.security.csrf.headerName;
    const req: any = createReq({ [header]: 'h-token' }, { [name]: 'c-token' });
    const res: any = createRes();
    const next = vi.fn();
    await requireDoubleSubmitCsrf(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.payload).toEqual({ error: 'CSRF validation failed' });
    expect(next).not.toHaveBeenCalled();
  });

  it('passes when cookie/header match', async () => {
    const { requireDoubleSubmitCsrf } = await import('server/middleware/csrf.js');
    const name = config.security.csrf.cookieName;
    const header = config.security.csrf.headerName;
    const token = 'same-token';
    const req: any = createReq({ [header]: token }, { [name]: token });
    const res: any = createRes();
    const next = vi.fn();
    await requireDoubleSubmitCsrf(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('authController.refresh', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Ensure prisma shape exists
    (prisma as any).session = (prisma as any).session || {};
    (prisma as any).user = (prisma as any).user || {};
    (prisma as any).session.findUnique = vi.fn();
    (prisma as any).session.update = vi.fn();
    (prisma as any).session.create = vi.fn();
    (prisma as any).session.deleteMany = vi.fn();
    (prisma as any).user.findUnique = vi.fn();
  });

  it('blocks by Origin/Referer policy with Forbidden', async () => {
    const { refresh } = await import('server/controllers/authController.js');
    const req: any = createReq({ origin: 'https://evil.example', referer: 'https://evil.example/x' });
    const res: any = createRes();
    await expect(refresh(req, res)).rejects.toThrow('Forbidden');
  });

  it('returns 401 Unauthorized when refresh cookie missing', async () => {
    const { refresh } = await import('server/controllers/authController.js');
    const origin = config.cors.origin;
    const req: any = createReq({ origin, referer: `${origin}/app` });
    const res: any = createRes();
    await expect(refresh(req, res)).rejects.toThrow('Unauthorized');
  });

  it('returns 401 Unauthorized when session not found', async () => {
    const { refresh } = await import('server/controllers/authController.js');
    (prisma as any).session.findUnique = vi.fn().mockResolvedValue(null);
    const origin = config.cors.origin;
    const cookieName = config.auth.refreshCookieName;
    const req: any = createReq({ origin, referer: `${origin}/x` }, { [cookieName]: 'r1' });
    const res: any = createRes();
    await expect(refresh(req, res)).rejects.toThrow('Unauthorized');
  });

  it('clears cookie and returns 401 when session revoked (replay attack)', async () => {
    const { refresh } = await import('server/controllers/authController.js');
    (prisma as any).session.findUnique = vi.fn().mockResolvedValue({ userId: 'u1', revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) });
    const origin = config.cors.origin;
    const cookieName = config.auth.refreshCookieName;
    const req: any = createReq({ origin, referer: `${origin}/x` }, { [cookieName]: 'r2' });
    const res: any = createRes();
    await expect(refresh(req, res)).rejects.toThrow('Unauthorized');
    expect(res.cleared.some(c => c.name === cookieName && c.options?.path === config.routes.auth)).toBe(true);
  });

  it('returns 401 when session expired (rotation fails)', async () => {
    const { refresh } = await import('server/controllers/authController.js');
    (prisma as any).session.findUnique = vi.fn().mockResolvedValue({ userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() - 60_000) });
    const origin = config.cors.origin;
    const cookieName = config.auth.refreshCookieName;
    const req: any = createReq({ origin, referer: `${origin}/x` }, { [cookieName]: 'r3' });
    const res: any = createRes();
    await expect(refresh(req, res)).rejects.toThrow('Unauthorized');
  });

  it('rotates session, sets new cookie and returns new access token', async () => {
    const { refresh } = await import('server/controllers/authController.js');
    // First findUnique (controller) and then (rotateSession) should see a valid session
    (prisma as any).session.findUnique = vi.fn().mockResolvedValue({ userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() + 300_000) });
    (prisma as any).session.update = vi.fn().mockResolvedValue({});
    (prisma as any).session.create = vi.fn().mockResolvedValue({});
    // User for access token
    (prisma as any).user.findUnique = vi.fn().mockResolvedValue({ id: 'u1', email: 'u1@x.com', name: 'U', avatarUrl: null, role: 'USER', createdAt: new Date(), updatedAt: new Date() });

    const origin = config.cors.origin;
    const cookieName = config.auth.refreshCookieName;
    const req: any = createReq({ origin, referer: `${origin}/x` }, { [cookieName]: 'r4' });
    const res: any = createRes();
    await refresh(req, res);

    expect(typeof res.payload?.token).toBe('string');
    expect(res.payload?.token.length).toBeGreaterThan(10);
    const newCookie = res.cookies[cookieName];
    expect(newCookie).toBeTruthy();
    expect(typeof newCookie.value).toBe('string');
    expect(newCookie.value.length).toBeGreaterThanOrEqual(32);
    expect(newCookie.options?.httpOnly).toBe(true);
    expect(newCookie.options?.path).toBe(config.routes.auth);
  });
});


