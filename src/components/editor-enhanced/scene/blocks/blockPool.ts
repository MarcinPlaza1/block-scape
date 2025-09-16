import * as BABYLON from '@babylonjs/core';

type BlockType =
  | 'cube'
  | 'cube_bouncy'
  | 'cube_ice'
  | 'cube_conveyor'
  | 'cube_boost'
  | 'cube_slow'
  | 'cube_sticky'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'pyramid'
  | 'plate'
  | 'ramp'
  | 'torus'
  | 'wedge'
  | 'door'
  | 'window'
  | 'fence'
  | 'start'
  | 'checkpoint'
  | 'finish'
  | 'hazard';

type PooledBlock = {
  mesh: BABYLON.Mesh;
  body: any;
};

/**
 * Simple object pool for reusing BABYLON.Mesh + CANNON.Body pairs per block type.
 * Bodies are removed from world when returned to pool; meshes are detached from scene.
 */
export class BlockPool {
  private static instance: BlockPool;
  private pool: Map<BlockType, PooledBlock[]> = new Map();
  private maxPerType: number = 100;

  static getInstance(): BlockPool {
    if (!BlockPool.instance) BlockPool.instance = new BlockPool();
    return BlockPool.instance;
  }

  setMaxPerType(limit: number) {
    this.maxPerType = Math.max(0, limit | 0);
  }

  acquire(type: BlockType, deps: { scene: BABYLON.Scene; world: any }, factory: () => PooledBlock): PooledBlock {
    const list = this.pool.get(type);
    if (list && list.length > 0) {
      const obj = list.pop()!;
      try { 
        // In Babylon.js, meshes are automatically part of scene when created
        obj.mesh.setEnabled(true);
      } catch {}
      try { deps.world.addBody(obj.body); } catch {}
      return obj;
    }
    return factory();
  }

  release(type: BlockType, obj: PooledBlock, deps: { scene?: BABYLON.Scene; world?: any }): boolean {
    try { if (deps.world) deps.world.removeBody(obj.body); } catch {}
    try { 
      // In Babylon.js, hide mesh instead of removing from scene
      obj.mesh.setEnabled(false);
    } catch {}
    
    const list = this.pool.get(type) ?? [];
    if (list.length >= this.maxPerType) {
      // Pool full – dispose aggressively
      try { 
        obj.mesh.dispose(false, true); // Don't dispose materials, but dispose textures
      } catch {}
      try { /* cannon bodies are GC'd after removal */ } catch {}
      return false;
    }
    list.push(obj);
    this.pool.set(type, list);
    return true;
  }

  drain(dispose: (obj: PooledBlock) => void) {
    for (const [, list] of this.pool) {
      while (list.length) {
        const obj = list.pop()!;
        dispose(obj);
      }
    }
    this.pool.clear();
  }
}