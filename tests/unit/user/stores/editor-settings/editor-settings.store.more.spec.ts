import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorSettingsStore } from '@/features/projects/stores/editor-settings.store';

describe('useEditorSettingsStore more', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('setSnapSize clamps to 0.1..10', () => {
    const s = useEditorSettingsStore.getState();
    s.setSnapSize(-5 as any);
    expect(useEditorSettingsStore.getState().snapSize).toBeGreaterThan(0);
    s.setSnapSize(999 as any);
    expect(useEditorSettingsStore.getState().snapSize).toBeLessThanOrEqual(10);
  });

  it('setTerrainBrushSize clamps to 0.1..25', () => {
    const s = useEditorSettingsStore.getState();
    s.setTerrainBrushSize(-1 as any);
    expect(useEditorSettingsStore.getState().terrainBrushSize).toBeGreaterThan(0);
    s.setTerrainBrushSize(999 as any);
    expect(useEditorSettingsStore.getState().terrainBrushSize).toBeLessThanOrEqual(25);
  });

  it('setTerrainBrushStrength clamps to 0.01..5', () => {
    const s = useEditorSettingsStore.getState();
    s.setTerrainBrushStrength(-1 as any);
    expect(useEditorSettingsStore.getState().terrainBrushStrength).toBeGreaterThan(0);
    s.setTerrainBrushStrength(999 as any);
    expect(useEditorSettingsStore.getState().terrainBrushStrength).toBeLessThanOrEqual(5);
  });

  it('setTerrainBrushColor persists', () => {
    const s = useEditorSettingsStore.getState();
    s.setTerrainBrushColor(0xffffff);
    expect(localStorage.getItem('sandbox-editor-settings')).toBeTruthy();
  });
});


