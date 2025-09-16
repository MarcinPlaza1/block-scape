import { describe, it, expect, beforeEach } from 'vitest';
import { useInventoryStore } from '@/features/projects/stores/inventory.store';

describe('useInventoryStore extra', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('selectInventorySlot clamps to 0..8', () => {
    const s = useInventoryStore.getState();
    s.selectInventorySlot(99);
    expect(useInventoryStore.getState().selectedInventorySlot).toBe(8);
    s.selectInventorySlot(-5);
    expect(useInventoryStore.getState().selectedInventorySlot).toBe(0);
  });

  it('cycleInventorySlot wraps correctly', () => {
    const s = useInventoryStore.getState();
    s.selectInventorySlot(0);
    s.cycleInventorySlot(-1);
    expect(useInventoryStore.getState().selectedInventorySlot).toBe(8);
    s.cycleInventorySlot(1);
    expect(useInventoryStore.getState().selectedInventorySlot).toBe(0);
  });

  it('setLastUsedColorForType persists color map', () => {
    const s = useInventoryStore.getState();
    s.setLastUsedColorForType('cube' as any, 0x555555);
    expect(useInventoryStore.getState().lastUsedColorByType['cube']).toBe(0x555555);
    // Ensure it can be read back from localStorage on new store import
    expect(localStorage.getItem('sandbox-last-colors')).toBeTruthy();
  });
});


