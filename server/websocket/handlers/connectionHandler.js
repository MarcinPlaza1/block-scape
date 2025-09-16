import { sessionManager } from '../services/session/SessionManager.js';
import { presenceManager } from '../services/presence/PresenceManager.js';
import { sessionChatService } from '../services/chat/SessionChatService.js';
import { globalChatService } from '../services/chat/GlobalChatService.js';
import { privateChatService } from '../services/chat/PrivateChatService.js';
import { collaborationService } from '../services/collaboration/CollaborationService.js';
import { friendsService } from '../services/friends/FriendsService.js';
import { wsConfig } from '../config/websocket.config.js';
import {
  chatMessageSchema,
  typingSchema,
  globalChatMessageSchema,
  privateMessageSchema,
  markMessageReadSchema,
  blockOperationSchema,
  selectionChangeSchema,
  playerInputSchema,
  gameEventSchema,
  friendRequestSentSchema,
  friendRequestAcceptedSchema,
  friendRemovedSchema,
  presenceUpdateSchema
} from '../validation/schemas.js';
import logger from '../../utils/logger.js';

// Simple per-socket token bucket rate limiter
function createRateLimiter() {
  const limits = {
    presence_update: { tokensPerInterval: 10, intervalMs: 1000, bucketSize: 10 },
    chat_message: { tokensPerInterval: 3, intervalMs: 1000, bucketSize: 3 },
    typing: { tokensPerInterval: 10, intervalMs: 1000, bucketSize: 10 },
    block_operation: { tokensPerInterval: 20, intervalMs: 1000, bucketSize: 20 },
    selection_change: { tokensPerInterval: 10, intervalMs: 1000, bucketSize: 10 },
    player_input: { tokensPerInterval: 60, intervalMs: 1000, bucketSize: 60 },
    game_event: { tokensPerInterval: 10, intervalMs: 1000, bucketSize: 10 },
    global_chat_message: { tokensPerInterval: 2, intervalMs: 1000, bucketSize: 2 },
    private_message: { tokensPerInterval: 2, intervalMs: 1000, bucketSize: 2 }
  };
  const state = {};
  return {
    allow(eventName) {
      const limit = limits[eventName];
      if (!limit) return true;
      const now = Date.now();
      const bucket = state[eventName] || { tokens: limit.bucketSize, lastRefill: now };
      // Refill
      const elapsed = now - bucket.lastRefill;
      if (elapsed > 0) {
        const refill = (elapsed / limit.intervalMs) * limit.tokensPerInterval;
        bucket.tokens = Math.min(limit.bucketSize, bucket.tokens + refill);
        bucket.lastRefill = now;
      }
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        state[eventName] = bucket;
        return true;
      }
      state[eventName] = bucket;
      return false;
    }
  };
}

// Minimal payload validators
function isObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}
function isString(x) {
  return typeof x === 'string';
}
function isBoolean(x) {
  return typeof x === 'boolean';
}
function isArrayOfStrings(x) {
  return Array.isArray(x) && x.every(isString);
}

/**
 * Main connection handler for Socket.IO
 */
export function handleConnection(io, socket) {
  const userData = socket.userData;
  const { userId, guestId, sessionId, isGuest } = userData;
  const effectiveUserId = userId || guestId;
  
  console.log(`[WS] ${isGuest ? 'Guest' : 'User'} ${userData.userName} (${effectiveUserId}) joined session ${sessionId} with role ${userData.role}`);

  // Attach rate limiter to socket
  socket.rateLimiter = createRateLimiter();

  // Setup initial connection
  setupConnection(io, socket);

  // Register event handlers
  registerSessionHandlers(io, socket);
  registerChatHandlers(io, socket);
  registerCollaborationHandlers(io, socket);
  registerFriendsHandlers(io, socket);
  registerDisconnectHandler(io, socket);
}

/**
 * Setup initial connection
 */
async function setupConnection(io, socket) {
  const { userId, sessionId, isGuest } = socket.userData;
  
  // Join session room
  socket.join(`session:${sessionId}`);
  
  // Setup presence tracking for logged-in users
  if (userId && !isGuest) {
    presenceManager.addUserSocket(userId, socket);
    presenceManager.joinUserRoom(userId, socket);
  }
  
  // Add participant to session
  try {
    const participant = await sessionManager.addParticipant(sessionId, socket.userData, socket.id);
    // Send initial data
    socket.emit('session_joined', {
      sessionId,
      participants: sessionManager.getParticipants(sessionId),
      gameState: sessionManager.getGameState(sessionId)
    });

    // Notify others about new participant
    socket.to(`session:${sessionId}`).emit('participant_joined', {
      id: participant.id,
      userId: participant.userId,
      guestId: participant.guestId,
      userName: participant.userName,
      role: participant.role,
      presence: participant.presence,
      isGuest: participant.isGuest
    });
  } catch (err) {
    if (err?.code === 'SESSION_FULL') {
      socket.emit('error', { message: 'Session is full' });
      return socket.disconnect(true);
    }
    socket.emit('error', { message: 'Join failed' });
    return socket.disconnect(true);
  }

  // Notify friends if user is logged in
  if (userId && !isGuest) {
    await notifyFriendsStatus(io, socket.userData, true);
  }
}

/**
 * Register session-related handlers
 */
function registerSessionHandlers(io, socket) {
  const { sessionId } = socket.userData;

  // Presence updates
  socket.on('presence_update', async (data) => {
    try {
      if (!socket.rateLimiter.allow('presence_update')) return;
      const parsed = presenceUpdateSchema.safeParse(data);
      if (!parsed.success) return;
      const effectiveUserId = socket.userData.userId || socket.userData.guestId;
      const presence = await sessionManager.updatePresence(
        sessionId,
        effectiveUserId,
        parsed.data
      );

      socket.to(`session:${sessionId}`).emit('presence_update', {
        userId: effectiveUserId,
        guestId: socket.userData.guestId || null,
        userName: socket.userData.userName,
        presence
      });
    } catch (error) {
      console.error('[WS] Presence update error:', error);
    }
  });
}

/**
 * Register chat handlers
 */
function registerChatHandlers(io, socket) {
  const { sessionId, userId, isGuest } = socket.userData;

  // Session chat
  socket.on('chat_message', async (data) => {
    try {
      if (!socket.rateLimiter.allow('chat_message')) return;
      const parsed = chatMessageSchema.safeParse(data);
      if (!parsed.success) return;
      const message = await sessionChatService.sendMessage(
        sessionId,
        socket.userData,
        parsed.data.content,
        parsed.data.type
      );

      io.to(`session:${sessionId}`).emit('chat_message', message);
    } catch (error) {
      console.error('[WS] Chat message error:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Typing indicator
  socket.on('typing', (data) => {
    if (!socket.rateLimiter.allow('typing')) return;
    const parsed = typingSchema.safeParse(data);
    const isTyping = parsed.success ? parsed.data.isTyping : false;
    const indicator = sessionChatService.createTypingIndicator(
      socket.userData,
      isTyping
    );
    socket.to(`session:${sessionId}`).emit('user_typing', indicator);
  });

  // Global chat
  socket.on('join_global_chat', () => {
    if (userId && !isGuest) {
      globalChatService.joinChat(userId, socket);
      const history = globalChatService.getRecentHistory();
      socket.emit('global_chat_history', { messages: history });
      
      const notification = globalChatService.createUserJoinedNotification(socket.userData);
      socket.to('global_chat').emit('global_chat_user_joined', notification);
    }
  });

  socket.on('leave_global_chat', () => {
    if (userId && !isGuest) {
      globalChatService.leaveChat(userId, socket);
      const notification = globalChatService.createUserLeftNotification(socket.userData);
      socket.to('global_chat').emit('global_chat_user_left', notification);
    }
  });

  socket.on('global_chat_message', async (data) => {
    try {
      if (!socket.rateLimiter.allow('global_chat_message')) return;
      const parsed = globalChatMessageSchema.safeParse(data);
      if (!parsed.success) return;
      const message = globalChatService.sendMessage(socket.userData, parsed.data.content);
      io.to('global_chat').emit('global_chat_message', message);
    } catch (error) {
      console.error('[WS] Global chat message error:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Private chat
  socket.on('join_private_chat', () => {
    if (userId && !isGuest) {
      console.log(`[WS] User ${socket.userData.userName} joined private chat`);
    }
  });

  socket.on('private_message', async (data) => {
    try {
      if (!socket.rateLimiter.allow('private_message')) return;
      const parsed = privateMessageSchema.safeParse(data);
      if (!parsed.success) return;
      const result = await privateChatService.sendMessage(
        socket.userData,
        parsed.data.conversationId,
        parsed.data.content
      );

      const participantIds = privateChatService.getParticipantIds(result.conversation);
      participantIds.forEach(participantId => {
        io.to(`user:${participantId}`).emit('private_message', {
          ...result.message,
          conversationId: data.conversationId
        });
      });

      console.log(`[WS] Private message sent from ${socket.userData.userName} to conversation ${data.conversationId}`);
    } catch (error) {
      console.error('[WS] Private message error:', error);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('mark_message_read', async (data) => {
    try {
      if (userId && !isGuest) {
        const parsed = markMessageReadSchema.safeParse(data);
        if (!parsed.success) return;
        await privateChatService.markAsRead(parsed.data.messageId, userId);
      }
    } catch (error) {
      console.error('[WS] Mark message read error:', error);
    }
  });
}

/**
 * Register collaboration handlers
 */
function registerCollaborationHandlers(io, socket) {
  const { sessionId } = socket.userData;

  // Block operations
  socket.on('block_operation', async (data) => {
    try {
      if (!socket.rateLimiter.allow('block_operation')) return;
      const parsed = blockOperationSchema.safeParse(data);
      if (!parsed.success) return;
      const result = collaborationService.processBlockOperation(
        sessionId,
        socket.userData,
        parsed.data.operation,
        parsed.data.blockId,
        parsed.data.blockData
      );

      io.to(`session:${sessionId}`).emit('block_operation', result);
      socket.emit('operation_ack', { operation: data.operation, blockId: data.blockId });
    } catch (error) {
      console.error('[WS] Block operation error:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Selection changes
  socket.on('selection_change', (data) => {
    if (!socket.rateLimiter.allow('selection_change')) return;
    const parsed = selectionChangeSchema.safeParse(data);
    const selectedBlocks = parsed.success ? parsed.data.selectedBlocks : [];
    const result = collaborationService.processSelectionChange(
      socket.userData,
      selectedBlocks
    );
    socket.to(`session:${sessionId}`).emit('selection_change', result);
  });

  // Multiplayer game events
  socket.on('player_input', (data) => {
    try {
      if (!socket.rateLimiter.allow('player_input')) return;
      const parsed = playerInputSchema.safeParse(data);
      if (!parsed.success) return;
      const result = collaborationService.processPlayerInput(socket.userData, parsed.data);
      socket.to(`session:${sessionId}`).emit('player_input', result);
    } catch (error) {
      console.error('[WS] Player input error:', error);
    }
  });

  socket.on('game_event', async (data) => {
    try {
      if (!socket.rateLimiter.allow('game_event')) return;
      const parsed = gameEventSchema.safeParse(data);
      if (!parsed.success) return;
      const result = await collaborationService.processGameEvent(
        sessionId,
        socket.userData,
        parsed.data.type,
        parsed.data.eventData
      );
      io.to(`session:${sessionId}`).emit('game_event', result);
    } catch (error) {
      console.error('[WS] Game event error:', error);
    }
  });
}

/**
 * Register friends handlers
 */
function registerFriendsHandlers(io, socket) {
  const { userId, isGuest } = socket.userData;

  socket.on('friend_request_sent', async (data) => {
    try {
      const parsed = friendRequestSentSchema.safeParse(data);
      if (parsed.success) {
        const notification = friendsService.createFriendRequestNotification(
          userId,
          socket.userData.userName,
          parsed.data.receiverId
        );
        io.to(`user:${parsed.data.receiverId}`).emit('friend_request_received', notification);
      }
    } catch (error) {
      console.error('[WS] Friend request notification error:', error);
    }
  });

  socket.on('friend_request_accepted', async (data) => {
    try {
      const parsed = friendRequestAcceptedSchema.safeParse(data);
      if (parsed.success) {
        const notification = friendsService.createFriendAcceptedNotification(
          userId,
          socket.userData.userName,
          parsed.data.senderId
        );
        io.to(`user:${parsed.data.senderId}`).emit('friend_request_accepted', notification);
      }
    } catch (error) {
      console.error('[WS] Friend accept notification error:', error);
    }
  });

  socket.on('friend_removed', async (data) => {
    try {
      const parsed = friendRemovedSchema.safeParse(data);
      if (parsed.success) {
        const notification = friendsService.createFriendRemovedNotification(
          userId,
          socket.userData.userName,
          parsed.data.friendId
        );
        io.to(`user:${parsed.data.friendId}`).emit('friend_removed', notification);
      }
    } catch (error) {
      console.error('[WS] Friend removed notification error:', error);
    }
  });

  socket.on('get_online_friends', async () => {
    try {
      if (!userId || isGuest) return;
      
      const onlineFriends = await friendsService.getOnlineFriends(userId);
      socket.emit('online_friends_list', { friends: onlineFriends });
    } catch (error) {
      console.error('[WS] Get online friends error:', error);
    }
  });
}

/**
 * Register disconnect handler
 */
function registerDisconnectHandler(io, socket) {
  socket.on('disconnect', async (reason) => {
    console.log(`[WS] User ${socket.userData.userName} disconnected from session ${socket.userData.sessionId}: ${reason}`);
    
    try {
      const { userId, guestId, sessionId, isGuest } = socket.userData;
      const effectiveUserId = userId || guestId;

      // Remove from presence tracking
      if (userId && !isGuest) {
        presenceManager.removeUserSocket(userId, socket);
        
        // Notify friends if user is completely offline
        if (!presenceManager.isUserOnline(userId)) {
          await notifyFriendsStatus(io, socket.userData, false);
        }
      }

      // Leave global chat
      if (userId && !isGuest && globalChatService.isUserActive(userId)) {
        globalChatService.leaveChat(userId, socket);
        const notification = globalChatService.createUserLeftNotification(socket.userData);
        socket.to('global_chat').emit('global_chat_user_left', notification);
      }

      // Remove from session
      await sessionManager.removeParticipant(sessionId, socket.userData);

      // Notify others in session
      socket.to(`session:${sessionId}`).emit('participant_left', {
        userId: effectiveUserId,
        userName: socket.userData.userName,
        isGuest: isGuest
      });

    } catch (error) {
      console.error('[WS] Disconnect cleanup error:', error);
    }
  });
}

/**
 * Notify friends about user status change
 */
async function notifyFriendsStatus(io, userData, isOnline) {
  try {
    const friendIds = await friendsService.getFriendsToNotify(userData.userId);
    const notification = friendsService.createStatusChangeNotification(
      userData.userId,
      userData.userName,
      isOnline
    );
    
    friendIds.forEach(friendId => {
      io.to(`user:${friendId}`).emit('friend_status_changed', notification);
    });
  } catch (error) {
    console.error('[WS] Friend status notification error:', error);
  }
}
