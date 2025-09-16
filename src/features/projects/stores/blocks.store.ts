import { create } from 'zustand';
import type { Block, BlockType } from '@/types/project';

// Block management state and actions
export interface BlocksState {
  blocks: Block[];
  selectedBlockId: string | null;
  selectedBlockIds: string[]; // multi-select
  droppedBlock: { type: BlockType } | null;
  
  // Actions
  setBlocks: (blocks: Block[]) => void;
  addBlock: (block: Block) => void;
  addBlocks: (blocks: Block[]) => void;
  removeBlock: (id: string) => void;
  removeBlocks: (ids: string[]) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  duplicateBlock: (id: string) => void;
  clearBlocks: () => void;
  
  // Selection
  setSelectedBlockId: (id: string | null) => void;
  setSelectedBlockIds: (ids: string[]) => void;
  setDroppedBlock: (payload: { type: BlockType } | null) => void;
  
  // Block properties
  setBlockColor: (id: string, color: number) => void;
  setBlockPosition: (id: string, position: { x: number; y: number; z: number }) => void;
  setBlockRotationY: (id: string, rotationY: number) => void;
  setBlockRotationX: (id: string, rotationX: number) => void;
  setBlockRotationZ: (id: string, rotationZ: number) => void;
  setBlockScale: (id: string, scale: number) => void;
  setBlockHidden: (id: string, hidden: boolean) => void;
  setBlockLocked: (id: string, locked: boolean) => void;
  setBlockGroup: (id: string, group: string) => void;
  renameBlock: (id: string, name: string) => void;
  
  // Bulk operations
  paintBlocks: (ids: string[], color: number) => void;
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

// Helper to apply blocks to 3D scene
function applyBlocksToScene(blocks: Block[]) {
  try {
    const anyWindow: any = typeof window !== 'undefined' ? window : null;
    const blocksCopy = snapshotBlocks(blocks);
    anyWindow?.requestAnimationFrame?.(() => {
      try {
        anyWindow?.scene3D?.loadScene?.(blocksCopy);
      } catch {}
    });
  } catch {}
}

export const useBlocksStore = create<BlocksState>((set, get) => ({
  blocks: [],
  selectedBlockId: null,
  selectedBlockIds: [],
  droppedBlock: null,

  setBlocks: (blocks) => {
    const newBlocks = snapshotBlocks(blocks);
    set({ blocks: newBlocks });
    applyBlocksToScene(newBlocks);
  },

  addBlock: (block) => {
    set((state) => {
      const newBlocks = snapshotBlocks([...state.blocks, block]);
      applyBlocksToScene(newBlocks);
      return { blocks: newBlocks };
    });
  },

  addBlocks: (toAdd) => {
    set((state) => {
      const newBlocks = snapshotBlocks([...state.blocks, ...toAdd]);
      applyBlocksToScene(newBlocks);
      return { blocks: newBlocks };
    });
  },

  removeBlock: (id) => {
    set((state) => {
      const newBlocks = snapshotBlocks(state.blocks.filter(b => b.id !== id));
      applyBlocksToScene(newBlocks);
      return {
        blocks: newBlocks,
        selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
      };
    });
  },

  removeBlocks: (ids) => {
    const idSet = new Set(ids || []);
    set((state) => {
      const newBlocks = snapshotBlocks(state.blocks.filter(b => !idSet.has(b.id)));
      applyBlocksToScene(newBlocks);
      return {
        blocks: newBlocks,
        selectedBlockId: idSet.has(state.selectedBlockId || '') ? null : state.selectedBlockId,
        selectedBlockIds: state.selectedBlockIds.filter(x => !idSet.has(x)),
      };
    });
  },

  updateBlock: (id, updates) => {
    set((state) => {
      const newBlocks = snapshotBlocks(
        state.blocks.map(b => b.id === id ? { ...b, ...updates } as Block : b)
      );
      applyBlocksToScene(newBlocks);
      return { blocks: newBlocks };
    });
  },

  duplicateBlock: (id) => {
    set((state) => {
      const src = state.blocks.find(b => b.id === id);
      if (!src) return state;
      
      const copy: Block = {
        id: `${id}-copy-${Date.now()}`,
        type: src.type,
        position: { x: src.position.x + 1, y: src.position.y, z: src.position.z + 1 },
        name: src.name ? `${src.name} Copy` : undefined,
        hidden: false,
        locked: false,
        color: (src as any).color,
        group: (src as any).group,
        rotationY: (src as any).rotationY,
        rotationX: (src as any).rotationX,
        rotationZ: (src as any).rotationZ,
        scale: (src as any).scale,
      } as Block;
      
      const newBlocks = snapshotBlocks([...state.blocks, copy]);
      applyBlocksToScene(newBlocks);
      return {
        blocks: newBlocks,
        selectedBlockId: copy.id,
        selectedBlockIds: [copy.id],
      };
    });
  },

  clearBlocks: () => {
    set({ blocks: [] });
    applyBlocksToScene([]);
  },

  // Selection
  setSelectedBlockId: (id) => set({ selectedBlockId: id }),
  setSelectedBlockIds: (ids) => set({ selectedBlockIds: Array.from(new Set(ids)) }),
  setDroppedBlock: (payload) => set({ droppedBlock: payload }),

  // Block properties
  setBlockColor: (id, color) => {
    set((state) => {
      const newBlocks = snapshotBlocks(state.blocks.map(b => {
        if (b.id !== id) return b;
        // Prevent applying color to textured mechanic cubes
        if (['cube_bouncy','cube_ice','cube_conveyor'].includes((b as any).type)) return b;
        return { ...b, color } as Block;
      }));
      applyBlocksToScene(newBlocks);
      return { blocks: newBlocks };
    });
  },

  setBlockPosition: (id, position) => {
    get().updateBlock(id, { position });
  },

  setBlockRotationY: (id, rotationY) => {
    const clamped = Number.isFinite(rotationY) ? rotationY : 0;
    const normalized = ((clamped % 360) + 360) % 360; // 0..360
    get().updateBlock(id, { rotationY: normalized } as any);
  },

  setBlockRotationX: (id, rotationX) => {
    const clamped = Number.isFinite(rotationX) ? rotationX : 0;
    const normalized = ((clamped % 360) + 360) % 360;
    get().updateBlock(id, { rotationX: normalized } as any);
  },

  setBlockRotationZ: (id, rotationZ) => {
    const clamped = Number.isFinite(rotationZ) ? rotationZ : 0;
    const normalized = ((clamped % 360) + 360) % 360;
    get().updateBlock(id, { rotationZ: normalized } as any);
  },

  setBlockScale: (id, scale) => {
    const safe = Number.isFinite(scale) ? Math.max(0.1, Math.min(10, scale)) : 1;
    get().updateBlock(id, { scale: safe } as any);
  },

  setBlockHidden: (id, hidden) => {
    get().updateBlock(id, { hidden } as any);
  },

  setBlockLocked: (id, locked) => {
    get().updateBlock(id, { locked } as any);
  },

  setBlockGroup: (id, group) => {
    get().updateBlock(id, { group } as any);
  },

  renameBlock: (id, name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    get().updateBlock(id, { name: trimmed } as any);
  },

  // Bulk operations
  paintBlocks: (ids, color) => {
    const idSet = new Set(ids || []);
    set((state) => {
      const newBlocks = snapshotBlocks(
        state.blocks.map(b => idSet.has(b.id) ? ({ ...b, color } as Block) : b)
      );
      applyBlocksToScene(newBlocks);
      return { blocks: newBlocks };
    });
  },
}));
