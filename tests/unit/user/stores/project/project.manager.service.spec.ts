import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectManagerService } from '@/services/project-manager.service';
import { ProjectService } from '@/services/api.service';

const makeProject = (over: Partial<any> = {}) => ({
  id: undefined,
  name: 'My Project',
  blocks: [
    { id: 'b1', type: 'cube', position: { x: 0, y: 0, z: 0 } },
    { id: 'b2', type: 'finish', position: { x: 1, y: 0, z: 0 } },
  ],
  timestamp: new Date().toISOString(),
  version: '1.2.0',
  ...over,
});

describe('ProjectManagerService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => vi.restoreAllMocks());

  it('validateProject finds required name and block integrity issues', () => {
    const bad = makeProject({ name: '  ' });
    const res1 = ProjectManagerService.validateProject(bad);
    expect(res1.isValid).toBe(false);
    expect(res1.errors).toContain('Project name is required');

    const dup = makeProject({ blocks: [
      { id: 'x', type: 'cube', position: { x: 0, y: 0, z: 0 } },
      { id: 'x', type: 'cube', position: { x: 0, y: 0, z: 0 } },
    ]});
    const res2 = ProjectManagerService.validateProject(dup);
    expect(res2.isValid).toBe(false);
    expect(res2.errors.some(e => e.includes('Duplicate block ID'))).toBe(true);
  });

  it('validateBlockData returns warnings for extreme positions and scale bounds', () => {
    const res = ProjectManagerService.validateBlockData({
      id: 'b',
      type: 'cube',
      position: { x: 2000, y: 0, z: 0 },
      scale: 20,
    } as any);
    expect(res.isValid).toBe(true);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it('sanitizeBlockForSave keeps only whitelisted fields and defaults', () => {
    const save = ProjectManagerService.sanitizeBlockForSave({
      id: 'b1',
      type: 'cube',
      position: { x: 0, y: 0, z: 0 },
      rotationY: undefined,
      scale: undefined,
      extra: 'ignored' as any,
    } as any);
    expect(save).toMatchObject({ id: 'b1', type: 'cube', position: { x: 0, y: 0, z: 0 } });
    expect(save.rotationY).toBe(0);
    expect(save.scale).toBe(1);
    expect((save as any).extra).toBeUndefined();
  });

  it('saveProjectToCloud validates, optionally generates thumbnail, and creates project', async () => {
    vi.spyOn(ProjectService, 'createProject').mockResolvedValue({ game: { id: 'g1', name: 'My Project' } } as any);
    (window as any).scene3D = { captureThumbnail: vi.fn().mockReturnValue('data:image/jpeg;base64,...') };

    const res = await ProjectManagerService.saveProjectToCloud(makeProject(), { generateThumbnail: true });
    expect(res.success).toBe(true);
    expect(res.project?.id).toBe('g1');
    expect(ProjectService.createProject).toHaveBeenCalled();
  });

  it('saveProjectToCloud updates when id is present', async () => {
    vi.spyOn(ProjectService, 'updateProject').mockResolvedValue({ game: { id: 'g2', name: 'Existing' } } as any);
    const proj = makeProject({ id: 'g2' });
    const res = await ProjectManagerService.saveProjectToCloud(proj);
    expect(res.success).toBe(true);
    expect(ProjectService.updateProject).toHaveBeenCalledWith('g2', expect.any(Object));
  });

  it('local save/get/delete manage sandbox-projects in localStorage', () => {
    const p = makeProject({ name: 'Local' });
    const ok = ProjectManagerService.saveProjectToLocal(p as any);
    expect(ok).toBe(true);
    const all = ProjectManagerService.getSavedProjects();
    expect(all['Local']).toBeTruthy();
    const del = ProjectManagerService.deleteLocalProject('Local');
    expect(del).toBe(true);
  });

  it('create templates and utilities behave as expected', () => {
    const empty = ProjectManagerService.createEmptyProject('E');
    expect(empty.name).toBe('E');
    expect(empty.blocks.length).toBe(0);

    const basic = ProjectManagerService.createBasicTemplate('B');
    expect(basic.blocks.length).toBeGreaterThan(0);

    const id = ProjectManagerService.generateProjectId();
    expect(id).toMatch(/^project_/);

    const size = ProjectManagerService.calculateProjectSize(makeProject());
    expect(size.blockCount).toBe(2);
  });
});


