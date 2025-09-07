import { create } from 'zustand';
import { apiFetch } from '@/shared/api/client';
import type { Block, ProjectData } from '@/types/project';

type SaveResult = { savedTo: 'cloud' | 'local'; project: ProjectData };

interface ProjectState {
  blocks: Block[];
  droppedBlock: { type: 'cube' | 'cube_bouncy' | 'cube_ice' | 'cube_conveyor' | 'cube_boost' | 'cube_slow' | 'cube_sticky' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'plate' | 'ramp' | 'torus' | 'wedge' | 'door' | 'window' | 'fence' | 'start' | 'checkpoint' | 'finish' | 'hazard' } | null;
  projectName: string;
  hasUnsavedChanges: boolean;
  loadedBlocks: Block[];
  isPlayMode: boolean;
  selectedTool: 'select' | 'move' | 'paint';
  selectedBlockId: string | null;
  selectedBlockIds: string[]; // multi-select
  // Builder Mode
  builderModeEnabled: boolean;
  builderCurrentType: 'cube' | 'cube_bouncy' | 'cube_ice' | 'cube_conveyor' | 'cube_boost' | 'cube_slow' | 'cube_sticky' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'plate' | 'ramp' | 'torus' | 'wedge' | 'door' | 'window' | 'fence' | 'start' | 'checkpoint' | 'finish' | 'hazard';
  builderCurrentColor: number;
  noUiModeEnabled: boolean;
  savedProjects: Record<string, ProjectData>;
  currentProject: ProjectData | null;
  historyPast: Block[][];
  historyFuture: Block[][];

  // Editor settings
  gridVisible: boolean;
  snapEnabled: boolean;
  snapSize: number;
  // Placement
  placeMultiple: boolean;

  setDroppedBlock: (payload: { type: 'cube' | 'cube_bouncy' | 'cube_ice' | 'cube_conveyor' | 'cube_boost' | 'cube_slow' | 'cube_sticky' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'plate' | 'ramp' | 'torus' | 'wedge' | 'door' | 'window' | 'fence' } | null) => void;
  addBlock: (block: Block) => void;
  setBlocks: (blocks: Block[]) => void;
  clearScene: () => void;
  togglePlay: () => void;
  setSelectedTool: (tool: 'select' | 'move' | 'paint') => void;
  setSelectedBlockId: (id: string | null) => void;
  setSelectedBlockIds: (ids: string[]) => void;
  setBlockColor: (id: string, color: number) => void;
  setBlockPosition: (id: string, position: { x: number; y: number; z: number }) => void;
  setBlockRotationY: (id: string, rotationY: number) => void;
  setBlockRotationX: (id: string, rotationX: number) => void;
  setBlockRotationZ: (id: string, rotationZ: number) => void;
  setBlockScale: (id: string, scale: number) => void;
  undo: () => void;
  redo: () => void;
  removeBlock: (id: string) => void;
  removeBlocks: (ids: string[]) => void;
  renameBlock: (id: string, name: string) => void;
  duplicateBlock: (id: string) => void;
  setBlockHidden: (id: string, hidden: boolean) => void;
  setBlockLocked: (id: string, locked: boolean) => void;
  setBlockGroup: (id: string, group: string) => void;

  // Bulk operations
  addBlocks: (toAdd: Block[]) => void;
  paintBlocks: (ids: string[], color: number) => void;

  // Editor settings actions
  setGridVisible: (visible: boolean) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapSize: (size: number) => void;
  setPlaceMultiple: (enabled: boolean) => void;
  // Builder actions
  setBuilderModeEnabled: (enabled: boolean) => void;
  setBuilderCurrentType: (type: 'cube' | 'cube_bouncy' | 'cube_ice' | 'cube_conveyor' | 'cube_boost' | 'cube_slow' | 'cube_sticky' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'plate' | 'ramp' | 'torus' | 'wedge' | 'door' | 'window' | 'fence' | 'start' | 'checkpoint' | 'finish' | 'hazard') => void;
  setBuilderCurrentColor: (color: number) => void;
  setNoUiModeEnabled: (enabled: boolean) => void;

  loadCurrentProject: () => boolean;
  loadProject: (name: string) => boolean;
  renameProject: (newName: string) => boolean;
  newProject: () => void;
  deleteSavedProject: (name: string) => void;

  saveProject: () => Promise<SaveResult>;
  saveLocalProject: () => ProjectData;

  publishProject: (published: boolean) => Promise<boolean>;

  restoreAutoSaveIfPresent: () => boolean;
}

let autoSaveTimer: number | null = null;
let autoSaveIdleId: number | null = null;
const MAX_HISTORY = 50;
let applyRafId: number | null = null;
let queuedBlocksForApply: Block[] | null = null;

function scheduleAutoSave(get: () => ProjectState) {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  const cancelIdle = (window as any)?.cancelIdleCallback;
  if (autoSaveIdleId && typeof cancelIdle === 'function') {
    try { cancelIdle(autoSaveIdleId); } catch {}
    autoSaveIdleId = null;
  }
  autoSaveTimer = window.setTimeout(() => {
    const run = () => {
      const state = get();
      if (state.blocks.length === 0) return;
      const autoSaveData: ProjectData = {
        id: state.currentProject?.id,
        name: `${state.projectName} (Auto-save)`,
        blocks: state.blocks,
        timestamp: new Date().toISOString(),
        version: '1.2.0',
      };
      try {
        localStorage.setItem('sandbox-autosave', JSON.stringify(autoSaveData));
      } catch {}
    };
    const ric = (window as any)?.requestIdleCallback;
    if (typeof ric === 'function') {
      try { autoSaveIdleId = ric(() => run(), { timeout: 2000 }); } catch { run(); }
    } else {
      run();
    }
  }, 1500);
}

function snapshotBlocks(blocks: Block[]): Block[] {
  return (blocks || []).map(b => ({
    id: b.id,
    type: b.type,
    position: { ...b.position },
    name: (b as any).name,
    hidden: (b as any).hidden,
    locked: (b as any).locked,
    color: (b as any).color,
    group: (b as any).group,
    rotationY: (b as any).rotationY,
    rotationX: (b as any).rotationX,
    rotationZ: (b as any).rotationZ,
    scale: (b as any).scale,
    mechanic: (b as any).mechanic,
    mechanicPower: (b as any).mechanicPower,
  } as Block));
}

function applyBlocksToScene(blocks: Block[]) {
  try {
    const anyWindow: any = typeof window !== 'undefined' ? window : null;
    queuedBlocksForApply = snapshotBlocks(blocks);
    if (applyRafId) return;
    applyRafId = anyWindow?.requestAnimationFrame?.(() => {
      try {
        const toApply = queuedBlocksForApply || [];
        anyWindow?.scene3D?.loadScene?.(toApply);
      } finally {
        applyRafId = null;
        queuedBlocksForApply = null;
      }
    }) as any;
  } catch {}
}

function readSavedProjects(): Record<string, ProjectData> {
  try {
    return JSON.parse(localStorage.getItem('sandbox-projects') || '{}') || {};
  } catch {
    return {};
  }
}

function writeSavedProjects(saved: Record<string, ProjectData>) {
  try {
    localStorage.setItem('sandbox-projects', JSON.stringify(saved));
  } catch {}
}

function pushVersionHistory(key: string, timestamp: string) {
  try {
    const raw = localStorage.getItem(`sandbox-history-${key}`);
    const list = Array.isArray(raw ? JSON.parse(raw) : []) ? JSON.parse(raw) as string[] : [];
    const next = [timestamp, ...list.filter((x) => x !== timestamp)].slice(0, 5);
    localStorage.setItem(`sandbox-history-${key}`, JSON.stringify(next));
  } catch {}
}

type EditorSettings = {
  gridVisible: boolean;
  snapEnabled: boolean;
  snapSize: number;
  builderModeEnabled: boolean;
  builderCurrentType: 'cube' | 'cube_bouncy' | 'cube_ice' | 'cube_conveyor' | 'cube_boost' | 'cube_slow' | 'cube_sticky' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'plate' | 'ramp' | 'torus' | 'wedge' | 'door' | 'window' | 'fence' | 'start' | 'checkpoint' | 'finish' | 'hazard';
  builderCurrentColor: number;
  noUiModeEnabled: boolean;
  placeMultiple: boolean;
};

function readEditorSettings(): EditorSettings {
  try {
    const raw = localStorage.getItem('sandbox-editor-settings');
    if (!raw) return { gridVisible: true, snapEnabled: true, snapSize: 1, builderModeEnabled: true, builderCurrentType: 'cube', builderCurrentColor: 0x6b7280, noUiModeEnabled: false, placeMultiple: false };
    const parsed = JSON.parse(raw) as Partial<EditorSettings>;
    return {
      gridVisible: parsed.gridVisible ?? true,
      snapEnabled: parsed.snapEnabled ?? true,
      snapSize: typeof parsed.snapSize === 'number' && parsed.snapSize > 0 ? parsed.snapSize : 1,
      builderModeEnabled: parsed.builderModeEnabled ?? true,
      builderCurrentType: (['cube','cube_bouncy','cube_ice','cube_conveyor','cube_boost','cube_slow','cube_sticky','sphere','cylinder','cone','pyramid','plate','ramp','torus','wedge','door','window','fence','start','checkpoint','finish','hazard'].includes(parsed.builderCurrentType as any) ? parsed.builderCurrentType : 'cube') as any,
      builderCurrentColor: typeof parsed.builderCurrentColor === 'number' ? parsed.builderCurrentColor : 0x6b7280,
      noUiModeEnabled: !!parsed.noUiModeEnabled,
      placeMultiple: !!parsed.placeMultiple,
    };
  } catch {
    return { gridVisible: true, snapEnabled: true, snapSize: 1, builderModeEnabled: true, builderCurrentType: 'cube', builderCurrentColor: 0x6b7280, noUiModeEnabled: false, placeMultiple: false };
  }
}

function writeEditorSettings(settings: EditorSettings) {
  try {
    localStorage.setItem('sandbox-editor-settings', JSON.stringify(settings));
  } catch {}
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  blocks: [],
  droppedBlock: null,
  projectName: 'Untitled Project',
  hasUnsavedChanges: false,
  loadedBlocks: [],
  isPlayMode: false,
  selectedTool: 'select',
  selectedBlockId: null,
  selectedBlockIds: [],
  // Builder Mode initial
  ...(() => { const s = readEditorSettings(); return { builderModeEnabled: s.builderModeEnabled, builderCurrentType: s.builderCurrentType, builderCurrentColor: s.builderCurrentColor, noUiModeEnabled: s.noUiModeEnabled } as Pick<ProjectState, 'builderModeEnabled' | 'builderCurrentType' | 'builderCurrentColor' | 'noUiModeEnabled'>; })(),
  savedProjects: readSavedProjects(),
  currentProject: null,
  historyPast: [],
  historyFuture: [],
  // Editor settings initial state
  ...(() => {
    const s = readEditorSettings();
    return { gridVisible: s.gridVisible, snapEnabled: s.snapEnabled, snapSize: s.snapSize, placeMultiple: s.placeMultiple } as Pick<ProjectState, 'gridVisible' | 'snapEnabled' | 'snapSize' | 'placeMultiple'>;
  })(),

  setDroppedBlock: (payload) => set({ droppedBlock: payload }),

  addBlock: (block) => {
    set((state) => ({
      historyPast: (() => {
        const next = [...state.historyPast, snapshotBlocks(state.blocks)];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      })(),
      historyFuture: [],
      blocks: snapshotBlocks([...state.blocks, block]),
      hasUnsavedChanges: true,
    }));
    applyBlocksToScene(get().blocks);
    scheduleAutoSave(get);
  },

  setBlocks: (blocks) => {
    const prev = get().blocks;
    const next = snapshotBlocks(blocks);
    // Push history only if changed in length or first/last id differs (lightweight check)
    const changed = prev.length !== next.length || prev.some((b, i) => b.id !== next[i]?.id || b.type !== next[i]?.type || b.position.x !== next[i]?.position.x || b.position.y !== next[i]?.position.y || b.position.z !== next[i]?.position.z);
    set((state) => ({
      historyPast: changed ? (() => {
        const h = [...state.historyPast, snapshotBlocks(prev)];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })() : state.historyPast,
      historyFuture: changed ? [] : state.historyFuture,
      blocks: next,
      hasUnsavedChanges: next.length > 0,
    }));
    scheduleAutoSave(get);
  },

  clearScene: () => {
    const prev = get().blocks;
    set((state) => ({
      historyPast: prev.length ? (() => {
        const h = [...state.historyPast, snapshotBlocks(prev)];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })() : state.historyPast,
      historyFuture: [],
      blocks: [],
      hasUnsavedChanges: false,
    }));
    applyBlocksToScene([]);
  },

  togglePlay: () => set((s) => ({ isPlayMode: !s.isPlayMode })),

  setSelectedTool: (tool) => set({ selectedTool: tool }),
  setSelectedBlockId: (id) => set({ selectedBlockId: id }),
  setSelectedBlockIds: (ids) => set({ selectedBlockIds: Array.from(new Set(ids)) }),

  setBlockColor: (id, color) => {
    const prev = get().blocks;
    const next = snapshotBlocks(prev.map(b => {
      if (b.id !== id) return b as Block;
      // Prevent applying color to textured mechanic cubes
      if (['cube_bouncy','cube_ice','cube_conveyor'].includes((b as any).type)) return b as Block;
      return { ...b, color } as Block;
    }));
    set((state) => ({
      historyPast: (() => {
        const h = [...state.historyPast, snapshotBlocks(prev)];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })(),
      historyFuture: [],
      blocks: next,
      hasUnsavedChanges: true,
    }));
    applyBlocksToScene(next);
    scheduleAutoSave(get);
  },

  setBlockPosition: (id, position) => {
    const prev = get().blocks;
    const next = snapshotBlocks(prev.map(b => b.id === id ? { ...b, position } as Block : b));
    set((state) => ({
      historyPast: (() => {
        const h = [...state.historyPast, snapshotBlocks(prev)];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })(),
      historyFuture: [],
      blocks: next,
      hasUnsavedChanges: true,
    }));
    applyBlocksToScene(next);
    scheduleAutoSave(get);
  },

  setBlockRotationY: (id, rotationY) => {
    const prev = get().blocks;
    const clamped = Number.isFinite(rotationY) ? rotationY : 0;
    const normalized = ((clamped % 360) + 360) % 360; // 0..360
    const next = snapshotBlocks(prev.map(b => b.id === id ? { ...b, rotationY: normalized } as Block : b));
    set((state) => ({
      historyPast: (() => {
        const h = [...state.historyPast, snapshotBlocks(prev)];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })(),
      historyFuture: [],
      blocks: next,
      hasUnsavedChanges: true,
    }));
    applyBlocksToScene(next);
    scheduleAutoSave(get);
  },

  setBlockRotationX: (id, rotationX) => {
    const prev = get().blocks;
    const clamped = Number.isFinite(rotationX) ? rotationX : 0;
    const normalized = ((clamped % 360) + 360) % 360;
    const next = snapshotBlocks(prev.map(b => b.id === id ? { ...b, rotationX: normalized } as Block : b));
    set((state) => ({
      historyPast: (() => {
        const h = [...state.historyPast, snapshotBlocks(prev)];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })(),
      historyFuture: [],
      blocks: next,
      hasUnsavedChanges: true,
    }));
    applyBlocksToScene(next);
    scheduleAutoSave(get);
  },

  setBlockRotationZ: (id, rotationZ) => {
    const prev = get().blocks;
    const clamped = Number.isFinite(rotationZ) ? rotationZ : 0;
    const normalized = ((clamped % 360) + 360) % 360;
    const next = snapshotBlocks(prev.map(b => b.id === id ? { ...b, rotationZ: normalized } as Block : b));
    set((state) => ({
      historyPast: (() => {
        const h = [...state.historyPast, snapshotBlocks(prev)];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })(),
      historyFuture: [],
      blocks: next,
      hasUnsavedChanges: true,
    }));
    applyBlocksToScene(next);
    scheduleAutoSave(get);
  },

  setBlockScale: (id, scale) => {
    const prev = get().blocks;
    const safe = Number.isFinite(scale) ? Math.max(0.1, Math.min(10, scale)) : 1;
    const next = snapshotBlocks(prev.map(b => b.id === id ? { ...b, scale: safe } as Block : b));
    set((state) => ({
      historyPast: (() => {
        const h = [...state.historyPast, snapshotBlocks(prev)];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })(),
      historyFuture: [],
      blocks: next,
      hasUnsavedChanges: true,
    }));
    applyBlocksToScene(next);
    scheduleAutoSave(get);
  },

  // Editor settings actions
  setGridVisible: (visible) => {
    set({ gridVisible: visible });
    const state = get();
    writeEditorSettings({ gridVisible: state.gridVisible, snapEnabled: state.snapEnabled, snapSize: state.snapSize, builderModeEnabled: state.builderModeEnabled, builderCurrentType: state.builderCurrentType, builderCurrentColor: state.builderCurrentColor, noUiModeEnabled: state.noUiModeEnabled, placeMultiple: state.placeMultiple });
  },
  setSnapEnabled: (enabled) => {
    set({ snapEnabled: enabled });
    const state = get();
    writeEditorSettings({ gridVisible: state.gridVisible, snapEnabled: state.snapEnabled, snapSize: state.snapSize, builderModeEnabled: state.builderModeEnabled, builderCurrentType: state.builderCurrentType, builderCurrentColor: state.builderCurrentColor, noUiModeEnabled: state.noUiModeEnabled, placeMultiple: state.placeMultiple });
  },
  setSnapSize: (size) => {
    const safe = !isFinite(size) || size <= 0 ? 1 : Math.min(10, Math.max(0.1, Number(size)));
    set({ snapSize: safe });
    const state = get();
    writeEditorSettings({ gridVisible: state.gridVisible, snapEnabled: state.snapEnabled, snapSize: state.snapSize, builderModeEnabled: state.builderModeEnabled, builderCurrentType: state.builderCurrentType, builderCurrentColor: state.builderCurrentColor, noUiModeEnabled: state.noUiModeEnabled, placeMultiple: state.placeMultiple });
  },
  setPlaceMultiple: (enabled) => {
    set({ placeMultiple: enabled });
    const state = get();
    writeEditorSettings({ gridVisible: state.gridVisible, snapEnabled: state.snapEnabled, snapSize: state.snapSize, builderModeEnabled: state.builderModeEnabled, builderCurrentType: state.builderCurrentType, builderCurrentColor: state.builderCurrentColor, noUiModeEnabled: state.noUiModeEnabled, placeMultiple: state.placeMultiple });
  },
  setBuilderModeEnabled: (enabled) => {
    set({ builderModeEnabled: enabled });
    const state = get();
    writeEditorSettings({ gridVisible: state.gridVisible, snapEnabled: state.snapEnabled, snapSize: state.snapSize, builderModeEnabled: state.builderModeEnabled, builderCurrentType: state.builderCurrentType, builderCurrentColor: state.builderCurrentColor, noUiModeEnabled: state.noUiModeEnabled, placeMultiple: state.placeMultiple });
  },
  setBuilderCurrentType: (type) => {
    set({ builderCurrentType: type });
    const state = get();
    writeEditorSettings({ gridVisible: state.gridVisible, snapEnabled: state.snapEnabled, snapSize: state.snapSize, builderModeEnabled: state.builderModeEnabled, builderCurrentType: state.builderCurrentType, builderCurrentColor: state.builderCurrentColor, noUiModeEnabled: state.noUiModeEnabled, placeMultiple: state.placeMultiple });
  },
  setBuilderCurrentColor: (color) => {
    set({ builderCurrentColor: color });
    const state = get();
    writeEditorSettings({ gridVisible: state.gridVisible, snapEnabled: state.snapEnabled, snapSize: state.snapSize, builderModeEnabled: state.builderModeEnabled, builderCurrentType: state.builderCurrentType, builderCurrentColor: state.builderCurrentColor, noUiModeEnabled: state.noUiModeEnabled, placeMultiple: state.placeMultiple });
  },
  setNoUiModeEnabled: (enabled) => {
    set({ noUiModeEnabled: enabled });
    const state = get();
    writeEditorSettings({ gridVisible: state.gridVisible, snapEnabled: state.snapEnabled, snapSize: state.snapSize, builderModeEnabled: state.builderModeEnabled, builderCurrentType: state.builderCurrentType, builderCurrentColor: state.builderCurrentColor, noUiModeEnabled: state.noUiModeEnabled, placeMultiple: state.placeMultiple });
  },

  undo: () => {
    const state = get();
    if (state.historyPast.length === 0) return;
    const previous = state.historyPast[state.historyPast.length - 1];
    const newPast = state.historyPast.slice(0, -1);
    const current = snapshotBlocks(state.blocks);
    set({
      blocks: snapshotBlocks(previous),
      historyPast: newPast,
      historyFuture: (() => {
        const h = [...state.historyFuture, current];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })(),
      hasUnsavedChanges: previous.length > 0,
    });
    applyBlocksToScene(previous);
    scheduleAutoSave(get);
  },

  redo: () => {
    const state = get();
    if (state.historyFuture.length === 0) return;
    const next = state.historyFuture[state.historyFuture.length - 1];
    const newFuture = state.historyFuture.slice(0, -1);
    const current = snapshotBlocks(state.blocks);
    set({
      blocks: snapshotBlocks(next),
      historyPast: (() => {
        const h = [...state.historyPast, current];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })(),
      historyFuture: newFuture,
      hasUnsavedChanges: next.length > 0,
    });
    applyBlocksToScene(next);
    scheduleAutoSave(get);
  },

  removeBlock: (id: string) => {
    const prev = get().blocks;
    const next = snapshotBlocks(prev.filter(b => b.id !== id));
    set((state) => ({
      historyPast: prev.length ? (() => {
        const h = [...state.historyPast, snapshotBlocks(prev)];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })() : state.historyPast,
      historyFuture: [],
      blocks: next,
      hasUnsavedChanges: next.length > 0,
      selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
    }));
    applyBlocksToScene(next);
    scheduleAutoSave(get);
  },

  removeBlocks: (ids: string[]) => {
    const idSet = new Set(ids || []);
    const prev = get().blocks;
    const next = snapshotBlocks(prev.filter(b => !idSet.has(b.id)));
    set((state) => ({
      historyPast: prev.length ? (() => {
        const h = [...state.historyPast, snapshotBlocks(prev)];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })() : state.historyPast,
      historyFuture: [],
      blocks: next,
      hasUnsavedChanges: next.length > 0,
      selectedBlockId: idSet.has(state.selectedBlockId || '') ? null : state.selectedBlockId,
      selectedBlockIds: state.selectedBlockIds.filter(x => !idSet.has(x)),
    }));
    applyBlocksToScene(next);
    scheduleAutoSave(get);
  },

  renameBlock: (id: string, name: string) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const prev = get().blocks;
    const next = snapshotBlocks(prev.map(b => b.id === id ? { ...b, name: trimmed } as Block : b));
    set((state) => ({
      historyPast: (() => {
        const h = [...state.historyPast, snapshotBlocks(prev)];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })(),
      historyFuture: [],
      blocks: next,
      hasUnsavedChanges: true,
    }));
    scheduleAutoSave(get);
  },

  duplicateBlock: (id: string) => {
    const prev = get().blocks;
    const src = prev.find(b => b.id === id);
    if (!src) return;
    const copy: Block = {
      id: `${id}-copy-${Date.now()}`,
      type: src.type,
      position: { x: src.position.x + 1, y: src.position.y, z: src.position.z + 1 },
      name: src.name ? `${src.name} Copy` : undefined,
      hidden: false,
      locked: false,
      color: (src as any).color,
      group: (src as any).group,
      rotationY: (src as any).rotationY,
      rotationX: (src as any).rotationX,
      rotationZ: (src as any).rotationZ,
      scale: (src as any).scale,
    } as Block;
    const next = snapshotBlocks([...prev, copy]);
    set((state) => ({
      historyPast: (() => {
        const h = [...state.historyPast, snapshotBlocks(prev)];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })(),
      historyFuture: [],
      blocks: next,
      hasUnsavedChanges: true,
      selectedBlockId: copy.id,
      selectedBlockIds: [copy.id],
    }));
    applyBlocksToScene(next);
    scheduleAutoSave(get);
  },

  addBlocks: (toAdd) => {
    const prev = get().blocks;
    const append = snapshotBlocks(toAdd.map(b => ({
      id: b.id,
      type: b.type,
      position: { ...b.position },
      name: (b as any).name,
      hidden: (b as any).hidden,
      locked: (b as any).locked,
      color: (b as any).color,
      group: (b as any).group,
      rotationY: (b as any).rotationY,
      rotationX: (b as any).rotationX,
      rotationZ: (b as any).rotationZ,
      scale: (b as any).scale,
    } as Block)));
    const next = snapshotBlocks([...prev, ...append]);
    set((state) => ({
      historyPast: (() => {
        const h = [...state.historyPast, snapshotBlocks(prev)];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })(),
      historyFuture: [],
      blocks: next,
      hasUnsavedChanges: true,
    }));
    applyBlocksToScene(next);
    scheduleAutoSave(get);
  },

  paintBlocks: (ids, color) => {
    const idSet = new Set(ids || []);
    const prev = get().blocks;
    const next = snapshotBlocks(prev.map(b => idSet.has(b.id) ? ({ ...b, color } as Block) : b));
    set((state) => ({
      historyPast: (() => {
        const h = [...state.historyPast, snapshotBlocks(prev)];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })(),
      historyFuture: [],
      blocks: next,
      hasUnsavedChanges: true,
    }));
    applyBlocksToScene(next);
    scheduleAutoSave(get);
  },

  setBlockHidden: (id: string, hidden: boolean) => {
    const prev = get().blocks;
    const next = snapshotBlocks(prev.map(b => b.id === id ? { ...b, hidden } as Block : b));
    set((state) => ({
      historyPast: (() => {
        const h = [...state.historyPast, snapshotBlocks(prev)];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })(),
      historyFuture: [],
      blocks: next,
      hasUnsavedChanges: true,
    }));
    scheduleAutoSave(get);
  },

  setBlockLocked: (id: string, locked: boolean) => {
    const prev = get().blocks;
    const next = snapshotBlocks(prev.map(b => b.id === id ? { ...b, locked } as Block : b));
    set((state) => ({
      historyPast: (() => {
        const h = [...state.historyPast, snapshotBlocks(prev)];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })(),
      historyFuture: [],
      blocks: next,
      hasUnsavedChanges: true,
    }));
    scheduleAutoSave(get);
  },

  setBlockGroup: (id: string, group: string) => {
    const prev = get().blocks;
    const next = snapshotBlocks(prev.map(b => b.id === id ? { ...b, group } as Block : b));
    set((state) => ({
      historyPast: (() => {
        const h = [...state.historyPast, snapshotBlocks(prev)];
        return h.length > MAX_HISTORY ? h.slice(-MAX_HISTORY) : h;
      })(),
      historyFuture: [],
      blocks: next,
      hasUnsavedChanges: true,
    }));
    scheduleAutoSave(get);
  },

  loadCurrentProject: () => {
    try {
      const saved = localStorage.getItem('sandbox-current-project');
      if (!saved) return false;
      const project: ProjectData = JSON.parse(saved);
      set({
        projectName: project.name,
        loadedBlocks: snapshotBlocks(project.blocks),
        blocks: snapshotBlocks(project.blocks),
        currentProject: project,
        hasUnsavedChanges: false,
        historyPast: [],
        historyFuture: [],
      });
      return true;
    } catch {
      return false;
    }
  },

  loadProject: (name: string) => {
    const saved = get().savedProjects;
    const project = saved[name];
    if (!project) return false;
    try {
      localStorage.setItem('sandbox-current-project', JSON.stringify(project));
    } catch {}
    set({
      projectName: project.name,
      loadedBlocks: snapshotBlocks(project.blocks),
      blocks: snapshotBlocks(project.blocks),
      currentProject: project,
      hasUnsavedChanges: false,
      historyPast: [],
      historyFuture: [],
    });
    return true;
  },

  renameProject: (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return false;
    const state = get();
    const current = state.currentProject;
    const saved = { ...state.savedProjects };
    if (current) {
      const updated: ProjectData = { ...current, name: trimmed };
      delete saved[current.name];
      saved[trimmed] = updated;
      writeSavedProjects(saved);
      try {
        localStorage.setItem('sandbox-current-project', JSON.stringify(updated));
      } catch {}
      set({ projectName: trimmed, currentProject: updated, savedProjects: saved, hasUnsavedChanges: true });
      return true;
    }
    set({ projectName: trimmed, hasUnsavedChanges: true });
    return true;
  },

  newProject: () => {
    set({
      blocks: [],
      loadedBlocks: [],
      hasUnsavedChanges: false,
      projectName: 'Untitled Project',
      currentProject: null,
      historyPast: [],
      historyFuture: [],
    });
  },

  deleteSavedProject: (name: string) => {
    const saved = { ...get().savedProjects };
    delete saved[name];
    writeSavedProjects(saved);
    set({ savedProjects: saved });
  },

  saveLocalProject: () => {
    const state = get();
    const project: ProjectData = {
      id: state.currentProject?.id,
      name: state.projectName,
      blocks: state.blocks.map(b => ({ id: b.id, type: b.type, position: { ...b.position }, name: (b as any).name, hidden: (b as any).hidden, locked: (b as any).locked, color: (b as any).color, group: (b as any).group, rotationY: (b as any).rotationY, rotationX: (b as any).rotationX, rotationZ: (b as any).rotationZ, scale: (b as any).scale })),
      timestamp: new Date().toISOString(),
      version: '1.2.0',
    };
    const saved = { ...state.savedProjects, [project.name]: project };
    writeSavedProjects(saved);
    try {
      localStorage.setItem('sandbox-current-project', JSON.stringify(project));
    } catch {}
    set({ savedProjects: saved, currentProject: project, hasUnsavedChanges: false });
    return project;
  },

  saveProject: async () => {
    const state = get();
    const baseBody = {
      name: state.projectName,
      blocks: state.blocks.map(b => ({ id: b.id, type: b.type, position: { ...b.position }, name: (b as any).name, hidden: (b as any).hidden, locked: (b as any).locked, color: (b as any).color, group: (b as any).group, rotationY: (b as any).rotationY, rotationX: (b as any).rotationX, rotationZ: (b as any).rotationZ, scale: (b as any).scale })),
    };
    try {
      // Try capture thumbnail from scene if available
      let thumbnail: string | undefined;
      try { thumbnail = (window as any).scene3D?.captureThumbnail?.({ type: 'image/jpeg', quality: 0.8 }); } catch {}
      const bodyWithThumb = { ...baseBody, ...(thumbnail ? { thumbnail } : {}) } as any;
      let result: { game: { id: string; name: string; updatedAt?: string } };
      if (state.currentProject?.id) {
        result = await apiFetch(`/games/${state.currentProject.id}`, { method: 'PUT', body: JSON.stringify(bodyWithThumb) });
      } else {
        result = await apiFetch(`/games`, { method: 'POST', body: JSON.stringify(bodyWithThumb) });
      }
      const updated: ProjectData = {
        id: (result as any).game.id,
        name: (result as any).game.name,
        blocks: state.blocks,
        timestamp: new Date().toISOString(),
        version: '1.2.0',
      };
      const saved = { ...state.savedProjects, [updated.name]: updated };
      writeSavedProjects(saved);
      try {
        localStorage.setItem('sandbox-current-project', JSON.stringify(updated));
      } catch {}
      set({ currentProject: updated, projectName: updated.name, savedProjects: saved, hasUnsavedChanges: false });
      pushVersionHistory(updated.name, updated.timestamp);
      return { savedTo: 'cloud', project: updated } as SaveResult;
    } catch {
      const project = state.saveLocalProject();
      return { savedTo: 'local', project } as SaveResult;
    }
  },

  publishProject: async (published: boolean) => {
    const state = get();
    if (!state.currentProject?.id) return false;
    try {
      // Thumb on publishing for better cover freshness
      let thumbnail: string | undefined;
      try { thumbnail = (window as any).scene3D?.captureThumbnail?.({ type: 'image/jpeg', quality: 0.8 }); } catch {}
      const resp = await apiFetch(`/games/${state.currentProject.id}`, { method: 'PUT', body: JSON.stringify({ published, ...(thumbnail ? { thumbnail } : {}) }) });
      const updated: ProjectData = { ...(state.currentProject as any), published: (resp as any).game.published, timestamp: new Date().toISOString() };
      const saved = { ...state.savedProjects, [updated.name]: updated };
      writeSavedProjects(saved);
      try { localStorage.setItem('sandbox-current-project', JSON.stringify(updated)); } catch {}
      set({ currentProject: updated, savedProjects: saved });
      return true;
    } catch {
      return false;
    }
  },

  restoreAutoSaveIfPresent: () => {
    try {
      const auto = localStorage.getItem('sandbox-autosave');
      if (!auto || localStorage.getItem('sandbox-current-project')) return false;
      const data: ProjectData = JSON.parse(auto);
      if (!data?.blocks?.length) return false;
      set({ projectName: data.name, loadedBlocks: data.blocks, blocks: data.blocks, hasUnsavedChanges: true, currentProject: data });
      try {
        localStorage.setItem('sandbox-current-project', JSON.stringify(data));
        localStorage.removeItem('sandbox-autosave');
      } catch {}
      return true;
    } catch {
      return false;
    }
  },
}));


