import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const app = express();
// ===== In-memory content (demo) =====
const NEWS = [
  {
    id: 'water-glass',
    title: 'Nowe bloki w edytorze: Woda i SzkÅ‚o!',
    description: 'Zanurz siÄ™ w kreatywnoÅ›ci dziÄ™ki nowym, realistycznym blokom wody i szkÅ‚a.',
    image: '/news-water-glass.svg',
    date: '2024-07-20',
    category: 'Aktualizacja',
    href: '/news/water-glass',
    content:
      'WprowadziliÅ›my dwa nowe bloki: Woda oraz SzkÅ‚o.\n\nWoda umoÅ¼liwia tworzenie jezior i rzek, a SzkÅ‚o pozwala budowaÄ‡ efektowne konstrukcje.\n\nSkorzystaj z trybu Budowy, aby dodaÄ‡ nowe bloki do Å›wiata i udostÄ™pnij efekty!'
  },
  {
    id: 'castle-contest',
    title: 'Konkurs na najlepszy zamek',
    description: 'PokaÅ¼ swoje umiejÄ™tnoÅ›ci i wygraj nagrody w konkursie budowlanym.',
    image: '/news-castle-contest.svg',
    date: '2024-07-18',
    category: 'SpoÅ‚ecznoÅ›Ä‡',
    href: '/news/castle-contest',
    content:
      'Zapraszamy do udziaÅ‚u w konkursie na najlepszy zamek!\n\nOpublikuj swÃ³j projekt i wyÅ›lij link do 31 sierpnia.\n\nNajlepsze prace wyrÃ³Å¼nimy na stronie gÅ‚Ã³wnej.'
  },
];

// CORS for cookie-based refresh endpoint
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:9000';
app.use(
  cors({
    origin: ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: '6mb' }));
app.use(cookieParser());

// ===== Auth helpers =====
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || 'refresh_token';

function signAccessToken(user) {
  const payload = { sub: user.id, email: user.email, role: user.role };
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET || 'dev-access-secret', {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

function isAllowedRefreshRequest(req) {
  const origin = req.headers.origin;
  const referer = req.headers.referer || '';
  const originOk = !origin || origin === ORIGIN;
  const refererOk = !referer || referer.startsWith(ORIGIN);
  return originOk && refererOk;
}

async function createSession(userId) {
  const token = generateRefreshToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { tokenHash, userId, expiresAt } });
  return token;
}

async function revokeSessionByToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  await prisma.session.update({ where: { tokenHash }, data: { revokedAt: new Date() } }).catch(() => {});
}

async function rotateSession(rawToken) {
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.session.findUnique({ where: { tokenHash } });
  if (!existing || existing.revokedAt) return null;
  if (existing.expiresAt.getTime() < Date.now()) return null;
  // rotate: revoke old and create new
  await prisma.session.update({ where: { tokenHash }, data: { revokedAt: new Date() } });
  const newToken = await createSession(existing.userId);
  return { userId: existing.userId, token: newToken };
}

async function findUserSafeById(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, avatarUrl: true, role: true, createdAt: true, updatedAt: true },
  });
}

async function logAudit(req, action, userId, metadata = undefined) {
  try {
    const ip = req.ip;
    const userAgent = req.get('user-agent') || undefined;
    await prisma.auditLog.create({ data: { action, userId: userId || null, ip: ip || null, userAgent, metadata } });
  } catch {
    // ignore
  }
}

async function revokeAllUserSessions(userId) {
  await prisma.session.deleteMany({ where: { userId } });
}

// ===== Auth middleware (access token) =====
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'dev-access-secret');
    req.auth = { userId: payload.sub, email: payload.email, role: payload.role };
    const user = await findUserSafeById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.auth || req.auth.role !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// ===== Auth routes =====
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, name, passwordHash },
      select: { id: true, email: true, name: true, avatarUrl: true, role: true, createdAt: true, updatedAt: true },
    });
    const accessToken = signAccessToken(user);
    const refreshToken = await createSession(user.id);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    res.status(201).json({ token: accessToken, user });
    await logAudit(req, 'auth.register', user.id);
  } catch (e) {
    await logAudit(req, 'auth.register.error', undefined, { message: String(e?.message || e) });
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const safeUser = await findUserSafeById(user.id);
    const accessToken = signAccessToken(safeUser);
    const refreshToken = await createSession(user.id);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    res.json({ token: accessToken, user: safeUser });
    await logAudit(req, 'auth.login', user.id);
  } catch (e) {
    await logAudit(req, 'auth.login.error', undefined, { message: String(e?.message || e) });
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    if (!isAllowedRefreshRequest(req)) {
      await logAudit(req, 'auth.refresh.csrf_block');
      return res.status(403).json({ error: 'Forbidden' });
    }
    const cookie = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!cookie) return res.status(401).json({ error: 'Unauthorized' });
    const tokenHash = hashToken(cookie);
    const session = await prisma.session.findUnique({ where: { tokenHash } });
    if (!session) {
      await logAudit(req, 'auth.refresh.unknown_session');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (session.revokedAt) {
      await revokeAllUserSessions(session.userId);
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
      await logAudit(req, 'auth.refresh.reuse_detected', session.userId);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const rotated = await rotateSession(cookie);
    if (!rotated) return res.status(401).json({ error: 'Unauthorized' });
    const user = await findUserSafeById(rotated.userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const accessToken = signAccessToken(user);
    res.cookie(REFRESH_COOKIE_NAME, rotated.token, refreshCookieOptions());
    res.json({ token: accessToken });
    await logAudit(req, 'auth.refresh.success', user.id);
  } catch (e) {
    await logAudit(req, 'auth.refresh.error', undefined, { message: String(e?.message || e) });
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const cookie = req.cookies?.[REFRESH_COOKIE_NAME];
  if (cookie) await revokeSessionByToken(cookie).catch(() => {});
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
  res.json({ ok: true });
  const header = req.headers.authorization || '';
  try {
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = token ? jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'dev-access-secret') : null;
    await logAudit(req, 'auth.logout', payload?.sub);
  } catch {
    await logAudit(req, 'auth.logout');
  }
});

// ===== Users =====
app.get('/api/users/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

app.put('/api/users/me', requireAuth, async (req, res) => {
  try {
    const nameRaw = (req.body?.name ?? '').toString();
    const name = nameRaw.trim();
    if (name && (name.length < 2 || name.length > 64)) return res.status(400).json({ error: 'Invalid name' });

    let avatarUrl = req.body?.avatarUrl;
    if (typeof avatarUrl !== 'undefined') {
      if (avatarUrl === null || avatarUrl === '') avatarUrl = null;
      else if (typeof avatarUrl !== 'string' || avatarUrl.length > 500000) {
        return res.status(400).json({ error: 'Invalid avatar' });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.auth.userId },
      data: { ...(name ? { name } : {}), ...(typeof avatarUrl !== 'undefined' ? { avatarUrl } : {}) },
      select: { id: true, email: true, name: true, avatarUrl: true, role: true, createdAt: true, updatedAt: true }
    });
    res.json({ user });
    await logAudit(req, 'user.update_profile', req.auth.userId);
  } catch (e) {
    res.status(500).json({ error: 'Update failed' });
  }
});

app.delete('/api/users/me', requireAuth, async (req, res) => {
  try {
    await prisma.game.deleteMany({ where: { ownerId: req.auth.userId } });
    await prisma.session.deleteMany({ where: { userId: req.auth.userId } });
    await prisma.user.delete({ where: { id: req.auth.userId } });
    res.json({ ok: true });
    await logAudit(req, 'user.delete', req.auth.userId);
  } catch (e) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Password change
app.post('/api/users/me/password', requireAuth, async (req, res) => {
  try {
    const oldPassword = req.body?.oldPassword || '';
    const newPassword = req.body?.newPassword || '';
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Missing fields' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password too short' });
    const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
    if (!user) return res.status(404).json({ error: 'Not found' });
    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid password' });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await revokeAllUserSessions(user.id);
    const newRefresh = await createSession(user.id);
    res.cookie(REFRESH_COOKIE_NAME, newRefresh, refreshCookieOptions());
    await logAudit(req, 'user.change_password', user.id);
    res.json({ ok: true });
  } catch (e) {
    await logAudit(req, 'user.change_password.error', req.auth.userId, { message: String(e?.message || e) });
    res.status(500).json({ error: 'Change failed' });
  }
});

// Permissions preview
app.get('/api/users/me/permissions', requireAuth, async (req, res) => {
  const role = req.user.role;
  const base = [
    'ZarzÄ…dzanie kontem i profilem',
    'Tworzenie i edycja wÅ‚asnych gier',
  ];
  const adminExtra = [
    'ZarzÄ…dzanie uÅ¼ytkownikami i treÅ›ciami',
  ];
  const permissions = role === 'ADMIN' ? [...base, ...adminExtra] : base;
  res.json({ role, permissions });
});

// Sessions management
app.get('/api/auth/sessions', requireAuth, async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: { userId: req.auth.userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, expiresAt: true, revokedAt: true },
  });
  res.json({ sessions });
});

app.delete('/api/auth/sessions/:id', requireAuth, async (req, res) => {
  const session = await prisma.session.findFirst({ where: { id: req.params.id, userId: req.auth.userId } });
  if (!session) return res.status(404).json({ error: 'Not found' });
  await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  await logAudit(req, 'auth.session.revoke', req.auth.userId, { sessionId: session.id });
  res.json({ ok: true });
});

// Recent login activity
app.get('/api/users/me/logins', requireAuth, async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    where: { userId: req.auth.userId, action: { in: ['auth.login', 'auth.refresh.success', 'auth.refresh.reuse_detected'] } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, action: true, ip: true, userAgent: true, createdAt: true },
  });
  res.json({ logs });
});

// ===== Games (ABAC) =====
// Public listing of published games (currently returns all)
app.get('/api/games', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 12)));
    const q = (req.query.q || '').toString();
    const sort = (req.query.sort || 'updated_desc').toString();

    const orderBy = (() => {
      switch (sort) {
        case 'updated_asc': return { updatedAt: 'asc' };
        case 'name_asc': return { name: 'asc' };
        case 'name_desc': return { name: 'desc' };
        case 'likes_desc': return { likes: 'desc' };
        case 'likes_asc': return { likes: 'asc' };
        case 'updated_desc':
        default: return { updatedAt: 'desc' };
      }
    })();

    const where = {
      published: true,
      ...(q ? { name: { contains: q } } : {}),
    };

    try {
      const [total, games] = await Promise.all([
        prisma.game.count({ where }),
        prisma.game.findMany({
          where,
          orderBy: orderBy.likes ? undefined : orderBy,
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            name: true,
            updatedAt: true,
            thumbnail: true,
            owner: { select: { name: true } },
            _count: { select: { likes: true } },
          },
        })
      ]);

      let list = games.map(g => ({ id: g.id, name: g.name, updatedAt: g.updatedAt, ownerName: g.owner?.name || 'UÅ¼ytkownik', likes: g._count?.likes || 0, thumbnail: g.thumbnail || null }));
      if (orderBy.likes) {
        list.sort((a, b) => orderBy.likes === 'desc' ? (b.likes - a.likes) : (a.likes - b.likes));
      }

      res.json({
        games: list,
        total,
        page,
        limit,
      });
    } catch {
      // Fallback without relations if client is outdated
      const [total, games] = await Promise.all([
        prisma.game.count({ where }).catch(() => Promise.resolve(0)),
        prisma.game.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          select: { id: true, name: true, updatedAt: true },
        }).catch(() => Promise.resolve([])),
      ]);
      res.json({
        games: games.map(g => ({ id: g.id, name: g.name, updatedAt: g.updatedAt, ownerName: 'UÅ¼ytkownik', likes: 0, thumbnail: null })),
        total,
        page,
        limit,
      });
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to load games' });
  }
});

app.get('/api/users/me/games', requireAuth, async (req, res) => {
  const games = await prisma.game.findMany({
    where: {
      OR: [
        { ownerId: req.auth.userId },
        { members: { some: { userId: req.auth.userId } } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      published: true,
      thumbnail: true,
      _count: { select: { likes: true } },
    },
  });
  res.json({ games });
});

app.post('/api/games', requireAuth, async (req, res) => {
  const { name = 'Untitled Project', blocks = [], published = false, thumbnail } = req.body || {};
  const baseData = {
    name,
    blocks,
    published: !!published,
    owner: { connect: { id: req.auth.userId } }
  };
  try {
    const data = {
      ...baseData,
      ...(typeof thumbnail === 'string' && thumbnail.length < 5_000_000 ? { thumbnail } : {}),
    };
    const game = await prisma.game.create({ data });
    res.status(201).json({ game });
    await logAudit(req, 'game.create', req.auth.userId, { gameId: game.id });
  } catch (e) {
    // Fallback without thumbnail (old schema)
    const game = await prisma.game.create({ data: baseData });
    res.status(201).json({ game });
    await logAudit(req, 'game.create', req.auth.userId, { gameId: game.id, note: 'fallback_without_thumbnail' });
  }
});

app.get('/api/games/:id', requireAuth, async (req, res) => {
  const game = await prisma.game.findFirst({
    where: {
      id: req.params.id,
      OR: [
        { ownerId: req.auth.userId },
        { members: { some: { userId: req.auth.userId } } },
      ],
    },
  });
  if (!game) return res.status(404).json({ error: 'Not found' });
  res.json({ game });
});

// Public game details for published games (no auth)
app.get('/api/games/:id/public', async (req, res) => {
  try {
    if (req.params.id === 'demo') {
      const demoBlocks = [
        { id: 'start-1', type: 'start', position: { x: 0, y: 0.5, z: 0 } },
        { id: 'cube-1', type: 'cube', position: { x: 1, y: 0.5, z: 0 } },
        { id: 'cube-2', type: 'cube', position: { x: 2, y: 0.5, z: 0 } },
        { id: 'cube-3', type: 'cube', position: { x: 3, y: 0.5, z: 0 } },
        { id: 'haz-1', type: 'hazard', position: { x: 2, y: 0.5, z: 2 } },
        { id: 'chk-1', type: 'checkpoint', position: { x: 4, y: 0.5, z: 0 } },
        { id: 'finish-1', type: 'finish', position: { x: 6, y: 0.5, z: 0 } },
      ];
      return res.json({ game: { id: 'demo', name: 'Demo World', blocks: demoBlocks, updatedAt: new Date().toISOString(), likes: 0 } });
    }
    const game = await prisma.game.findFirst({
      where: { id: req.params.id, published: true },
      select: { id: true, name: true, blocks: true, updatedAt: true, _count: { select: { likes: true } } },
    });
    if (!game) return res.status(404).json({ error: 'Not found' });
    const out = { id: game.id, name: game.name, blocks: game.blocks, updatedAt: game.updatedAt, likes: game._count?.likes || 0 };
    res.json({ game: out });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load game' });
  }
});

// ===== News (simple demo feed) =====
app.get('/api/news', async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
  const start = (page - 1) * limit;
  const items = NEWS.slice(start, start + limit);
  res.json({ news: items, total: NEWS.length, page, limit });
});

app.get('/api/news/:id', async (req, res) => {
  const found = NEWS.find(n => n.id === req.params.id);
  if (!found) return res.status(404).json({ error: 'Not found' });
  res.json({ news: found });
});

// ===== Top creators (aggregate by published games and likes) =====
app.get('/api/creators/top', async (_req, res) => {
  try {
    const games = await prisma.game.findMany({
      where: { published: true },
      select: {
        id: true,
        ownerId: true,
        owner: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { likes: true } },
      },
    });
    const byOwner = new Map();
    for (const g of games) {
      const key = g.ownerId || (g.owner?.id ?? 'unknown');
      const prev = byOwner.get(key) || { id: key, name: g.owner?.name || 'TwÃ³rca', avatarUrl: g.owner?.avatarUrl || '/avatar-default.svg', creations: 0, likes: 0 };
      prev.creations += 1;
      prev.likes += g._count?.likes || 0;
      byOwner.set(key, prev);
    }
    const creators = Array.from(byOwner.values()).sort((a, b) => (b.likes - a.likes) || (b.creations - a.creations)).slice(0, 8);
    res.json({ creators });
  } catch (e) {
    res.json({ creators: [] });
  }
});

app.put('/api/games/:id', requireAuth, async (req, res) => {
  const membership = await prisma.game.findFirst({
    where: { id: req.params.id },
    select: {
      ownerId: true,
      members: { where: { userId: req.auth.userId }, select: { role: true }, take: 1 },
    },
  });
  if (!membership) return res.status(404).json({ error: 'Not found' });
  const isOwner = membership.ownerId === req.auth.userId;
  const memberRole = membership.members[0]?.role;
  const canEdit = isOwner || memberRole === 'EDITOR' || memberRole === 'OWNER';
  if (!canEdit) return res.status(403).json({ error: 'Forbidden' });
  const fullData = {
    name: req.body?.name,
    blocks: req.body?.blocks,
    ...(typeof req.body?.published === 'boolean' ? { published: req.body.published } : {}),
    ...(typeof req.body?.thumbnail === 'string' && req.body.thumbnail.length < 5_000_000 ? { thumbnail: req.body.thumbnail } : {}),
  };
  try {
    const game = await prisma.game.update({ where: { id: req.params.id }, data: fullData });
    res.json({ game });
    await logAudit(req, 'game.update', req.auth.userId, { gameId: req.params.id });
  } catch (e) {
    // Retry without thumbnail
    const { thumbnail, ...noThumb } = fullData;
    const game = await prisma.game.update({ where: { id: req.params.id }, data: noThumb });
    res.json({ game });
    await logAudit(req, 'game.update', req.auth.userId, { gameId: req.params.id, note: 'fallback_without_thumbnail' });
  }
});

app.delete('/api/games/:id', requireAuth, async (req, res) => {
  const owned = await prisma.game.findFirst({ where: { id: req.params.id, ownerId: req.auth.userId }, select: { id: true } });
  if (!owned) return res.status(403).json({ error: 'Forbidden' });
  const removed = await prisma.game.delete({ where: { id: req.params.id } });
  res.json({ game: removed });
  await logAudit(req, 'game.delete', req.auth.userId, { gameId: req.params.id });
});

// ===== Likes =====
app.get('/api/games/:id/likes', async (req, res) => {
  try {
    const id = req.params.id;
    const [count, youLike] = await Promise.all([
      prisma.like.count({ where: { gameId: id } }),
      (async () => {
        try {
          await requireAuth(req, res, () => {});
          const found = await prisma.like.findFirst({ where: { gameId: id, userId: req.auth.userId }, select: { id: true } });
          return !!found;
        } catch { return false; }
      })(),
    ]);
    res.json({ likes: count, youLike });
  } catch { res.json({ likes: 0, youLike: false }); }
});

app.post('/api/games/:id/likes', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await prisma.like.create({ data: { gameId: id, userId: req.auth.userId } }).catch(() => {});
    const count = await prisma.like.count({ where: { gameId: id } });
    await logAudit(req, 'game.like', req.auth.userId, { gameId: id });
    res.json({ likes: count, youLike: true });
  } catch { res.status(500).json({ error: 'Failed to like' }); }
});

app.delete('/api/games/:id/likes', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await prisma.like.deleteMany({ where: { gameId: id, userId: req.auth.userId } });
    const count = await prisma.like.count({ where: { gameId: id } });
    await logAudit(req, 'game.unlike', req.auth.userId, { gameId: id });
    res.json({ likes: count, youLike: false });
  } catch { res.status(500).json({ error: 'Failed to unlike' }); }
});

// ===== Leaderboard =====
app.get('/api/games/:id/leaderboard', async (req, res) => {
  try {
    const id = req.params.id;
    const top = await prisma.score.findMany({
      where: { gameId: id },
      orderBy: { timeMs: 'asc' },
      take: 10,
      select: { id: true, timeMs: true, createdAt: true, user: { select: { name: true } } }
    });
    res.json({ leaderboard: top.map(s => ({ id: s.id, name: s.user?.name || 'Gracz', timeMs: s.timeMs, createdAt: s.createdAt })) });
  } catch { res.status(500).json({ error: 'Failed to load leaderboard' }); }
});

app.post('/api/games/:id/leaderboard', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const timeMs = Number(req.body?.timeMs || 0);
    if (!Number.isFinite(timeMs) || timeMs <= 0 || timeMs > 10 * 60 * 1000) return res.status(400).json({ error: 'Invalid time' });
    const created = await prisma.score.create({ data: { userId: req.auth.userId, gameId: id, timeMs } });
    await logAudit(req, 'game.score.submit', req.auth.userId, { gameId: id, timeMs });
    res.status(201).json({ id: created.id });
  } catch { res.status(500).json({ error: 'Failed to submit score' }); }
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
});


