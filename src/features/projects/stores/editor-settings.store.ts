import { create } from 'zustand';
import type { BlockType } from '@/types/project';

// Editor settings state and actions
export interface EditorSettingsState {
  // Tool selection
  selectedTool: 'select' | 'move' | 'paint' | 'place';

  // Grid and snapping
  gridVisible: boolean;
  snapEnabled: boolean;
  snapSize: number;
  placeMultiple: boolean;
  
  // Builder mode
  builderModeEnabled: boolean;
  builderCurrentType: BlockType;
  builderCurrentColor: number;
  noUiModeEnabled: boolean;
  
  // Terrain brush
  terrainBrushMode: 'raise' | 'lower' | 'smooth' | 'paint';
  terrainBrushSize: number; // world units radius
  terrainBrushStrength: number; // effect per stroke
  terrainBrushColor: number; // hex RGB
  
  // Actions
  setSelectedTool: (tool: 'select' | 'move' | 'paint' | 'place') => void;
  setGridVisible: (visible: boolean) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapSize: (size: number) => void;
  setPlaceMultiple: (enabled: boolean) => void;
  setBuilderModeEnabled: (enabled: boolean) => void;
  setBuilderCurrentType: (type: BlockType) => void;
  setBuilderCurrentColor: (color: number) => void;
  setNoUiModeEnabled: (enabled: boolean) => void;
  setTerrainBrushMode: (mode: 'raise' | 'lower' | 'smooth' | 'paint') => void;
  setTerrainBrushSize: (size: number) => void;
  setTerrainBrushStrength: (strength: number) => void;
  setTerrainBrushColor: (color: number) => void;
}

// Persistence helpers
type EditorSettings = {
  selectedTool: 'select' | 'move' | 'paint' | 'place';
  gridVisible: boolean;
  snapEnabled: boolean;
  snapSize: number;
  builderModeEnabled: boolean;
  builderCurrentType: BlockType;
  builderCurrentColor: number;
  noUiModeEnabled: boolean;
  placeMultiple: boolean;
  terrainBrushMode: 'raise' | 'lower' | 'smooth' | 'paint';
  terrainBrushSize: number;
  terrainBrushStrength: number;
  terrainBrushColor: number;
};

function getDefaultSettings(): EditorSettings {
  return {
    selectedTool: 'place',
    gridVisible: true,
    snapEnabled: true,
    snapSize: 1,
    builderModeEnabled: true,
    builderCurrentType: 'cube',
    builderCurrentColor: 0x6b7280,
    noUiModeEnabled: false,
    placeMultiple: false,
    terrainBrushMode: 'raise',
    terrainBrushSize: 3,
    terrainBrushStrength: 0.2,
    terrainBrushColor: 0x4a9d4a,
  };
}

function readEditorSettings(): EditorSettings {
  try {
    const raw = localStorage.getItem('sandbox-editor-settings');
    if (!raw) return getDefaultSettings();
    
    const parsed = JSON.parse(raw) as Partial<EditorSettings>;
    const defaults = getDefaultSettings();
    
    return {
      selectedTool: (parsed.selectedTool as any) ?? defaults.selectedTool,
      gridVisible: parsed.gridVisible ?? defaults.gridVisible,
      snapEnabled: parsed.snapEnabled ?? defaults.snapEnabled,
      snapSize: typeof parsed.snapSize === 'number' && parsed.snapSize > 0 ? parsed.snapSize : defaults.snapSize,
      builderModeEnabled: parsed.builderModeEnabled ?? defaults.builderModeEnabled,
      builderCurrentType: (parsed.builderCurrentType && typeof parsed.builderCurrentType === 'string' ? parsed.builderCurrentType : defaults.builderCurrentType) as BlockType,
      builderCurrentColor: typeof parsed.builderCurrentColor === 'number' ? parsed.builderCurrentColor : defaults.builderCurrentColor,
      noUiModeEnabled: !!parsed.noUiModeEnabled,
      placeMultiple: !!parsed.placeMultiple,
      terrainBrushMode: (parsed.terrainBrushMode as any) ?? defaults.terrainBrushMode,
      terrainBrushSize: typeof parsed.terrainBrushSize === 'number' ? parsed.terrainBrushSize : defaults.terrainBrushSize,
      terrainBrushStrength: typeof parsed.terrainBrushStrength === 'number' ? parsed.terrainBrushStrength : defaults.terrainBrushStrength,
      terrainBrushColor: typeof parsed.terrainBrushColor === 'number' ? parsed.terrainBrushColor : defaults.terrainBrushColor,
    };
  } catch {
    return getDefaultSettings();
  }
}

function writeEditorSettings(settings: EditorSettings) {
  try {
    localStorage.setItem('sandbox-editor-settings', JSON.stringify(settings));
  } catch {}
}

export const useEditorSettingsStore = create<EditorSettingsState>((set, get) => {
  const initialSettings = readEditorSettings();
  
  return {
    ...initialSettings,

    setSelectedTool: (tool) => {
      set({ selectedTool: tool });
      const state = get();
      writeEditorSettings({
        selectedTool: state.selectedTool,
        gridVisible: state.gridVisible,
        snapEnabled: state.snapEnabled,
        snapSize: state.snapSize,
        builderModeEnabled: state.builderModeEnabled,
        builderCurrentType: state.builderCurrentType,
        builderCurrentColor: state.builderCurrentColor,
        noUiModeEnabled: state.noUiModeEnabled,
        placeMultiple: state.placeMultiple,
        terrainBrushMode: state.terrainBrushMode,
        terrainBrushSize: state.terrainBrushSize,
        terrainBrushStrength: state.terrainBrushStrength,
        terrainBrushColor: state.terrainBrushColor,
      });
    },

    setGridVisible: (visible) => {
      set({ gridVisible: visible });
      const state = get();
      writeEditorSettings({
        selectedTool: state.selectedTool,
        gridVisible: state.gridVisible,
        snapEnabled: state.snapEnabled,
        snapSize: state.snapSize,
        builderModeEnabled: state.builderModeEnabled,
        builderCurrentType: state.builderCurrentType,
        builderCurrentColor: state.builderCurrentColor,
        noUiModeEnabled: state.noUiModeEnabled,
        placeMultiple: state.placeMultiple,
        terrainBrushMode: state.terrainBrushMode,
        terrainBrushSize: state.terrainBrushSize,
        terrainBrushStrength: state.terrainBrushStrength,
        terrainBrushColor: state.terrainBrushColor,
      });
    },

    setSnapEnabled: (enabled) => {
      set({ snapEnabled: enabled });
      const state = get();
      writeEditorSettings({
        selectedTool: state.selectedTool,
        gridVisible: state.gridVisible,
        snapEnabled: state.snapEnabled,
        snapSize: state.snapSize,
        builderModeEnabled: state.builderModeEnabled,
        builderCurrentType: state.builderCurrentType,
        builderCurrentColor: state.builderCurrentColor,
        noUiModeEnabled: state.noUiModeEnabled,
        placeMultiple: state.placeMultiple,
        terrainBrushMode: state.terrainBrushMode,
        terrainBrushSize: state.terrainBrushSize,
        terrainBrushStrength: state.terrainBrushStrength,
        terrainBrushColor: state.terrainBrushColor,
      });
    },

    setSnapSize: (size) => {
      const safe = !isFinite(size) || size <= 0 ? 1 : Math.min(10, Math.max(0.1, Number(size)));
      set({ snapSize: safe });
      const state = get();
      writeEditorSettings({
        selectedTool: state.selectedTool,
        gridVisible: state.gridVisible,
        snapEnabled: state.snapEnabled,
        snapSize: state.snapSize,
        builderModeEnabled: state.builderModeEnabled,
        builderCurrentType: state.builderCurrentType,
        builderCurrentColor: state.builderCurrentColor,
        noUiModeEnabled: state.noUiModeEnabled,
        placeMultiple: state.placeMultiple,
        terrainBrushMode: state.terrainBrushMode,
        terrainBrushSize: state.terrainBrushSize,
        terrainBrushStrength: state.terrainBrushStrength,
        terrainBrushColor: state.terrainBrushColor,
      });
    },

    setPlaceMultiple: (enabled) => {
      set({ placeMultiple: enabled });
      const state = get();
      writeEditorSettings({
        selectedTool: state.selectedTool,
        gridVisible: state.gridVisible,
        snapEnabled: state.snapEnabled,
        snapSize: state.snapSize,
        builderModeEnabled: state.builderModeEnabled,
        builderCurrentType: state.builderCurrentType,
        builderCurrentColor: state.builderCurrentColor,
        noUiModeEnabled: state.noUiModeEnabled,
        placeMultiple: state.placeMultiple,
        terrainBrushMode: state.terrainBrushMode,
        terrainBrushSize: state.terrainBrushSize,
        terrainBrushStrength: state.terrainBrushStrength,
        terrainBrushColor: state.terrainBrushColor,
      });
    },

    setBuilderModeEnabled: (enabled) => {
      set({ builderModeEnabled: enabled });
      const state = get();
      writeEditorSettings({
        selectedTool: state.selectedTool,
        gridVisible: state.gridVisible,
        snapEnabled: state.snapEnabled,
        snapSize: state.snapSize,
        builderModeEnabled: state.builderModeEnabled,
        builderCurrentType: state.builderCurrentType,
        builderCurrentColor: state.builderCurrentColor,
        noUiModeEnabled: state.noUiModeEnabled,
        placeMultiple: state.placeMultiple,
        terrainBrushMode: state.terrainBrushMode,
        terrainBrushSize: state.terrainBrushSize,
        terrainBrushStrength: state.terrainBrushStrength,
        terrainBrushColor: state.terrainBrushColor,
      });
    },

    setBuilderCurrentType: (type) => {
      set({ builderCurrentType: type });
      const state = get();
      writeEditorSettings({
        selectedTool: state.selectedTool,
        gridVisible: state.gridVisible,
        snapEnabled: state.snapEnabled,
        snapSize: state.snapSize,
        builderModeEnabled: state.builderModeEnabled,
        builderCurrentType: state.builderCurrentType,
        builderCurrentColor: state.builderCurrentColor,
        noUiModeEnabled: state.noUiModeEnabled,
        placeMultiple: state.placeMultiple,
        terrainBrushMode: state.terrainBrushMode,
        terrainBrushSize: state.terrainBrushSize,
        terrainBrushStrength: state.terrainBrushStrength,
        terrainBrushColor: state.terrainBrushColor,
      });
    },

    setBuilderCurrentColor: (color) => {
      set({ builderCurrentColor: color });
      const state = get();
      writeEditorSettings({
        selectedTool: state.selectedTool,
        gridVisible: state.gridVisible,
        snapEnabled: state.snapEnabled,
        snapSize: state.snapSize,
        builderModeEnabled: state.builderModeEnabled,
        builderCurrentType: state.builderCurrentType,
        builderCurrentColor: state.builderCurrentColor,
        noUiModeEnabled: state.noUiModeEnabled,
        placeMultiple: state.placeMultiple,
        terrainBrushMode: state.terrainBrushMode,
        terrainBrushSize: state.terrainBrushSize,
        terrainBrushStrength: state.terrainBrushStrength,
        terrainBrushColor: state.terrainBrushColor,
      });
    },

    setNoUiModeEnabled: (enabled) => {
      set({ noUiModeEnabled: enabled });
      const state = get();
      writeEditorSettings({
        selectedTool: state.selectedTool,
        gridVisible: state.gridVisible,
        snapEnabled: state.snapEnabled,
        snapSize: state.snapSize,
        builderModeEnabled: state.builderModeEnabled,
        builderCurrentType: state.builderCurrentType,
        builderCurrentColor: state.builderCurrentColor,
        noUiModeEnabled: state.noUiModeEnabled,
        placeMultiple: state.placeMultiple,
        terrainBrushMode: state.terrainBrushMode,
        terrainBrushSize: state.terrainBrushSize,
        terrainBrushStrength: state.terrainBrushStrength,
        terrainBrushColor: state.terrainBrushColor,
      });
    },

    setTerrainBrushMode: (mode) => {
      set({ terrainBrushMode: mode });
      const state = get();
      writeEditorSettings({
        selectedTool: state.selectedTool,
        gridVisible: state.gridVisible,
        snapEnabled: state.snapEnabled,
        snapSize: state.snapSize,
        builderModeEnabled: state.builderModeEnabled,
        builderCurrentType: state.builderCurrentType,
        builderCurrentColor: state.builderCurrentColor,
        noUiModeEnabled: state.noUiModeEnabled,
        placeMultiple: state.placeMultiple,
        terrainBrushMode: state.terrainBrushMode,
        terrainBrushSize: state.terrainBrushSize,
        terrainBrushStrength: state.terrainBrushStrength,
        terrainBrushColor: state.terrainBrushColor,
      });
    },

    setTerrainBrushSize: (size) => {
      const safe = !isFinite(size) || size <= 0 ? 0.5 : Math.min(25, Math.max(0.1, Number(size)));
      set({ terrainBrushSize: safe });
      const state = get();
      writeEditorSettings({
        selectedTool: state.selectedTool,
        gridVisible: state.gridVisible,
        snapEnabled: state.snapEnabled,
        snapSize: state.snapSize,
        builderModeEnabled: state.builderModeEnabled,
        builderCurrentType: state.builderCurrentType,
        builderCurrentColor: state.builderCurrentColor,
        noUiModeEnabled: state.noUiModeEnabled,
        placeMultiple: state.placeMultiple,
        terrainBrushMode: state.terrainBrushMode,
        terrainBrushSize: state.terrainBrushSize,
        terrainBrushStrength: state.terrainBrushStrength,
        terrainBrushColor: state.terrainBrushColor,
      });
    },

    setTerrainBrushStrength: (strength) => {
      const safe = !isFinite(strength) ? 0.1 : Math.min(5, Math.max(0.01, Number(strength)));
      set({ terrainBrushStrength: safe });
      const state = get();
      writeEditorSettings({
        selectedTool: state.selectedTool,
        gridVisible: state.gridVisible,
        snapEnabled: state.snapEnabled,
        snapSize: state.snapSize,
        builderModeEnabled: state.builderModeEnabled,
        builderCurrentType: state.builderCurrentType,
        builderCurrentColor: state.builderCurrentColor,
        noUiModeEnabled: state.noUiModeEnabled,
        placeMultiple: state.placeMultiple,
        terrainBrushMode: state.terrainBrushMode,
        terrainBrushSize: state.terrainBrushSize,
        terrainBrushStrength: state.terrainBrushStrength,
        terrainBrushColor: state.terrainBrushColor,
      });
    },

    setTerrainBrushColor: (color) => {
      set({ terrainBrushColor: color });
      const state = get();
      writeEditorSettings({
        selectedTool: state.selectedTool,
        gridVisible: state.gridVisible,
        snapEnabled: state.snapEnabled,
        snapSize: state.snapSize,
        builderModeEnabled: state.builderModeEnabled,
        builderCurrentType: state.builderCurrentType,
        builderCurrentColor: state.builderCurrentColor,
        noUiModeEnabled: state.noUiModeEnabled,
        placeMultiple: state.placeMultiple,
        terrainBrushMode: state.terrainBrushMode,
        terrainBrushSize: state.terrainBrushSize,
        terrainBrushStrength: state.terrainBrushStrength,
        terrainBrushColor: state.terrainBrushColor,
      });
    },
  };
});
