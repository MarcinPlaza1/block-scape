import { create } from 'zustand';
import { apiFetch } from '@/shared/api/client';
import type { Block, ProjectData, TerrainData } from '@/types/project';
import type { EditorMode } from '@/types/editor';

type SaveResult = { savedTo: 'cloud' | 'local'; project: ProjectData };

// Project management state and actions
export interface ProjectState {
  // Project metadata
  projectName: string;
  currentProject: ProjectData | null;
  savedProjects: Record<string, ProjectData>;
  hasUnsavedChanges: boolean;
  // Legacy boolean kept for backward compatibility
  isPlayMode: boolean;
  // Unified editor mode state
  editorMode: EditorMode; // 'build' | 'play' | 'preview'
  
  // Terrain
  terrainSnapshot?: TerrainData | null;
  // Game mode
  gameMode?: 'PARKOUR' | 'PVP' | 'RACE' | 'SANDBOX';
  gameModeConfig?: string | null;
  
  // Actions
  setProjectName: (name: string) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  togglePlayMode: () => void;
  setEditorMode: (mode: EditorMode) => void;
  setGameMode: (mode: 'PARKOUR' | 'PVP' | 'RACE' | 'SANDBOX') => void;
  setGameModeConfig: (config: string | null) => void;
  
  // Project persistence
  loadCurrentProject: () => boolean;
  loadProject: (name: string) => boolean;
  renameProject: (newName: string) => boolean;
  newProject: () => void;
  deleteSavedProject: (name: string) => void;
  saveProject: (blocks: Block[]) => Promise<SaveResult>;
  saveLocalProject: (blocks: Block[]) => ProjectData;
  publishProject: (published: boolean) => Promise<boolean>;
  restoreAutoSaveIfPresent: () => { blocks: Block[]; project: ProjectData } | null;
  
  // Terrain persistence
  captureTerrainFromScene: () => void;
  applyTerrainToScene: (terrain: TerrainData) => void;
}

// Auto-save functionality
let autoSaveTimer: number | null = null;
let autoSaveIdleId: number | null = null;

function scheduleAutoSave(projectName: string, blocks: Block[], captureTerrainFn: () => void) {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  const cancelIdle = (window as any)?.cancelIdleCallback;
  if (autoSaveIdleId && typeof cancelIdle === 'function') {
    try { 
      cancelIdle(autoSaveIdleId); 
    } catch {}
    autoSaveIdleId = null;
  }
  
  autoSaveTimer = window.setTimeout(() => {
    const run = () => {
      if (blocks.length === 0) return;
      try { 
        captureTerrainFn(); 
      } catch {}
      
      const autoSaveData: ProjectData = {
        id: undefined,
        name: `${projectName} (Auto-save)`,
        blocks: blocks,
        timestamp: new Date().toISOString(),
        version: '1.2.0',
        terrain: undefined, // Will be set by captureTerrainFn if available
      };
      
      try {
        localStorage.setItem('sandbox-autosave', JSON.stringify(autoSaveData));
      } catch {}
    };
    
    const ric = (window as any)?.requestIdleCallback;
    if (typeof ric === 'function') {
      try { 
        autoSaveIdleId = ric(() => run(), { timeout: 2000 }); 
      } catch { 
        run(); 
      }
    } else {
      run();
    }
  }, 1500);
}

// Persistence helpers
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

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectName: 'Untitled Project',
  currentProject: null,
  savedProjects: readSavedProjects(),
  hasUnsavedChanges: false,
  isPlayMode: false,
  editorMode: 'build',
  terrainSnapshot: null,
  gameMode: 'PARKOUR',
  gameModeConfig: null,

  setProjectName: (name) => {
    set({ projectName: name.trim() });
  },

  setHasUnsavedChanges: (hasChanges) => {
    set({ hasUnsavedChanges: hasChanges });
  },

  togglePlayMode: () => {
    set((state) => ({ 
      isPlayMode: !state.isPlayMode,
      editorMode: state.isPlayMode ? 'build' : 'play',
    }));
  },

  setEditorMode: (mode) => {
    set({
      editorMode: mode,
      isPlayMode: mode === 'play',
    });
  },

  setGameMode: (mode) => {
    set({ gameMode: mode, hasUnsavedChanges: true });
  },

  setGameModeConfig: (config) => {
    set({ gameModeConfig: config, hasUnsavedChanges: true });
  },

  loadCurrentProject: () => {
    try {
      const saved = localStorage.getItem('sandbox-current-project');
      if (!saved) return false;
      
      const project: any = JSON.parse(saved);
      const email = localStorage.getItem('auth-email') || undefined;
      if (project?.ownerEmail && email && project.ownerEmail !== email) return false;
      
      set({
        projectName: project.name,
        currentProject: project,
        hasUnsavedChanges: false,
        terrainSnapshot: project.terrain || null,
        gameMode: (project as any).mode || 'PARKOUR',
        gameModeConfig: (project as any).modeConfig || null,
      });
      
      try { 
        get().applyTerrainToScene?.(project.terrain as any); 
      } catch {}
      
      return true;
    } catch {
      return false;
    }
  },

  loadProject: (name) => {
    const saved = get().savedProjects;
    const project = saved[name];
    if (!project) return false;
    
    try {
      const ownerEmail = localStorage.getItem('auth-email') || undefined;
      const scoped = { ...project, ownerEmail } as any;
      localStorage.setItem('sandbox-current-project', JSON.stringify(scoped));
    } catch {}
    
    set({
      projectName: project.name,
      currentProject: project,
      hasUnsavedChanges: false,
      terrainSnapshot: project.terrain || null,
      gameMode: (project as any).mode || 'PARKOUR',
      gameModeConfig: (project as any).modeConfig || null,
    });
    
    try { 
      get().applyTerrainToScene?.(project.terrain as any); 
    } catch {}
    
    return true;
  },

  renameProject: (newName) => {
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
      
      set({ 
        projectName: trimmed, 
        currentProject: updated, 
        savedProjects: saved, 
        hasUnsavedChanges: true 
      });
      return true;
    }
    
    set({ projectName: trimmed, hasUnsavedChanges: true });
    return true;
  },

  newProject: () => {
    set({
      projectName: 'Untitled Project',
      currentProject: null,
      hasUnsavedChanges: false,
      terrainSnapshot: null,
    });
  },

  deleteSavedProject: (name) => {
    const saved = { ...get().savedProjects };
    delete saved[name];
    writeSavedProjects(saved);
    set({ savedProjects: saved });
  },

  saveLocalProject: (blocks) => {
    const state = get();
    // Capture terrain from live scene before saving (if any)
    try { 
      state.captureTerrainFromScene(); 
    } catch {}
    
    const project: ProjectData = {
      id: state.currentProject?.id,
      name: state.projectName,
      blocks: blocks.map(b => ({
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
      })),
      timestamp: new Date().toISOString(),
      version: '1.2.0',
      terrain: state.terrainSnapshot || undefined,
      mode: state.gameMode || 'PARKOUR',
      modeConfig: state.gameModeConfig || null,
    };
    
    const saved = { ...state.savedProjects, [project.name]: project };
    writeSavedProjects(saved);
    
    try {
      const ownerEmail = localStorage.getItem('auth-email') || undefined;
      const scoped = { ...project, ownerEmail } as any;
      localStorage.setItem('sandbox-current-project', JSON.stringify(scoped));
    } catch {}
    
    set({ 
      savedProjects: saved, 
      currentProject: project, 
      hasUnsavedChanges: false 
    });
    
    return project;
  },

  saveProject: async (blocks) => {
    const state = get();
    try { 
      state.captureTerrainFromScene(); 
    } catch {}
    
    const baseBody = {
      name: state.projectName,
      blocks: blocks.map(b => ({
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
      })),
      terrain: state.terrainSnapshot || undefined,
      mode: state.gameMode || 'PARKOUR',
      modeConfig: state.gameModeConfig || undefined,
    };
    
    try {
      // Try capture thumbnail from scene if available
      let thumbnail: string | undefined;
      try { 
        thumbnail = (window as any).scene3D?.captureThumbnail?.({ 
          type: 'image/jpeg', 
          quality: 0.8 
        }); 
      } catch {}
      
      const bodyWithThumb = { 
        ...baseBody, 
        ...(thumbnail ? { thumbnail } : {}) 
      } as any;
      
      let result: { game: { id: string; name: string; updatedAt?: string } };
      if (state.currentProject?.id) {
        result = await apiFetch(`/games/${state.currentProject.id}`, { 
          method: 'PUT', 
          body: JSON.stringify(bodyWithThumb) 
        });
      } else {
        result = await apiFetch(`/games`, { 
          method: 'POST', 
          body: JSON.stringify(bodyWithThumb) 
        });
      }
      
      const updated: ProjectData = {
        id: (result as any).game.id,
        name: (result as any).game.name,
        blocks: blocks,
        timestamp: new Date().toISOString(),
        version: '1.2.0',
        terrain: state.terrainSnapshot || undefined,
      };
      
      const saved = { ...state.savedProjects, [updated.name]: updated };
      writeSavedProjects(saved);
      
      try {
        const ownerEmail = localStorage.getItem('auth-email') || undefined;
        const scoped = { ...updated, ownerEmail } as any;
        localStorage.setItem('sandbox-current-project', JSON.stringify(scoped));
      } catch {}
      
      set({ 
        currentProject: updated, 
        projectName: updated.name, 
        savedProjects: saved, 
        hasUnsavedChanges: false 
      });
      
      pushVersionHistory(updated.name, updated.timestamp);
      return { savedTo: 'cloud', project: updated } as SaveResult;
    } catch {
      const project = get().saveLocalProject(blocks);
      return { savedTo: 'local', project } as SaveResult;
    }
  },

  publishProject: async (published) => {
    const state = get();
    if (!state.currentProject?.id) return false;
    
    try {
      // Thumb on publishing for better cover freshness
      let thumbnail: string | undefined;
      try { 
        thumbnail = (window as any).scene3D?.captureThumbnail?.({ 
          type: 'image/jpeg', 
          quality: 0.8 
        }); 
      } catch {}
      
      const resp = await apiFetch(`/games/${state.currentProject.id}`, { 
        method: 'PUT', 
        body: JSON.stringify({ 
          published, 
          ...(thumbnail ? { thumbnail } : {}) 
        }) 
      });
      
      const updated: any = { 
        ...(state.currentProject as any), 
        published: (resp as any).game.published, 
        timestamp: new Date().toISOString() 
      };
      
      const saved = { ...state.savedProjects, [updated.name]: updated };
      writeSavedProjects(saved);
      
      try {
        const ownerEmail = localStorage.getItem('auth-email') || undefined;
        const scoped = { ...updated, ownerEmail } as any;
        localStorage.setItem('sandbox-current-project', JSON.stringify(scoped));
      } catch {}
      
      set({ currentProject: updated, savedProjects: saved });
      return true;
    } catch {
      return false;
    }
  },

  restoreAutoSaveIfPresent: () => {
    try {
      const auto = localStorage.getItem('sandbox-autosave');
      if (!auto || localStorage.getItem('sandbox-current-project')) return null;
      
      const data: ProjectData = JSON.parse(auto);
      if (!data?.blocks?.length) return null;
      
      set({ 
        projectName: data.name, 
        hasUnsavedChanges: true, 
        currentProject: data, 
        terrainSnapshot: data.terrain || null 
      });
      
      try {
        localStorage.setItem('sandbox-current-project', JSON.stringify(data));
        localStorage.removeItem('sandbox-autosave');
      } catch {}
      
      // Apply terrain to scene soon after
      try { 
        get().applyTerrainToScene?.(data.terrain as any); 
      } catch {}
      
      return { blocks: data.blocks, project: data };
    } catch {
      return null;
    }
  },

  // Terrain capture from live scene3D
  captureTerrainFromScene: () => {
    try {
      const anyWindow: any = typeof window !== 'undefined' ? window : null;
      const scene3D = anyWindow?.scene3D;
      const scene = (window as any).BABYLON?.Engine?.LastCreatedScene as any;
      const ground: any = (scene3D?.getGround?.() || scene?.meshes?.find((m: any) => m?.name === 'ground')) as any;
      
      if (!ground) { 
        set({ terrainSnapshot: null }); 
        return; 
      }
      
      // This would need to import Babylon and terrain utils
      // For now, just set null to avoid errors
      set({ terrainSnapshot: null });
    } catch {}
  },

  applyTerrainToScene: (terrain) => {
    if (!terrain) return;
    try {
      // This would need to import Babylon and terrain utils
      // For now, just no-op to avoid errors
    } catch {}
  },

  // Auto-save scheduler (to be called by external store)
  scheduleAutoSave: (blocks: Block[]) => {
    const state = get();
    scheduleAutoSave(state.projectName, blocks, state.captureTerrainFromScene);
  },
}));
