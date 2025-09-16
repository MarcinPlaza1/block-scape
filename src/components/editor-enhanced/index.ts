// Editor and scene-related components

// Main editor components
export { default as BlockInventory } from './BlockInventory';
export { default as GizmoControls } from './GizmoControls';
export { default as Hierarchy } from './Hierarchy';
export { default as InspectorPanel } from './InspectorPanel';
export { default as QualitySettings } from './QualitySettings';

// Editor UI components
export { default as BlockTooltip } from './editor/BlockTooltip';
export { default as CrosshairOverlay } from './editor/CrosshairOverlay';
export { default as GameLikeEditor } from './editor/GameLikeEditor';
export { default as MinecraftHotbar } from './editor/MinecraftHotbar';
export { default as ModeSwitcher } from './editor/ModeSwitcher';
export { default as ObjectRotationControls } from './editor/ObjectRotationControls';
export { default as SimsBuildPanel } from './editor/SimsBuildPanel';

// Scene components
export { default as BlockProperties } from './scene/BlockProperties';
export { CameraController } from './scene/CameraController';
export { InputHandler } from './scene/InputHandler';
export { default as MemoryDebugPanel } from './scene/MemoryDebugPanel';
export { PhysicsProvider, usePhysicsContext } from './scene/PhysicsProvider';
export { SceneCanvas } from './scene/SceneCanvas';

// Scene hooks
export { useGhostPreview } from './scene/useGhostPreview';
export { useGizmos } from './scene/useGizmos';
export { useGridSnapping } from './scene/useGridSnapping';
export { usePhysicsWorld } from './scene/usePhysicsWorld';
export { usePlayerController } from './scene/usePlayerController';
export { useSelectionAndDragging } from './scene/useSelectionAndDragging';
export { useTerrainEditor } from './scene/useTerrainEditor';

// Scene utilities
export type { Block, BlockType, Scene3DProps, CameraMode } from './scene/types';
export * from './scene/utils';
export * from './scene/sceneHelpers';
export * from './scene/memoryManager';

// Block management utilities
export * from './scene/blocks/blockPool';
export * from './scene/blocks/createBlock';
export * from './scene/blocks/disposeBlock';
export * from './scene/blocks/textureCache';
export { ThinInstanceManager } from './scene/blocks/ThinInstanceManager';

// Camera utilities
export * from './scene/camera/controller';

// Engine utilities
export * from './scene/engine/loop';
export { createSceneEngine } from './scene/engine/SceneEngine';

// Input utilities
export * from './scene/input/editorInput';

// Physics utilities
export * from './scene/physics/blockDimensions';
export * from './scene/physics/types';
export * from './scene/physics/worldPool';

// Compatibility
export * from './scene/compatibility/three-babylon-compat';
