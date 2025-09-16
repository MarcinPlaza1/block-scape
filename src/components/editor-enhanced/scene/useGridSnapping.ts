import { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';

export function useGridSnapping(params: { sceneRef: React.MutableRefObject<BABYLON.Scene | null>; gridVisible: boolean; snapSize: number; }) {
  const gridMeshRef = useRef<BABYLON.TransformNode | null>(null);
  const snapRingRef = useRef<BABYLON.Mesh | null>(null);
  const brushRingRef = useRef<BABYLON.Mesh | null>(null);
  const gridFollowObserverRef = useRef<BABYLON.Observer<BABYLON.Scene> | null>(null);
  const lastSnapCenterRef = useRef<{ x: number; z: number } | null>(null);

  const removeGridHelper = () => {
    const scene = params.sceneRef.current;
    if (!scene) return;
    if (gridFollowObserverRef.current) {
      try { scene.onBeforeRenderObservable.remove(gridFollowObserverRef.current); } catch {}
      gridFollowObserverRef.current = null;
    }
    if (gridMeshRef.current) {
      try { gridMeshRef.current.dispose(false, true); } catch {}
      gridMeshRef.current = null;
    }
  };

  const rebuildGridHelper = () => {
    // Remove any previous overlay grid meshes/observers
    removeGridHelper();
    // Intentionally disable the editor 2D overlay grid.
    // Terrain grid is handled by EditEngine, and placement helper grid lives in EnhancedPlacementSystem.
    const scene = params.sceneRef.current;
    if (!scene) return;
    // No grid lines/axes are created here anymore.
  };

  const removeSnapRing = () => {
    const ring = snapRingRef.current;
    if (!ring || !params.sceneRef.current) return;
    try {
      ring.dispose(false, true);
    } catch {}
    snapRingRef.current = null;
  };

  const ensureSnapRing = (snapSize?: number) => {
    if (!params.sceneRef.current) return;
    if (snapRingRef.current) return;
    
    const radius = Math.max(0.55, ((typeof snapSize === 'number' ? snapSize : params.snapSize) || 1) * 0.55);
    
    // Create ring using disc with hole
    const ring = BABYLON.MeshBuilder.CreateDisc('snapRing', {
      radius: radius,
      tessellation: 24,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, params.sceneRef.current);
    
    // Create inner hole by creating another disc and using CSG
    const innerDisc = BABYLON.MeshBuilder.CreateDisc('innerDisc', {
      radius: radius * 0.85,
      tessellation: 24
    }, params.sceneRef.current);
    
    // Use CSG to create ring shape
    const ringCSG = BABYLON.CSG.FromMesh(ring);
    const innerCSG = BABYLON.CSG.FromMesh(innerDisc);
    const finalCSG = ringCSG.subtract(innerCSG);
    
    innerDisc.dispose();
    ring.dispose();
    
    const finalRing = finalCSG.toMesh('snapRing', null, params.sceneRef.current);
    
    const mat = new BABYLON.StandardMaterial('snapRingMaterial', params.sceneRef.current);
    mat.diffuseColor = new BABYLON.Color3(0, 1, 1); // 0x00ffff
    mat.emissiveColor = new BABYLON.Color3(0, 0.5, 0.5);
    mat.alpha = 0.35;
    mat.backFaceCulling = false;
    finalRing.material = mat;
    
    finalRing.rotation.x = Math.PI / 2;
    finalRing.position.y = 0.01;
    finalRing.renderingGroupId = 2;
    
    snapRingRef.current = finalRing;
  };

  const removeBrushRing = () => {
    const ring = brushRingRef.current;
    if (!ring || !params.sceneRef.current) return;
    try { ring.dispose(false, true); } catch {}
    brushRingRef.current = null;
  };

  const updateBrushRing = (center: BABYLON.Vector3, radius: number) => {
    if (!params.sceneRef.current) return;
    const scene = params.sceneRef.current;
    const tessellation = 64;
    const path: BABYLON.Vector3[] = [];
    for (let i = 0; i <= tessellation; i++) {
      const a = (i / tessellation) * Math.PI * 2;
      path.push(new BABYLON.Vector3(center.x + Math.cos(a) * radius, 0.01, center.z + Math.sin(a) * radius));
    }
    if (!brushRingRef.current) {
      const lines = BABYLON.MeshBuilder.CreateLines('brushRing', { points: path }, scene);
      lines.color = new BABYLON.Color3(1, 0.6, 0);
      lines.renderingGroupId = 2;
      brushRingRef.current = lines;
    } else {
      BABYLON.MeshBuilder.CreateLines(null as any, { points: path, instance: brushRingRef.current as any }, scene);
    }
  };

  useEffect(() => { 
    rebuildGridHelper(); 
    return () => removeGridHelper(); 
  }, [params.gridVisible, params.snapSize]);

  return { 
    gridHelperRef: gridMeshRef, 
    snapRingRef, 
    rebuildGridHelper, 
    removeGridHelper, 
    ensureSnapRing, 
    removeSnapRing,
    brushRingRef,
    updateBrushRing,
    removeBrushRing 
  } as const;
}