import { create } from 'zustand';
import type { BlockType } from '@/types/project';

// Inventory (hotbar) state and actions
export interface InventoryState {
  inventorySlots: Array<{ type: BlockType; color?: number } | null>;
  selectedInventorySlot: number; // 0-8
  lastUsedColorByType: Partial<Record<BlockType, number>>;
  
  setInventorySlot: (index: number, item: { type: BlockType; color?: number } | null) => void;
  selectInventorySlot: (index: number) => void;
  cycleInventorySlot: (direction: 1 | -1) => void;
  setLastUsedColorForType: (type: BlockType, color: number) => void;
}

// Inventory persistence
type InventoryPersisted = {
  slots: Array<{ type: BlockType; color?: number } | null>;
  selected: number;
};

function defaultInventorySlots(): InventoryPersisted['slots'] {
  return [
    { type: 'cube' as BlockType },
    { type: 'sphere' as BlockType },
    { type: 'cylinder' as BlockType },
    { type: 'ramp' as BlockType },
    { type: 'plate' as BlockType },
    { type: 'torus' as BlockType },
    { type: 'wedge' as BlockType },
    { type: 'start' as BlockType },
    { type: 'finish' as BlockType },
  ];
}

function readInventory(): InventoryPersisted {
  try {
    const raw = localStorage.getItem('sandbox-inventory');
    if (!raw) {
      return {
        slots: defaultInventorySlots(),
        selected: 0,
      };
    }
    const parsed = JSON.parse(raw) as Partial<InventoryPersisted>;
    const slots = Array.isArray(parsed.slots) && parsed.slots.length === 9
      ? (parsed.slots as InventoryPersisted['slots'])
      : defaultInventorySlots();
    const selected = typeof parsed.selected === 'number' ? Math.max(0, Math.min(8, parsed.selected)) : 0;
    return { slots, selected };
  } catch {
    return {
      slots: defaultInventorySlots(),
      selected: 0,
    };
  }
}

function writeInventory(inv: InventoryPersisted) {
  try {
    localStorage.setItem('sandbox-inventory', JSON.stringify(inv));
  } catch {}
}

// Last-used colors persistence
type LastColorsPersisted = Partial<Record<BlockType, number>>;

function readLastColors(): LastColorsPersisted {
  try {
    const raw = localStorage.getItem('sandbox-last-colors');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as any;
    const out: LastColorsPersisted = {};
    const keys = Object.keys(parsed || {});
    for (const k of keys) {
      const v = parsed[k];
      if (typeof v === 'number') (out as any)[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeLastColors(map: LastColorsPersisted) {
  try {
    localStorage.setItem('sandbox-last-colors', JSON.stringify(map || {}));
  } catch {}
}

export const useInventoryStore = create<InventoryState>((set, get) => {
  const initialInventory = readInventory();
  
  return {
    inventorySlots: initialInventory.slots,
    selectedInventorySlot: initialInventory.selected,
    lastUsedColorByType: readLastColors(),

    setInventorySlot: (index, item) => {
      const idx = Math.max(0, Math.min(8, Math.floor(index)));
      set((state) => {
        const next = state.inventorySlots.slice(0, 9);
        next[idx] = item ? { type: item.type, color: item.color } : null;
        writeInventory({ slots: next, selected: state.selectedInventorySlot });
        
        // Update last-used color if provided
        if (item?.color && typeof item.color === 'number') {
          const map = { ...(state.lastUsedColorByType || {}) } as Partial<Record<BlockType, number>>;
          map[item.type] = item.color;
          writeLastColors(map);
          return { inventorySlots: next, lastUsedColorByType: map };
        }
        return { inventorySlots: next };
      });
    },

    selectInventorySlot: (index) => {
      const idx = Math.max(0, Math.min(8, Math.floor(index)));
      set((state) => {
        writeInventory({ slots: state.inventorySlots, selected: idx });
        return { selectedInventorySlot: idx };
      });
    },

    cycleInventorySlot: (direction) => {
      const dir = direction === -1 ? -1 : 1;
      const current = get().selectedInventorySlot || 0;
      const next = (current + dir + 9) % 9;
      set((state) => {
        writeInventory({ slots: state.inventorySlots, selected: next });
        return { selectedInventorySlot: next };
      });
    },

    setLastUsedColorForType: (type, color) => {
      set((state) => {
        const map = { ...(state.lastUsedColorByType || {}) } as Partial<Record<BlockType, number>>;
        map[type] = color;
        writeLastColors(map);
        return { lastUsedColorByType: map };
      });
    },
  };
});
