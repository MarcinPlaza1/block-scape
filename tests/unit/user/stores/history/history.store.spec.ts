import { describe, it, expect, beforeEach } from 'vitest';
import { useHistoryStore } from '@/features/projects/stores/history.store';
import type { Block } from '@/types/project';

function blk(id: string): Block {
  return { id, type: 'cube', position: { x: 0, y: 0, z: 0 } } as Block;
}

describe('useHistoryStore', () => {
  beforeEach(() => {
    const api = useHistoryStore.getState();
    api.clearHistory();
  });

  it('push, undo, redo flow', () => {
    const api = useHistoryStore.getState();
    // mimic typical flow: store previous states
    api.pushToHistory([]); // initial
    api.pushToHistory([blk('a')]); // after adding a
    expect(useHistoryStore.getState().canUndo()).toBe(true);

    // current is with a and b; undo should return previous (with a)
    const afterUndo = api.undo([blk('a'), blk('b')]);
    expect(afterUndo?.map(b => b.id)).toEqual(['a']);
    expect(useHistoryStore.getState().canRedo()).toBe(true);

    const afterRedo = api.redo([blk('a')]);
    expect(afterRedo?.map(b => b.id)).toEqual(['a', 'b']);
  });

  it('clearHistory resets canUndo/canRedo', () => {
    const api = useHistoryStore.getState();
    api.pushToHistory([blk('x')]);
    api.clearHistory();
    expect(api.canUndo()).toBe(false);
    expect(api.canRedo()).toBe(false);
  });
});


