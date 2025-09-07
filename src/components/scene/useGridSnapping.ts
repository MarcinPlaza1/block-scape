import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function useGridSnapping(params: { sceneRef: React.MutableRefObject<THREE.Scene | null>; gridVisible: boolean; snapSize: number; }) {
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const snapRingRef = useRef<THREE.Mesh | null>(null);

  const removeGridHelper = () => {
    if (!params.sceneRef.current || !gridHelperRef.current) return;
    try {
      params.sceneRef.current.remove(gridHelperRef.current);
      const mat: any = (gridHelperRef.current as any).material;
      if (Array.isArray(mat)) mat.forEach((m: THREE.Material) => m?.dispose()); else mat?.dispose?.();
      (gridHelperRef.current.geometry as any)?.dispose?.();
    } catch {}
    gridHelperRef.current = null;
  };

  const rebuildGridHelper = () => {
    removeGridHelper();
    if (!params.sceneRef.current || !params.gridVisible) return;
    const GRID_SIZE = 50;
    const divisions = Math.max(1, Math.min(500, Math.round(GRID_SIZE / (params.snapSize || 1))));
    const grid = new THREE.GridHelper(GRID_SIZE, divisions, 0x222222, 0x222222);
    grid.position.y = 0.001;
    (grid.material as any).transparent = true;
    (grid.material as any).opacity = 0.35;
    (grid.material as any).depthWrite = false;
    grid.renderOrder = 1;
    params.sceneRef.current.add(grid);
    gridHelperRef.current = grid;
  };

  const removeSnapRing = () => {
    const ring = snapRingRef.current;
    if (!ring || !params.sceneRef.current) return;
    try {
      params.sceneRef.current.remove(ring);
      (ring.geometry as any)?.dispose?.();
      const mat: any = (ring.material as any);
      if (Array.isArray(mat)) mat.forEach((m: THREE.Material) => m?.dispose()); else mat?.dispose?.();
    } catch {}
    snapRingRef.current = null;
  };

  const ensureSnapRing = (snapSize?: number) => {
    if (!params.sceneRef.current) return;
    if (snapRingRef.current) return;
    const radius = Math.max(0.55, ((typeof snapSize === 'number' ? snapSize : params.snapSize) || 1) * 0.55);
    const geo = new THREE.RingGeometry(radius * 0.85, radius, 24);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 2;
    params.sceneRef.current.add(ring);
    snapRingRef.current = ring;
  };

  useEffect(() => { rebuildGridHelper(); return () => removeGridHelper(); }, [params.gridVisible, params.snapSize]);

  return { gridHelperRef, snapRingRef, rebuildGridHelper, removeGridHelper, ensureSnapRing, removeSnapRing } as const;
}


