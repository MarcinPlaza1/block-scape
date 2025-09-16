import { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import type { BlockType } from './types';

export function useGhostPreview(params: { sceneRef: React.MutableRefObject<BABYLON.Scene | null>; colorRef: React.MutableRefObject<number>; }) {
  const ghostRef = useRef<BABYLON.Mesh | null>(null);

  const removeGhost = () => {
    try {
      if (ghostRef.current) {
        ghostRef.current.dispose(false, true);
      }
    } catch {}
    ghostRef.current = null;
  };

  const createGhost = (type: BlockType) => {
    if (!params.sceneRef.current) return;
    removeGhost();
    
    let ghost: BABYLON.Mesh;
    const scene = params.sceneRef.current;
    
    if (type === 'cube' || type === 'cube_bouncy' || type === 'cube_ice' || type === 'cube_conveyor' || 
        type === 'cube_boost' || type === 'cube_slow' || type === 'cube_sticky') {
      ghost = BABYLON.MeshBuilder.CreateBox('ghost', { size: 1 }, scene);
    } else if (type === 'sphere') {
      ghost = BABYLON.MeshBuilder.CreateSphere('ghost', { diameter: 1, segments: 16 }, scene);
    } else if (type === 'cylinder') {
      ghost = BABYLON.MeshBuilder.CreateCylinder('ghost', { diameter: 1, height: 1, tessellation: 16 }, scene);
    } else if (type === 'cone') {
      ghost = BABYLON.MeshBuilder.CreateCylinder('ghost', { diameterTop: 0, diameterBottom: 1, height: 1, tessellation: 16 }, scene);
    } else if (type === 'pyramid') {
      ghost = BABYLON.MeshBuilder.CreateCylinder('ghost', { diameterTop: 0, diameterBottom: 1.2, height: 1, tessellation: 4 }, scene);
    } else if (type === 'plate') {
      ghost = BABYLON.MeshBuilder.CreateBox('ghost', { width: 1, height: 0.2, depth: 1 }, scene);
    } else if (type === 'ramp') {
      ghost = BABYLON.MeshBuilder.CreateCylinder('ghost', { diameter: 1, height: 1, tessellation: 3, arc: Math.PI }, scene);
    } else if (type === 'torus') {
      ghost = BABYLON.MeshBuilder.CreateTorus('ghost', { diameter: 1.2, thickness: 0.4, tessellation: 24 }, scene);
    } else if (type === 'wedge') {
      ghost = BABYLON.MeshBuilder.CreateBox('ghost', { width: 1, height: 0.5, depth: 1 }, scene); // placeholder
    } else if (type === 'door') {
      ghost = BABYLON.MeshBuilder.CreateBox('ghost', { width: 1, height: 2, depth: 0.1 }, scene);
    } else if (type === 'window') {
      ghost = BABYLON.MeshBuilder.CreateBox('ghost', { width: 1.2, height: 1, depth: 0.1 }, scene);
    } else if (type === 'start' || type === 'checkpoint' || type === 'finish') {
      ghost = BABYLON.MeshBuilder.CreateCylinder('ghost', { diameter: 1.6, height: 0.2, tessellation: 24 }, scene);
    } else if (type === 'hazard') {
      ghost = BABYLON.MeshBuilder.CreateBox('ghost', { width: 1, height: 0.2, depth: 1 }, scene);
    } else {
      ghost = BABYLON.MeshBuilder.CreateBox('ghost', { width: 1.2, height: 1, depth: 0.1 }, scene); // fence placeholder
    }
    
    const material = new BABYLON.StandardMaterial('ghostMaterial', scene);
    const color = params.colorRef.current || 0xffffff;
    material.diffuseColor = BABYLON.Color3.FromHexString('#' + color.toString(16).padStart(6, '0'));
    material.alpha = 0.5;
    material.specularColor = new BABYLON.Color3(0, 0, 0);
    
    ghost.material = material;
    ghost.isPickable = false;
    ghost.position.set(0, 1, 0);  // Start higher, will be positioned by mouse
    ghost.scaling.setAll(1.02);  // Slightly larger for visibility
    
    ghostRef.current = ghost;
  };

  const updateGhostColor = () => {
    if (!ghostRef.current) return;
    try {
      const mat = ghostRef.current.material as BABYLON.StandardMaterial;
      if (mat) {
        const color = params.colorRef.current || 0xffffff;
        mat.diffuseColor = BABYLON.Color3.FromHexString('#' + color.toString(16).padStart(6, '0'));
      }
    } catch {}
  };

  return { ghostRef, createGhost, removeGhost, updateGhostColor } as const;
}