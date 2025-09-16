import { create } from 'zustand';
import type { Block } from '@/types/project';

const MAX_HISTORY = 50;

// History management state and actions
export interface HistoryState {
  historyPast: Block[][];
  historyFuture: Block[][];
  
  pushToHistory: (blocks: Block[]) => void;
  undo: (currentBlocks: Block[]) => Block[] | null;
  redo: (currentBlocks: Block[]) => Block[] | null;
  clearHistory: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function snapshotBlocks(blocks: Block[]): Block[] {
  return (blocks || []).map(b => ({
    id: b.id,
    type: b.type,
    position: { ...b.position },
    name: (b as any).name,
    hidden: (b as any).hidden,
    locked: (b as any).locked,
    color: (b as any).color,
    group: (b as any).group,
    rotationY: (b as any).rotationY,
    rotationX: (b as any).rotationX,
    rotationZ: (b as any).rotationZ,
    scale: (b as any).scale,
    mechanic: (b as any).mechanic,
    mechanicPower: (b as any).mechanicPower,
  } as Block));
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  historyPast: [],
  historyFuture: [],

  pushToHistory: (blocks) => {
    set((state) => ({
      historyPast: (() => {
        const next = [...state.historyPast, snapshotBlocks(blocks)];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      })(),
      historyFuture: [], // Clear future when new action is performed
    }));
  },

  undo: (currentBlocks) => {
    const state = get();
    if (state.historyPast.length === 0) return null;
    
    const previous = state.historyPast[state.historyPast.length - 1];
    const newPast = state.historyPast.slice(0, -1);
    const current = snapshotBlocks(currentBlocks);
    
    set({
      historyPast: newPast,
      historyFuture: (() => {
        const h = [...state.historyFuture, current];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })(),
    });
    
    return snapshotBlocks(previous);
  },

  redo: (currentBlocks) => {
    const state = get();
    if (state.historyFuture.length === 0) return null;
    
    const next = state.historyFuture[state.historyFuture.length - 1];
    const newFuture = state.historyFuture.slice(0, -1);
    const current = snapshotBlocks(currentBlocks);
    
    set({
      historyPast: (() => {
        const h = [...state.historyPast, current];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })(),
      historyFuture: newFuture,
    });
    
    return snapshotBlocks(next);
  },

  clearHistory: () => {
    set({
      historyPast: [],
      historyFuture: [],
    });
  },

  canUndo: () => {
    return get().historyPast.length > 0;
  },

  canRedo: () => {
    return get().historyFuture.length > 0;
  },
}));
