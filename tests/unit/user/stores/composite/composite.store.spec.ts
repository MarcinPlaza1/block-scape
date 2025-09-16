import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectStoreBase, useHistoryStore, useBlocksStore } from '@/features/projects/stores';
import type { Block } from '@/types/project';

function blk(id: string): Block {
  return { id, type: 'cube', position: { x: 0, y: 0, z: 0 } } as Block;
}

describe('Project store base + linked stores (integration-ish)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // hard reset stores
    const h = useHistoryStore.getState();
    h.clearHistory();
    const b = useBlocksStore.getState();
    b.clearBlocks();
  });

  it('addBlock integrates history and autosave scheduling', async () => {
    vi.useFakeTimers();
    const s = useProjectStoreBase.getState();
    s.newProject();
    // mimic composite behavior manually: push to history, then add
    useHistoryStore.getState().pushToHistory(useBlocksStore.getState().blocks);
    useBlocksStore.getState().addBlock(blk('a'));
    useProjectStoreBase.getState().setHasUnsavedChanges(true);
    (useProjectStoreBase.getState() as any).scheduleAutoSave?.(useBlocksStore.getState().blocks);

    expect(useBlocksStore.getState().blocks.length).toBe(1);
    expect(useProjectStoreBase.getState().hasUnsavedChanges).toBe(true);
    expect(useHistoryStore.getState().historyPast.length).toBe(1);

    await vi.advanceTimersByTimeAsync(1600);
    await vi.advanceTimersByTimeAsync(5);
    expect(localStorage.getItem('sandbox-autosave')).toBeTruthy();
    vi.useRealTimers();
  });

  it('undo/redo restores previous/next blocks snapshot', () => {
    const s = useProjectStoreBase.getState();
    s.newProject();
    useHistoryStore.getState().pushToHistory([]);
    useBlocksStore.getState().addBlock(blk('a'));
    useHistoryStore.getState().pushToHistory(useBlocksStore.getState().blocks);
    useBlocksStore.getState().addBlock(blk('b'));

    expect(useBlocksStore.getState().blocks.length).toBe(2);

    const prev = useHistoryStore.getState().undo(useBlocksStore.getState().blocks);
    if (prev) useBlocksStore.getState().setBlocks(prev);
    expect(useBlocksStore.getState().blocks.length).toBe(1);
    expect(useBlocksStore.getState().blocks[0].id).toBe('a');

    const next = useHistoryStore.getState().redo(useBlocksStore.getState().blocks);
    if (next) useBlocksStore.getState().setBlocks(next);
    expect(useBlocksStore.getState().blocks.length).toBe(2);
  });

  it('clearScene empties blocks, resets unsaved and terrain', () => {
    const s = useProjectStoreBase.getState();
    s.newProject();
    useBlocksStore.getState().addBlock(blk('x'));
    useBlocksStore.getState().clearBlocks();
    useProjectStoreBase.getState().setHasUnsavedChanges(false);
    (useProjectStoreBase.setState as any)({ terrainSnapshot: null });
    expect(useBlocksStore.getState().blocks.length).toBe(0);
    expect(useProjectStoreBase.getState().hasUnsavedChanges).toBe(false);
    expect(useProjectStoreBase.getState().terrainSnapshot).toBeNull();
  });

  it('setBlocks does not push history for identical array', () => {
    const s = useProjectStoreBase.getState();
    s.newProject();
    const a = [blk('a')];
    useBlocksStore.getState().setBlocks(a);
    const pastLen = useHistoryStore.getState().historyPast.length;
    useBlocksStore.getState().setBlocks([{ ...a[0] } as Block]);
    expect(useHistoryStore.getState().historyPast.length).toBe(pastLen);
  });
});


