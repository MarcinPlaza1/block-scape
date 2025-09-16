import prisma from '../../../config/database.js';
import { wsConfig } from '../../config/websocket.config.js';
import logger from '../../../utils/logger.js';

/**
 * Manages active WebSocket sessions and participants
 */
export class SessionManager {
  constructor() {
    // In-memory storage for active sessions
    this.activeSessions = new Map(); // sessionId -> { participants: Map, gameState: Object, chatHistory: Array }
    this.userSessions = new Map();   // userId -> Set of sessionIds
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Initialize a session if it doesn't exist
   */
  initializeSession(sessionId) {
    if (!this.activeSessions.has(sessionId)) {
      this.activeSessions.set(sessionId, {
        participants: new Map(),
        gameState: {},
        chatHistory: []
      });
    }
    return this.activeSessions.get(sessionId);
  }

  /**
   * Add a participant to a session
   */
  async addParticipant(sessionId, userData, socketId) {
    const sessionData = this.initializeSession(sessionId);
    const effectiveUserId = userData.userId || userData.guestId;
    // Enforce max participants (from DB or fallback to config)
    let maxParticipants = wsConfig?.limits?.maxParticipants || 10;
    try {
      const session = await prisma.realtimeSession.findUnique({
        where: { id: sessionId },
        select: { maxParticipants: true }
      });
      if (session?.maxParticipants && Number(session.maxParticipants) > 0) {
        maxParticipants = Number(session.maxParticipants);
      }
    } catch {}

    const currentCount = sessionData.participants.size;
    if (currentCount >= maxParticipants) {
      logger.warn({ sessionId, maxParticipants }, 'Session is full; rejecting participant');
      const err = new Error('Session is full');
      err.code = 'SESSION_FULL';
      throw err;
    }
    
    // Add participant to session
    sessionData.participants.set(effectiveUserId, {
      id: userData.participantId,
      userId: userData.userId,
      guestId: userData.guestId,
      userName: userData.userName,
      role: userData.role,
      socketId: socketId,
      joinedAt: Date.now(),
      presence: { online: true },
      isOnline: true,
      isGuest: userData.isGuest
    });

    // Track user sessions
    if (!this.userSessions.has(effectiveUserId)) {
      this.userSessions.set(effectiveUserId, new Set());
    }
    this.userSessions.get(effectiveUserId).add(sessionId);

    // Update database
    await prisma.realtimeParticipant.update({
      where: { id: userData.participantId },
      data: { 
        isOnline: true,
        lastSeen: new Date()
      }
    });

    return sessionData.participants.get(effectiveUserId);
  }

  /**
   * Remove a participant from a session
   */
  async removeParticipant(sessionId, userData) {
    const sessionData = this.activeSessions.get(sessionId);
    if (!sessionData) return;

    const effectiveUserId = userData.userId || userData.guestId;
    
    // Remove from session
    sessionData.participants.delete(effectiveUserId);

    // Update user sessions
    if (this.userSessions.has(effectiveUserId)) {
      this.userSessions.get(effectiveUserId).delete(sessionId);
      if (this.userSessions.get(effectiveUserId).size === 0) {
        this.userSessions.delete(effectiveUserId);
      }
    }

    // Update database
    await prisma.realtimeParticipant.update({
      where: { id: userData.participantId },
      data: { 
        isOnline: false,
        lastSeen: new Date()
      }
    });

    // Clean up empty sessions
    if (sessionData.participants.size === 0) {
      this.activeSessions.delete(sessionId);
      
      // Mark session as inactive
      await prisma.realtimeSession.update({
        where: { id: sessionId },
        data: { isActive: false, closedAt: new Date() }
      });
    }
  }

  /**
   * Get all participants in a session
   */
  getParticipants(sessionId) {
    const sessionData = this.activeSessions.get(sessionId);
    if (!sessionData) return [];

    return Array.from(sessionData.participants.values()).map(p => ({
      id: p.id,
      userId: p.userId,
      guestId: p.guestId,
      userName: p.userName,
      role: p.role,
      presence: p.presence,
      isOnline: p.isOnline,
      isGuest: p.isGuest
    }));
  }

  /**
   * Update participant presence data
   */
  async updatePresence(sessionId, userId, presenceData) {
    const sessionData = this.activeSessions.get(sessionId);
    if (!sessionData) return;

    const participant = sessionData.participants.get(userId);
    if (!participant) return;

    participant.presence = { ...participant.presence, ...presenceData };
    
    // Update database occasionally (throttled)
    if (Math.random() < wsConfig.presenceUpdateProbability) {
      await prisma.realtimeParticipant.update({
        where: { id: participant.id },
        data: { 
          presenceData: JSON.stringify(participant.presence),
          lastSeen: new Date()
        }
      });
    }

    return participant.presence;
  }

  /**
   * Get session data
   */
  getSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get game state for a session
   */
  getGameState(sessionId) {
    const sessionData = this.activeSessions.get(sessionId);
    return sessionData?.gameState || {};
  }

  /**
   * Update game state
   */
  updateGameState(sessionId, gameState) {
    const sessionData = this.activeSessions.get(sessionId);
    if (sessionData) {
      sessionData.gameState = gameState;
    }
  }

  /**
   * Get user's active sessions
   */
  getUserSessions(userId) {
    return Array.from(this.userSessions.get(userId) || []);
  }

  /**
   * Check if user is in any session
   */
  isUserActive(userId) {
    return this.userSessions.has(userId) && this.userSessions.get(userId).size > 0;
  }

  /**
   * Clean up inactive sessions periodically
   */
  startCleanupInterval() {
    setInterval(async () => {
      try {
        const cutoff = new Date(Date.now() - wsConfig.cleanupIntervals.sessionTimeout);
        
        await prisma.realtimeSession.updateMany({
          where: {
            isActive: true,
            participants: {
              none: {
                isOnline: true,
                lastSeen: { gte: cutoff }
              }
            }
          },
          data: {
            isActive: false,
            closedAt: new Date()
          }
        });
      } catch (error) {
        console.error('[SessionManager] Cleanup error:', error);
      }
    }, wsConfig.cleanupIntervals.inactiveSessions);
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
