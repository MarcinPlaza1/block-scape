import * as BABYLON from '@babylonjs/core';
import { RaycasterCompat, Vector2Compat } from '../compatibility/three-babylon-compat';

export function attachEditorInput(params: {
  mount: HTMLElement;
  isPlayMode: boolean;
  cameraRef: React.MutableRefObject<BABYLON.Camera | null>;
  raycasterRef: React.MutableRefObject<RaycasterCompat | null>;
  sceneRef: React.MutableRefObject<BABYLON.Scene | null>;
  isDraggingRef: React.MutableRefObject<boolean>;
  selectedTool: 'select' | 'move' | 'paint';
  selectedBlockIdsRef: React.MutableRefObject<string[] | null>;
  blocksRef: React.MutableRefObject<Array<any>>;
  groundRef: React.MutableRefObject<BABYLON.Mesh | null>;
  tempNdc: React.MutableRefObject<Vector2Compat>;
  snapEnabledRef: React.MutableRefObject<boolean>;
  snapSizeRef: React.MutableRefObject<number>;
  ensureSnapRing: (snap?: number) => void;
  snapRingRef: React.MutableRefObject<BABYLON.Mesh | null>;
  // Brush preview (optional)
  updateBrushRing?: (center: BABYLON.Vector3, radius: number) => void;
  selectedBlockRef: React.MutableRefObject<any>;
  startDragging: (block: any, clickPoint: BABYLON.Vector3) => void;
  dragTo: (mouseNdc: Vector2Compat) => void;
  stopDragging: () => void;
  selectBlock: (block: any) => void;
  deselectBlock: () => void;
  // Terrain paint/sculpt
  applyTerrainBrush?: (point: BABYLON.Vector3) => void;
}) {
  const lastMoveRef = { time: 0 };
  const throttleMs = 16;

  const onMouseMove = (event: MouseEvent) => {
    const now = performance.now();
    if (now - lastMoveRef.time < throttleMs) return;
    lastMoveRef.time = now;
    if (params.isPlayMode) return;

    if (params.isDraggingRef.current && params.mount && params.cameraRef.current) {
      const rect = params.mount.getBoundingClientRect();
      const mouse = params.tempNdc.current.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      params.dragTo(mouse);
    }

    if (params.groundRef.current && params.cameraRef.current && params.sceneRef.current) {
      const rect = params.mount.getBoundingClientRect();
      const scene = params.sceneRef.current;
      
      const pickResult = scene.pick(
        event.clientX - rect.left,
        event.clientY - rect.top,
        (mesh) => mesh === params.groundRef.current
      );
      
      if (pickResult && pickResult.hit && pickResult.pickedPoint) {
        const p = pickResult.pickedPoint;
        let gx = p.x;
        let gz = p.z;
        if (params.snapEnabledRef.current) {
          const s = params.snapSizeRef.current || 1;
          gx = Math.round(gx / s) * s;
          gz = Math.round(gz / s) * s;
        }
        params.ensureSnapRing(params.snapSizeRef.current);
        if (params.snapRingRef.current) {
          params.snapRingRef.current.position.set(gx, 0.002, gz);
        }
      } else {
        // If no ground under cursor, hide brush ring if present
        try { params.updateBrushRing?.(new BABYLON.Vector3(0, -1000, 0), 0.001); } catch {}
      }
    }
  };

  const onMouseUp = () => {
    if (!params.isDraggingRef.current) return;
    params.stopDragging();
  };

  const onClick = (event: MouseEvent) => {
    if (params.isPlayMode) return;
    if (!params.cameraRef.current || !params.sceneRef.current) return;
    
    const rect = params.mount.getBoundingClientRect();
    const scene = params.sceneRef.current;
    
    const pickResult = scene.pick(
      event.clientX - rect.left,
      event.clientY - rect.top,
      (mesh) => {
        // Check if mesh belongs to a block
        return params.blocksRef.current.some(b => !b.hidden && b.mesh === mesh);
      }
    );
    
    if (pickResult && pickResult.hit && pickResult.pickedMesh) {
      const clickedMesh = pickResult.pickedMesh;
      const clickedBlock = params.blocksRef.current.find(b => b.mesh === clickedMesh);
      if (!clickedBlock) return;
      
      if (params.selectedTool === 'select') {
        params.selectBlock(clickedBlock);
      } else if (params.selectedTool === 'move') {
        if (!clickedBlock.locked && pickResult.pickedPoint) {
          params.startDragging(clickedBlock, pickResult.pickedPoint.clone());
        }
      }
    } else {
      if (params.selectedTool === 'select') params.deselectBlock();
      // Terrain brush on click if paint mode and ground is under cursor
      if (params.selectedTool === 'paint' && params.applyTerrainBrush && params.groundRef.current) {
        const groundPick = scene.pick(
          event.clientX - rect.left,
          event.clientY - rect.top,
          (mesh) => mesh === params.groundRef.current
        );
        if (groundPick?.hit && groundPick.pickedPoint) {
          params.applyTerrainBrush(groundPick.pickedPoint.clone());
        }
      }
    }
  };

  const onMouseMovePaint = (event: MouseEvent) => {
    if (params.isPlayMode) return;
    if (params.selectedTool !== 'paint' || !params.applyTerrainBrush) return;
    if (!params.groundRef.current || !params.sceneRef.current) return;
    const rect = params.mount.getBoundingClientRect();
    const scene = params.sceneRef.current;
    const pickResult = scene.pick(
      event.clientX - rect.left,
      event.clientY - rect.top,
      (mesh) => mesh === params.groundRef.current
    );
    if (pickResult?.hit && pickResult.pickedPoint) {
      params.applyTerrainBrush(pickResult.pickedPoint.clone());
      // Update brush ring preview if available
      try {
        const anyWindow: any = typeof window !== 'undefined' ? window : null;
        const store = anyWindow?.useProjectStore?.getState?.();
        const radius = store?.terrainBrushSize || 3;
        params.updateBrushRing?.(pickResult.pickedPoint.clone(), radius);
      } catch {}
    } else {
      // No hit: nudge ring off-screen to visually hide
      try { params.updateBrushRing?.(new BABYLON.Vector3(0, -1000, 0), 0.001); } catch {}
    }
  };

  params.mount.addEventListener('mousemove', onMouseMove);
  params.mount.addEventListener('mouseup', onMouseUp);
  params.mount.addEventListener('click', onClick);
  params.mount.addEventListener('mousemove', onMouseMovePaint);

  return () => {
    params.mount.removeEventListener('mousemove', onMouseMove);
    params.mount.removeEventListener('mouseup', onMouseUp);
    params.mount.removeEventListener('click', onClick);
    params.mount.removeEventListener('mousemove', onMouseMovePaint);
  };
}