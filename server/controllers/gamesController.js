import config from '../config/config.js';
import prisma from '../config/database.js';
import { logAudit, verifyGameAccess } from '../utils/auth.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { parsePagination, parseSort, cleanSearchQuery } from '../utils/helpers.js';
import crypto from 'crypto';

/**
 * Get public games listing
 */
export async function getPublicGames(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const q = cleanSearchQuery(req.query.q);
  const sort = parseSort(req.query.sort, ['updatedAt', 'name', 'likes', 'views'], { updatedAt: 'desc' });
  
  const where = {
    OR: [
      { published: true },
      // New visibility flag
      { visibility: 'PUBLIC' }
    ],
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
  };
  
  try {
    const [total, games] = await Promise.all([
      prisma.game.count({ where }),
      prisma.game.findMany({
        where,
        orderBy: (sort.likes || sort.views) ? undefined : sort,
        skip: offset,
        take: limit,
        select: {
          id: true,
          name: true,
          updatedAt: true,
          visibility: true,
          thumbnail: true,
          owner: { select: { name: true } },
          _count: { select: { likes: true } },
        },
      })
    ]);
    
    // Views counts for current page
    let viewsMap = {};
    try {
      // Avoid Prisma error logs by checking table existence first
      const hasGameView = await prisma.$queryRawUnsafe(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='GameView'"
      ).then(rows => Array.isArray(rows) && rows.length > 0).catch(() => false);
      if (hasGameView) {
        const v = await prisma.gameView.groupBy({
          by: ['gameId'],
          _count: { _all: true },
          where: { gameId: { in: games.map(g => g.id) } }
        });
        viewsMap = Object.fromEntries(v.map(x => [x.gameId, x._count._all]));
      }
    } catch {}

    let list = games.map(g => ({ 
      id: g.id, 
      name: g.name, 
      updatedAt: g.updatedAt, 
      ownerName: g.owner?.name || 'Użytkownik', 
      likes: g._count?.likes || 0, 
      views: viewsMap[g.id] || 0,
      thumbnail: g.thumbnail || null,
      visibility: g.visibility || 'PUBLIC'
    }));
    
    // Handle likes/views sorting manually (limited to current page window)
    if (sort.likes) {
      list.sort((a, b) => sort.likes === 'desc' ? (b.likes - a.likes) : (a.likes - b.likes));
    }
    if (sort.views) {
      list.sort((a, b) => sort.views === 'desc' ? (b.views - a.views) : (a.views - b.views));
    }
    
    res.json({
      games: list,
      total,
      page,
      limit,
    });
  } catch (error) {
    // Fallback for older database schemas (no published/likes/owner/thumbnail columns)
    const [total, games] = await Promise.all([
      prisma.game.count({}).catch(() => 0),
      prisma.game.findMany({
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit,
        select: { id: true, name: true, updatedAt: true },
      }).catch(() => [])
    ]);
    
    res.json({
      games: games.map(g => ({ 
        id: g.id, 
        name: g.name, 
        updatedAt: g.updatedAt, 
        ownerName: 'Użytkownik', 
        likes: 0, 
        views: 0,
        thumbnail: null 
      })),
      total,
      page,
      limit,
    });
  }
}

/**
 * Get user's games
 */
export async function getUserGames(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const q = cleanSearchQuery(req.query.q);
  const sort = parseSort(req.query.sort, ['updatedAt', 'name', 'likes', 'views'], { updatedAt: 'desc' });
  const owner = (req.query.owner || 'all').toString();
  const publishedParam = req.query.published;

  // Base access condition (owner or member)
  const accessWhere = {
    OR: [
      { ownerId: req.auth.userId },
      { members: { some: { userId: req.auth.userId } } },
    ],
  };

  // Owner filter
  const ownerFilter = owner === 'mine'
    ? { ownerId: req.auth.userId }
    : owner === 'shared'
    ? { AND: [ { NOT: { ownerId: req.auth.userId } }, { members: { some: { userId: req.auth.userId } } } ] }
    : {};

  // Name search
  const searchFilter = q ? { name: { contains: q, mode: 'insensitive' } } : {};

  let publishedFilter = {};
  if (publishedParam === 'true') {
    publishedFilter = { OR: [ { published: true }, { visibility: 'PUBLIC' } ] };
  } else if (publishedParam === 'false') {
    // Treat drafts as explicitly not published (legacy behavior)
    publishedFilter = { published: false };
  }
  const where = { AND: [accessWhere, ownerFilter, searchFilter, publishedFilter] };

  let total = 0;
  let games = [];
  try {
    total = await prisma.game.count({ where });
    games = await prisma.game.findMany({
      where,
      orderBy: (sort.likes || sort.views) ? undefined : sort,
      skip: offset,
      take: limit,
      select: {
        id: true,
        name: true,
        updatedAt: true,
        published: true,
        visibility: true,
        thumbnail: true,
        ownerId: true,
        owner: { select: { name: true, role: true } },
        _count: { select: { likes: true } },
      },
    });
  } catch (e) {
    games = await prisma.game.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit,
      select: { id: true, name: true, updatedAt: true, ownerId: true },
    });
    total = await prisma.game.count({ where }).catch(() => games.length);
  }

  // Views counts for current page (optional table)
  let viewsMap = {};
  try {
    const hasGameView = await prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='GameView'"
    ).then(rows => Array.isArray(rows) && rows.length > 0).catch(() => false);
    if (hasGameView) {
      const v = await prisma.gameView.groupBy({
        by: ['gameId'],
        _count: { _all: true },
        where: { gameId: { in: games.map(g => g.id) } }
      });
      viewsMap = Object.fromEntries(v.map(x => [x.gameId, x._count._all]));
    }
  } catch {}

  let list = games.map(g => ({
    id: g.id,
    name: g.name,
    updatedAt: g.updatedAt,
    published: g.published,
    visibility: g.visibility,
    thumbnail: g.thumbnail,
    _count: g._count,
    views: viewsMap[g.id] || 0,
    ownerName: g.owner?.name || undefined,
    ownerRole: g.owner?.role || undefined,
    isOwner: g.ownerId ? g.ownerId === req.auth.userId : undefined,
  }));

  // Manual likes/views sorting within page window
  if (sort.likes) {
    list.sort((a, b) => sort.likes === 'desc' ? ((b._count?.likes||0) - (a._count?.likes||0)) : ((a._count?.likes||0) - (b._count?.likes||0)));
  }
  if (sort.views) {
    list.sort((a, b) => sort.views === 'desc' ? ((b.views||0) - (a.views||0)) : ((a.views||0) - (b.views||0)));
  }

  res.json({ games: list, total, page, limit });
}

/**
 * Bulk update games (publish toggle and/or name prefix)
 */
export async function bulkUpdateGames(req, res) {
  const { ids, published, namePrefix } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ValidationError('ids is required');
  }

  const updated = [];
  for (const id of ids) {
    const access = await verifyGameAccess(id, req.auth.userId);
    if (!access || !access.canEdit) continue;
    let data = {};
    if (typeof published === 'boolean') data = { ...data, published };
    if (typeof namePrefix === 'string' && namePrefix.trim()) {
      const current = await prisma.game.findUnique({ where: { id }, select: { name: true } });
      if (current?.name) data = { ...data, name: `${namePrefix}${current.name}` };
    }
    if (Object.keys(data).length === 0) continue;
    const game = await prisma.game.update({ where: { id }, data });
    updated.push({ id, published: game.published, name: game.name, updatedAt: game.updatedAt });
  }
  await logAudit(req, 'game.bulk_update', req.auth.userId, { ids: ids.length, published, namePrefix });
  res.json({ updated });
}

/**
 * Bulk delete games (owner only)
 */
export async function bulkDeleteGames(req, res) {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ValidationError('ids is required');
  }
  const owned = await prisma.game.findMany({ where: { id: { in: ids }, ownerId: req.auth.userId }, select: { id: true } });
  const ownedIds = owned.map(g => g.id);
  if (ownedIds.length > 0) {
    await prisma.game.deleteMany({ where: { id: { in: ownedIds } } });
  }
  await logAudit(req, 'game.bulk_delete', req.auth.userId, { count: ownedIds.length });
  res.json({ deleted: ownedIds });
}

/**
 * Export games as JSON (with access check). Sets Content-Disposition header.
 */
export async function exportGames(req, res) {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ValidationError('ids is required');
  }
  const list = await prisma.game.findMany({
    where: {
      id: { in: ids },
      OR: [
        { ownerId: req.auth.userId },
        { members: { some: { userId: req.auth.userId } } },
      ],
    },
    select: { id: true, name: true, blocks: true, published: true, updatedAt: true },
  });
  const out = list.map(g => ({ id: g.id, name: g.name, blocks: JSON.parse(g.blocks || '[]'), published: g.published || false, updatedAt: g.updatedAt }));
  const filename = `blockscape-projects-${new Date().toISOString().slice(0,10)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(out);
}

/**
 * Update game visibility (owner only)
 */
export async function updateVisibility(req, res) {
  const { id } = req.params;
  const { visibility } = req.body || {};
  if (!['PRIVATE','FRIENDS','PUBLIC'].includes(visibility)) {
    throw new ValidationError('Invalid visibility value');
  }

  const owned = await prisma.game.findFirst({ where: { id, ownerId: req.auth.userId }, select: { id: true } });
  if (!owned) {
    throw new ForbiddenError('Only owner can change visibility');
  }

  const updated = await prisma.game.update({ where: { id }, data: { visibility, published: visibility === 'PUBLIC' ? true : undefined } });
  await logAudit(req, 'game.visibility.update', req.auth.userId, { gameId: id, visibility });
  res.json({ game: { id: updated.id, visibility: updated.visibility, updatedAt: updated.updatedAt } });
}

/**
 * Share game with a friend (add member)
 */
export async function shareGame(req, res) {
  const { id } = req.params;
  const { userId, role } = req.body || {};

  // Owner only
  const owned = await prisma.game.findFirst({ where: { id, ownerId: req.auth.userId }, select: { id: true } });
  if (!owned) throw new ForbiddenError('Only owner can share the game');

  // Must be friends
  const isFriend = await prisma.friend.findFirst({
    where: {
      OR: [
        { userId: req.auth.userId, friendId: userId },
        { userId: userId, friendId: req.auth.userId }
      ]
    },
    select: { id: true }
  });
  if (!isFriend) throw new ValidationError('You can only share with friends');

  // Upsert member
  const member = await prisma.gameMember.upsert({
    where: { userId_gameId: { userId, gameId: id } },
    create: { userId, gameId: id, role: role === 'EDITOR' ? 'EDITOR' : 'VIEWER' },
    update: { role: role === 'EDITOR' ? 'EDITOR' : 'VIEWER' }
  });

  await logAudit(req, 'game.share', req.auth.userId, { gameId: id, userId, role: member.role });
  res.status(201).json({ member: { id: member.id, userId: member.userId, role: member.role } });
}

/**
 * Unshare game (remove member)
 */
export async function unshareGame(req, res) {
  const { id, memberId } = req.params;

  const owned = await prisma.game.findFirst({ where: { id, ownerId: req.auth.userId }, select: { id: true } });
  if (!owned) throw new ForbiddenError('Only owner can unshare');

  await prisma.gameMember.delete({ where: { id: memberId } });
  await logAudit(req, 'game.unshare', req.auth.userId, { gameId: id, memberId });
  res.json({ ok: true });
}

/**
 * Duplicate a game
 */
export async function duplicateGame(req, res) {
  const id = req.params.id;
  const nameIn = (req.body?.name || '').toString().trim();

  const access = await verifyGameAccess(id, req.auth.userId);
  if (!access || !access.canEdit) {
    throw new NotFoundError('Game not found');
  }

  const game = await prisma.game.findUnique({ where: { id }, select: { name: true, blocks: true } });
  if (!game) throw new NotFoundError('Game not found');

  const newName = nameIn || `Copy of ${game.name}`;
  const created = await prisma.game.create({
    data: {
      name: newName,
      blocks: game.blocks,
      published: false,
      owner: { connect: { id: req.auth.userId } },
    },
  });

  // Try copy members (best-effort)
  try {
    const members = await prisma.gameMember.findMany({ where: { gameId: id }, select: { userId: true, role: true } });
    for (const m of members) {
      try { await prisma.gameMember.create({ data: { gameId: created.id, userId: m.userId, role: m.role } }); } catch {}
    }
  } catch {}

  await logAudit(req, 'game.duplicate', req.auth.userId, { from: id, to: created.id });
  res.status(201).json({ game: { id: created.id, name: created.name, updatedAt: created.updatedAt } });
}

/**
 * Create new game
 */
export async function createGame(req, res) {
  const { name = 'Untitled Project', blocks = [], published = false, thumbnail, visibility, mode, modeConfig, terrain } = req.body;
  
  const baseData = {
    name,
    blocks: JSON.stringify(blocks ?? []),
    published: !!published,
    ...(visibility && ['PRIVATE','FRIENDS','PUBLIC'].includes(visibility) ? { visibility } : {}),
    ...(mode && ['PARKOUR','PVP','RACE','SANDBOX'].includes(mode) ? { mode } : { mode: 'PARKOUR' }),
    ...(typeof modeConfig === 'string' ? { modeConfig } : {}),
    ...(typeof terrain === 'string' ? { terrain } : {}),
    owner: { connect: { id: req.auth.userId } }
  };
  
  try {
    const data = {
      ...baseData,
      ...(typeof thumbnail === 'string' && thumbnail.length < config.security.maxThumbnailSize ? { thumbnail } : {}),
    };
    const game = await prisma.game.create({ data });
    const gameOut = { ...game, blocks: JSON.parse(game.blocks || '[]') };
    
    await logAudit(req, 'game.create', req.auth.userId, { gameId: game.id });
    res.status(201).json({ game: gameOut });
  } catch (error) {
    // Retry without thumbnail (old schema without thumbnail)
    try {
      const { thumbnail: _thumb, ...noThumb } = baseData;
      const game = await prisma.game.create({ data: noThumb });
      const gameOut = { ...game, blocks: JSON.parse(game.blocks || '[]') };
      await logAudit(req, 'game.create', req.auth.userId, { 
        gameId: game.id, 
        note: 'fallback_without_thumbnail' 
      });
      return res.status(201).json({ game: gameOut });
    } catch (e2) {
      // Retry without thumbnail and without published (very old schema)
      const { thumbnail: _t, published: _p, ...legacy } = baseData;
      const game = await prisma.game.create({ data: legacy });
      const gameOut = { ...game, blocks: JSON.parse(game.blocks || '[]') };
      await logAudit(req, 'game.create', req.auth.userId, { 
        gameId: game.id, 
        note: 'fallback_without_thumbnail_and_published' 
      });
      return res.status(201).json({ game: gameOut });
    }
  }
}

/**
 * Get game details (requires access)
 */
export async function getGame(req, res) {
  const game = await prisma.game.findFirst({
    where: {
      id: req.params.id,
      OR: [
        { ownerId: req.auth.userId },
        { members: { some: { userId: req.auth.userId } } },
      ],
    },
  });
  
  if (!game) {
    throw new NotFoundError('Game not found');
  }
  
  const gameOut = { 
    ...game, 
    blocks: JSON.parse(game.blocks || '[]'),
    mode: game.mode || 'PARKOUR',
    modeConfig: game.modeConfig || null,
    terrain: game.terrain || null,
  };
  res.json({ game: gameOut });
}

/**
 * Get public game details
 */
export async function getPublicGame(req, res) {
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
    return res.json({ 
      game: { 
        id: 'demo', 
        name: 'Demo World', 
        blocks: demoBlocks, 
        updatedAt: new Date().toISOString(), 
        likes: 0 
      } 
    });
  }
  
  let game = null;
  try {
    game = await prisma.game.findFirst({
      where: { id: req.params.id, OR: [ { published: true }, { visibility: 'PUBLIC' } ] },
      select: { 
        id: true, 
        name: true, 
        blocks: true, 
        updatedAt: true, 
        mode: true,
        modeConfig: true,
        terrain: true,
        _count: { select: { likes: true } } 
      },
    });
  } catch (e) {
    game = await prisma.game.findFirst({
      where: { id: req.params.id },
      select: { id: true, name: true, blocks: true, updatedAt: true, mode: true, modeConfig: true, terrain: true },
    });
  }
  
  if (!game) {
    throw new NotFoundError('Game not found');
  }
  
  const out = { 
    id: game.id, 
    name: game.name, 
    blocks: JSON.parse(game.blocks || '[]'), 
    updatedAt: game.updatedAt, 
    mode: game.mode || 'PARKOUR',
    modeConfig: game.modeConfig || null,
    terrain: game.terrain || null,
    likes: game._count?.likes || 0 
  };
  res.json({ game: out });
}

/**
 * Update game
 */
export async function updateGame(req, res) {
  const gameAccess = await verifyGameAccess(req.params.id, req.auth.userId);
  
  if (!gameAccess) {
    throw new NotFoundError('Game not found');
  }
  
  if (!gameAccess.canEdit) {
    throw new ForbiddenError('You do not have permission to edit this game');
  }
  
  const { name, blocks, published, thumbnail, visibility, mode, modeConfig, terrain } = req.body;
  
  const updateData = {
    ...(name !== undefined ? { name } : {}),
    ...(blocks !== undefined ? { blocks: JSON.stringify(blocks) } : {}),
    ...(typeof published === 'boolean' ? { published } : {}),
    ...(visibility && ['PRIVATE','FRIENDS','PUBLIC'].includes(visibility) ? { visibility } : {}),
    ...(mode && ['PARKOUR','PVP','RACE','SANDBOX'].includes(mode) ? { mode } : {}),
    ...(typeof modeConfig === 'string' ? { modeConfig } : {}),
    ...(typeof terrain === 'string' ? { terrain } : {}),
    ...(typeof thumbnail === 'string' && thumbnail.length < config.security.maxThumbnailSize ? { thumbnail } : {}),
  };
  
  try {
    const game = await prisma.game.update({ 
      where: { id: req.params.id }, 
      data: updateData 
    });
    const gameOut = { ...game, blocks: JSON.parse(game.blocks || '[]') };
    
    await logAudit(req, 'game.update', req.auth.userId, { gameId: req.params.id });
    res.json({ game: gameOut });
  } catch (error) {
    // Retry without thumbnail
    const { thumbnail, ...noThumb } = updateData;
    const game = await prisma.game.update({ 
      where: { id: req.params.id }, 
      data: noThumb 
    });
    const gameOut = { ...game, blocks: JSON.parse(game.blocks || '[]') };
    
    await logAudit(req, 'game.update', req.auth.userId, { 
      gameId: req.params.id, 
      note: 'fallback_without_thumbnail' 
    });
    res.json({ game: gameOut });
  }
}

/**
 * Delete game
 */
export async function deleteGame(req, res) {
  const owned = await prisma.game.findFirst({ 
    where: { 
      id: req.params.id, 
      ownerId: req.auth.userId 
    }, 
    select: { id: true } 
  });
  
  if (!owned) {
    throw new ForbiddenError('You can only delete your own games');
  }
  
  const removed = await prisma.game.delete({ 
    where: { id: req.params.id } 
  });
  
  await logAudit(req, 'game.delete', req.auth.userId, { gameId: req.params.id });
  res.json({ game: removed });
}

/**
 * Get game likes status
 */
export async function getLikes(req, res) {
  const id = req.params.id;
  
  const [count, youLike] = await Promise.all([
    prisma.like.count({ where: { gameId: id } }),
    (async () => {
      if (!req.user) return false;
      const found = await prisma.like.findFirst({ 
        where: { gameId: id, userId: req.user.id }, 
        select: { id: true } 
      });
      return !!found;
    })()
  ]);
  
  res.json({ likes: count, youLike });
}

/**
 * Like game
 */
export async function likeGame(req, res) {
  const id = req.params.id;
  if (!req.auth?.userId) {
    throw new ForbiddenError('Authentication required to like games');
  }
  
  // Check if game exists (prefer published where available)
  let game = null;
  try {
    game = await prisma.game.findFirst({
      where: { id, published: true },
      select: { id: true }
    });
  } catch (e) {
    game = await prisma.game.findFirst({
      where: { id },
      select: { id: true }
    });
  }
  
  if (!game) {
    throw new NotFoundError('Game not found');
  }
  
  // Create like (ignore if already exists or likes table missing)
  try {
    await prisma.like.create({ 
      data: { gameId: id, userId: req.auth.userId } 
    });
  } catch {}
  
  let count = 0;
  try { count = await prisma.like.count({ where: { gameId: id } }); } catch {}
  
  await logAudit(req, 'game.like', req.auth.userId, { gameId: id });
  res.json({ likes: count, youLike: true });
}

/**
 * Unlike game
 */
export async function unlikeGame(req, res) {
  const id = req.params.id;
  if (!req.auth?.userId) {
    throw new ForbiddenError('Authentication required to unlike games');
  }
  
  try {
    await prisma.like.deleteMany({ 
      where: { gameId: id, userId: req.auth.userId } 
    });
  } catch {}
  
  let count = 0;
  try { count = await prisma.like.count({ where: { gameId: id } }); } catch {}
  
  await logAudit(req, 'game.unlike', req.auth.userId, { gameId: id });
  res.json({ likes: count, youLike: false });
}

/**
 * Record a unique daily view for a game (user or anonymous fingerprint)
 */
export async function addView(req, res) {
  const id = req.params.id;
  // Accept for both guests and users
  // Build viewerKey from userId or anon IP+UA
  const date = new Date();
  const dailyKey = date.toISOString().slice(0, 10); // YYYY-MM-DD
  let viewerKey = '';
  if (req.auth?.userId) {
    viewerKey = `user:${req.auth.userId}`;
  } else {
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
    const ua = (req.headers['user-agent'] || '').toString();
    const hash = crypto.createHash('sha256').update(`${ip}|${ua}|${dailyKey}`).digest('hex').slice(0, 32);
    viewerKey = `anon:${hash}`;
  }
  try {
    // Avoid Prisma error logs by checking table existence first
    const hasGameView = await prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='GameView'"
    ).then(rows => Array.isArray(rows) && rows.length > 0).catch(() => false);
    if (hasGameView) {
      await prisma.gameView.upsert({
        where: { gameId_dailyKey_viewerKey: { gameId: id, dailyKey, viewerKey } },
        update: {},
        create: { gameId: id, dailyKey, viewerKey }
      });
    }
  } catch (e) {
    // Table may not exist on older schemas; ignore errors
  }
  res.json({ ok: true });
}

/**
 * Get game leaderboard
 */
export async function getLeaderboard(req, res) {
  const id = req.params.id;
  
  const top = await prisma.score.findMany({
    where: { gameId: id },
    orderBy: { timeMs: 'asc' },
    take: 10,
    select: { 
      id: true, 
      timeMs: true, 
      createdAt: true, 
      user: { select: { name: true } } 
    }
  });
  
  res.json({ 
    leaderboard: top.map(s => ({ 
      id: s.id, 
      name: s.user?.name || 'Gracz', 
      timeMs: s.timeMs, 
      createdAt: s.createdAt 
    })) 
  });
}

/**
 * Submit score to leaderboard
 */
export async function submitScore(req, res) {
  const id = req.params.id;
  const { timeMs } = req.body;
  
  // Validation is done by middleware
  
  // Check if game exists and is published
  const game = await prisma.game.findFirst({
    where: { id, OR: [ { published: true }, { visibility: 'PUBLIC' } ] },
    select: { id: true }
  });
  
  if (!game) {
    throw new NotFoundError('Game not found');
  }
  
  const created = await prisma.score.create({ 
    data: { 
      userId: req.auth.userId, 
      gameId: id, 
      timeMs 
    } 
  });
  
  await logAudit(req, 'game.score.submit', req.auth.userId, { gameId: id, timeMs });
  res.status(201).json({ id: created.id });
}

/**
 * List comments for a game (public, includes soft-deleted filtered out)
 */
export async function listComments(req, res) {
  const gameId = req.params.id;
  const { page, limit, offset } = parsePagination(req.query, { page: 1, limit: 20 });
  const items = await prisma.comment.findMany({
    where: { gameId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      authorName: true,
      authorAvatarUrl: true,
      userId: true,
    }
  });
  const total = await prisma.comment.count({ where: { gameId, deletedAt: null } }).catch(() => 0);
  res.json({ comments: items, total, page, limit });
}

/**
 * Create a comment (auth required). Allowed if game is public or user has access.
 */
export async function createComment(req, res) {
  const gameId = req.params.id;
  const access = await verifyGameAccess(gameId, req.auth?.userId || null);
  if (!access || !access.canView) throw new NotFoundError('Game not found');

  const { content } = req.body || {};
  const authorName = req.user?.name || 'Użytkownik';
  const authorAvatarUrl = req.user?.avatarUrl || null;

  const created = await prisma.comment.create({
    data: {
      gameId,
      userId: req.auth?.userId || null,
      authorName,
      authorAvatarUrl,
      content: (content || '').toString().slice(0, 1000)
    },
    select: { id: true }
  });
  await logAudit(req, 'comment.create', req.auth?.userId || null, { gameId, commentId: created.id });
  res.status(201).json({ id: created.id });
}

/**
 * Delete (soft) a comment (author or admin/owner)
 */
export async function deleteComment(req, res) {
  const { id, commentId } = req.params;
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.gameId !== id) throw new NotFoundError('Comment not found');

  const game = await prisma.game.findUnique({ where: { id }, select: { ownerId: true } });
  const isOwner = game?.ownerId === req.auth?.userId;
  const isAuthor = comment.userId && comment.userId === req.auth?.userId;
  const isAdmin = req.auth?.role === 'ADMIN' || req.auth?.role === 'MODERATOR';
  if (!isAuthor && !isOwner && !isAdmin) throw new ForbiddenError('Not allowed');

  await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  await logAudit(req, 'comment.delete', req.auth?.userId || null, { gameId: id, commentId });
  res.json({ ok: true });
}

/**
 * Get top creators
 */
export async function getTopCreators(req, res) {
  try {
    // Preferred query when full schema is available
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
      const key = g.ownerId || g.owner?.id || 'unknown';
      const prev = byOwner.get(key) || {
        id: key,
        name: g.owner?.name || 'Twórca',
        avatarUrl: g.owner?.avatarUrl || '/avatar-default.svg',
        creations: 0,
        likes: 0,
      };
      prev.creations += 1;
      prev.likes += g._count?.likes || 0;
      byOwner.set(key, prev);
    }

    const creators = Array.from(byOwner.values())
      .sort((a, b) => (b.likes - a.likes) || (b.creations - a.creations))
      .slice(0, 8);

    return res.json({ creators });
  } catch (error) {
    // Fallback for older or partially migrated schemas (no likes table or missing owner fields)
    try {
      const games = await prisma.game.findMany({
        where: { published: true },
        select: { id: true, ownerId: true },
      });

      const byOwner = new Map();
      for (const g of games) {
        const key = g.ownerId || 'unknown';
        const prev = byOwner.get(key) || {
          id: key,
          name: 'Twórca',
          avatarUrl: '/avatar-default.svg',
          creations: 0,
          likes: 0,
        };
        prev.creations += 1;
        byOwner.set(key, prev);
      }

      const creators = Array.from(byOwner.values()).slice(0, 8);
      return res.json({ creators });
    } catch {
      // If even the minimal query fails, avoid 500 and return empty list
      return res.json({ creators: [] });
    }
  }
}
