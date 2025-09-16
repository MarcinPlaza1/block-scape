import { describe, it, expect, beforeEach } from 'vitest';
import { useInventoryStore } from '@/features/projects/stores/inventory.store';

describe('useInventoryStore more', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('setInventorySlot persists item and updates selected unchanged', () => {
    const s = useInventoryStore.getState();
    const before = s.selectedInventorySlot;
    s.setInventorySlot(2, { type: 'cube', color: 0xabcdef });
    const st = useInventoryStore.getState();
    expect(st.inventorySlots[2]).toEqual({ type: 'cube', color: 0xabcdef });
    expect(st.selectedInventorySlot).toBe(before);
  });

  it('multi cycle wraps multiple steps', () => {
    const s = useInventoryStore.getState();
    s.selectInventorySlot(7);
    s.cycleInventorySlot(1); // 8
    s.cycleInventorySlot(1); // 0
    s.cycleInventorySlot(1); // 1
    expect(useInventoryStore.getState().selectedInventorySlot).toBe(1);
  });

  it('initialization reads defaults when no localStorage present', () => {
    const s = useInventoryStore.getState();
    expect(s.inventorySlots.length).toBe(9);
  });
});


