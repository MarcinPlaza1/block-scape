import { useEffect, MutableRefObject } from 'react';
import { attachEditorInput } from './input/editorInput';
import { THREE } from './compatibility/three-babylon-compat';
import * as BABYLON from '@babylonjs/core';
import type { Block } from './types';

interface InputHandlerProps {
  mountRef: MutableRefObject<HTMLDivElement | null>;
  isPlayMode: boolean;
  camera: BABYLON.Camera | null;
  scene: BABYLON.Scene | null;
  ground: BABYLON.Mesh | null;
  selectedTool: 'select' | 'move' | 'paint';
  
  // Terrain brush settings
  terrainBrushMode: 'raise' | 'lower' | 'smooth' | 'paint';
  terrainBrushSize: number;
  terrainBrushStrength: number;
  terrainBrushColor: number;
  
  // Refs
  raycaster: import('./compatibility/three-babylon-compat').RaycasterCompat;
  isDraggingRef: MutableRefObject<boolean>;
  selectedBlockIdsRef: MutableRefObject<string[] | null>;
  blocksRef: MutableRefObject<Block[]>;
  tempNdc: import('./compatibility/three-babylon-compat').Vector2Compat;
  snapEnabledRef: MutableRefObject<boolean>;
  snapSizeRef: MutableRefObject<number>;
  
  // Selection and dragging methods
  selectedBlockRef: MutableRefObject<Block | null>;
  startDragging: (block: Block, startPos: BABYLON.Vector3) => void;
  dragTo: (screenPos: import('./compatibility/three-babylon-compat').Vector2Compat) => void;
  stopDragging: () => void;
  selectBlock: (block: Block) => void;
  deselectBlock: () => void;
  
  // Grid snapping methods
  ensureSnapRing: (snap?: number) => void;
  snapRingRef: MutableRefObject<BABYLON.Mesh | null>;
  updateBrushRing?: (center: BABYLON.Vector3, radius: number) => void;
  removeBrushRing?: () => void;
  
  // Terrain editing
  applyTerrainBrush?: (point: BABYLON.Vector3) => void;
}

export const InputHandler = ({
  mountRef,
  isPlayMode,
  camera,
  scene,
  ground,
  selectedTool,
  terrainBrushMode,
  terrainBrushSize,
  terrainBrushStrength,
  terrainBrushColor,
  
  // Refs
  raycaster,
  isDraggingRef,
  selectedBlockIdsRef,
  blocksRef,
  tempNdc,
  snapEnabledRef,
  snapSizeRef,
  
  // Methods
  selectedBlockRef,
  startDragging,
  dragTo,
  stopDragging,
  selectBlock,
  deselectBlock,
  ensureSnapRing,
  snapRingRef,
  updateBrushRing,
  removeBrushRing,
  applyTerrainBrush
}: InputHandlerProps) => {

  useEffect(() => {
    if (!mountRef.current || isPlayMode) return;

    const cleanup = attachEditorInput({
      mount: mountRef.current,
      isPlayMode,
      cameraRef: { current: camera },
      raycasterRef: { current: raycaster },
      sceneRef: { current: scene },
      isDraggingRef,
      selectedTool,
      selectedBlockIdsRef,
      blocksRef,
      groundRef: { current: ground },
      tempNdc: { current: tempNdc },
      snapEnabledRef,
      snapSizeRef,
      ensureSnapRing,
      snapRingRef,
      updateBrushRing,
      selectedBlockRef,
      startDragging,
      dragTo,
      stopDragging,
      selectBlock,
      deselectBlock,
      applyTerrainBrush
    });

    return () => {
      try { removeBrushRing?.(); } catch {}
      cleanup?.();
    };
  }, [
    isPlayMode, 
    camera, 
    scene, 
    ground, 
    selectedTool, 
    terrainBrushMode, 
    terrainBrushSize, 
    terrainBrushStrength, 
    terrainBrushColor,
    // Dependencies for methods - these shouldn't change often
    raycaster,
    isDraggingRef,
    selectedBlockIdsRef,
    blocksRef,
    tempNdc,
    snapEnabledRef,
    snapSizeRef,
    selectedBlockRef,
    startDragging,
    dragTo,
    stopDragging,
    selectBlock,
    deselectBlock,
    ensureSnapRing,
    snapRingRef,
    updateBrushRing,
    removeBrushRing,
    applyTerrainBrush
  ]);

  // Remove brush ring when leaving paint mode
  useEffect(() => {
    if (selectedTool !== 'paint') {
      try { removeBrushRing?.(); } catch {}
    }
  }, [selectedTool, removeBrushRing]);

  return null; // This is a controller component with no visual output
};
