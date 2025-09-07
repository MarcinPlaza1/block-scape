import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function useGhostPreview(params: { sceneRef: React.MutableRefObject<THREE.Scene | null>; colorRef: React.MutableRefObject<number>; }) {
  const ghostRef = useRef<THREE.Mesh | null>(null);

  const removeGhost = () => {
    try {
      if (ghostRef.current && params.sceneRef.current) {
        params.sceneRef.current.remove(ghostRef.current);
        ghostRef.current.geometry?.dispose?.();
        const mat: any = ghostRef.current.material;
        if (Array.isArray(mat)) { mat.forEach((m: THREE.Material) => m?.dispose()); } else { mat?.dispose?.(); }
      }
    } catch {}
    ghostRef.current = null;
  };

  const createGhost = (type: 'cube' | 'cube_bouncy' | 'cube_ice' | 'cube_conveyor' | 'cube_boost' | 'cube_slow' | 'cube_sticky' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'plate' | 'ramp' | 'torus' | 'wedge' | 'door' | 'window' | 'fence') => {
    if (!params.sceneRef.current) return;
    removeGhost();
    let geometry: THREE.BufferGeometry;
    if (type === 'cube' || type === 'cube_bouncy' || type === 'cube_ice' || type === 'cube_conveyor' || type === 'cube_boost' || type === 'cube_slow' || type === 'cube_sticky') geometry = new THREE.BoxGeometry(1, 1, 1);
    else if (type === 'sphere') geometry = new THREE.SphereGeometry(0.5, 16, 16);
    else if (type === 'cylinder') geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
    else if (type === 'cone') geometry = new THREE.ConeGeometry(0.5, 1, 16);
    else if (type === 'pyramid') geometry = new THREE.ConeGeometry(0.6, 1, 4);
    else if (type === 'plate') geometry = new THREE.BoxGeometry(1, 0.2, 1);
    else if (type === 'ramp') geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1, true); // rough triangular ramp
    else if (type === 'torus') geometry = new THREE.TorusGeometry(0.6, 0.2, 12, 24);
    else if (type === 'wedge') geometry = new THREE.BoxGeometry(1, 0.5, 1); // placeholder
    else if (type === 'door') geometry = new THREE.BoxGeometry(1, 2, 0.1);
    else if (type === 'window') geometry = new THREE.BoxGeometry(1.2, 1, 0.1);
    else geometry = new THREE.BoxGeometry(1.2, 1, 0.1); // fence panel placeholder
    const material = new THREE.MeshLambertMaterial({ color: params.colorRef.current || 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
    const ghost = new THREE.Mesh(geometry, material);
    ghost.castShadow = false;
    ghost.receiveShadow = false;
    ghost.name = 'ghost-preview';
    ghost.position.set(0, 0.5, 0);
    ghost.scale.set(1.05, 1.05, 1.05);
    params.sceneRef.current.add(ghost);
    ghostRef.current = ghost;
  };

  const updateGhostColor = () => {
    if (!ghostRef.current) return;
    try {
      const mat = ghostRef.current.material as THREE.MeshLambertMaterial;
      mat.color = new THREE.Color(params.colorRef.current || 0xffffff);
      mat.needsUpdate = true;
    } catch {}
  };

  return { ghostRef, createGhost, removeGhost, updateGhostColor } as const;
}


