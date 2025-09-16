import config from '../config/config.js';
import prisma from '../config/database.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  hashPassword,
  comparePassword,
  refreshCookieOptions,
  isAllowedRefreshRequest,
  createSession,
  revokeSessionByToken,
  rotateSession,
  revokeAllUserSessions,
  findUserSafeById,
  logAudit
} from '../utils/auth.js';
import { ValidationError, AuthorizationError } from '../middleware/errorHandler.js';
import { recordLoginFailure, recordLoginSuccess, recordRefreshFailure, recordRefreshSuccess } from '../middleware/bruteforce.js';

/**
 * Register new user
 */
export async function register(req, res, next) {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ValidationError('Email already in use');
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, name, passwordHash },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Create session
    const accessToken = signAccessToken(user);
    const refreshToken = await createSession(user.id);

    // Set refresh token cookie
    res.cookie(config.auth.refreshCookieName, refreshToken, refreshCookieOptions());

    // Log audit
    await logAudit(req, 'auth.register', user.id);

    res.status(201).json({
      token: accessToken,
      user,
    });
  } catch (error) {
    // Log the detailed error and pass it to the global error handler
    console.error('Registration failed:', error);
    next(error);
  }
}

/**
 * Login user
 */
export async function login(req, res) {
  const { email, password } = req.body;

  // Find user (select minimal fields to avoid schema drift issues)
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true }
  });
  if (!user) {
    recordLoginFailure(req);
    throw new AuthorizationError('Invalid credentials');
  }

  // Verify password
  const validPassword = await comparePassword(password, user.passwordHash);
  if (!validPassword) {
    recordLoginFailure(req);
    throw new AuthorizationError('Invalid credentials');
  }

  // Get safe user data
  const safeUser = await findUserSafeById(user.id);

  // Create session
  const accessToken = signAccessToken(safeUser);
  const refreshToken = await createSession(user.id);

  // Set refresh token cookie
  res.cookie(config.auth.refreshCookieName, refreshToken, refreshCookieOptions());

  // Log audit
  await logAudit(req, 'auth.login', user.id);

  // Clear brute-force counters on success
  recordLoginSuccess(req);

  res.json({
    token: accessToken,
    user: safeUser,
  });
}

/**
 * Refresh access token
 */
export async function refresh(req, res) {
  // CSRF protection
  if (!isAllowedRefreshRequest(req)) {
    await logAudit(req, 'auth.refresh.csrf_block');
    recordRefreshFailure(req);
    throw new AuthorizationError('Forbidden');
  }

  // Get refresh token from cookie
  const cookie = req.cookies?.[config.auth.refreshCookieName];
  if (!cookie) {
    recordRefreshFailure(req);
    throw new AuthorizationError('Unauthorized');
  }

  // Find session
  const tokenHash = hashToken(cookie);
  const session = await prisma.session.findUnique({ where: { tokenHash } });

  if (!session) {
    await logAudit(req, 'auth.refresh.unknown_session');
    recordRefreshFailure(req);
    throw new AuthorizationError('Unauthorized');
  }

  // Check if session was already used (replay attack)
  if (session.revokedAt) {
    await revokeAllUserSessions(session.userId);
    res.clearCookie(config.auth.refreshCookieName, { path: config.routes.auth });
    await logAudit(req, 'auth.refresh.reuse_detected', session.userId);
    recordRefreshFailure(req);
    throw new AuthorizationError('Unauthorized');
  }

  // Rotate session
  const rotated = await rotateSession(cookie);
  if (!rotated) {
    recordRefreshFailure(req);
    throw new AuthorizationError('Unauthorized');
  }

  // Get user
  const user = await findUserSafeById(rotated.userId);
  if (!user) {
    recordRefreshFailure(req);
    throw new AuthorizationError('Unauthorized');
  }

  // Create new access token
  const accessToken = signAccessToken(user);

  // Set new refresh token cookie
  res.cookie(config.auth.refreshCookieName, rotated.token, refreshCookieOptions());

  // Log audit
  await logAudit(req, 'auth.refresh.success', user.id);

  // Clear refresh brute-force counters on success
  recordRefreshSuccess(req);

  res.json({ token: accessToken });
}

/**
 * Logout user
 */
export async function logout(req, res) {
  const cookie = req.cookies?.[config.auth.refreshCookieName];

  // Revoke session if exists
  if (cookie) {
    await revokeSessionByToken(cookie);
  }

  // Clear cookie
  res.clearCookie(config.auth.refreshCookieName, { path: config.routes.auth });

  // Log audit
  const userId = req.auth?.userId || null;
  await logAudit(req, 'auth.logout', userId);

  res.json({ ok: true });
}

/**
 * Get user sessions
 */
export async function getSessions(req, res) {
  const sessions = await prisma.session.findMany({
    where: { userId: req.auth.userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  res.json({ sessions });
}

/**
 * Revoke specific session
 */
export async function revokeSession(req, res) {
  const session = await prisma.session.findFirst({
    where: {
      id: req.params.id,
      userId: req.auth.userId,
    },
  });

  if (!session) {
    throw new ValidationError('Session not found');
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  await logAudit(req, 'auth.session.revoke', req.auth.userId, { sessionId: session.id });

  res.json({ ok: true });
}
