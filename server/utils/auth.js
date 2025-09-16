import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import config from '../config/config.js';
import prisma from '../config/database.js';

/**
 * Sign JWT access token for user
 */
export function signAccessToken(user) {
  const payload = { 
    sub: user.id, 
    email: user.email, 
    role: user.role 
  };
  
  return jwt.sign(payload, config.auth.jwtAccessSecret, {
    expiresIn: config.auth.accessTokenTTL,
  });
}

/**
 * Generate random refresh token
 */
export function generateRefreshToken() {
  return crypto.randomBytes(config.security.tokenBytesLength).toString('hex');
}

/**
 * Hash token for storage
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Hash password
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, config.security.bcryptRounds);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Get refresh cookie options
 */
export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: `${config.routes.auth}`,
    maxAge: config.auth.refreshTokenTTLDays * 24 * 60 * 60 * 1000,
  };
}

/**
 * Check if refresh request is allowed (CSRF protection)
 */
export function isAllowedRefreshRequest(req) {
  const origin = req.headers.origin;
  const referer = req.headers.referer || '';
  const originOk = !origin || origin === config.cors.origin;
  const refererOk = !referer || referer.startsWith(config.cors.origin);
  return originOk && refererOk;
}

/**
 * Create new session for user
 */
export async function createSession(userId) {
  const token = generateRefreshToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + config.auth.refreshTokenTTLDays * 24 * 60 * 60 * 1000);
  
  await prisma.session.create({ 
    data: { 
      tokenHash, 
      userId, 
      expiresAt 
    } 
  });
  
  return token;
}

/**
 * Revoke session by token
 */
export async function revokeSessionByToken(rawToken) {
  try {
    const tokenHash = hashToken(rawToken);
    await prisma.session.update({ 
      where: { tokenHash }, 
      data: { revokedAt: new Date() } 
    });
  } catch {
    // Ignore if session doesn't exist
  }
}

/**
 * Rotate session (revoke old, create new)
 */
export async function rotateSession(rawToken) {
  const tokenHash = hashToken(rawToken);
  
  const existing = await prisma.session.findUnique({ 
    where: { tokenHash } 
  });
  
  if (!existing || existing.revokedAt) {
    return null;
  }
  
  if (existing.expiresAt.getTime() < Date.now()) {
    return null;
  }
  
  // Revoke old session
  await prisma.session.update({ 
    where: { tokenHash }, 
    data: { revokedAt: new Date() } 
  });
  
  // Create new session
  const newToken = await createSession(existing.userId);
  
  return { 
    userId: existing.userId, 
    token: newToken 
  };
}

/**
 * Revoke all user sessions
 */
export async function revokeAllUserSessions(userId) {
  await prisma.session.deleteMany({ 
    where: { userId } 
  });
}

/**
 * Find user by ID with safe fields only
 */
export async function findUserSafeById(userId) {
  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        email: true, 
        name: true, 
        avatarUrl: true, 
        role: true, 
        // Skin customization fields returned to client
        skinId: true,
        skinPrimary: true,
        skinSecondary: true,
        skinConfig: true,
        createdAt: true, 
        updatedAt: true 
      },
    });
  } catch (e) {
    // Fallback for older DBs without skinConfig column
    if (e?.code === 'P2022') {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          email: true, 
          name: true, 
          avatarUrl: true, 
          role: true, 
          skinId: true,
          skinPrimary: true,
          skinSecondary: true,
          createdAt: true, 
          updatedAt: true 
        },
      });
    } else {
      throw e;
    }
  }
  if (!user) return null;
  let parsedConfig = null;
  try {
    parsedConfig = (user).skinConfig ? JSON.parse((user).skinConfig) : null;
  } catch {
    parsedConfig = null;
  }
  return { ...user, skinConfig: parsedConfig };
}

/**
 * Log audit event
 */
export async function logAudit(req, action, userId = null, metadata = undefined) {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const userAgent = req.get('user-agent') || undefined;
    const metadataSerialized = typeof metadata === 'undefined' 
      ? undefined 
      : JSON.stringify(metadata);
    
    await prisma.auditLog.create({ 
      data: { 
        action, 
        userId: userId || null, 
        ip: ip || null, 
        userAgent, 
        metadata: metadataSerialized 
      } 
    });
  } catch (error) {
    // Log error but don't fail the request
    console.error('Audit log error:', error);
  }
}

/**
 * Verify user has access to game
 */
export async function verifyGameAccess(gameId, userId, requireOwner = false) {
  const game = await prisma.game.findFirst({
    where: {
      id: gameId,
      ...(requireOwner
        ? { ownerId: userId }
        : {
            OR: [
              { ownerId: userId },
              { members: { some: { userId } } },
              // Public visibility or legacy published flag
              { visibility: 'PUBLIC' },
              { published: true },
              // Friends visibility: user is a friend of the owner
              {
                AND: [
                  { visibility: 'FRIENDS' },
                  {
                    OR: [
                      { owner: { friendsInitiated: { some: { friendId: userId } } } },
                      { owner: { friendsReceived: { some: { userId: userId } } } }
                    ]
                  }
                ]
              }
            ]
          }
      )
    },
    select: {
      id: true,
      ownerId: true,
      published: true,
      visibility: true,
      members: {
        where: { userId },
        select: { role: true },
        take: 1
      }
    }
  });

  if (!game) {
    return null;
  }

  const isOwner = game.ownerId === userId;
  const memberRole = game.members[0]?.role;
  const canEdit = isOwner || memberRole === 'EDITOR' || memberRole === 'OWNER';

  return {
    game,
    isOwner,
    memberRole,
    canEdit,
    canView: true
  };
}
