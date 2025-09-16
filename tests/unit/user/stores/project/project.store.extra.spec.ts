import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore as useProjectStoreBase } from '@/features/projects/stores/project.store';

describe('useProjectStoreBase extra', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('togglePlayMode switches isPlayMode and editorMode', () => {
    const s = useProjectStoreBase.getState();
    expect(s.isPlayMode).toBe(false);
    expect(s.editorMode).toBe('build');
    s.togglePlayMode();
    expect(useProjectStoreBase.getState().isPlayMode).toBe(true);
    expect(useProjectStoreBase.getState().editorMode).toBe('play');
    s.togglePlayMode();
    expect(useProjectStoreBase.getState().isPlayMode).toBe(false);
    expect(useProjectStoreBase.getState().editorMode).toBe('build');
  });

  it('setEditorMode updates both editorMode and isPlayMode', () => {
    const s = useProjectStoreBase.getState();
    s.setEditorMode('play');
    expect(useProjectStoreBase.getState().editorMode).toBe('play');
    expect(useProjectStoreBase.getState().isPlayMode).toBe(true);
    s.setEditorMode('build');
    expect(useProjectStoreBase.getState().editorMode).toBe('build');
    expect(useProjectStoreBase.getState().isPlayMode).toBe(false);
  });
});


