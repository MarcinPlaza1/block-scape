import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export interface CollabParticipant {
  id: string;
  userId: string;
  guestId?: string;
  userName: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER' | 'PLAYER';
  presence: {
    online: boolean;
    position?: { x: number; y: number; z: number };
    camera?: { x: number; y: number; z: number };
    selectedBlocks?: string[];
    cursor?: { x: number; y: number; z: number };
  };
  isOnline: boolean;
}

export interface ChatMessage {
  id: string;
  userId?: string;
  authorName: string;
  content: string;
  type: 'text' | 'system' | 'join' | 'leave';
  createdAt: string;
  user?: {
    id: string;
    avatarUrl?: string;
  };
}

export interface BlockOperation {
  operation: 'add' | 'update' | 'delete';
  blockId: string;
  blockData?: any;
  userId: string;
  userName: string;
  timestamp: number;
}

export interface CollabClientState {
  isConnected: boolean;
  isConnecting: boolean;
  sessionId: string | null;
  participants: CollabParticipant[];
  chatMessages: ChatMessage[];
  error: string | null;
  gameState: any;
}

interface UseCollabClientOptions {
  gameId: string;
  sessionType: 'build' | 'play';
  onBlockOperation?: (operation: BlockOperation) => void;
  onGameStateUpdate?: (state: any) => void;
  onParticipantUpdate?: (participants: CollabParticipant[]) => void;
  onChatMessage?: (message: ChatMessage) => void;
}

export const useCollabClient = ({
  gameId,
  sessionType,
  onBlockOperation,
  onGameStateUpdate,
  onParticipantUpdate,
  onChatMessage
}: UseCollabClientOptions) => {
  const { user, token } = useAuthStore();
  const [state, setState] = useState<CollabClientState>({
    isConnected: false,
    isConnecting: false,
    sessionId: null,
    participants: [],
    chatMessages: [],
    error: null,
    gameState: {}
  });

  const socketRef = useRef<Socket | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize session and connect to WebSocket
  const initializeSession = useCallback(async () => {
    if (!user || !token || !gameId) return;

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Create or get existing session
      const sessionResponse = await apiFetch<{ session: any }>('/realtime/sessions', {
        method: 'POST',
        body: JSON.stringify({
          gameId,
          type: sessionType,
          maxParticipants: sessionType === 'build' ? 5 : 20
        })
      });

      const sessionId = sessionResponse.session.id;

      // Join session to get WebSocket token
      const joinResponse = await apiFetch<{
        sessionToken: string;
        participant: any;
        session: any;
      }>(`/realtime/sessions/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify({
          role: sessionType === 'build' ? 'EDITOR' : 'PLAYER'
        })
      });

      sessionTokenRef.current = joinResponse.sessionToken;
      
      setState(prev => ({
        ...prev,
        sessionId,
        isConnecting: false
      }));

      // Connect to WebSocket
      connectWebSocket(sessionId, joinResponse.sessionToken);

    } catch (error: any) {
      console.error('Failed to initialize session:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to initialize session',
        isConnecting: false
      }));
    }
  }, [user, token, gameId, sessionType]);

  // Connect to WebSocket
  const connectWebSocket = useCallback((sessionId: string, sessionToken: string) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const baseUrl = import.meta.env.VITE_WS_URL || 'http://localhost:9000';
    const socket = io(`${baseUrl}/realtime`, {
      transports: ['websocket', 'polling'],
      auth: {
        token: sessionToken
      },
      forceNew: true
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('[Collab] Connected to WebSocket');
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        error: null
      }));
    });

    socket.on('disconnect', (reason) => {
      console.log('[Collab] Disconnected:', reason);
      setState(prev => ({
        ...prev,
        isConnected: false
      }));

      // Auto-reconnect after delay (except for manual disconnect)
      if (reason !== 'io client disconnect') {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (sessionTokenRef.current) {
            connectWebSocket(sessionId, sessionTokenRef.current);
          }
        }, 3000);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('[Collab] Connection error:', error);
      setState(prev => ({
        ...prev,
        error: error.message,
        isConnecting: false,
        isConnected: false
      }));
    });

    // Session events
    socket.on('session_joined', (data) => {
      console.log('[Collab] Session joined:', data);
      setState(prev => ({
        ...prev,
        participants: data.participants || [],
        gameState: data.gameState || {}
      }));

      if (onGameStateUpdate) {
        onGameStateUpdate(data.gameState || {});
      }

      if (onParticipantUpdate) {
        onParticipantUpdate(data.participants || []);
      }
    });

    socket.on('participant_joined', (participant) => {
      console.log('[Collab] Participant joined:', participant);
      setState(prev => {
        const newParticipants = [
          ...prev.participants.filter(p => {
            const existingId = (p as any).userId || (p as any).guestId;
            const incomingId = (participant as any).userId || (participant as any).guestId;
            return existingId !== incomingId;
          }),
          participant
        ];
        
        if (onParticipantUpdate) {
          onParticipantUpdate(newParticipants);
        }
        
        return { ...prev, participants: newParticipants };
      });
    });

    socket.on('participant_left', (data) => {
      console.log('[Collab] Participant left:', data);
      setState(prev => {
        const newParticipants = prev.participants.filter(p => {
          const existingId = (p as any).userId || (p as any).guestId;
          const leavingId = (data as any).userId || (data as any).guestId;
          return existingId !== leavingId;
        });
        
        if (onParticipantUpdate) {
          onParticipantUpdate(newParticipants);
        }
        
        return { ...prev, participants: newParticipants };
      });
    });

    socket.on('presence_update', (data) => {
      setState(prev => {
        const newParticipants = prev.participants.map(p =>
          ((p as any).userId || (p as any).guestId) === ((data as any).userId || (data as any).guestId)
            ? { ...p, presence: { ...p.presence, ...data.presence } }
            : p
        );
        
        if (onParticipantUpdate) {
          onParticipantUpdate(newParticipants);
        }
        
        return { ...prev, participants: newParticipants };
      });
    });

    // Block operations (collaborative editing)
    socket.on('block_operation', (operation: BlockOperation) => {
      console.log('[Collab] Block operation:', operation);
      if (onBlockOperation) {
        onBlockOperation(operation);
      }
    });

    socket.on('operation_ack', (data) => {
      console.log('[Collab] Operation acknowledged:', data);
    });

    socket.on('selection_change', (data) => {
      setState(prev => {
        const newParticipants = prev.participants.map(p =>
          p.userId === data.userId
            ? { ...p, presence: { ...p.presence, selectedBlocks: data.selectedBlocks } }
            : p
        );
        
        if (onParticipantUpdate) {
          onParticipantUpdate(newParticipants);
        }
        
        return { ...prev, participants: newParticipants };
      });
    });

    // Chat events
    socket.on('chat_message', (message: ChatMessage) => {
      console.log('[Collab] Chat message:', message);
      setState(prev => ({
        ...prev,
        chatMessages: [...prev.chatMessages, message].slice(-100) // Keep last 100 messages
      }));

      if (onChatMessage) {
        onChatMessage(message);
      }
    });

    socket.on('user_typing', (data) => {
      // Handle typing indicators
      console.log('[Collab] User typing:', data);
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('[Collab] Socket error:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'WebSocket error'
      }));
    });

  }, [onBlockOperation, onGameStateUpdate, onParticipantUpdate, onChatMessage]);

  // Public methods
  const sendBlockOperation = useCallback((operation: 'add' | 'update' | 'delete', blockId: string, blockData?: any) => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit('block_operation', {
      operation,
      blockId,
      blockData
    });
  }, []);

  const updatePresence = useCallback((presence: Partial<CollabParticipant['presence']>) => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit('presence_update', presence);
  }, []);

  // Emit current game activity for friends presence once connected
  useEffect(() => {
    if (!socketRef.current?.connected) return;
    try {
      socketRef.current.emit('presence_update', { activity: { gameId, type: sessionType } });
    } catch {}
  }, [gameId, sessionType, state.isConnected]);

  const sendChatMessage = useCallback((content: string, type: string = 'text') => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit('chat_message', {
      content,
      type
    });
  }, []);

  const updateSelection = useCallback((selectedBlocks: string[]) => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit('selection_change', {
      selectedBlocks
    });
  }, []);

  const setTyping = useCallback((isTyping: boolean) => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit('typing', { isTyping });
  }, []);

  // Load chat history
  const loadChatHistory = useCallback(async (cursor?: string) => {
    if (!state.sessionId) return;

    try {
      const response = await apiFetch<{
        messages: ChatMessage[];
        hasMore: boolean;
      }>(`/realtime/sessions/${state.sessionId}/chat?${cursor ? `cursor=${cursor}` : ''}`);

      setState(prev => ({
        ...prev,
        chatMessages: cursor 
          ? [...response.messages, ...prev.chatMessages]
          : response.messages
      }));

      return response.hasMore;
    } catch (error) {
      console.error('Failed to load chat history:', error);
      return false;
    }
  }, [state.sessionId]);

  // Initialize session on mount
  useEffect(() => {
    initializeSession();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [initializeSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return {
    ...state,
    sendBlockOperation,
    updatePresence,
    sendChatMessage,
    updateSelection,
    setTyping,
    loadChatHistory,
    reconnect: () => initializeSession()
  };
};
