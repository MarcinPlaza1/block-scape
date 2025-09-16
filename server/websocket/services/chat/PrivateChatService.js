import prisma from '../../../config/database.js';
import { wsConfig } from '../../config/websocket.config.js';

/**
 * Handles private messaging functionality
 */
export class PrivateChatService {
  /**
   * Send a private message
   */
  async sendMessage(userData, conversationId, content) {
    // Validate user
    if (!userData.userId || userData.isGuest) {
      throw new Error('Only registered users can send private messages');
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      throw new Error('Message content is required');
    }

    if (content.length > wsConfig.limits.maxMessageLength.private) {
      throw new Error(`Message too long. Maximum ${wsConfig.limits.maxMessageLength.private} characters allowed`);
    }

    // Verify user is participant in this conversation
    const conversation = await this.verifyConversationAccess(conversationId, userData.userId);

    // Create message in database
    const message = await prisma.privateMessage.create({
      data: {
        conversationId,
        senderId: userData.userId,
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

    return {
      message,
      conversation
    };
  }

  /**
   * Verify user has access to conversation
   */
  async verifyConversationAccess(conversationId, userId) {
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
      throw new Error('Conversation not found or access denied');
    }

    return conversation;
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId, userId) {
    await prisma.privateMessage.updateMany({
      where: {
        id: messageId,
        senderId: { not: userId },
        isRead: false
      },
      data: { isRead: true }
    });
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(conversationId, userId, limit = 50) {
    // Verify access
    await this.verifyConversationAccess(conversationId, userId);

    const messages = await prisma.privateMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true }
        }
      }
    });

    return messages.reverse();
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(userId) {
    const count = await prisma.privateMessage.count({
      where: {
        conversation: {
          participants: {
            some: { userId }
          }
        },
        senderId: { not: userId },
        isRead: false
      }
    });

    return count;
  }

  /**
   * Create or get conversation between two users
   */
  async createOrGetConversation(userId1, userId2) {
    // Check if conversation already exists
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: userId1 } } },
          { participants: { some: { userId: userId2 } } }
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

    if (existingConversation) {
      return existingConversation;
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId: userId1 },
            { userId: userId2 }
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

    return conversation;
  }

  /**
   * Get participant IDs for a conversation
   */
  getParticipantIds(conversation) {
    return conversation.participants.map(p => p.userId);
  }
}

// Export singleton instance
export const privateChatService = new PrivateChatService();
