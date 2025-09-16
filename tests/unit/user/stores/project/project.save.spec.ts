import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectStoreBase } from '@/features/projects/stores';
import type { Block } from '@/types/project';

function blk(id: string): Block {
  return { id, type: 'cube', position: { x: 0, y: 0, z: 0 } } as Block;
}

describe('Project save flow (cloud and local fallback)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    (window as any).fetch = vi.fn();
  });

  it('saves to cloud when API succeeds (POST new)', async () => {
    const s = useProjectStoreBase.getState();
    s.newProject();
    s.setProjectName('Cloud A');
    const blocks = [blk('a1')];

    // Mock fetch success for create
    (window as any).fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ game: { id: 'g1', name: 'Cloud A' } }),
      status: 200,
      headers: new Map([['content-type','application/json']]),
      clone() { return this; },
      text: async () => '',
    });

    const res = await useProjectStoreBase.getState().saveProject(blocks);
    expect(res.savedTo).toBe('cloud');
    expect(res.project.id).toBe('g1');
    expect(useProjectStoreBase.getState().currentProject?.name).toBe('Cloud A');
    expect(useProjectStoreBase.getState().hasUnsavedChanges).toBe(false);
    expect(localStorage.getItem('sandbox-current-project')).toBeTruthy();
  });

  it('falls back to local when API fails', async () => {
    const s = useProjectStoreBase.getState();
    s.newProject();
    s.setProjectName('Local Fallback');
    const blocks = [blk('b1')];

    // Mock fetch failure
    (window as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Map([['content-type','application/json']]),
      clone() { return this; },
      json: async () => ({ message: 'server error' }),
      text: async () => 'server error',
    });

    const res = await useProjectStoreBase.getState().saveProject(blocks);
    expect(res.savedTo).toBe('local');
    expect(res.project.name).toBe('Local Fallback');
    expect(useProjectStoreBase.getState().savedProjects['Local Fallback']).toBeTruthy();
    expect(useProjectStoreBase.getState().hasUnsavedChanges).toBe(false);
  });
});


