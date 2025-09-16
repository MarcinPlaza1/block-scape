import { describe, it, expect, beforeEach } from 'vitest';
import { useHistoryStore } from '@/features/projects/stores/history.store';

describe('useHistoryStore extra', () => {
  beforeEach(() => {
    const s = useHistoryStore.getState();
    s.clearHistory();
  });

  it('undo returns null when past is empty', () => {
    const s = useHistoryStore.getState();
    const res = s.undo([]);
    expect(res).toBeNull();
    expect(s.canUndo()).toBe(false);
  });

  it('redo returns null when future is empty', () => {
    const s = useHistoryStore.getState();
    s.pushToHistory([]);
    const res = s.redo([]);
    expect(res).toBeNull();
    expect(s.canRedo()).toBe(false);
  });

  it('trims history to max length (50)', () => {
    const s = useHistoryStore.getState();
    for (let i = 0; i < 60; i++) {
      s.pushToHistory([]);
    }
    expect(useHistoryStore.getState().historyPast.length).toBe(50);
  });
});


