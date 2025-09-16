import { create } from 'zustand';
import type { Block } from '../../../../../types';

export interface PlayerStats {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  isGrounded: boolean;
  health: number;
  score: number;
}

export interface GameStats {
  startTime: number;
  elapsedTime: number;
  currentCheckpoint: number;
  totalCheckpoints: number;
  deaths: number;
  jumps: number;
  blocksCollected: number;
}

export interface PlayState {
  // Game state
  gameId: string | null;
  gameName: string;
  isPlaying: boolean;
  isPaused: boolean;
  isFinished: boolean;
  
  // Player
  playerStats: PlayerStats;
  
  // Game stats
  gameStats: GameStats;
  
  // World
  blocks: Block[];
  startPosition: { x: number; y: number; z: number } | null;
  checkpoints: Array<{ id: number; position: { x: number; y: number; z: number }; reached: boolean }>;
  collectibles: Array<{ id: string; position: { x: number; y: number; z: number }; collected: boolean }>;
  
  // Settings
  cameraMode: 'third-person' | 'first-person' | 'free';
  difficulty: 'easy' | 'normal' | 'hard';
  renderQuality: 'performance' | 'balanced' | 'quality';
  soundEnabled: boolean;
  musicEnabled: boolean;
  
  // Multiplayer
  isMultiplayer: boolean;
  players: Map<string, { name: string; position: { x: number; y: number; z: number }; color: string }>;
  
  // Actions
  setGameId: (id: string | null) => void;
  setGameName: (name: string) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  finishGame: () => void;
  resetGame: () => void;
  
  // Player actions
  updatePlayerStats: (stats: Partial<PlayerStats>) => void;
  respawnPlayer: () => void;
  
  // Game stats actions
  updateGameStats: (stats: Partial<GameStats>) => void;
  incrementDeaths: () => void;
  incrementJumps: () => void;
  
  // World actions
  loadBlocks: (blocks: Block[]) => void;
  setStartPosition: (position: { x: number; y: number; z: number }) => void;
  addCheckpoint: (checkpoint: { id: number; position: { x: number; y: number; z: number } }) => void;
  reachCheckpoint: (id: number) => void;
  addCollectible: (collectible: { id: string; position: { x: number; y: number; z: number } }) => void;
  collectItem: (id: string) => void;
  
  // Settings actions
  setCameraMode: (mode: PlayState['cameraMode']) => void;
  setDifficulty: (difficulty: PlayState['difficulty']) => void;
  setRenderQuality: (quality: PlayState['renderQuality']) => void;
  toggleSound: () => void;
  toggleMusic: () => void;
  
  // Multiplayer actions
  setMultiplayer: (enabled: boolean) => void;
  addPlayer: (id: string, player: { name: string; position: { x: number; y: number; z: number }; color: string }) => void;
  updatePlayer: (id: string, updates: Partial<{ name: string; position: { x: number; y: number; z: number }; color: string }>) => void;
  removePlayer: (id: string) => void;
  
  // Utility
  getCurrentCheckpointPosition: () => { x: number; y: number; z: number } | null;
  getProgress: () => number;
}

export const usePlayState = create<PlayState>((set, get) => ({
  // Initial state
  gameId: null,
  gameName: '',
  isPlaying: false,
  isPaused: false,
  isFinished: false,
  
  playerStats: {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    isGrounded: false,
    health: 100,
    score: 0,
  },
  
  gameStats: {
    startTime: 0,
    elapsedTime: 0,
    currentCheckpoint: 0,
    totalCheckpoints: 0,
    deaths: 0,
    jumps: 0,
    blocksCollected: 0,
  },
  
  blocks: [],
  startPosition: null,
  checkpoints: [],
  collectibles: [],
  
  cameraMode: 'third-person',
  difficulty: 'normal',
  renderQuality: 'balanced',
  soundEnabled: true,
  musicEnabled: true,
  
  isMultiplayer: false,
  players: new Map(),
  
  // Actions
  setGameId: (id) => set({ gameId: id }),
  setGameName: (name) => set({ gameName: name }),
  
  startGame: () => {
    set({
      isPlaying: true,
      isPaused: false,
      isFinished: false,
      gameStats: {
        ...get().gameStats,
        startTime: Date.now(),
        elapsedTime: 0,
        deaths: 0,
        jumps: 0,
        blocksCollected: 0,
      },
    });
  },
  
  pauseGame: () => set({ isPaused: true }),
  resumeGame: () => set({ isPaused: false }),
  
  finishGame: () => {
    const { gameStats } = get();
    set({
      isFinished: true,
      isPlaying: false,
      gameStats: {
        ...gameStats,
        elapsedTime: Date.now() - gameStats.startTime,
      },
    });
  },
  
  resetGame: () => {
    const { startPosition } = get();
    set({
      isPlaying: false,
      isPaused: false,
      isFinished: false,
      playerStats: {
        position: startPosition || { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        isGrounded: false,
        health: 100,
        score: 0,
      },
      gameStats: {
        startTime: 0,
        elapsedTime: 0,
        currentCheckpoint: 0,
        totalCheckpoints: get().checkpoints.length,
        deaths: 0,
        jumps: 0,
        blocksCollected: 0,
      },
      checkpoints: get().checkpoints.map(cp => ({ ...cp, reached: false })),
      collectibles: get().collectibles.map(c => ({ ...c, collected: false })),
    });
  },
  
  // Player actions
  updatePlayerStats: (stats) => {
    set((state) => ({
      playerStats: { ...state.playerStats, ...stats },
    }));
  },
  
  respawnPlayer: () => {
    const position = get().getCurrentCheckpointPosition() || get().startPosition || { x: 0, y: 0, z: 0 };
    set((state) => ({
      playerStats: {
        ...state.playerStats,
        position: { ...position },
        velocity: { x: 0, y: 0, z: 0 },
        health: 100,
      },
    }));
    get().incrementDeaths();
  },
  
  // Game stats actions
  updateGameStats: (stats) => {
    set((state) => ({
      gameStats: { ...state.gameStats, ...stats },
    }));
  },
  
  incrementDeaths: () => {
    set((state) => ({
      gameStats: {
        ...state.gameStats,
        deaths: state.gameStats.deaths + 1,
      },
    }));
  },
  
  incrementJumps: () => {
    set((state) => ({
      gameStats: {
        ...state.gameStats,
        jumps: state.gameStats.jumps + 1,
      },
    }));
  },
  
  // World actions
  loadBlocks: (blocks) => set({ blocks }),
  
  setStartPosition: (position) => {
    set({
      startPosition: position,
      playerStats: {
        ...get().playerStats,
        position: { ...position },
      },
    });
  },
  
  addCheckpoint: (checkpoint) => {
    set((state) => ({
      checkpoints: [...state.checkpoints, { ...checkpoint, reached: false }],
      gameStats: {
        ...state.gameStats,
        totalCheckpoints: state.checkpoints.length + 1,
      },
    }));
  },
  
  reachCheckpoint: (id) => {
    set((state) => ({
      checkpoints: state.checkpoints.map(cp => 
        cp.id === id ? { ...cp, reached: true } : cp
      ),
      gameStats: {
        ...state.gameStats,
        currentCheckpoint: Math.max(state.gameStats.currentCheckpoint, id),
      },
    }));
  },
  
  addCollectible: (collectible) => {
    set((state) => ({
      collectibles: [...state.collectibles, { ...collectible, collected: false }],
    }));
  },
  
  collectItem: (id) => {
    set((state) => ({
      collectibles: state.collectibles.map(c => 
        c.id === id ? { ...c, collected: true } : c
      ),
      gameStats: {
        ...state.gameStats,
        blocksCollected: state.gameStats.blocksCollected + 1,
      },
      playerStats: {
        ...state.playerStats,
        score: state.playerStats.score + 10,
      },
    }));
  },
  
  // Settings actions
  setCameraMode: (mode) => set({ cameraMode: mode }),
  setDifficulty: (difficulty) => set({ difficulty }),
  setRenderQuality: (quality) => set({ renderQuality: quality }),
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
  toggleMusic: () => set((state) => ({ musicEnabled: !state.musicEnabled })),
  
  // Multiplayer actions
  setMultiplayer: (enabled) => set({ isMultiplayer: enabled }),
  
  addPlayer: (id, player) => {
    set((state) => ({
      players: new Map(state.players).set(id, player),
    }));
  },
  
  updatePlayer: (id, updates) => {
    set((state) => {
      const players = new Map(state.players);
      const player = players.get(id);
      if (player) {
        players.set(id, { ...player, ...updates });
      }
      return { players };
    });
  },
  
  removePlayer: (id) => {
    set((state) => {
      const players = new Map(state.players);
      players.delete(id);
      return { players };
    });
  },
  
  // Utility
  getCurrentCheckpointPosition: () => {
    const { checkpoints, gameStats } = get();
    const currentCheckpoint = checkpoints.find(cp => cp.id === gameStats.currentCheckpoint);
    return currentCheckpoint?.position || null;
  },
  
  getProgress: () => {
    const { gameStats, collectibles } = get();
    const checkpointProgress = gameStats.totalCheckpoints > 0 
      ? gameStats.currentCheckpoint / gameStats.totalCheckpoints 
      : 0;
    const collectibleProgress = collectibles.length > 0
      ? collectibles.filter(c => c.collected).length / collectibles.length
      : 0;
    return (checkpointProgress + collectibleProgress) / 2;
  },
}));
