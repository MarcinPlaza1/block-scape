import { describe, it, expect, beforeEach } from 'vitest';
import { useInventoryStore } from '@/features/projects/stores/inventory.store';

describe('useInventoryStore', () => {
  beforeEach(() => {
    // Reset persistent storage between tests
    localStorage.clear();
    const state = useInventoryStore.getState();
    // No direct clear API; re-create store by setting slots via setter
    state.selectInventorySlot(0);
  });

  it('selects and cycles inventory slots with wrap-around', () => {
    const api = useInventoryStore.getState();
    api.selectInventorySlot(8);
    expect(useInventoryStore.getState().selectedInventorySlot).toBe(8);
    api.cycleInventorySlot(1);
    expect(useInventoryStore.getState().selectedInventorySlot).toBe(0);
    api.cycleInventorySlot(-1);
    expect(useInventoryStore.getState().selectedInventorySlot).toBe(8);
  });

  it('sets inventory slot with color and updates lastUsedColorByType', () => {
    const api = useInventoryStore.getState();
    api.setInventorySlot(1, { type: 'cube', color: 0xabcdef });
    const s = useInventoryStore.getState();
    expect(s.inventorySlots[1]).toEqual({ type: 'cube', color: 0xabcdef });
    expect(s.lastUsedColorByType['cube']).toBe(0xabcdef);
  });
});


