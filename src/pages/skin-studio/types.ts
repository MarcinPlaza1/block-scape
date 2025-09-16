import type { RefObject } from 'react';
import type { PlayerSkinId } from '@/features/player/store';
import type { SkinListingWithSkin, SkinVisibilityFilter, SkinWithListings } from '@/types/skins';
import type { UserProfile } from '@/types/profile';
import type { ActiveLayer } from '@/pages/skin-studio/lib/voxel-utils';

export type EditorMode = 'preview' | 'edit';
export type EditorTool = 'add' | 'remove' | 'paint';
export type EditorBrush = 'point' | 'line' | 'rect' | 'sphere';
export type AxisLock = 'auto' | 'x' | 'y' | 'z';
export type QualitySetting = 'low' | 'medium' | 'high';
export type SkinStudioTab = 'editor' | 'library' | 'marketplace';

export interface SkinPreset {
  id: string;
  name: string;
  skinId: PlayerSkinId;
  primary: string;
  secondary: string;
}

export interface SkinAppearanceState {
  skinId: PlayerSkinId;
  setSkinId: (id: PlayerSkinId) => void;
  primaryHex: string;
  setPrimaryHex: (value: string) => void;
  secondaryHex: string;
  setSecondaryHex: (value: string) => void;
  scale: number;
  setScale: (value: number) => void;
  rotationSpeed: number;
  setRotationSpeed: (value: number) => void;
  save: () => Promise<void>;
  reset: () => void;
  randomize: () => void;
}

export interface SkinPresetsState {
  presets: SkinPreset[];
  selectedPresetId: string;
  savePreset: () => void;
  loadPreset: (id: string) => void;
  deletePreset: (id: string) => void;
}

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

export interface VoxelEditorState {
  tool: EditorTool;
  setTool: (tool: EditorTool) => void;
  brush: EditorBrush;
  setBrush: (brush: EditorBrush) => void;
  axisLock: AxisLock;
  setAxisLock: (axis: AxisLock) => void;
  activeLayer: ActiveLayer;
  setActiveLayer: (layer: ActiveLayer) => void;
  selectedColorIndex: number;
  setSelectedColorIndex: (index: number) => void;
  palette: string[];
  setPaletteColor: (index: number, color: string) => void;
  brushRadius: number;
  setBrushRadius: (radius: number) => void;
  showGrid: boolean;
  setShowGrid: (visible: boolean) => void;
  snapToSegments: boolean;
  setSnapToSegments: (enabled: boolean) => void;
  mirrorX: boolean;
  setMirrorX: (enabled: boolean) => void;
  clear: () => void;
  exportVoxels: () => void;
  importVoxels: () => void;
  exportRLE: () => void;
  importRLE: () => void;
  saveRLEToAccount: () => Promise<void>;
  loadRLEFromAccount: () => Promise<void>;
  undoRedo: UndoRedoState;
}

export interface EditorState {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  showBaseModel: boolean;
  setShowBaseModel: (value: boolean) => void;
  quality: QualitySetting;
  setQuality: (quality: QualitySetting) => void;
  appearance: SkinAppearanceState;
  voxels: VoxelEditorState;
  presets: SkinPresetsState;
}

export interface LibraryActions {
  create: (name: string, publish: boolean) => Promise<void>;
  load: (skin: SkinWithListings) => void;
  apply: (skin: SkinWithListings) => Promise<void>;
  togglePublish: (skin: SkinWithListings, publish: boolean) => Promise<void>;
  remove: (skin: SkinWithListings) => Promise<void>;
  createListing: (skin: SkinWithListings, price: string) => Promise<void>;
  updateListing: (skin: SkinWithListings, listingId: string, price: string) => Promise<void>;
  cancelListing: (skin: SkinWithListings, listingId: string) => Promise<void>;
}

export interface LibraryState {
  isAuthenticated: boolean;
  newSkinName: string;
  setNewSkinName: (value: string) => void;
  filter: SkinVisibilityFilter;
  setFilter: (filter: SkinVisibilityFilter) => void;
  search: string;
  setSearch: (value: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
  items: SkinWithListings[];
  filteredItems: SkinWithListings[];
  actions: LibraryActions;
}

export type MarketplaceFilter = 'available' | 'all' | 'owned';
export type MarketplaceSort = 'recent' | 'price-asc' | 'price-desc';

export interface MarketplaceActions {
  preview: (listing: SkinListingWithSkin) => void;
  purchase: (listing: SkinListingWithSkin) => Promise<void>;
}

export interface MarketplaceState {
  filter: MarketplaceFilter;
  setFilter: (filter: MarketplaceFilter) => void;
  search: string;
  setSearch: (value: string) => void;
  sort: MarketplaceSort;
  setSort: (sort: MarketplaceSort) => void;
  listings: SkinListingWithSkin[];
  filteredListings: SkinListingWithSkin[];
  loading: boolean;
  refresh: () => Promise<void>;
  actions: MarketplaceActions;
}

export interface SkinStudioController {
  canvasRef: RefObject<HTMLCanvasElement>;
  layout: { activeTab: SkinStudioTab; setActiveTab: (tab: SkinStudioTab) => void };
  editor: EditorState;
  library: LibraryState;
  marketplace: MarketplaceState;
  currentUser: UserProfile | null;
  isActionBusy: (key: string) => boolean;
}
