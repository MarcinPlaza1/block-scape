import config from '../config/config.js';
import prisma from '../config/database.js';
import { logAudit } from '../utils/auth.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { parsePagination, formatPaginationResponse } from '../utils/helpers.js';

/**
 * Get global chat history (placeholder)
 */
export async function getGlobalChatHistory(req, res) {
  const { limit, offset } = parsePagination(req.query, {
    limit: config.pagination.defaultChatHistoryLimit
  });
  
  // For now, return empty array since chat history is stored in memory
  // In production, you might want to store this in database
  res.json({ 
    messages: [],
    hasMore: false,
    total: 0
  });
}

/**
 * Get online users in global chat
 */
export async function getOnlineUsers(req, res) {
  // Get all users who are currently online (have active sessions)
  const onlineUsers = await prisma.realtimeParticipant.findMany({
    where: {
      isOnline: true,
      userId: { not: null }
    },
    select: {
      userId: true,
      user: {
        select: {
          id: true,
          name: true,
          avatarUrl: true
        }
      }
    },
    distinct: ['userId']
  });
  
  const users = onlineUsers
    .filter(p => p.user) // Filter out null users
    .map(p => ({
      id: p.user.id,
      name: p.user.name,
      avatarUrl: p.user.avatarUrl
    }));
  
  res.json({ users });
}

/**
 * Get user's conversations
 */
export async function getConversations(req, res) {
  const conversations = await prisma.conversation.findMany({
    where: {
      participants: {
        some: { userId: req.auth.userId }
      }
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true }
          }
        }
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          content: true,
          senderId: true,
          createdAt: true,
          isRead: true
        }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });
  
  const formattedConversations = await Promise.all(
    conversations.map(async (conv) => {
      const otherParticipant = conv.participants.find(p => p.userId !== req.auth.userId);
      const lastMessage = conv.messages[0];
      
      // Count unread messages
      const unreadCount = await prisma.privateMessage.count({
        where: {
          conversationId: conv.id,
          senderId: { not: req.auth.userId },
          isRead: false
        }
      });
      
      return {
        id: conv.id,
        otherUser: otherParticipant?.user,
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          content: lastMessage.content,
          senderId: lastMessage.senderId,
          createdAt: lastMessage.createdAt,
          isRead: lastMessage.isRead
        } : null,
        updatedAt: conv.updatedAt,
        unreadCount
      };
    })
  );
  
  res.json({ conversations: formattedConversations });
}

/**
 * Create or get conversation with a friend
 */
export async function createConversation(req, res) {
  const { friendId } = req.body;
  
  if (friendId === req.auth.userId) {
    throw new ValidationError('Cannot start conversation with yourself');
  }
  
  // Check if users are friends
  const friendship = await prisma.friend.findFirst({
    where: {
      OR: [
        { userId: req.auth.userId, friendId },
        { userId: friendId, friendId: req.auth.userId }
      ]
    }
  });
  
  if (!friendship) {
    throw new ForbiddenError('Can only start conversations with friends');
  }
  
  // Check if conversation already exists
  let conversation = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: req.auth.userId } } },
        { participants: { some: { userId: friendId } } },
        { participants: { every: { userId: { in: [req.auth.userId, friendId] } } } }
      ]
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
    // Create new conversation
    conversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId: req.auth.userId },
            { userId: friendId }
          ]
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
  }
  
  const otherUser = conversation.participants.find(p => p.userId !== req.auth.userId)?.user;
  
  res.json({
    conversation: {
      id: conversation.id,
      otherUser,
      createdAt: conversation.createdAt
    }
  });
}

/**
 * Get messages in a conversation
 */
export async function getMessages(req, res) {
  const { id } = req.params;
  const { limit, offset } = parsePagination(req.query, {
    limit: config.pagination.defaultMessagesLimit
  });
  
  // Verify user is participant in this conversation
  const conversation = await prisma.conversation.findFirst({
    where: {
      id,
      participants: {
        some: { userId: req.auth.userId }
      }
    }
  });
  
  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }
  
  const messages = await prisma.privateMessage.findMany({
    where: { conversationId: id },
    include: {
      sender: {
        select: { id: true, name: true, avatarUrl: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset
  });
  
  // Mark messages as read
  await prisma.privateMessage.updateMany({
    where: {
      conversationId: id,
      senderId: { not: req.auth.userId },
      isRead: false
    },
    data: { isRead: true }
  });
  
  res.json({
    messages: messages.reverse(), // Return in chronological order
    hasMore: messages.length === limit
  });
}

/**
 * Send message in conversation
 */
export async function sendMessage(req, res) {
  const { id } = req.params;
  const { content, messageType = 'text' } = req.body;
  
  // Content validation is done by middleware
  
  // Verify user is participant in this conversation
  const conversation = await prisma.conversation.findFirst({
    where: {
      id,
      participants: {
        some: { userId: req.auth.userId }
      }
    }
  });
  
  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }
  
  const message = await prisma.privateMessage.create({
    data: {
      conversationId: id,
      senderId: req.auth.userId,
      content: content.trim(),
      messageType
    },
    include: {
      sender: {
        select: { id: true, name: true, avatarUrl: true }
      }
    }
  });
  
  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id },
    data: { updatedAt: new Date() }
  });
  
  await logAudit(req, 'chat.message.send', req.auth.userId, { 
    conversationId: id,
    messageId: message.id 
  });
  
  res.status(201).json({ message });
}

/**
 * Get unread message count
 */
export async function getUnreadCount(req, res) {
  const count = await prisma.privateMessage.count({
    where: {
      conversation: {
        participants: {
          some: { userId: req.auth.userId }
        }
      },
      senderId: { not: req.auth.userId },
      isRead: false
    }
  });
  
  res.json({ unreadCount: count });
}
