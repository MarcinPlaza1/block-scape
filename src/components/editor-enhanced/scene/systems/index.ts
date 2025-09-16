// Main scene manager
export { SceneManager } from './SceneManager';
export type { SceneManagerProps } from './SceneManager';

// Edit mode
export { EditEngine } from './edit/EditEngine';
export { EditPhysics } from './edit/EditPhysics';
export { EditCamera } from './edit/EditCamera';
export { useEditState } from './edit/EditState';
export type { EditState } from './edit/EditState';

// Play mode
export { PlayEngine } from './play/PlayEngine';
export { PlayPhysics } from './play/PlayPhysics';
export { PlayCamera } from './play/PlayCamera';
export { PlayerController } from './play/PlayerController';
export { usePlayState } from './play/PlayState';
export type { PlayState } from './play/PlayState';

// Shared components
export { SceneCore } from './shared/SceneCore';
export { Renderer } from './shared/Renderer';
export { BlockFactory, createBlock, disposeBlock } from './shared/BlockFactory';
export type { RenderableBlock } from './shared/Renderer';
