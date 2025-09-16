import config from '../config/config.js';
import prisma from '../config/database.js';
import {
  hashPassword,
  comparePassword,
  revokeAllUserSessions,
  createSession,
  refreshCookieOptions,
  logAudit
} from '../utils/auth.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';

/**
 * Get current user profile
 */
export async function getProfile(req, res) {
  let user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
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
      updatedAt: true,
    }
  });
  // Try select with skinConfig, fallback if column missing
  if (user && typeof user.skinConfig === 'undefined') {
    try {
      const withCfg = await prisma.user.findUnique({
        where: { id: req.auth.userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          skinId: true,
          skinPrimary: true,
          skinSecondary: true,
          skinConfig: true,
          createdAt: true,
          updatedAt: true,
        }
      });
      if (withCfg) user = withCfg;
    } catch {}
  }
  if (!user) throw new NotFoundError('User not found');
  res.json({ user });
}

/**
 * Update user profile
 */
export async function updateProfile(req, res) {
  const { name, avatarUrl, skinId, skinPrimary, skinSecondary, skinConfig } = req.body;
  
  const updateData = {};
  
  // Handle name update
  if (name !== undefined) {
    const trimmedName = name.trim();
    if (trimmedName.length < config.security.minNameLength || 
        trimmedName.length > config.security.maxNameLength) {
      throw new ValidationError(
        `Name must be between ${config.security.minNameLength} and ${config.security.maxNameLength} characters`
      );
    }
    updateData.name = trimmedName;
  }
  
  // Handle avatar update
  if (avatarUrl !== undefined) {
    if (avatarUrl === null || avatarUrl === '') {
      updateData.avatarUrl = null;
    } else if (typeof avatarUrl === 'string') {
      if (avatarUrl.length > config.security.maxAvatarSize) {
        throw new ValidationError('Avatar size too large');
      }
      updateData.avatarUrl = avatarUrl;
    } else {
      throw new ValidationError('Invalid avatar format');
    }
  }

  // Handle skin updates
  if (skinId !== undefined) {
    if (typeof skinId !== 'string' || !['blocky','capsule','robot','kogama'].includes(skinId)) {
      throw new ValidationError('Invalid skinId');
    }
    updateData.skinId = skinId;
  }
  if (skinPrimary !== undefined) {
    const v = Number(skinPrimary);
    if (!Number.isFinite(v) || v < 0 || v > 0xffffff) throw new ValidationError('Invalid skinPrimary');
    updateData.skinPrimary = v >>> 0;
  }
  if (skinSecondary !== undefined) {
    const v = Number(skinSecondary);
    if (!Number.isFinite(v) || v < 0 || v > 0xffffff) throw new ValidationError('Invalid skinSecondary');
    updateData.skinSecondary = v >>> 0;
  }
  if (skinConfig !== undefined) {
    try {
      if (skinConfig === null) {
        updateData.skinConfig = null;
      } else {
        // Basic size guard
        const json = JSON.stringify(skinConfig);
        if (json.length > 5000) throw new ValidationError('skinConfig too large');
        updateData.skinConfig = json;
      }
    } catch (e) {
      if (e instanceof ValidationError) throw e;
      throw new ValidationError('Invalid skinConfig');
    }
  }
  
  // Update user
  const user = await prisma.user.update({
    where: { id: req.auth.userId },
    data: updateData,
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
    }
  });
  // Try to include skinConfig if available
  if (typeof user.skinConfig === 'undefined') {
    try {
      const withCfg = await prisma.user.findUnique({
        where: { id: req.auth.userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          skinId: true,
          skinPrimary: true,
          skinSecondary: true,
          skinConfig: true,
          createdAt: true,
          updatedAt: true,
        }
      });
      if (withCfg) user = withCfg;
    } catch {}
  }
  
  await logAudit(req, 'user.update_profile', req.auth.userId);
  
  res.json({ user });
}

/**
 * Change user password
 */
export async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body;
  
  // Get user with password hash
  const user = await prisma.user.findUnique({ 
    where: { id: req.auth.userId } 
  });
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Verify old password
  const validPassword = await comparePassword(oldPassword, user.passwordHash);
  if (!validPassword) {
    throw new ValidationError('Invalid current password');
  }
  
  // Hash new password
  const passwordHash = await hashPassword(newPassword);
  
  // Update password
  await prisma.user.update({ 
    where: { id: user.id }, 
    data: { passwordHash } 
  });
  
  // Revoke all sessions for security
  await revokeAllUserSessions(user.id);
  
  // Create new session
  const newRefresh = await createSession(user.id);
  res.cookie(config.auth.refreshCookieName, newRefresh, refreshCookieOptions());
  
  await logAudit(req, 'user.change_password', user.id);
  
  res.json({ ok: true });
}

/**
 * Delete user account
 */
export async function deleteAccount(req, res) {
  const userId = req.auth.userId;
  
  // Delete all user data in transaction
  await prisma.$transaction(async (tx) => {
    // Delete games
    await tx.game.deleteMany({ where: { ownerId: userId } });
    
    // Delete sessions
    await tx.session.deleteMany({ where: { userId } });
    
    // Delete friend relationships
    await tx.friend.deleteMany({
      where: {
        OR: [
          { userId },
          { friendId: userId }
        ]
      }
    });
    
    // Delete friend requests
    await tx.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      }
    });
    
    // Delete private messages
    await tx.privateMessage.deleteMany({ where: { senderId: userId } });
    
    // Delete conversation participants
    await tx.conversationParticipant.deleteMany({ where: { userId } });
    
    // Delete likes
    await tx.like.deleteMany({ where: { userId } });
    
    // Delete scores
    await tx.score.deleteMany({ where: { userId } });
    
    // Delete realtime participants
    await tx.realtimeParticipant.deleteMany({ where: { userId } });
    
    // Delete user
    await tx.user.delete({ where: { id: userId } });
  });
  
  // Clear auth cookie
  res.clearCookie(config.auth.refreshCookieName, { path: config.routes.auth });
  
  await logAudit(req, 'user.delete', userId);
  
  res.json({ ok: true });
}

/**
 * Get user permissions
 */
export async function getPermissions(req, res) {
  const role = req.user.role;
  
  const basePermissions = [
    'Zarządzanie kontem i profilem',
    'Tworzenie i edycja własnych gier',
    'Dodawanie znajomych i czat',
    'Uczestnictwo w sesjach multiplayer'
  ];
  
  const adminPermissions = [
    ...basePermissions,
    'Zarządzanie użytkownikami i treściami',
    'Dostęp do panelu administracyjnego',
    'Moderowanie czatu globalnego',
    'Usuwanie dowolnych treści'
  ];
  
  const permissions = role === 'ADMIN' ? adminPermissions : basePermissions;
  
  res.json({ role, permissions });
}

/**
 * Get user login history
 */
export async function getLoginHistory(req, res) {
  const logs = await prisma.auditLog.findMany({
    where: { 
      userId: req.auth.userId, 
      action: { 
        in: ['auth.login', 'auth.refresh.success', 'auth.refresh.reuse_detected'] 
      } 
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { 
      id: true, 
      action: true, 
      ip: true, 
      userAgent: true, 
      createdAt: true 
    },
  });
  
  res.json({ logs });
}
