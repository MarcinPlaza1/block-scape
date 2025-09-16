// Editor and 3D engine related types
// Types for the 3D editor, Babylon.js integration, and scene management

import type { BlockType } from './project';

// Editor modes and tools
export type EditorMode = 'build' | 'play' | 'preview';
export type EditorTool = 'select' | 'move' | 'rotate' | 'scale' | 'paint' | 'terrain' | 'camera';

// Camera types
export type CameraMode = 'free' | 'orbit' | 'first-person' | 'third-person' | 'top-down' | 'isometric';

export interface CameraState {
  mode: CameraMode;
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  fov?: number;
  distance?: number; // for orbit camera
  rotation?: { x: number; y: number; z: number };
  locked?: boolean;
}

// Selection and interaction
export interface SelectionBox {
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
}

export interface RaycastResult {
  hit: boolean;
  point?: { x: number; y: number; z: number };
  normal?: { x: number; y: number; z: number };
  distance?: number;
  entity?: any; // Block or terrain
}

// Grid and snapping
export interface GridSettings {
  visible: boolean;
  size: number;
  subdivisions: number;
  color: string;
  opacity: number;
  adaptive: boolean; // Show different grid levels based on camera distance
}

export interface SnapSettings {
  enabled: boolean;
  grid: boolean;
  objects: boolean;
  vertices: boolean;
  edges: boolean;
  faces: boolean;
  tolerance: number;
}

// Gizmo and manipulation
export type GizmoType = 'position' | 'rotation' | 'scale' | 'universal';
export type GizmoMode = 'local' | 'world';
export type GizmoAxis = 'x' | 'y' | 'z' | 'xy' | 'yz' | 'xz' | 'xyz';

export interface GizmoState {
  visible: boolean;
  type: GizmoType;
  mode: GizmoMode;
  size: number;
  activeAxis?: GizmoAxis;
  isDragging: boolean;
}

// Terrain editing
export type TerrainBrushMode = 'raise' | 'lower' | 'smooth' | 'flatten' | 'paint' | 'noise';

export interface TerrainBrushSettings {
  mode: TerrainBrushMode;
  size: number;
  strength: number;
  falloff: 'linear' | 'smooth' | 'spherical';
  color?: number;
  texture?: string;
}

export interface TerrainPaintLayer {
  id: string;
  name: string;
  texture: string;
  tiling: number;
  strength: number;
  visible: boolean;
}

// Materials and rendering
export interface MaterialSettings {
  albedo: string | number;
  metallic: number;
  roughness: number;
  emission?: string | number;
  emissionIntensity?: number;
  normal?: string;
  height?: string;
  occlusion?: string;
  transparent?: boolean;
  opacity?: number;
}

export interface LightingSettings {
  ambient: {
    color: string;
    intensity: number;
  };
  directional: {
    color: string;
    intensity: number;
    direction: { x: number; y: number; z: number };
    shadows: boolean;
  };
  skybox?: string;
  fog?: {
    enabled: boolean;
    color: string;
    density: number;
    start: number;
    end: number;
  };
}

// Performance and rendering
export interface RenderSettings {
  quality: 'low' | 'medium' | 'high' | 'ultra';
  antialiasing: number; // MSAA samples
  shadows: boolean;
  shadowMapSize: number;
  postProcessing: boolean;
  bloom: boolean;
  ssao: boolean; // Screen space ambient occlusion
  motionBlur: boolean;
  fxaa: boolean;
  targetFrameRate: number;
}

export interface PerformanceStats {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  vertices: number;
  textures: number;
  memoryUsage: number;
  gpuMemoryUsage?: number;
}

// Physics simulation
export interface PhysicsSettings {
  enabled: boolean;
  gravity: { x: number; y: number; z: number };
  timeStep: number;
  maxSubSteps: number;
  solver: 'impulse' | 'sequential';
  broadphase: 'naive' | 'sap' | 'grid';
}

export interface PhysicsBody {
  id: string;
  type: 'static' | 'dynamic' | 'kinematic';
  shape: 'box' | 'sphere' | 'capsule' | 'cylinder' | 'mesh';
  mass: number;
  restitution: number;
  friction: number;
  linearDamping: number;
  angularDamping: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  velocity?: { x: number; y: number; z: number };
  angularVelocity?: { x: number; y: number; z: number };
}

// Animation and timeline
export interface AnimationClip {
  id: string;
  name: string;
  duration: number;
  tracks: AnimationTrack[];
  loop: boolean;
  autoPlay: boolean;
}

export interface AnimationTrack {
  id: string;
  targetId: string; // Block or object ID
  property: 'position' | 'rotation' | 'scale' | 'color' | 'visibility';
  keyframes: AnimationKeyframe[];
  interpolation: 'linear' | 'step' | 'cubic';
}

export interface AnimationKeyframe {
  time: number;
  value: any;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

// Input and controls
export interface InputState {
  mouse: {
    position: { x: number; y: number };
    delta: { x: number; y: number };
    buttons: boolean[];
    wheel: number;
  };
  keyboard: {
    keys: Set<string>;
    modifiers: {
      shift: boolean;
      ctrl: boolean;
      alt: boolean;
      meta: boolean;
    };
  };
  touch: {
    touches: TouchPoint[];
    pinch: {
      distance: number;
      delta: number;
    };
  };
}

export interface TouchPoint {
  id: number;
  position: { x: number; y: number };
  pressure: number;
}

// Viewport and layout
export interface ViewportState {
  width: number;
  height: number;
  aspectRatio: number;
  devicePixelRatio: number;
  bounds: DOMRect;
}

// Memory management
export interface MemoryPool<T> {
  available: T[];
  active: Set<T>;
  create: () => T;
  reset: (item: T) => void;
  destroy: (item: T) => void;
  stats: {
    total: number;
    available: number;
    active: number;
    peak: number;
  };
}

// Scene graph and hierarchy
export interface SceneNode {
  id: string;
  name: string;
  type: 'group' | 'block' | 'light' | 'camera' | 'terrain';
  visible: boolean;
  locked: boolean;
  children: SceneNode[];
  parent?: SceneNode;
  userData?: Record<string, any>;
}

// Asset management
export interface AssetDefinition {
  id: string;
  name: string;
  type: 'texture' | 'model' | 'material' | 'sound' | 'script';
  url: string;
  metadata?: Record<string, any>;
  loadState: 'unloaded' | 'loading' | 'loaded' | 'error';
}

// Editor events
export interface EditorEvent {
  type: string;
  timestamp: number;
  data?: any;
}

export interface SelectionChangedEvent extends EditorEvent {
  type: 'selection-changed';
  data: {
    selected: string[];
    deselected: string[];
    total: string[];
  };
}

export interface BlockPlacedEvent extends EditorEvent {
  type: 'block-placed';
  data: {
    blockId: string;
    blockType: BlockType;
    position: { x: number; y: number; z: number };
  };
}

export interface CameraModeChangedEvent extends EditorEvent {
  type: 'camera-mode-changed';
  data: {
    oldMode: CameraMode;
    newMode: CameraMode;
  };
}
