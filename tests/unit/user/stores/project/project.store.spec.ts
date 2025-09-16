import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useProjectStore } from '@/features/projects/stores/project.store';
import type { Block } from '@/types/project';

function blk(id: string): Block {
  return { id, type: 'cube', position: { x: 0, y: 0, z: 0 } } as Block;
}

describe('useProjectStore', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renames project and marks unsaved', () => {
    const api = useProjectStore.getState();
    const ok = api.renameProject('New Name');
    expect(ok).toBe(true);
    expect(useProjectStore.getState().projectName).toBe('New Name');
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('saveLocalProject writes to savedProjects and currentProject', () => {
    const api = useProjectStore.getState();
    api.setProjectName('Local A');
    const project = api.saveLocalProject([blk('a')]);
    const s = useProjectStore.getState();
    expect(project.name).toBe('Local A');
    expect(s.currentProject?.name).toBe('Local A');
    expect(s.savedProjects['Local A']).toBeTruthy();
  });

  it('restoreAutoSaveIfPresent sets state and clears autosave', () => {
    const auto = {
      name: 'Auto X',
      blocks: [blk('x')],
      timestamp: new Date().toISOString(),
      version: '1.2.0',
    } as any;
    localStorage.setItem('sandbox-autosave', JSON.stringify(auto));
    const api = useProjectStore.getState();
    const restored = api.restoreAutoSaveIfPresent();
    expect(restored?.project.name).toBe('Auto X');
    expect(useProjectStore.getState().projectName).toBe('Auto X');
    expect(localStorage.getItem('sandbox-autosave')).toBeNull();
  });

  it('scheduleAutoSave stores autosave when blocks provided (via internal fn)', async () => {
    vi.useFakeTimers();
    const api = useProjectStore.getState() as any;
    api.setProjectName('Sched');
    api.scheduleAutoSave([blk('s1')]);
    await vi.advanceTimersByTimeAsync(1600);
    // also allow idle callback (stubbed via setTimeout) to run
    await vi.advanceTimersByTimeAsync(5);
    expect(localStorage.getItem('sandbox-autosave')).toBeTruthy();
  });
});


