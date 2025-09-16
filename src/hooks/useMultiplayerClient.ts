import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export interface Player {
  id: string;
  userId: string;
  userName: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  input: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    jump: boolean;
  };
  isGrounded: boolean;
  lastUpdate: number;
}

export interface GameEvent {
  type: 'start' | 'checkpoint' | 'finish' | 'hazard' | 'respawn';
  userId: string;
  userName: string;
  data?: any;
  timestamp: number;
}

export interface MultiplayerState {
  isConnected: boolean;
  isConnecting: boolean;
  sessionId: string | null;
  players: Record<string, Player>;
  myPlayerId: string | null;
  gameEvents: GameEvent[];
  error: string | null;
  ping: number;
}

interface UseMultiplayerClientOptions {
  gameId: string;
  onGameEvent?: (event: GameEvent) => void;
  onPlayerUpdate?: (players: Record<string, Player>) => void;
  onScoreSubmit?: (userId: string, timeMs: number) => void;
}

export const useMultiplayerClient = ({
  gameId,
  onGameEvent,
  onPlayerUpdate,
  onScoreSubmit
}: UseMultiplayerClientOptions) => {
  const { user, token } = useAuthStore();
  const [state, setState] = useState<MultiplayerState>({
    isConnected: false,
    isConnecting: false,
    sessionId: null,
    players: {},
    myPlayerId: null,
    gameEvents: [],
    error: null,
    ping: 0
  });

  const socketRef = useRef<Socket | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const inputBufferRef = useRef<any[]>([]);
  const lastInputSeqRef = useRef(0);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize multiplayer session
  const initializeSession = useCallback(async () => {
    if (!gameId) return;

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      let sessionToken: string;
      let playerId: string;
      let sessionId: string;

      if (user && token) {
        // Logged-in user flow
        // Create or get multiplayer session
        const sessionResponse = await apiFetch<{ session: any }>('/realtime/sessions', {
          method: 'POST',
          body: JSON.stringify({
            gameId,
            type: 'play',
            maxParticipants: 20
          })
        });

        sessionId = sessionResponse.session.id;

        // Join session for multiplayer
        const joinResponse = await apiFetch<{
          sessionToken: string;
          participant: any;
          session: any;
        }>(`/realtime/sessions/${sessionId}/join`, {
          method: 'POST',
          body: JSON.stringify({
            role: 'PLAYER'
          })
        });

        sessionToken = joinResponse.sessionToken;
        playerId = user.id;

      } else {
        // Guest flow
        try {
          const guestName = prompt('Enter your name for multiplayer (optional)') || 'Guest';
          
          const joinResponse = await fetch(`/api/realtime/games/${gameId}/join-play`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              guestName,
              asGuest: true
            })
          });

          if (!joinResponse.ok) {
            const errorData = await joinResponse.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to join as guest');
          }

          const guestData = await joinResponse.json();
          sessionToken = guestData.sessionToken;
          sessionId = guestData.session.id;
          playerId = guestData.participant.effectiveUserId || guestData.participant.id;

        } catch (guestError: any) {
          throw new Error(guestError.message || 'Could not join multiplayer session. Try logging in for full features.');
        }
      }

      sessionTokenRef.current = sessionToken;
      
      setState(prev => ({
        ...prev,
        sessionId,
        myPlayerId: playerId,
        isConnecting: false
      }));

      // Connect to WebSocket
      connectWebSocket(sessionId, sessionToken);

    } catch (error: any) {
      console.error('Failed to initialize multiplayer session:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to initialize multiplayer session',
        isConnecting: false
      }));
    }
  }, [user, token, gameId]);

  // Connect to WebSocket for multiplayer
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
      console.log('[Multiplayer] Connected to WebSocket');
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        error: null
      }));

      // Start ping monitoring
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      
      let pingStart = Date.now();
      pingIntervalRef.current = setInterval(() => {
        pingStart = Date.now();
        socket.emit('ping');
      }, 5000);

      socket.on('pong', () => {
        const ping = Date.now() - pingStart;
        setState(prev => ({ ...prev, ping }));
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('[Multiplayer] Disconnected:', reason);
      setState(prev => ({
        ...prev,
        isConnected: false,
        players: {} // Clear players on disconnect
      }));

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      // Auto-reconnect after delay
      if (reason !== 'io client disconnect') {
        setTimeout(() => {
          if (sessionTokenRef.current) {
            connectWebSocket(sessionId, sessionTokenRef.current);
          }
        }, 3000);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('[Multiplayer] Connection error:', error);
      setState(prev => ({
        ...prev,
        error: error.message,
        isConnecting: false,
        isConnected: false
      }));
    });

    // Session events
    socket.on('session_joined', (data) => {
      console.log('[Multiplayer] Session joined:', data);
      
      // Initialize players from participants
      const players: Record<string, Player> = {};
      if (data.participants) {
        data.participants.forEach((participant: any) => {
          if (participant.role === 'PLAYER') {
            players[participant.userId] = {
              id: participant.userId,
              userId: participant.userId,
              userName: participant.userName,
              position: { x: 0, y: 1, z: 0 },
              velocity: { x: 0, y: 0, z: 0 },
              input: {
                forward: false,
                backward: false,
                left: false,
                right: false,
                jump: false
              },
              isGrounded: true,
              lastUpdate: Date.now()
            };
          }
        });
      }

      setState(prev => ({ ...prev, players }));

      if (onPlayerUpdate) {
        onPlayerUpdate(players);
      }
    });

    socket.on('participant_joined', (participant) => {
      if (participant.role === 'PLAYER') {
        console.log('[Multiplayer] Player joined:', participant);
        
        const newPlayer: Player = {
          id: participant.userId,
          userId: participant.userId,
          userName: participant.userName,
          position: { x: 0, y: 1, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          input: {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false
          },
          isGrounded: true,
          lastUpdate: Date.now()
        };

        setState(prev => {
          const newPlayers = { ...prev.players, [participant.userId]: newPlayer };
          
          if (onPlayerUpdate) {
            onPlayerUpdate(newPlayers);
          }
          
          return { ...prev, players: newPlayers };
        });
      }
    });

    socket.on('participant_left', (data) => {
      console.log('[Multiplayer] Player left:', data);
      setState(prev => {
        const { [data.userId]: removed, ...remainingPlayers } = prev.players;
        
        if (onPlayerUpdate) {
          onPlayerUpdate(remainingPlayers);
        }
        
        return { ...prev, players: remainingPlayers };
      });
    });

    // Player input/movement events
    socket.on('player_input', (data) => {
      const { userId, input } = data;
      
      setState(prev => {
        if (prev.players[userId]) {
          const updatedPlayers = {
            ...prev.players,
            [userId]: {
              ...prev.players[userId],
              input,
              lastUpdate: Date.now()
            }
          };
          
          if (onPlayerUpdate) {
            onPlayerUpdate(updatedPlayers);
          }
          
          return { ...prev, players: updatedPlayers };
        }
        return prev;
      });
    });

    // Game events (checkpoints, finish, etc.)
    socket.on('game_event', (event: GameEvent) => {
      console.log('[Multiplayer] Game event:', event);
      
      setState(prev => ({
        ...prev,
        gameEvents: [...prev.gameEvents, event].slice(-50) // Keep last 50 events
      }));

      if (onGameEvent) {
        onGameEvent(event);
      }

      // Handle score submission for finish events
      if (event.type === 'finish' && event.data?.timeMs && onScoreSubmit) {
        onScoreSubmit(event.userId, event.data.timeMs);
      }
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('[Multiplayer] Socket error:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'WebSocket error'
      }));
    });

  }, [onGameEvent, onPlayerUpdate, onScoreSubmit]);

  // Send player input
  const sendInput = useCallback((input: Player['input']) => {
    if (!socketRef.current?.connected) return;

    lastInputSeqRef.current++;
    const inputData = {
      seq: lastInputSeqRef.current,
      input,
      timestamp: Date.now()
    };

    // Buffer input for client-side prediction
    inputBufferRef.current.push(inputData);
    if (inputBufferRef.current.length > 60) { // Keep last ~2 seconds at 30fps
      inputBufferRef.current.shift();
    }

    socketRef.current.emit('player_input', inputData);
  }, []);

  // Send game event
  const sendGameEvent = useCallback((type: GameEvent['type'], data?: any) => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit('game_event', {
      type,
      data,
      timestamp: Date.now()
    });
  }, []);

  // Update player position (for local player prediction)
  const updatePlayerPosition = useCallback((position: { x: number; y: number; z: number }, velocity?: { x: number; y: number; z: number }) => {
    if (!state.myPlayerId) return;

    setState(prev => {
      if (prev.players[prev.myPlayerId!]) {
        const updatedPlayers = {
          ...prev.players,
          [prev.myPlayerId!]: {
            ...prev.players[prev.myPlayerId!],
            position,
            velocity: velocity || prev.players[prev.myPlayerId!].velocity,
            lastUpdate: Date.now()
          }
        };
        
        if (onPlayerUpdate) {
          onPlayerUpdate(updatedPlayers);
        }
        
        return { ...prev, players: updatedPlayers };
      }
      return prev;
    });
  }, [state.myPlayerId, onPlayerUpdate]);

  // Initialize session on mount
  useEffect(() => {
    initializeSession();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [initializeSession]);

  // Get player by ID
  const getPlayer = useCallback((userId: string): Player | null => {
    return state.players[userId] || null;
  }, [state.players]);

  // Get my player
  const getMyPlayer = useCallback((): Player | null => {
    return state.myPlayerId ? getPlayer(state.myPlayerId) : null;
  }, [state.myPlayerId, getPlayer]);

  // Get all other players (excluding current user)
  const getOtherPlayers = useCallback((): Player[] => {
    return Object.values(state.players).filter(player => player.userId !== state.myPlayerId);
  }, [state.players, state.myPlayerId]);

  return {
    ...state,
    sendInput,
    sendGameEvent,
    updatePlayerPosition,
    getPlayer,
    getMyPlayer,
    getOtherPlayers,
    reconnect: () => initializeSession()
  };
};
