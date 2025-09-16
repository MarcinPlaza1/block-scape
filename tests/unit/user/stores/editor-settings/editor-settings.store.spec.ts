import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorSettingsStore } from '@/features/projects/stores/editor-settings.store';

describe('useEditorSettingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('toggles grid and snap, persists to localStorage', () => {
    const api = useEditorSettingsStore.getState();
    api.setGridVisible(false);
    api.setSnapEnabled(false);
    const s1 = useEditorSettingsStore.getState();
    expect(s1.gridVisible).toBe(false);
    expect(s1.snapEnabled).toBe(false);
    // ensure persisted JSON exists
    expect(localStorage.getItem('sandbox-editor-settings')).toBeTruthy();
  });

  it('clamps snap size and terrain parameters', () => {
    const api = useEditorSettingsStore.getState();
    api.setSnapSize(-5 as any);
    expect(useEditorSettingsStore.getState().snapSize).toBeGreaterThan(0);
    api.setTerrainBrushSize(-1 as any);
    expect(useEditorSettingsStore.getState().terrainBrushSize).toBeGreaterThan(0);
    api.setTerrainBrushStrength(999 as any);
    expect(useEditorSettingsStore.getState().terrainBrushStrength).toBeLessThanOrEqual(5);
  });
});


