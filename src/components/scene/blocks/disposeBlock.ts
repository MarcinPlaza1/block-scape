import * as THREE from 'three';
import type { Block } from '../types';

export function disposeBlock(block: Block, deps: { scene: THREE.Scene; world: any }) {
  try {
    if (block.mesh && deps.scene) {
      deps.scene.remove(block.mesh);
      try {
        block.mesh.geometry?.dispose?.();
        const mat: any = (block.mesh as any).material;
        if (Array.isArray(mat)) mat.forEach((m: THREE.Material) => m?.dispose());
        else mat?.dispose?.();
      } catch {}
    }
    if (block.body && deps.world) {
      try { deps.world.removeBody(block.body); } catch {}
    }
  } catch {}
}


