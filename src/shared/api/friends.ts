import { apiFetch } from './client';

// Types
export interface Friend {
  id: string;
  name: string;
  avatarUrl?: string;
  friendshipId: string;
  createdAt: string;
  isOnline: boolean;
}

export interface FriendRequest {
  id: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  message?: string;
  createdAt: string;
}

export interface OnlineStatus {
  isOnline: boolean;
  activity?: {
    gameId: string;
    type: string;
  };
}

// Friends API
export const friendsApi = {
  async getFriends(): Promise<{ friends: Friend[] }> {
    return apiFetch('/friends');
  },

  async getRequests(): Promise<{ sent: FriendRequest[]; received: FriendRequest[] }> {
    return apiFetch('/friends/requests');
  },

  async sendRequest(receiverId: string, message?: string): Promise<{ request: FriendRequest; message?: string; friendId?: string }> {
    return apiFetch('/friends/requests', {
      method: 'POST',
      body: JSON.stringify({ receiverId, message }),
    });
  },

  async searchUsers(query: string): Promise<{ users: Array<{ id: string; name: string; avatarUrl?: string }> }> {
    return apiFetch(`/friends/search?q=${encodeURIComponent(query)}`);
  },

  async acceptRequest(requestId: string): Promise<{ message: string }> {
    return apiFetch(`/friends/requests/${requestId}/accept`, {
      method: 'POST',
    });
  },

  async rejectRequest(requestId: string): Promise<{ message: string }> {
    return apiFetch(`/friends/requests/${requestId}/reject`, {
      method: 'POST',
    });
  },

  async cancelRequest(requestId: string): Promise<{ message: string }> {
    return apiFetch(`/friends/requests/${requestId}`, {
      method: 'DELETE',
    });
  },

  async removeFriend(friendId: string): Promise<{ message: string }> {
    return apiFetch(`/friends/${friendId}`, {
      method: 'DELETE',
    });
  },

  async getOnlineStatus(): Promise<{ onlineFriends: Record<string, OnlineStatus> }> {
    return apiFetch('/friends/online');
  },

  async getFriendsGames(params: { page?: number; limit?: number; q?: string; sort?: string } = {}): Promise<{ games: any[]; total: number; page: number; limit: number }>{
    const search = new URLSearchParams();
    if (params.page) search.set('page', String(params.page));
    if (params.limit) search.set('limit', String(params.limit));
    if (params.q) search.set('q', params.q);
    if (params.sort) search.set('sort', params.sort);
    return apiFetch(`/friends/games?${search.toString()}`);
  },
};
