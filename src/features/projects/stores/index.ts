// Composite store that combines all project-related stores
// This provides a unified API while keeping the implementation modular

import { useBlocksStore } from './blocks.store';
import { useHistoryStore } from './history.store';
import { useInventoryStore } from './inventory.store';
import { useEditorSettingsStore } from './editor-settings.store';
import { useProjectStore as useProjectStoreBase } from './project.store';

import type { Block, BlockType, ProjectData, TerrainData } from '@/types/project';
import type { EditorMode } from '@/types/editor';

// Combined interface for backward compatibility
export interface CompositeProjectState {
  // From BlocksStore
  blocks: Block[];
  droppedBlock: { type: BlockType } | null;
  selectedTool: 'select' | 'move' | 'paint' | 'place';
  selectedBlockId: string | null;
  selectedBlockIds: string[];
  
  // From ProjectStore
  projectName: string;
  hasUnsavedChanges: boolean;
  isPlayMode: boolean;
  editorMode: EditorMode;
  currentProject: ProjectData | null;
  savedProjects: Record<string, ProjectData>;
  terrainSnapshot?: TerrainData | null;
  
  // From InventoryStore
  inventorySlots: Array<{ type: BlockType; color?: number } | null>;
  selectedInventorySlot: number;
  lastUsedColorByType: Partial<Record<BlockType, number>>;
  
  // From EditorSettingsStore
  gridVisible: boolean;
  snapEnabled: boolean;
  snapSize: number;
  placeMultiple: boolean;
  builderModeEnabled: boolean;
  builderCurrentType: BlockType;
  builderCurrentColor: number;
  noUiModeEnabled: boolean;
  terrainBrushMode: 'raise' | 'lower' | 'smooth' | 'paint';
  terrainBrushSize: number;
  terrainBrushStrength: number;
  terrainBrushColor: number;
  
  // From HistoryStore
  historyPast: Block[][];
  historyFuture: Block[][];
  
  // Combined actions
  setDroppedBlock: (payload: { type: BlockType } | null) => void;
  addBlock: (block: Block) => void;
  setBlocks: (blocks: Block[]) => void;
  clearScene: () => void;
  togglePlay: () => void;
  setSelectedTool: (tool: 'select' | 'move' | 'paint' | 'place') => void;
  setSelectedBlockId: (id: string | null) => void;
  setSelectedBlockIds: (ids: string[]) => void;
  setEditorMode: (mode: EditorMode) => void;
  
  // Inventory actions
  setInventorySlot: (index: number, item: { type: BlockType; color?: number } | null) => void;
  selectInventorySlot: (index: number) => void;
  cycleInventorySlot: (direction: 1 | -1) => void;
  setLastUsedColorForType: (type: BlockType, color: number) => void;
  
  // Block manipulation
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
  setBuilderModeEnabled: (enabled: boolean) => void;
  setBuilderCurrentType: (type: BlockType) => void;
  setBuilderCurrentColor: (color: number) => void;
  setNoUiModeEnabled: (enabled: boolean) => void;
  
  // Terrain brush actions
  setTerrainBrushMode: (mode: 'raise' | 'lower' | 'smooth' | 'paint') => void;
  setTerrainBrushSize: (size: number) => void;
  setTerrainBrushStrength: (strength: number) => void;
  setTerrainBrushColor: (color: number) => void;
  
  // Project actions
  loadCurrentProject: () => boolean;
  loadProject: (name: string) => boolean;
  renameProject: (newName: string) => boolean;
  newProject: () => void;
  deleteSavedProject: (name: string) => void;
  saveProject: () => Promise<{ savedTo: 'cloud' | 'local'; project: ProjectData }>;
  saveLocalProject: () => ProjectData;
  publishProject: (published: boolean) => Promise<boolean>;
  restoreAutoSaveIfPresent: () => boolean;
  
  // Terrain persistence helpers
  captureTerrainFromScene: () => void;
  applyTerrainToScene: (terrain: TerrainData) => void;
}

// Hook that provides the composite interface
export const useProjectStore = (): CompositeProjectState => {
  const blocksStore = useBlocksStore();
  const historyStore = useHistoryStore();
  const inventoryStore = useInventoryStore();
  const editorStore = useEditorSettingsStore();
  const projectStore = useProjectStoreBase();
  
  // Auto-save scheduling
  const scheduleAutoSave = () => {
    (projectStore as any).scheduleAutoSave?.(blocksStore.blocks);
  };
  
  // Enhanced actions that coordinate between stores
  const addBlock = (block: Block) => {
    historyStore.pushToHistory(blocksStore.blocks);
    blocksStore.addBlock(block);
    projectStore.setHasUnsavedChanges(true);
    scheduleAutoSave();
  };
  
  const setBlocks = (blocks: Block[]) => {
    const shouldPushHistory = blocks.length !== blocksStore.blocks.length || 
      blocks.some((b, i) => b.id !== blocksStore.blocks[i]?.id);
      
    if (shouldPushHistory) {
      historyStore.pushToHistory(blocksStore.blocks);
    }
    
    blocksStore.setBlocks(blocks);
    projectStore.setHasUnsavedChanges(blocks.length > 0);
    scheduleAutoSave();
  };
  
  const clearScene = () => {
    if (blocksStore.blocks.length > 0) {
      historyStore.pushToHistory(blocksStore.blocks);
    }
    blocksStore.clearBlocks();
    projectStore.setHasUnsavedChanges(false);
    projectStore.terrainSnapshot = null;
  };
  
  const undo = () => {
    const previousBlocks = historyStore.undo(blocksStore.blocks);
    if (previousBlocks) {
      blocksStore.setBlocks(previousBlocks);
      projectStore.setHasUnsavedChanges(previousBlocks.length > 0);
      scheduleAutoSave();
    }
  };
  
  const redo = () => {
    const nextBlocks = historyStore.redo(blocksStore.blocks);
    if (nextBlocks) {
      blocksStore.setBlocks(nextBlocks);
      projectStore.setHasUnsavedChanges(nextBlocks.length > 0);
      scheduleAutoSave();
    }
  };
  
  // Enhanced block manipulation actions
  const createHistoryAction = <A extends any[]>(fn: (...args: A) => void) => {
    return (...args: A) => {
      historyStore.pushToHistory(blocksStore.blocks);
      fn(...args);
      projectStore.setHasUnsavedChanges(true);
      scheduleAutoSave();
    };
  };
  
  const removeBlock = createHistoryAction(blocksStore.removeBlock);
  const removeBlocks = createHistoryAction(blocksStore.removeBlocks);
  const setBlockColor = createHistoryAction(blocksStore.setBlockColor);
  const setBlockPosition = createHistoryAction(blocksStore.setBlockPosition);
  const setBlockRotationY = createHistoryAction(blocksStore.setBlockRotationY);
  const setBlockRotationX = createHistoryAction(blocksStore.setBlockRotationX);
  const setBlockRotationZ = createHistoryAction(blocksStore.setBlockRotationZ);
  const setBlockScale = createHistoryAction(blocksStore.setBlockScale);
  const renameBlock = createHistoryAction(blocksStore.renameBlock);
  const duplicateBlock = createHistoryAction(blocksStore.duplicateBlock);
  const setBlockHidden = createHistoryAction(blocksStore.setBlockHidden);
  const setBlockLocked = createHistoryAction(blocksStore.setBlockLocked);
  const setBlockGroup = createHistoryAction(blocksStore.setBlockGroup);
  const addBlocks = createHistoryAction(blocksStore.addBlocks);
  const paintBlocks = createHistoryAction(blocksStore.paintBlocks);
  
  // Enhanced project actions
  const loadCurrentProject = () => {
    const result = projectStore.loadCurrentProject();
    if (result) {
      const currentProject = projectStore.currentProject;
      if (currentProject) {
        blocksStore.setBlocks(currentProject.blocks);
        historyStore.clearHistory();
      }
    }
    return result;
  };
  
  const loadProject = (name: string) => {
    const result = projectStore.loadProject(name);
    if (result) {
      const currentProject = projectStore.currentProject;
      if (currentProject) {
        blocksStore.setBlocks(currentProject.blocks);
        historyStore.clearHistory();
      }
    }
    return result;
  };
  
  const newProject = () => {
    blocksStore.clearBlocks();
    historyStore.clearHistory();
    projectStore.newProject();
  };
  
  const saveProject = async () => {
    return await projectStore.saveProject(blocksStore.blocks);
  };
  
  const saveLocalProject = () => {
    return projectStore.saveLocalProject(blocksStore.blocks);
  };
  
  const restoreAutoSaveIfPresent = () => {
    const result = projectStore.restoreAutoSaveIfPresent();
    if (result) {
      blocksStore.setBlocks(result.blocks);
      historyStore.clearHistory();
      return true;
    }
    return false;
  };
  
  // Pass through editor settings actions
  // const setSelectedTool = (tool: 'select' | 'move' | 'paint' | 'place') => {
  //   editorStore.setSelectedTool(tool);
  // };

  return {
    // State from all stores
    ...blocksStore,
    ...historyStore,
    ...inventoryStore,
    ...editorStore,
    ...projectStore,
    
    // Enhanced coordinated actions
    addBlock,
    setBlocks,
    clearScene,
    undo,
    redo,
    removeBlock: removeBlock as any,
    removeBlocks: removeBlocks as any,
    setBlockColor: setBlockColor as any,
    setBlockPosition: setBlockPosition as any,
    setBlockRotationY: setBlockRotationY as any,
    setBlockRotationX: setBlockRotationX as any,
    setBlockRotationZ: setBlockRotationZ as any,
    setBlockScale: setBlockScale as any,
    renameBlock: renameBlock as any,
    duplicateBlock: duplicateBlock as any,
    setBlockHidden: setBlockHidden as any,
    setBlockLocked: setBlockLocked as any,
    setBlockGroup: setBlockGroup as any,
    addBlocks: addBlocks as any,
    paintBlocks: paintBlocks as any,
    loadCurrentProject,
    loadProject,
    newProject,
    saveProject,
    saveLocalProject,
    restoreAutoSaveIfPresent,
    
    // Direct pass-through actions
    togglePlay: projectStore.togglePlayMode,
    setSelectedTool: editorStore.setSelectedTool,
    setEditorMode: projectStore.setEditorMode,
  };
};

// Export individual stores for fine-grained access when needed
export { useBlocksStore, useHistoryStore, useInventoryStore, useEditorSettingsStore, useProjectStoreBase };
