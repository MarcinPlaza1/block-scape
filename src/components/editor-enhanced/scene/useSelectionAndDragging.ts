import { useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import type { Block } from './types';
import { RaycasterCompat, Vector2Compat } from './compatibility/three-babylon-compat';
import { useProjectStore } from '@/lib/projectStore';

export function useSelectionAndDragging(params: { 
  sceneRef: React.MutableRefObject<BABYLON.Scene | null>; 
  cameraRef: React.MutableRefObject<BABYLON.Camera | null>; 
  raycasterRef: React.MutableRefObject<RaycasterCompat | null>; 
  snapEnabledRef: React.MutableRefObject<boolean>; 
  snapSizeRef: React.MutableRefObject<number>; 
  setSelectedBlockId?: (id: string | null) => void; 
}) {
  const { setBlockPosition } = useProjectStore();
  const selectedBlockRef = useRef<Block | null>(null);
  const outlineRef = useRef<BABYLON.Mesh | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragPlaneRef = useRef<BABYLON.Plane>(new BABYLON.Plane(0, 1, 0, 0));
  const dragOffsetRef = useRef<BABYLON.Vector3>(new BABYLON.Vector3());

  const selectBlock = (block: Block) => {
    if (outlineRef.current) {
      outlineRef.current.dispose();
    }
    
    selectedBlockRef.current = block;
    params.setSelectedBlockId?.(block.id);
    
    if (block.mesh && params.sceneRef.current) {
      // Create outline using EdgeRenderer
      block.mesh.enableEdgesRendering();
      block.mesh.edgesWidth = 4.0;
      block.mesh.edgesColor = new BABYLON.Color4(1, 1, 0, 1); // Yellow outline
      
      // Store reference to the mesh for cleanup
      outlineRef.current = block.mesh;
    }
  };

  const deselectBlock = () => {
    if (outlineRef.current) {
      // Disable edge rendering
      outlineRef.current.disableEdgesRendering();
      outlineRef.current = null;
    }
    selectedBlockRef.current = null;
    params.setSelectedBlockId?.(null);
  };

  const startDragging = (block: Block, clickPoint: BABYLON.Vector3) => {
    selectedBlockRef.current = block;
    isDraggingRef.current = true;
    if (params.cameraRef.current && block.mesh) {
      // Create drag plane perpendicular to camera view
      const cameraForward = params.cameraRef.current.getForwardRay().direction;
      dragPlaneRef.current = BABYLON.Plane.FromPositionAndNormal(clickPoint, cameraForward);
      
      // Calculate offset between block position and click point
      dragOffsetRef.current = block.mesh.position.subtract(clickPoint);
    }
  };

  const dragTo = (mouseNdc: Vector2Compat) => {
    if (!isDraggingRef.current || !selectedBlockRef.current || !params.cameraRef.current || !params.sceneRef.current) return;
    
    const scene = params.sceneRef.current;
    const camera = params.cameraRef.current;
    
    // Create ray from camera through mouse position
    const ray = scene.createPickingRay(
      (mouseNdc.x + 1) * 0.5 * scene.getEngine().getRenderWidth(),
      (1 - mouseNdc.y) * 0.5 * scene.getEngine().getRenderHeight(),
      BABYLON.Matrix.Identity(),
      camera
    );
    
    if (ray) {
      // Find intersection with drag plane
      const distance = ray.intersectsPlane(dragPlaneRef.current);
      if (distance !== null && selectedBlockRef.current.body && selectedBlockRef.current.mesh) {
        const intersection = ray.origin.add(ray.direction.scale(distance));
        const newPosition = intersection.add(dragOffsetRef.current);
        
        if (params.snapEnabledRef.current) {
          const s = params.snapSizeRef.current || 1;
          newPosition.x = Math.round(newPosition.x / s) * s;
          newPosition.z = Math.round(newPosition.z / s) * s;
        }
        
        selectedBlockRef.current.body.position.set(newPosition.x, newPosition.y, newPosition.z);
        selectedBlockRef.current.mesh.position.copyFrom(newPosition);
      }
    }
  };

  const stopDragging = () => { 
    isDraggingRef.current = false; 
    try {
      const b = selectedBlockRef.current;
      if (b && b.id && b.mesh) {
        const p = b.mesh.position;
        setBlockPosition?.(b.id, { x: p.x, y: p.y, z: p.z });
      }
    } catch {}
  };

  return { 
    selectedBlockRef, 
    outlineRef, 
    isDraggingRef, 
    selectBlock, 
    deselectBlock, 
    startDragging, 
    dragTo, 
    stopDragging 
  } as const;
}