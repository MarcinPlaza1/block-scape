import prisma from '../../../config/database.js';
import { presenceManager } from '../presence/PresenceManager.js';
import { sessionManager } from '../session/SessionManager.js';

/**
 * Handles friends system functionality
 */
export class FriendsService {
  /**
   * Create friend request notification data
   */
  createFriendRequestNotification(senderId, senderName, receiverId) {
    return {
      type: 'friend_request_sent',
      senderId,
      senderName,
      receiverId,
      timestamp: Date.now()
    };
  }

  /**
   * Create friend request accepted notification data
   */
  createFriendAcceptedNotification(accepterId, accepterName, senderId) {
    return {
      type: 'friend_request_accepted',
      accepterId,
      accepterName,
      senderId,
      timestamp: Date.now()
    };
  }

  /**
   * Create friend removed notification data
   */
  createFriendRemovedNotification(removerId, removerName, friendId) {
    return {
      type: 'friend_removed',
      removerId,
      removerName,
      friendId,
      timestamp: Date.now()
    };
  }

  /**
   * Get online friends for a user
   */
  async getOnlineFriends(userId) {
    if (!userId) return [];

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

    // Check which friends are online and get their activity
    const onlineFriends = [];
    
    for (const friendId of friendIds) {
      if (presenceManager.isUserOnline(friendId)) {
        // Get friend's current activity
        let activity = null;
        const userSessions = sessionManager.getUserSessions(friendId);
        
        if (userSessions.length > 0) {
          const sessionId = userSessions[0]; // Take first active session
          const sessionData = sessionManager.getSession(sessionId);
          
          if (sessionData) {
            const participant = sessionData.participants.get(friendId);
            if (participant) {
              activity = { 
                sessionId, 
                role: participant.role 
              };
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

    return onlineFriends;
  }

  /**
   * Notify friends about user status change
   */
  async getFriendsToNotify(userId) {
    if (!userId) return [];

    // Get user's friends from database
    const friendships = await prisma.friend.findMany({
      where: {
        OR: [
          { userId: userId },
          { friendId: userId }
        ]
      }
    });

    return friendships.map(f => 
      f.userId === userId ? f.friendId : f.userId
    );
  }

  /**
   * Create status change notification
   */
  createStatusChangeNotification(userId, userName, isOnline) {
    return {
      userId,
      userName,
      isOnline,
      timestamp: Date.now()
    };
  }

  /**
   * Get friend requests for a user
   */
  async getPendingFriendRequests(userId) {
    const requests = await prisma.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING'
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return requests;
  }

  /**
   * Check if two users are friends
   */
  async areFriends(userId1, userId2) {
    const friendship = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: userId1, friendId: userId2 },
          { userId: userId2, friendId: userId1 }
        ]
      }
    });

    return !!friendship;
  }
}

// Export singleton instance
export const friendsService = new FriendsService();
