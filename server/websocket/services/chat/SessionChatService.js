import prisma from '../../../config/database.js';
import { wsConfig } from '../../config/websocket.config.js';
import { sessionManager } from '../session/SessionManager.js';

/**
 * Handles chat functionality within sessions
 */
export class SessionChatService {
  /**
   * Send a chat message in a session
   */
  async sendMessage(sessionId, userData, content, type = 'text') {
    // Validate content
    if (!content || content.trim().length === 0) {
      throw new Error('Message content is required');
    }

    if (content.length > wsConfig.limits.maxMessageLength.session) {
      throw new Error(`Message too long. Maximum ${wsConfig.limits.maxMessageLength.session} characters allowed`);
    }

    // Save to database
    const message = await prisma.chatMessage.create({
      data: {
        sessionId,
        userId: userData.userId || null,
        authorName: userData.userName,
        content: content.trim(),
        type
      }
    });

    // Create message object
    const chatMessage = {
      id: message.id,
      userId: userData.userId,
      authorName: userData.userName,
      content: message.content,
      type: message.type,
      createdAt: message.createdAt.toISOString()
    };
    
    // Add to session history
    this.addToHistory(sessionId, chatMessage);

    return chatMessage;
  }

  /**
   * Add message to session history
   */
  addToHistory(sessionId, message) {
    const sessionData = sessionManager.getSession(sessionId);
    if (!sessionData) return;

    sessionData.chatHistory.push(message);
    
    // Keep only last N messages in memory
    if (sessionData.chatHistory.length > wsConfig.limits.historySize.session) {
      sessionData.chatHistory = sessionData.chatHistory.slice(-wsConfig.limits.historySize.session);
    }
  }

  /**
   * Get chat history for a session
   */
  async getHistory(sessionId, limit = 50) {
    const sessionData = sessionManager.getSession(sessionId);
    
    // If session is active, return from memory
    if (sessionData && sessionData.chatHistory.length > 0) {
      return sessionData.chatHistory.slice(-limit);
    }

    // Otherwise fetch from database
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        authorName: true,
        content: true,
        type: true,
        createdAt: true
      }
    });

    return messages.reverse().map(msg => ({
      ...msg,
      createdAt: msg.createdAt.toISOString()
    }));
  }

  /**
   * Handle typing indicator
   */
  createTypingIndicator(userData, isTyping) {
    return {
      userId: userData.userId,
      userName: userData.userName,
      isTyping
    };
  }
}

// Export singleton instance
export const sessionChatService = new SessionChatService();
