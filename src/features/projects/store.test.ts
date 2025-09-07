import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectStore } from '@/lib/projectStore';

// Helper to reset store between tests
function resetStore() {
  const { newProject } = useProjectStore.getState();
  newProject();
}

describe('useProjectStore regression', () => {
  beforeEach(() => {
    // JSDOM localStorage mock safety
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null);
    resetStore();
  });

  it('adds a block and schedules autosave', () => {
    const s = useProjectStore.getState();
    const block = { id: 'b1', type: 'cube' as const, position: { x: 1, y: 1, z: 1 } };
    s.addBlock(block as any);
    const state = useProjectStore.getState();
    expect(state.blocks.length).toBe(1);
    expect(state.blocks[0].id).toBe('b1');
  });

  it('undo and redo restore blocks arrays', () => {
    const s = useProjectStore.getState();
    const blockA = { id: 'a', type: 'cube' as const, position: { x: 0, y: 0, z: 0 } };
    const blockB = { id: 'b', type: 'sphere' as const, position: { x: 2, y: 0, z: 2 } };
    s.addBlock(blockA as any);
    s.addBlock(blockB as any);
    expect(useProjectStore.getState().blocks.map(b => b.id)).toEqual(['a','b']);

    s.undo();
    expect(useProjectStore.getState().blocks.map(b => b.id)).toEqual(['a']);

    s.redo();
    expect(useProjectStore.getState().blocks.map(b => b.id)).toEqual(['a','b']);
  });

  it('removes a block and clears selection when deleted', () => {
    const s = useProjectStore.getState();
    const block = { id: 'x', type: 'cube' as const, position: { x: 0, y: 0, z: 0 } };
    s.addBlock(block as any);
    s.setSelectedBlockId('x');
    s.removeBlock('x');
    const st = useProjectStore.getState();
    expect(st.blocks.length).toBe(0);
    expect(st.selectedBlockId).toBe(null);
  });

  it('duplicateBlock creates shifted copy and selects it', () => {
    const s = useProjectStore.getState();
    s.addBlock({ id: 'orig', type: 'cube' as const, position: { x: 1, y: 1, z: 1 } } as any);
    s.duplicateBlock('orig');
    const ids = useProjectStore.getState().blocks.map(b => b.id);
    expect(ids.length).toBe(2);
    expect(useProjectStore.getState().selectedBlockId).not.toBe('orig');
  });

  it('grid and snapping toggles persist settings', () => {
    const s = useProjectStore.getState();
    s.setGridVisible(false);
    s.setSnapEnabled(false);
    s.setSnapSize(2);
    const st = useProjectStore.getState();
    expect(st.gridVisible).toBe(false);
    expect(st.snapEnabled).toBe(false);
    expect(st.snapSize).toBe(2);
  });
});


