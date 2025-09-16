import { create } from 'zustand';
import type { Block } from '../../../../../types';
import type { RenderableBlock } from '../shared/Renderer';

export interface EditState {
  // Project
  projectName: string;
  projectId: string | null;
  isDirty: boolean;
  
  // Blocks
  blocks: Block[];
  selectedBlockId: string | null;
  selectedBlockIds: string[]; // multi-select
  hoveredBlockId: string | null;
  copiedBlock: Block | null;
  
  // Tools
  currentTool: 'select' | 'place' | 'move' | 'rotate' | 'scale' | 'delete';
  currentBlockType: string;
  currentBlockColor: string;
  
  // UI
  gridVisible: boolean;
  gizmoType: 'position' | 'rotation' | 'scale' | 'bounding' | null;
  showBlockInventory: boolean;
  showInspector: boolean;
  showHierarchy: boolean;
  
  // Camera
  cameraMode: 'orbit' | 'free' | 'ortho';
  
  // History
  history: Block[][];
  historyIndex: number;
  maxHistorySize: number;
  
  // Actions
  setProjectName: (name: string) => void;
  setProjectId: (id: string | null) => void;
  setDirty: (dirty: boolean) => void;
  
  // Block actions
  addBlock: (block: Block) => void;
  removeBlock: (id: string) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  selectBlock: (id: string | null) => void;
  setSelectedBlockIds: (ids: string[]) => void;
  hoverBlock: (id: string | null) => void;
  copyBlock: (block: Block | null) => void;
  pasteBlock: (position: { x: number; y: number; z: number }) => void;
  clearBlocks: () => void;
  loadBlocks: (blocks: Block[]) => void;
  
  // Tool actions
  setCurrentTool: (tool: EditState['currentTool']) => void;
  setCurrentBlockType: (type: string) => void;
  setCurrentBlockColor: (color: string) => void;
  
  // UI actions
  toggleGrid: () => void;
  setGizmoType: (type: EditState['gizmoType']) => void;
  toggleBlockInventory: () => void;
  toggleInspector: () => void;
  toggleHierarchy: () => void;
  
  // Camera actions
  setCameraMode: (mode: EditState['cameraMode']) => void;
  
  // History actions
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

export const useEditState = create<EditState>((set, get) => ({
  // Initial state
  projectName: 'Untitled Project',
  projectId: null,
  isDirty: false,
  
  blocks: [],
  selectedBlockId: null,
  selectedBlockIds: [],
  hoveredBlockId: null,
  copiedBlock: null,
  
  currentTool: 'select',
  currentBlockType: 'cube',
  currentBlockColor: '#ff0000',
  
  gridVisible: true,
  gizmoType: null,
  showBlockInventory: true,
  showInspector: true,
  showHierarchy: true,
  
  cameraMode: 'orbit',
  
  history: [[]],
  historyIndex: 0,
  maxHistorySize: 50,
  
  // Actions
  setProjectName: (name) => set({ projectName: name, isDirty: true }),
  setProjectId: (id) => set({ projectId: id }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  
  // Block actions
  addBlock: (block) => {
    set((state) => {
      const newBlocks = [...state.blocks, block];
      return {
        blocks: newBlocks,
        isDirty: true,
        selectedBlockId: block.id,
        selectedBlockIds: [block.id],
      };
    });
    get().pushHistory();
  },
  
  removeBlock: (id) => {
    set((state) => ({
      blocks: state.blocks.filter(b => b.id !== id),
      isDirty: true,
      selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
      selectedBlockIds: state.selectedBlockIds.filter(bid => bid !== id),
    }));
    get().pushHistory();
  },
  
  updateBlock: (id, updates) => {
    set((state) => ({
      blocks: state.blocks.map(b => 
        b.id === id ? { ...b, ...updates } : b
      ),
      isDirty: true,
    }));
    get().pushHistory();
  },
  
  selectBlock: (id) => set({ selectedBlockId: id, selectedBlockIds: id ? [id] : [] }),
  setSelectedBlockIds: (ids) => set({ selectedBlockIds: [...ids], selectedBlockId: ids.length === 1 ? ids[0] : null }),
  hoverBlock: (id) => set({ hoveredBlockId: id }),
  copyBlock: (block) => set({ copiedBlock: block }),
  
  pasteBlock: (position) => {
    const { copiedBlock } = get();
    if (!copiedBlock) return;
    
    const newBlock: Block = {
      ...copiedBlock,
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      position: { ...position },
    };
    
    get().addBlock(newBlock);
  },
  
  clearBlocks: () => {
    set({
      blocks: [],
      selectedBlockId: null,
      selectedBlockIds: [],
      hoveredBlockId: null,
      isDirty: true,
    });
    get().pushHistory();
  },
  
  loadBlocks: (blocks) => {
    set({
      blocks: blocks,
      selectedBlockId: null,
      selectedBlockIds: [],
      hoveredBlockId: null,
      isDirty: false,
      history: [blocks],
      historyIndex: 0,
    });
  },
  
  // Tool actions
  setCurrentTool: (tool) => set({ currentTool: tool }),
  setCurrentBlockType: (type) => set({ currentBlockType: type }),
  setCurrentBlockColor: (color) => set({ currentBlockColor: color }),
  
  // UI actions
  toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),
  setGizmoType: (type) => set({ gizmoType: type }),
  toggleBlockInventory: () => set((state) => ({ showBlockInventory: !state.showBlockInventory })),
  toggleInspector: () => set((state) => ({ showInspector: !state.showInspector })),
  toggleHierarchy: () => set((state) => ({ showHierarchy: !state.showHierarchy })),
  
  // Camera actions
  setCameraMode: (mode) => set({ cameraMode: mode }),
  
  // History actions
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({
        blocks: [...history[newIndex]],
        historyIndex: newIndex,
        isDirty: true,
      });
    }
  },
  
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({
        blocks: [...history[newIndex]],
        historyIndex: newIndex,
        isDirty: true,
      });
    }
  },
  
  pushHistory: () => {
    const { blocks, history, historyIndex, maxHistorySize } = get();
    const newHistory = [...history.slice(0, historyIndex + 1), [...blocks]];
    if (newHistory.length > maxHistorySize) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },
}));
