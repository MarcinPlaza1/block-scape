# Scene Systems Architecture

This directory contains the separated systems for Edit and Play modes.

## Structure

- `edit/` - Edit mode specific systems
  - `EditEngine.ts` - Edit mode engine loop
  - `EditPhysics.ts` - Physics for edit mode (limited, for placement)
  - `EditCamera.ts` - Camera controller for edit mode
  - `EditState.ts` - Edit mode state management
  
- `play/` - Play mode specific systems  
  - `PlayEngine.ts` - Play mode engine loop
  - `PlayPhysics.ts` - Full physics simulation
  - `PlayCamera.ts` - Camera controller for play mode
  - `PlayState.ts` - Play mode state management
  - `PlayerController.ts` - Player movement and controls
  
- `shared/` - Shared systems used by both modes
  - `Renderer.ts` - Common rendering logic
  - `BlockManager.ts` - Block instance management
  - `ResourceManager.ts` - Texture and material management
  - `SceneCore.ts` - Core scene setup and utilities

## Design Principles

1. **Separation of Concerns**: Each mode has its own dedicated systems
2. **Performance**: Edit mode optimized for building, Play mode for gameplay
3. **Modularity**: Easy to extend and modify each mode independently
4. **Code Reuse**: Shared components prevent duplication
