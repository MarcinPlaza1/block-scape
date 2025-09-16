import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectStoreBase } from '@/features/projects/stores';
import type { Block, ProjectData } from '@/types/project';

function blk(id: string): Block {
  return { id, type: 'cube', position: { x: 0, y: 0, z: 0 } } as Block;
}

describe('Project publish flow', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    (window as any).fetch = vi.fn();
  });

  it('returns false when no currentProject id', async () => {
    const s = useProjectStoreBase.getState();
    s.newProject();
    const ok = await useProjectStoreBase.getState().publishProject(true);
    expect(ok).toBe(false);
  });

  it('updates published flag and persists when API succeeds', async () => {
    const s = useProjectStoreBase.getState();
    s.newProject();
    s.setProjectName('Publish Me');

    // Save locally to create a currentProject without id
    const local = s.saveLocalProject([blk('x')]);
    // Emulate that a cloud save happened earlier: inject id in currentProject
    const withId: ProjectData = { ...local, id: 'g-123' };
    // persist in store and localStorage like cloud save would
    const saved = { [withId.name]: withId } as Record<string, ProjectData>;
    localStorage.setItem('sandbox-projects', JSON.stringify(saved));
    localStorage.setItem('sandbox-current-project', JSON.stringify(withId));
    (useProjectStoreBase.getState() as any).setHasUnsavedChanges(false);
    // set into store
    (useProjectStoreBase.setState as any)({ currentProject: withId, savedProjects: saved });

    (window as any).fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ game: { id: 'g-123', published: true } }),
      status: 200,
      headers: new Map([['content-type','application/json']]),
      clone() { return this; },
      text: async () => '',
    });

    const ok = await useProjectStoreBase.getState().publishProject(true);
    expect(ok).toBe(true);
    expect(useProjectStoreBase.getState().currentProject?.published).toBe(true);
    expect(JSON.parse(localStorage.getItem('sandbox-projects') || '{}')['Publish Me'].published).toBe(true);
    expect(JSON.parse(localStorage.getItem('sandbox-current-project') || '{}').published).toBe(true);
  });
});


