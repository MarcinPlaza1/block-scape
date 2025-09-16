// Centralized API service layer
// Abstracts away direct apiFetch calls and provides type-safe API methods

import { apiFetch } from '@/shared/api/client';
import type { UserProfile, ProfileUpdateData } from '@/types/profile';
import type { ProjectData } from '@/types/project';
import type { SkinListingRecord, SkinListingWithSkin, SkinRecord, SkinWithListings } from '@/types/skins';

// Authentication API methods
export class AuthService {
  static async login(email: string, password: string) {
    return await apiFetch<{ token: string; user: UserProfile }>(`/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  static async register(email: string, password: string, name?: string) {
    const displayName = name || email.split('@')[0] || 'User';
    return await apiFetch<{ token: string; user: UserProfile }>(`/auth/register`, {
      method: 'POST',
      body: JSON.stringify({ email, password, name: displayName }),
    });
  }

  static async logout() {
    return await apiFetch(`/auth/logout`, { method: 'POST' });
  }

  static async getMe() {
    return await apiFetch<{ user: UserProfile }>(`/users/me`);
  }

  static async updateProfile(data: ProfileUpdateData) {
    return await apiFetch<{ user: UserProfile }>(`/users/me`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  static async deleteAccount() {
    return await apiFetch(`/users/me`, { method: 'DELETE' });
  }
}

// Project/Game API methods
export class ProjectService {
  static async createProject(projectData: {
    name: string;
    blocks: any[];
    terrain?: any;
    thumbnail?: string;
    mode?: 'PARKOUR' | 'PVP' | 'RACE' | 'SANDBOX';
    modeConfig?: string;
  }) {
    return await apiFetch<{ game: { id: string; name: string } }>(`/games`, {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  }

  static async updateProject(
    projectId: string,
    projectData: {
      name?: string;
      blocks?: any[];
      terrain?: any;
      thumbnail?: string;
      published?: boolean;
      mode?: 'PARKOUR' | 'PVP' | 'RACE' | 'SANDBOX';
      modeConfig?: string;
    }
  ) {
    return await apiFetch<{ game: { id: string; name: string; published?: boolean } }>(
      `/games/${projectId}`,
      {
        method: 'PUT',
        body: JSON.stringify(projectData),
      }
    );
  }

  static async deleteProject(projectId: string) {
    return await apiFetch(`/games/${projectId}`, { method: 'DELETE' });
  }

  static async getProject(projectId: string) {
    return await apiFetch<{ game: ProjectData }>(`/games/${projectId}`);
  }

  static async getUserProjects() {
    return await apiFetch<{ games: ProjectData[] }>(`/games/user`);
  }

  static async getPublicProjects() {
    return await apiFetch<{ games: ProjectData[] }>(`/games/public`);
  }

  static async publishProject(projectId: string, published: boolean) {
    return this.updateProject(projectId, { published });
  }
}

// Skins API methods
export class SkinsService {
  static async createSkin(payload: { name: string; data: string; thumbnail?: string; published?: boolean }) {
    return await apiFetch<{ skin: SkinRecord }>(`/skins`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static async updateSkin(id: string, payload: { name?: string; data?: string; thumbnail?: string; published?: boolean }) {
    return await apiFetch<{ skin: SkinRecord }>(`/skins/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  static async deleteSkin(id: string) {
    return await apiFetch<{ ok: boolean }>(`/skins/${id}`, { method: 'DELETE' });
  }

  static async getMySkins() {
    return await apiFetch<{ skins: SkinWithListings[] }>(`/skins/user`);
  }

  static async getPublicSkins() {
    return await apiFetch<{ skins: SkinRecord[] }>(`/skins/public`);
  }

  static async createListing(id: string, payload: { price: number | string; currency?: string }) {
    return await apiFetch<{ listing: SkinListingRecord }>(`/skins/${id}/listings`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static async updateListing(skinId: string, listingId: string, payload: { price?: number | string; currency?: string }) {
    return await apiFetch<{ listing: SkinListingWithSkin }>(`/skins/${skinId}/listings/${listingId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  static async cancelListing(skinId: string, listingId: string) {
    return await apiFetch<{ listing: SkinListingWithSkin }>(`/skins/${skinId}/listings/${listingId}`, {
      method: 'DELETE',
    });
  }

  static async purchaseListing(skinId: string, listingId: string) {
    return await apiFetch<{ listing: SkinListingWithSkin; skin: SkinRecord }>(
      `/skins/${skinId}/listings/${listingId}/purchase`,
      { method: 'POST' }
    );
  }

  static async getListings() {
    return await apiFetch<{ listings: SkinListingWithSkin[] }>(`/skins/listings`);
  }
}
// Friends API methods
export class FriendsService {
  static async getFriends() {
    return await apiFetch(`/friends`);
  }

  static async sendFriendRequest(userId: string) {
    return await apiFetch(`/friends/request`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  static async acceptFriendRequest(requestId: string) {
    return await apiFetch(`/friends/accept`, {
      method: 'POST',
      body: JSON.stringify({ requestId }),
    });
  }

  static async rejectFriendRequest(requestId: string) {
    return await apiFetch(`/friends/reject`, {
      method: 'POST',
      body: JSON.stringify({ requestId }),
    });
  }

  static async removeFriend(friendId: string) {
    return await apiFetch(`/friends/${friendId}`, { method: 'DELETE' });
  }
}

// Chat API methods
export class ChatService {
  static async getMessages(recipientId?: string) {
    const endpoint = recipientId ? `/chat/messages/${recipientId}` : `/chat/messages`;
    return await apiFetch(endpoint);
  }

  static async sendMessage(content: string, recipientId?: string) {
    return await apiFetch(`/chat/send`, {
      method: 'POST',
      body: JSON.stringify({ content, recipientId }),
    });
  }

  static async markAsRead(messageId: string) {
    return await apiFetch(`/chat/read/${messageId}`, { method: 'POST' });
  }
}

// News API methods
export class NewsService {
  static async getNews() {
    return await apiFetch(`/news`);
  }

  static async getNewsItem(id: string) {
    return await apiFetch(`/news/${id}`);
  }
}




