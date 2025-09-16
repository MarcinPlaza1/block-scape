import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectStore } from '@/features/projects/stores/project.store';
import type { Block } from '@/types/project';

const blk = (id: string): Block => ({ id, type: 'cube', position: { x: 0, y: 0, z: 0 } } as Block);

describe('useProjectStore more', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    (window as any).fetch = vi.fn();
  });

  it('saveLocalProject clones blocks and persists current', () => {
    const s = useProjectStore.getState();
    s.setProjectName('LocalClone');
    const project = s.saveLocalProject([blk('a'), blk('b')]);
    expect(project.name).toBe('LocalClone');
    expect(project.blocks.length).toBe(2);
    expect(useProjectStore.getState().currentProject?.name).toBe('LocalClone');
    expect(localStorage.getItem('sandbox-current-project')).toBeTruthy();
  });

  it('renameProject updates saved and current when current exists', () => {
    const s = useProjectStore.getState();
    s.setProjectName('Old');
    const p = s.saveLocalProject([blk('x')]);
    const ok = s.renameProject('New');
    expect(ok).toBe(true);
    expect(useProjectStore.getState().projectName).toBe('New');
    const saved = JSON.parse(localStorage.getItem('sandbox-projects') || '{}');
    expect(saved['New']).toBeTruthy();
  });

  it('publishProject returns false on API failure', async () => {
    const s = useProjectStore.getState();
    s.setProjectName('Pub');
    const local = s.saveLocalProject([blk('p')]);
    // emulate cloud id
    (useProjectStore.setState as any)({ currentProject: { ...local, id: 'gid' } });
    (window as any).fetch.mockResolvedValueOnce({ ok: false, status: 500, headers: { get: () => 'application/json' }, clone() { return this; }, json: async () => ({ message: 'fail' }), text: async () => 'fail' });
    const ok = await s.publishProject(true);
    expect(ok).toBe(false);
  });

  it('scheduleAutoSave stores autosave when blocks exist', async () => {
    vi.useFakeTimers();
    const s = useProjectStore.getState() as any;
    s.setProjectName('Auto');
    s.scheduleAutoSave([blk('a')]);
    await vi.advanceTimersByTimeAsync(1600);
    await vi.advanceTimersByTimeAsync(5);
    expect(localStorage.getItem('sandbox-autosave')).toBeTruthy();
    vi.useRealTimers();
  });
});


