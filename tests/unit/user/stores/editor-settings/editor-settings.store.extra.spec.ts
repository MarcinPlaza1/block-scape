import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorSettingsStore } from '@/features/projects/stores/editor-settings.store';

describe('useEditorSettingsStore extra', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('toggles placeMultiple and persists', () => {
    const s = useEditorSettingsStore.getState();
    s.setPlaceMultiple(true);
    expect(useEditorSettingsStore.getState().placeMultiple).toBe(true);
    expect(localStorage.getItem('sandbox-editor-settings')).toBeTruthy();
  });

  it('sets builder type and color with persistence', () => {
    const s = useEditorSettingsStore.getState();
    s.setBuilderCurrentType('sphere');
    s.setBuilderCurrentColor(0x123456);
    const st = useEditorSettingsStore.getState();
    expect(st.builderCurrentType).toBe('sphere');
    expect(st.builderCurrentColor).toBe(0x123456);
  });

  it('noUiModeEnabled toggles and persists', () => {
    const s = useEditorSettingsStore.getState();
    s.setNoUiModeEnabled(true);
    expect(useEditorSettingsStore.getState().noUiModeEnabled).toBe(true);
  });
});


