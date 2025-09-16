/**
 * Manages user presence and socket connections
 */
export class PresenceManager {
  constructor() {
    // Track user sockets for notifications
    this.userSockets = new Map(); // userId -> Set of socket instances
  }

  /**
   * Add a socket for a user
   */
  addUserSocket(userId, socket) {
    if (!userId) return;

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socket);
  }

  /**
   * Remove a socket for a user
   */
  removeUserSocket(userId, socket) {
    if (!userId || !this.userSockets.has(userId)) return;

    this.userSockets.get(userId).delete(socket);
    if (this.userSockets.get(userId).size === 0) {
      this.userSockets.delete(userId);
    }
  }

  /**
   * Check if a user is online (has active sockets)
   */
  isUserOnline(userId) {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
  }

  /**
   * Get all sockets for a user
   */
  getUserSockets(userId) {
    return Array.from(this.userSockets.get(userId) || []);
  }

  /**
   * Get online status for multiple users
   */
  getOnlineUsers(userIds) {
    return userIds.filter(userId => this.isUserOnline(userId));
  }

  /**
   * Join user to their personal room
   */
  joinUserRoom(userId, socket) {
    if (!userId) return;
    socket.join(`user:${userId}`);
  }

  /**
   * Leave user room
   */
  leaveUserRoom(userId, socket) {
    if (!userId) return;
    socket.leave(`user:${userId}`);
  }

  /**
   * Get total online users count
   */
  getOnlineUsersCount() {
    return this.userSockets.size;
  }

  /**
   * Clear all presence data (for testing/reset)
   */
  clear() {
    this.userSockets.clear();
  }
}

// Export singleton instance
export const presenceManager = new PresenceManager();
