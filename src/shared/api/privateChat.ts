import { apiFetch } from './client';

// Types
export interface Conversation {
  id: string;
  otherUser: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
    isRead: boolean;
  };
  updatedAt: string;
  unreadCount: number;
}

export interface PrivateMessage {
  id: string;
  content: string;
  senderId: string;
  messageType: string;
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
}

export interface OnlineFriend {
  id: string;
  name: string;
  avatarUrl?: string;
  isOnline: boolean;
  activity?: {
    sessionId: string;
    role: string;
  };
}

// Private Chat API
export const privateChatApi = {
  async getConversations(): Promise<{ conversations: Conversation[] }> {
    return apiFetch('/chat/conversations');
  },

  async createConversation(friendId: string): Promise<{ conversation: { id: string; otherUser: any; createdAt: string } }> {
    return apiFetch('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ friendId }),
    });
  },

  async getMessages(conversationId: string, limit = 50, offset = 0): Promise<{ messages: PrivateMessage[]; hasMore: boolean }> {
    return apiFetch(`/chat/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`);
  },

  async sendMessage(conversationId: string, content: string, messageType = 'text'): Promise<{ message: PrivateMessage }> {
    return apiFetch(`/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, messageType }),
    });
  },

  async getUnreadCount(): Promise<{ unreadCount: number }> {
    return apiFetch('/chat/unread-count');
  },

  async getFriends(): Promise<{ friends: OnlineFriend[] }> {
    return apiFetch('/friends');
  },

  async getOnlineStatus(): Promise<{ onlineFriends: Record<string, { isOnline: boolean; activity?: any }> }> {
    return apiFetch('/friends/online');
  },
};
