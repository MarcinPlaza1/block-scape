import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from './config/database.js';

// Session token config (short-lived for WebSocket auth)
// Unify secret with REST JWT to avoid multiple secrets in the system
const SESSION_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || process.env.WS_SESSION_SECRET || 'dev-access-secret';
const SESSION_TOKEN_EXPIRY = '1h';

// In-memory storage for active sessions (v1 - simple implementation)
const activeSessions = new Map(); // sessionId -> { participants: Map, gameState: Object }
const userSessions = new Map();   // userId -> Set of sessionIds
const userSockets = new Map();    // userId -> Set of socket instances (for friend notifications)

// Global chat storage
const globalChatHistory = []; // Array of chat messages
const globalChatUsers = new Set(); // Set of user IDs in global chat

export function createWebSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:9000",
      credentials: true,
    },
    path: "/socket.io/",
    transports: ['websocket', 'polling']
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, SESSION_TOKEN_SECRET);
      const { userId, sessionId, role, isGuest, guestName } = decoded;

      // Verify session exists and user has access
      const session = await prisma.realtimeSession.findFirst({
        where: { 
          id: sessionId, 
          isActive: true 
        },
        include: {
          game: true,
          participants: isGuest ? {
            where: { 
              userId: null,
              guestName: guestName || null
            }
          } : {
            where: { userId: userId || null }
          }
        }
      });

      if (!session) {
        return next(new Error('Invalid or expired session'));
      }

      let participant;
      if (isGuest) {
        // For guests, find participant by guestName or create if needed
        participant = session.participants.find(p => p.guestName === guestName && p.userId === null);
        if (!participant) {
          return next(new Error('Guest participant not found'));
        }
      } else {
        // For logged-in users
        participant = session.participants[0];
        if (!participant) {
          return next(new Error('Not a participant of this session'));
        }
      }

      // Attach user data to socket
      socket.userId = isGuest ? null : userId;
      socket.guestId = isGuest ? userId : null; // For guests, userId contains the generated guestId
      socket.sessionId = sessionId;
      socket.participantId = participant.id;
      socket.role = participant.role;
      socket.userName = participant.user?.name || participant.guestName || 'Anonymous';
      socket.isGuest = isGuest || false;

      next();
    } catch (error) {
      next(new Error('Authentication failed: ' + error.message));
    }
  });

  // Connection handler
  io.on('connection', async (socket) => {
    const { userId, guestId, sessionId, participantId, role, userName, isGuest } = socket;
    const effectiveUserId = userId || guestId;
    
    console.log(`[WS] ${isGuest ? 'Guest' : 'User'} ${userName} (${effectiveUserId}) joined session ${sessionId} with role ${role}`);

    // Join room
    socket.join(`session:${sessionId}`);
    
    // Track user socket for friend notifications (only for logged-in users)
    if (userId && !isGuest) {
      socket.join(`user:${userId}`); // Join user-specific room for friend notifications
      
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId).add(socket);
    }
    
    // Initialize session in memory if needed
    if (!activeSessions.has(sessionId)) {
      activeSessions.set(sessionId, {
        participants: new Map(),
        gameState: {},
        chatHistory: []
      });
    }

    const sessionData = activeSessions.get(sessionId);
    
    // Add participant to active session
    sessionData.participants.set(effectiveUserId, {
      id: participantId,
      userId: userId,
      guestId: guestId,
      userName,
      role,
      socketId: socket.id,
      joinedAt: Date.now(),
      presence: { online: true },
      isOnline: true,
      isGuest: isGuest
    });

    // Track user sessions
    if (!userSessions.has(effectiveUserId)) {
      userSessions.set(effectiveUserId, new Set());
    }
    userSessions.get(effectiveUserId).add(sessionId);

    // Update participant status in database
    await prisma.realtimeParticipant.update({
      where: { id: participantId },
      data: { 
        isOnline: true,
        lastSeen: new Date()
      }
    });

    // Send initial data to joining user
    const participants = Array.from(sessionData.participants.values()).map(p => ({
      id: p.id,
      userId: p.userId,
      guestId: p.guestId,
      userName: p.userName,
      role: p.role,
      presence: p.presence,
      isOnline: p.isOnline,
      isGuest: p.isGuest
    }));

    socket.emit('session_joined', {
      sessionId,
      participants,
      gameState: sessionData.gameState
    });

    // Notify others about new participant
    socket.to(`session:${sessionId}`).emit('participant_joined', {
      id: participantId,
      userId: userId,
      guestId: guestId,
      userName,
      role,
      presence: { online: true },
      isGuest: isGuest
    });

    // Chat message handler
    socket.on('chat_message', async (data) => {
      try {
        const { content, type = 'text' } = data;
        
        if (!content || content.trim().length === 0) {
          return socket.emit('error', { message: 'Message content is required' });
        }

        // Save to database
        const message = await prisma.chatMessage.create({
          data: {
            sessionId,
            userId: userId || null,
            authorName: userName,
            content: content.trim(),
            type
          }
        });

        // Add to session history
        const chatMessage = {
          id: message.id,
          userId,
          authorName: userName,
          content: message.content,
          type: message.type,
          createdAt: message.createdAt.toISOString()
        };
        
        sessionData.chatHistory.push(chatMessage);
        
        // Keep only last 100 messages in memory
        if (sessionData.chatHistory.length > 100) {
          sessionData.chatHistory = sessionData.chatHistory.slice(-100);
        }

        // Broadcast to all participants
        io.to(`session:${sessionId}`).emit('chat_message', chatMessage);
        
      } catch (error) {
        console.error('[WS] Chat message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing', (data) => {
      socket.to(`session:${sessionId}`).emit('user_typing', {
        userId,
        userName,
        isTyping: data.isTyping
      });
    });

    // Presence/cursor updates (real-time editing)
    socket.on('presence_update', async (data) => {
      try {
        const participant = sessionData.participants.get(userId);
        if (participant) {
          participant.presence = { ...participant.presence, ...data };
          
          // Update database occasionally (throttled)
          if (Math.random() < 0.1) { // 10% chance to persist
            await prisma.realtimeParticipant.update({
              where: { id: participantId },
              data: { 
                presenceData: JSON.stringify(participant.presence),
                lastSeen: new Date()
              }
            });
          }
        }

        // Broadcast to others
        socket.to(`session:${sessionId}`).emit('presence_update', {
          userId,
          userName,
          presence: data
        });
      } catch (error) {
        console.error('[WS] Presence update error:', error);
      }
    });

    // Block operations (collaborative editing)
    socket.on('block_operation', async (data) => {
      try {
        const { operation, blockId, blockData } = data;
        
        // Check permissions
        if (role !== 'OWNER' && role !== 'EDITOR') {
          return socket.emit('error', { message: 'Insufficient permissions for editing' });
        }

        // Apply operation to game state
        let updatedState = { ...sessionData.gameState };
        
        switch (operation) {
          case 'add':
            updatedState.blocks = updatedState.blocks || {};
            updatedState.blocks[blockId] = {
              ...blockData,
              id: blockId,
              createdBy: userId,
              createdAt: Date.now()
            };
            break;
            
          case 'update':
            if (updatedState.blocks && updatedState.blocks[blockId]) {
              updatedState.blocks[blockId] = {
                ...updatedState.blocks[blockId],
                ...blockData,
                updatedBy: userId,
                updatedAt: Date.now()
              };
            }
            break;
            
          case 'delete':
            if (updatedState.blocks) {
              delete updatedState.blocks[blockId];
            }
            break;
        }

        sessionData.gameState = updatedState;

        // Broadcast operation to all participants
        io.to(`session:${sessionId}`).emit('block_operation', {
          operation,
          blockId,
          blockData,
          userId,
          userName,
          timestamp: Date.now()
        });

        // Acknowledge to sender
        socket.emit('operation_ack', { operation, blockId });

      } catch (error) {
        console.error('[WS] Block operation error:', error);
        socket.emit('error', { message: 'Operation failed' });
      }
    });

    // Selection changes
    socket.on('selection_change', (data) => {
      socket.to(`session:${sessionId}`).emit('selection_change', {
        userId,
        userName,
        selectedBlocks: data.selectedBlocks || []
      });
    });

    // Multiplayer game events (for play sessions)
    socket.on('player_input', (data) => {
      if (role === 'PLAYER') {
        socket.to(`session:${sessionId}`).emit('player_input', {
          userId,
          userName,
          input: data
        });
      }
    });

    socket.on('game_event', async (data) => {
      try {
        const { type, eventData } = data;
        
        // Broadcast game event
        io.to(`session:${sessionId}`).emit('game_event', {
          type,
          userId,
          userName,
          data: eventData,
          timestamp: Date.now()
        });

        // Handle special events
        if (type === 'finish' && eventData.timeMs) {
          // Save score to leaderboard
          const session = await prisma.realtimeSession.findUnique({
            where: { id: sessionId },
            select: { gameId: true }
          });

          if (session && userId) {
            await prisma.score.create({
              data: {
                userId,
                gameId: session.gameId,
                timeMs: eventData.timeMs
              }
            });
          }
        }
      } catch (error) {
        console.error('[WS] Game event error:', error);
      }
    });

    // ===== Friends System Events =====
    
    // Send friend request notification
    socket.on('friend_request_sent', async (data) => {
      try {
        const { receiverId } = data;
        if (receiverId) {
          // Notify the receiver if they're online
          io.to(`user:${receiverId}`).emit('friend_request_received', {
            senderId: userId,
            senderName: userName,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('[WS] Friend request notification error:', error);
      }
    });

    // Friend request accepted notification
    socket.on('friend_request_accepted', async (data) => {
      try {
        const { senderId } = data;
        if (senderId) {
          // Notify the original sender
          io.to(`user:${senderId}`).emit('friend_request_accepted', {
            accepterId: userId,
            accepterName: userName,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('[WS] Friend accept notification error:', error);
      }
    });

    // Friend removed notification
    socket.on('friend_removed', async (data) => {
      try {
        const { friendId } = data;
        if (friendId) {
          io.to(`user:${friendId}`).emit('friend_removed', {
            removerId: userId,
            removerName: userName,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('[WS] Friend removed notification error:', error);
      }
    });

    // Get online friends
    socket.on('get_online_friends', async () => {
      try {
        if (!userId || isGuest) return;

        // Get user's friends from database
        const friendships = await prisma.friend.findMany({
          where: {
            OR: [
              { userId: userId },
              { friendId: userId }
            ]
          }
        });

        const friendIds = friendships.map(f => 
          f.userId === userId ? f.friendId : f.userId
        );

        // Check which friends are online
        const onlineFriends = [];
        for (const friendId of friendIds) {
          if (userSockets.has(friendId) && userSockets.get(friendId).size > 0) {
            // Get friend's current activity
            let activity = null;
            for (const sessionId of (userSessions.get(friendId) || [])) {
              const session = activeSessions.get(sessionId);
              if (session) {
                const participant = session.participants.get(friendId);
                if (participant) {
                  activity = { sessionId, role: participant.role };
                  break;
                }
              }
            }
            
            onlineFriends.push({
              userId: friendId,
              isOnline: true,
              activity
            });
          }
        }

        socket.emit('online_friends_list', { friends: onlineFriends });

      } catch (error) {
        console.error('[WS] Get online friends error:', error);
      }
    });

    // Friend status update (when a friend comes online/offline)
    const notifyFriendsAboutStatus = async (isOnline) => {
      try {
        if (!userId || isGuest) return;

        // Get user's friends from database
        const friendships = await prisma.friend.findMany({
          where: {
            OR: [
              { userId: userId },
              { friendId: userId }
            ]
          }
        });

        const friendIds = friendships.map(f => 
          f.userId === userId ? f.friendId : f.userId
        );

        // Notify all online friends
        for (const friendId of friendIds) {
          io.to(`user:${friendId}`).emit('friend_status_changed', {
            userId: userId,
            userName: userName,
            isOnline: isOnline,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('[WS] Friend status notification error:', error);
      }
    };

    // Notify friends that user came online
    notifyFriendsAboutStatus(true);

    // ===== Global Chat Events =====
    
    // Join global chat
    socket.on('join_global_chat', () => {
      if (userId && !isGuest) {
        socket.join('global_chat');
        globalChatUsers.add(userId);
        
        // Send recent chat history
        const recentMessages = globalChatHistory.slice(-50); // Last 50 messages
        socket.emit('global_chat_history', { messages: recentMessages });
        
        // Notify others that user joined global chat
        socket.to('global_chat').emit('global_chat_user_joined', {
          userId,
          userName,
          timestamp: Date.now()
        });
      }
    });

    // Leave global chat
    socket.on('leave_global_chat', () => {
      if (userId && !isGuest) {
        socket.leave('global_chat');
        globalChatUsers.delete(userId);
        
        // Notify others that user left global chat
        socket.to('global_chat').emit('global_chat_user_left', {
          userId,
          userName,
          timestamp: Date.now()
        });
      }
    });

    // Global chat message
    socket.on('global_chat_message', async (data) => {
      try {
        if (!userId || isGuest) return;
        
        const { content } = data;
        if (!content || content.trim().length === 0) return;
        if (content.length > 500) return; // Limit message length

        const message = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          userName,
          userAvatar: null, // Could be fetched from user data
          content: content.trim(),
          timestamp: new Date().toISOString(),
          isSystem: false
        };

        // Add to history
        globalChatHistory.push(message);
        
        // Keep only last 1000 messages
        if (globalChatHistory.length > 1000) {
          globalChatHistory.splice(0, globalChatHistory.length - 1000);
        }

        // Broadcast to all users in global chat
        io.to('global_chat').emit('global_chat_message', message);
        
      } catch (error) {
        console.error('[WS] Global chat message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ===== Private Chat Events =====
    
    // Join private chat
    socket.on('join_private_chat', () => {
      if (userId && !isGuest) {
        socket.join(`user:${userId}`); // Join user-specific room for private messages
        console.log(`[WS] User ${userName} joined private chat`);
      }
    });

    // Send private message
    socket.on('private_message', async (data) => {
      try {
        if (!userId || isGuest) return;
        
        const { conversationId, content } = data;
        if (!conversationId || !content || content.trim().length === 0) return;
        if (content.length > 1000) return; // Limit message length

        // Verify user is participant in this conversation
        const conversation = await prisma.conversation.findFirst({
          where: {
            id: conversationId,
            participants: {
              some: { userId: userId }
            }
          },
          include: {
            participants: {
              include: {
                user: {
                  select: { id: true, name: true, avatarUrl: true }
                }
              }
            }
          }
        });

        if (!conversation) {
          return socket.emit('error', { message: 'Conversation not found' });
        }

        // Create message in database
        const message = await prisma.privateMessage.create({
          data: {
            conversationId,
            senderId: userId,
            content: content.trim(),
            messageType: 'text'
          },
          include: {
            sender: {
              select: { id: true, name: true, avatarUrl: true }
            }
          }
        });

        // Update conversation timestamp
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });

        // Send to all participants in the conversation
        conversation.participants.forEach(participant => {
          io.to(`user:${participant.userId}`).emit('private_message', {
            ...message,
            conversationId
          });
        });

        console.log(`[WS] Private message sent from ${userName} to conversation ${conversationId}`);
        
      } catch (error) {
        console.error('[WS] Private message error:', error);
        socket.emit('error', { message: 'Failed to send private message' });
      }
    });

    // Mark message as read
    socket.on('mark_message_read', async (data) => {
      try {
        if (!userId || isGuest) return;
        
        const { messageId } = data;
        if (!messageId) return;

        await prisma.privateMessage.updateMany({
          where: {
            id: messageId,
            senderId: { not: userId },
            isRead: false
          },
          data: { isRead: true }
        });

      } catch (error) {
        console.error('[WS] Mark message read error:', error);
      }
    });

    // Disconnect handler
    socket.on('disconnect', async (reason) => {
      console.log(`[WS] User ${userName} disconnected from session ${sessionId}: ${reason}`);
      
      try {
        // Remove from user sockets tracking
        if (userId && !isGuest && userSockets.has(userId)) {
          userSockets.get(userId).delete(socket);
          if (userSockets.get(userId).size === 0) {
            userSockets.delete(userId);
            // Notify friends that user went offline
            await notifyFriendsAboutStatus(false);
          }
        }

        // Remove from global chat
        if (userId && !isGuest) {
          socket.leave('global_chat');
          globalChatUsers.delete(userId);
          
          // Notify others that user left global chat
          socket.to('global_chat').emit('global_chat_user_left', {
            userId,
            userName,
            timestamp: Date.now()
          });
        }

        // Remove from active session
        if (sessionData.participants.has(effectiveUserId)) {
          sessionData.participants.delete(effectiveUserId);
        }

        // Update user sessions
        if (userSessions.has(effectiveUserId)) {
          userSessions.get(effectiveUserId).delete(sessionId);
          if (userSessions.get(effectiveUserId).size === 0) {
            userSessions.delete(effectiveUserId);
          }
        }

        // Update database
        await prisma.realtimeParticipant.update({
          where: { id: participantId },
          data: { 
            isOnline: false,
            lastSeen: new Date()
          }
        });

        // Notify others
        socket.to(`session:${sessionId}`).emit('participant_left', {
          userId: effectiveUserId,
          userName,
          isGuest: isGuest
        });

        // Clean up empty sessions
        if (sessionData.participants.size === 0) {
          activeSessions.delete(sessionId);
          
          // Mark session as inactive if no participants
          await prisma.realtimeSession.update({
            where: { id: sessionId },
            data: { isActive: false, closedAt: new Date() }
          });
        }

      } catch (error) {
        console.error('[WS] Disconnect cleanup error:', error);
      }
    });
  });

  return io;
}

// Utility function to generate session tokens
export function generateSessionToken(userId, sessionId, role, extra = {}) {
  return jwt.sign(
    { userId, sessionId, role, ...extra },
    SESSION_TOKEN_SECRET,
    { expiresIn: SESSION_TOKEN_EXPIRY }
  );
}

// Clean up inactive sessions periodically
setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
    
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
    console.error('[WS] Session cleanup error:', error);
  }
}, 5 * 60 * 1000); // Run every 5 minutes
