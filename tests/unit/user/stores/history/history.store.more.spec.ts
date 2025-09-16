import { describe, it, expect, beforeEach } from 'vitest';
import { useHistoryStore } from '@/features/projects/stores/history.store';

describe('useHistoryStore more', () => {
  beforeEach(() => {
    const s = useHistoryStore.getState();
    s.clearHistory();
  });

  it('pushToHistory clears future', () => {
    const s = useHistoryStore.getState();
    s.pushToHistory([]);
    s.undo([]);
    expect(useHistoryStore.getState().historyFuture.length).toBe(1);
    s.pushToHistory([]);
    expect(useHistoryStore.getState().historyFuture.length).toBe(0);
  });

  it('flags canUndo/canRedo reflect state', () => {
    const s = useHistoryStore.getState();
    expect(s.canUndo()).toBe(false);
    s.pushToHistory([]);
    expect(s.canUndo()).toBe(true);
    s.undo([]);
    expect(s.canRedo()).toBe(true);
  });

  it('clearHistory resets both arrays', () => {
    const s = useHistoryStore.getState();
    s.pushToHistory([]);
    s.undo([]);
    s.clearHistory();
    const st = useHistoryStore.getState();
    expect(st.historyPast.length).toBe(0);
    expect(st.historyFuture.length).toBe(0);
  });
});


