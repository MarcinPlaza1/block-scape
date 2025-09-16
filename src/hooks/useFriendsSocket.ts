import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from './use-toast';
import { getAuthToken } from '@/shared/api/client';

interface FriendNotification {
  senderId?: string;
  senderName?: string;
  accepterId?: string;
  accepterName?: string;
  removerId?: string;
  removerName?: string;
  userId?: string;
  userName?: string;
  isOnline?: boolean;
  timestamp: number;
}

interface UseFriendsSocketOptions {
  onFriendRequestReceived?: (notification: FriendNotification) => void;
  onFriendRequestAccepted?: (notification: FriendNotification) => void;
  onFriendRemoved?: (notification: FriendNotification) => void;
  onFriendStatusChanged?: (notification: FriendNotification) => void;
  onOnlineFriendsList?: (friends: any[]) => void;
}

export function useFriendsSocket(options: UseFriendsSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);

  const connect = useCallback(() => {
    const token = getAuthToken();
    if (!token) {
      console.log('[Friends Socket] No auth token, skipping connection');
      return;
    }

    if (isConnectedRef.current) {
      console.log('[Friends Socket] Already connected');
      return;
    }

    const baseUrl = import.meta.env.VITE_WS_URL || 'http://localhost:9000';
    
    console.log('[Friends Socket] Connecting to:', wsUrl);

    const socket = io(`${baseUrl}/app`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Connection events
    socket.on('connect', () => {
      console.log('[Friends Socket] Connected');
      isConnectedRef.current = true;
      
      // Request online friends list on connect
      socket.emit('get_online_friends');
    });

    socket.on('disconnect', (reason) => {
      console.log('[Friends Socket] Disconnected:', reason);
      isConnectedRef.current = false;
    });

    socket.on('connect_error', (error) => {
      console.error('[Friends Socket] Connection error:', error.message);
    });

    // Friend request events
    socket.on('friend_request_received', (data: FriendNotification) => {
      console.log('[Friends Socket] Friend request received:', data);
      
      toast({
        title: 'Nowe zaproszenie do znajomych',
        description: `${data.senderName} wysłał Ci zaproszenie do znajomych`,
      });
      
      if (options.onFriendRequestReceived) {
        options.onFriendRequestReceived(data);
      }
    });

    socket.on('friend_request_accepted', (data: FriendNotification) => {
      console.log('[Friends Socket] Friend request accepted:', data);
      
      toast({
        title: 'Zaproszenie przyjęte',
        description: `${data.accepterName} przyjął Twoje zaproszenie do znajomych`,
      });
      
      if (options.onFriendRequestAccepted) {
        options.onFriendRequestAccepted(data);
      }
    });

    socket.on('friend_removed', (data: FriendNotification) => {
      console.log('[Friends Socket] Friend removed:', data);
      
      toast({
        title: 'Znajomy usunięty',
        description: `${data.removerName} usunął Cię ze znajomych`,
        variant: 'destructive',
      });
      
      if (options.onFriendRemoved) {
        options.onFriendRemoved(data);
      }
    });

    socket.on('friend_status_changed', (data: FriendNotification) => {
      console.log('[Friends Socket] Friend status changed:', data);
      
      if (options.onFriendStatusChanged) {
        options.onFriendStatusChanged(data);
      }
    });

    socket.on('online_friends_list', (data: { friends: any[] }) => {
      console.log('[Friends Socket] Online friends list:', data);
      
      if (options.onOnlineFriendsList) {
        options.onOnlineFriendsList(data.friends);
      }
    });

    socketRef.current = socket;
    return socket;
  }, [options]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[Friends Socket] Disconnecting');
      socketRef.current.disconnect();
      socketRef.current = null;
      isConnectedRef.current = false;
    }
  }, []);

  const sendFriendRequest = useCallback((receiverId: string) => {
    if (socketRef.current && isConnectedRef.current) {
      socketRef.current.emit('friend_request_sent', { receiverId });
    }
  }, []);

  const acceptFriendRequest = useCallback((senderId: string) => {
    if (socketRef.current && isConnectedRef.current) {
      socketRef.current.emit('friend_request_accepted', { senderId });
    }
  }, []);

  const removeFriend = useCallback((friendId: string) => {
    if (socketRef.current && isConnectedRef.current) {
      socketRef.current.emit('friend_removed', { friendId });
    }
  }, []);

  const getOnlineFriends = useCallback(() => {
    if (socketRef.current && isConnectedRef.current) {
      socketRef.current.emit('get_online_friends');
    }
  }, []);

  useEffect(() => {
    const socket = connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected: isConnectedRef.current,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriend,
    getOnlineFriends,
  };
}
