import { wsConfig } from '../../config/websocket.config.js';

/**
 * Handles global chat functionality
 */
export class GlobalChatService {
  constructor() {
    this.chatHistory = [];
    this.activeUsers = new Set();
  }

  /**
   * Join global chat
   */
  joinChat(userId, socket) {
    if (!userId) return false;
    
    socket.join('global_chat');
    this.activeUsers.add(userId);
    return true;
  }

  /**
   * Leave global chat
   */
  leaveChat(userId, socket) {
    if (!userId) return;
    
    socket.leave('global_chat');
    this.activeUsers.delete(userId);
  }

  /**
   * Send a message to global chat
   */
  sendMessage(userData, content) {
    // Validate
    if (!userData.userId || userData.isGuest) {
      throw new Error('Only registered users can send global messages');
    }

    if (!content || content.trim().length === 0) {
      throw new Error('Message content is required');
    }

    if (content.length > wsConfig.limits.maxMessageLength.global) {
      throw new Error(`Message too long. Maximum ${wsConfig.limits.maxMessageLength.global} characters allowed`);
    }

    // Create message
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: userData.userId,
      userName: userData.userName,
      userAvatar: null, // Could be fetched from user data
      content: content.trim(),
      timestamp: new Date().toISOString(),
      isSystem: false
    };

    // Add to history
    this.addToHistory(message);

    return message;
  }

  /**
   * Send a system message
   */
  sendSystemMessage(content) {
    const message = {
      id: `sys_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: null,
      userName: 'System',
      userAvatar: null,
      content,
      timestamp: new Date().toISOString(),
      isSystem: true
    };

    this.addToHistory(message);
    return message;
  }

  /**
   * Add message to history
   */
  addToHistory(message) {
    this.chatHistory.push(message);
    
    // Keep only last N messages
    if (this.chatHistory.length > wsConfig.limits.historySize.global) {
      this.chatHistory.splice(0, this.chatHistory.length - wsConfig.limits.historySize.global);
    }
  }

  /**
   * Get recent chat history
   */
  getRecentHistory(limit = wsConfig.limits.recentMessagesCount) {
    return this.chatHistory.slice(-limit);
  }

  /**
   * Get active users count
   */
  getActiveUsersCount() {
    return this.activeUsers.size;
  }

  /**
   * Check if user is in global chat
   */
  isUserActive(userId) {
    return this.activeUsers.has(userId);
  }

  /**
   * Create user joined notification
   */
  createUserJoinedNotification(userData) {
    return {
      userId: userData.userId,
      userName: userData.userName,
      timestamp: Date.now()
    };
  }

  /**
   * Create user left notification
   */
  createUserLeftNotification(userData) {
    return {
      userId: userData.userId,
      userName: userData.userName,
      timestamp: Date.now()
    };
  }
}

// Export singleton instance
export const globalChatService = new GlobalChatService();
