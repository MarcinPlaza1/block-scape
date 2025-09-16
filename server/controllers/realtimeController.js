import config from '../config/config.js';
import prisma from '../config/database.js';
import { generateSessionToken } from '../websocket.js';
import { logAudit, verifyGameAccess } from '../utils/auth.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { generateId } from '../utils/helpers.js';

/**
 * Create new realtime session
 */
export async function createSession(req, res) {
  const { gameId, type = 'edit', maxParticipants = config.session.defaultMaxParticipants } = req.body;
  
  // Verify user has access to the game
  const gameAccess = await verifyGameAccess(gameId, req.auth.userId);
  
  if (!gameAccess) {
    throw new NotFoundError('Game not found or access denied');
  }
  
  // Check for existing active session for this game
  const existingSession = await prisma.realtimeSession.findFirst({
    where: {
      gameId,
      type,
      isActive: true,
      ownerId: req.auth.userId
    }
  });
  
  if (existingSession) {
    return res.json({ session: existingSession });
  }
  
  // Create new session
  const session = await prisma.realtimeSession.create({
    data: {
      gameId,
      type,
      ownerId: req.auth.userId,
      maxParticipants
    }
  });
  
  // Add owner as first participant
  await prisma.realtimeParticipant.create({
    data: {
      sessionId: session.id,
      userId: req.auth.userId,
      role: 'OWNER'
    }
  });
  
  await logAudit(req, 'realtime.session.create', req.auth.userId, { 
    sessionId: session.id, 
    gameId, 
    type 
  });
  
  res.status(201).json({ session });
}

/**
 * Join existing session
 */
export async function joinSession(req, res) {
  const { id } = req.params;
  // Ignore role from body for authenticated users; determine from ownership or GameMember
  
  const session = await prisma.realtimeSession.findFirst({
    where: { id, isActive: true },
    include: {
      game: true,
      participants: true
    }
  });
  
  if (!session) {
    throw new NotFoundError('Session not found or inactive');
  }
  
  // Check if user has access to the game
  const membership = await prisma.gameMember.findFirst({
    where: { gameId: session.gameId, userId: req.auth.userId },
    select: { role: true }
  });

  const hasAccess = session.game.ownerId === req.auth.userId || 
    session.game.published || 
    !!membership;
  
  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this game');
  }
  
  // Check participant limit
  const activeParticipants = session.participants.filter(p => p.isOnline).length;
  if (activeParticipants >= session.maxParticipants) {
    throw new ValidationError('Session is full');
  }
  
  // Derive effective role for this session
  let effectiveRole = 'VIEWER';
  if (session.ownerId === req.auth.userId) {
    effectiveRole = 'OWNER';
  } else if (session.type === 'play') {
    // In play sessions, non-owners are players regardless of game membership
    effectiveRole = 'PLAYER';
  } else if (membership?.role) {
    effectiveRole = (membership.role === 'EDITOR' || membership.role === 'OWNER') ? 'EDITOR' : 'VIEWER';
  }

  // Check if already a participant
  let participant = session.participants.find(p => p.userId === req.auth.userId);
  
  if (!participant) {
    // Add new participant
    participant = await prisma.realtimeParticipant.create({
      data: {
        sessionId: id,
        userId: req.auth.userId,
        role: effectiveRole
      }
    });
  } else {
    // Update existing participant
    participant = await prisma.realtimeParticipant.update({
      where: { id: participant.id },
      data: { 
        isOnline: true,
        joinedAt: new Date(),
        role: effectiveRole
      }
    });
  }
  
  // Generate session token for WebSocket auth
  const sessionToken = generateSessionToken(req.auth.userId, id, participant.role);
  
  await logAudit(req, 'realtime.session.join', req.auth.userId, { sessionId: id });
  
  res.json({
    sessionToken,
    participant,
    session: {
      id: session.id,
      gameId: session.gameId,
      type: session.type,
      maxParticipants: session.maxParticipants
    }
  });
}

/**
 * Join session as guest (public games only)
 */
export async function joinSessionAsGuest(req, res) {
  const { id } = req.params;
  const { guestName = 'Guest' } = req.body;
  
  const session = await prisma.realtimeSession.findFirst({
    where: { id, isActive: true, type: 'play' }, // Only allow guests in play sessions
    include: {
      game: true,
      participants: true
    }
  });
  
  if (!session) {
    throw new NotFoundError('Session not found or inactive');
  }
  
  // Only allow guests in published games
  if (!session.game.published) {
    throw new ForbiddenError('This game is not public');
  }
  
  // Check participant limit
  const activeParticipants = session.participants.filter(p => p.isOnline).length;
  if (activeParticipants >= session.maxParticipants) {
    throw new ValidationError('Session is full');
  }
  
  // Create guest participant
  const guestId = generateId('guest');
  const participant = await prisma.realtimeParticipant.create({
    data: {
      sessionId: id,
      userId: null, // No user ID for guests
      guestName: guestName.trim().substring(0, config.security.maxGuestNameLength) || 'Guest',
      role: 'PLAYER'
    }
  });
  
  // Generate session token for WebSocket auth (with guest info)
  const sessionToken = generateSessionToken(guestId, id, 'PLAYER', { 
    isGuest: true, 
    guestName: participant.guestName 
  });
  
  res.json({
    sessionToken,
    participant: {
      ...participant,
      isGuest: true
    },
    session: {
      id: session.id,
      gameId: session.gameId,
      type: session.type,
      maxParticipants: session.maxParticipants
    }
  });
}

/**
 * Join play session for a public game
 */
export async function joinGamePlay(req, res) {
  const { gameId } = req.params;
  const { guestName = 'Guest', asGuest = false } = req.body;
  
  // Verify the game is published
  const game = await prisma.game.findFirst({
    where: { id: gameId, published: true }
  });
  
  if (!game) {
    throw new NotFoundError('Game not found or not published');
  }
  
  // Find or create a public play session for this game
  let session = await prisma.realtimeSession.findFirst({
    where: {
      gameId,
      type: 'play',
      isActive: true
    },
    include: {
      participants: true
    }
  });
  
  if (!session) {
    // Create new public play session owned by game owner
    session = await prisma.realtimeSession.create({
      data: {
        gameId,
        type: 'play',
        ownerId: game.ownerId,
        maxParticipants: config.session.publicPlayMaxParticipants
      }
    });
    session.participants = [];
  }
  
  // Check participant limit
  const activeParticipants = session.participants.filter(p => p.isOnline).length;
  if (activeParticipants >= session.maxParticipants) {
    throw new ValidationError('Session is full');
  }
  
  if (asGuest) {
    // Guest flow
    const cleanGuestName = guestName.trim().substring(0, config.security.maxGuestNameLength) || 'Guest';
    const guestId = generateId('guest');
    
    const participant = await prisma.realtimeParticipant.create({
      data: {
        sessionId: session.id,
        userId: null,
        guestName: cleanGuestName,
        role: 'PLAYER'
      }
    });
    
    const sessionToken = generateSessionToken(guestId, session.id, 'PLAYER', { 
      isGuest: true, 
      guestName: cleanGuestName 
    });
    
    res.json({
      sessionToken,
      participant: {
        ...participant,
        isGuest: true,
        effectiveUserId: guestId
      },
      session: {
        id: session.id,
        gameId: session.gameId,
        type: session.type,
        maxParticipants: session.maxParticipants
      }
    });
  } else {
    // This endpoint can also be used by logged-in users
    // But they should use the authenticated endpoint instead
    throw new ValidationError('Use authenticated endpoint for logged-in users');
  }
}

/**
 * Get session details
 */
export async function getSession(req, res) {
  const { id } = req.params;
  
  const session = await prisma.realtimeSession.findFirst({
    where: { id },
    include: {
      game: {
        select: { id: true, name: true, ownerId: true }
      },
      participants: {
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true }
          }
        }
      }
    }
  });
  
  if (!session) {
    throw new NotFoundError('Session not found');
  }
  
  // Check access
  const hasAccess = session.game.ownerId === req.auth.userId || 
    session.participants.some(p => p.userId === req.auth.userId);
  
  if (!hasAccess) {
    throw new ForbiddenError('Access denied');
  }
  
  res.json({ session });
}

/**
 * Update session settings (owner only)
 */
export async function updateSession(req, res) {
  const { id } = req.params;
  const { maxParticipants } = req.body;
  const session = await prisma.realtimeSession.findFirst({ where: { id } });
  if (!session) {
    throw new NotFoundError('Session not found');
  }
  if (session.ownerId !== req.auth.userId) {
    throw new ForbiddenError('Only owner can update session');
  }
  const updated = await prisma.realtimeSession.update({
    where: { id },
    data: { maxParticipants: Number(maxParticipants) }
  });
  await logAudit(req, 'realtime.session.update', req.auth.userId, { sessionId: id, maxParticipants: updated.maxParticipants });
  res.json({ session: { id: updated.id, maxParticipants: updated.maxParticipants } });
}

/**
 * Get online players count for a public game (play sessions)
 */
export async function getOnlinePlayersForGame(req, res) {
  const { gameId } = req.params;
  try {
    const sessions = await prisma.realtimeSession.findMany({
      where: { gameId, type: 'play', isActive: true },
      select: {
        id: true,
        participants: { where: { isOnline: true }, select: { id: true } }
      }
    });
    const online = (sessions || []).reduce((sum, s) => sum + (s.participants?.length || 0), 0);
    return res.json({ online });
  } catch (e) {
    // Fallback for older schemas without realtime tables
    return res.json({ online: 0 });
  }
}

/**
 * Get session chat history
 */
export async function getSessionChat(req, res) {
  const { id } = req.params;
  const { cursor, limit = 50, includeSystem } = req.query;
  const includeSystemBool = String(includeSystem).toLowerCase() === 'true' || includeSystem === '1';
  
  const session = await prisma.realtimeSession.findFirst({
    where: { id },
    include: {
      game: {
        select: { id: true, ownerId: true }
      },
      participants: {
        select: { userId: true }
      }
    }
  });
  
  if (!session) {
    throw new NotFoundError('Session not found');
  }

  // Access control: owner or participant only
  const isOwner = session.game?.ownerId === req.auth?.userId;
  const isParticipant = session.participants?.some(p => p.userId === req.auth?.userId);
  if (!isOwner && !isParticipant) {
    throw new ForbiddenError('Access denied');
  }
  
  const messages = await prisma.chatMessage.findMany({
    where: {
      sessionId: id,
      deletedAt: null,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      ...(!includeSystemBool ? { type: 'text' } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: Number(limit),
    select: {
      id: true,
      authorName: true,
      content: true,
      type: true,
      createdAt: true,
      user: {
        select: { id: true, avatarUrl: true }
      }
    }
  });
  
  res.json({ 
    messages: messages.reverse(),
    hasMore: messages.length === Number(limit)
  });
}

/**
 * Close session
 */
export async function closeSession(req, res) {
  const { id } = req.params;
  
  const session = await prisma.realtimeSession.findFirst({
    where: { id, ownerId: req.auth.userId }
  });
  
  if (!session) {
    throw new NotFoundError('Session not found or access denied');
  }
  
  await prisma.realtimeSession.update({
    where: { id },
    data: { 
      isActive: false,
      closedAt: new Date()
    }
  });
  
  await logAudit(req, 'realtime.session.close', req.auth.userId, { sessionId: id });
  
  res.json({ success: true });
}
