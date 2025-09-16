import { presenceManager } from '../services/presence/PresenceManager.js';
import { globalChatService } from '../services/chat/GlobalChatService.js';
import { privateChatService } from '../services/chat/PrivateChatService.js';
import { friendsService } from '../services/friends/FriendsService.js';
import { globalChatMessageSchema, privateMessageSchema, markMessageReadSchema, friendRequestSentSchema, friendRequestAcceptedSchema, friendRemovedSchema } from '../validation/schemas.js';

/**
 * Connection handler for '/app' namespace.
 * Does NOT require realtime session. Handles global chat, private chat, friends.
 */
export function handleAppConnection(io, socket) {
  const { userId, userName } = socket.userData;

  // Presence tracking for app connections
  presenceManager.addUserSocket(userId, socket);
  presenceManager.joinUserRoom(userId, socket);

  // Register handlers
  registerGlobalChatHandlers(io, socket);
  registerPrivateChatHandlers(io, socket);
  registerFriendsHandlers(io, socket);
  registerDisconnectHandler(io, socket);
}

function registerGlobalChatHandlers(io, socket) {
  const { userId } = socket.userData;

  socket.on('join_global_chat', () => {
    if (globalChatService.joinChat(userId, socket)) {
      const history = globalChatService.getRecentHistory();
      socket.emit('global_chat_history', { messages: history });
      const notification = globalChatService.createUserJoinedNotification(socket.userData);
      socket.to('global_chat').emit('global_chat_user_joined', notification);
    }
  });

  socket.on('leave_global_chat', () => {
    globalChatService.leaveChat(userId, socket);
    const notification = globalChatService.createUserLeftNotification(socket.userData);
    socket.to('global_chat').emit('global_chat_user_left', notification);
  });

  socket.on('global_chat_message', (data) => {
    try {
      const parsed = globalChatMessageSchema.safeParse(data);
      if (!parsed.success) return;
      const message = globalChatService.sendMessage(socket.userData, parsed.data.content);
      io.to('global_chat').emit('global_chat_message', message);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
}

function registerPrivateChatHandlers(io, socket) {
  socket.on('join_private_chat', () => {
    // No-op placeholder for potential future room management
  });

  socket.on('private_message', async (data) => {
    try {
      const parsed = privateMessageSchema.safeParse(data);
      if (!parsed.success) return;
      const result = await privateChatService.sendMessage(
        socket.userData,
        parsed.data.conversationId,
        parsed.data.content
      );

      const participantIds = privateChatService.getParticipantIds(result.conversation);
      participantIds.forEach(participantId => {
        io.to(`user:${participantId}`).emit('private_message', {
          ...result.message,
          conversationId: data.conversationId
        });
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('mark_message_read', async (data) => {
    try {
      const parsed = markMessageReadSchema.safeParse(data);
      if (!parsed.success) return;
      await privateChatService.markAsRead(parsed.data.messageId, socket.userData.userId);
    } catch (error) {
      // Swallow errors to avoid crashing client
    }
  });
}

function registerFriendsHandlers(io, socket) {
  const { userId, userName } = socket.userData;

  socket.on('friend_request_sent', async (data) => {
    try {
      const parsed = friendRequestSentSchema.safeParse(data);
      if (parsed.success) {
        const notification = friendsService.createFriendRequestNotification(
          userId,
          userName,
          parsed.data.receiverId
        );
        io.to(`user:${parsed.data.receiverId}`).emit('friend_request_received', notification);
      }
    } catch {}
  });

  socket.on('friend_request_accepted', async (data) => {
    try {
      const parsed = friendRequestAcceptedSchema.safeParse(data);
      if (parsed.success) {
        const notification = friendsService.createFriendAcceptedNotification(
          userId,
          userName,
          parsed.data.senderId
        );
        io.to(`user:${parsed.data.senderId}`).emit('friend_request_accepted', notification);
      }
    } catch {}
  });

  socket.on('friend_removed', async (data) => {
    try {
      const parsed = friendRemovedSchema.safeParse(data);
      if (parsed.success) {
        const notification = friendsService.createFriendRemovedNotification(
          userId,
          userName,
          parsed.data.friendId
        );
        io.to(`user:${parsed.data.friendId}`).emit('friend_removed', notification);
      }
    } catch {}
  });

  socket.on('get_online_friends', async () => {
    try {
      const onlineFriends = await friendsService.getOnlineFriends(userId);
      socket.emit('online_friends_list', { friends: onlineFriends });
    } catch {}
  });
}

function registerDisconnectHandler(io, socket) {
  socket.on('disconnect', () => {
    const { userId } = socket.userData;
    presenceManager.removeUserSocket(userId, socket);
  });
}


