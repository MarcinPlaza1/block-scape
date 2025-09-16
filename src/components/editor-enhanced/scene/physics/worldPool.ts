import * as CANNON from 'cannon-es';

type PooledWorld = any;

/**
 * Physics world pool to reduce GC pressure from frequent editor sessions.
 * Worlds are reset and reused instead of recreated.
 */
export class PhysicsWorldPool {
  private static instance: PhysicsWorldPool;
  private pool: PooledWorld[] = [];
  private maxSize = 4;

  static getInstance(): PhysicsWorldPool {
    if (!PhysicsWorldPool.instance) PhysicsWorldPool.instance = new PhysicsWorldPool();
    return PhysicsWorldPool.instance;
  }

  acquire(): PooledWorld {
    const w = this.pool.pop();
    if (w) {
      // Reset world state
      try {
        w.allowSleep = true;
        w.gravity.set(0, -9.82, 0);
        if (w.solver) { w.solver.iterations = 12; w.solver.tolerance = 0.001; }
      } catch {}
      return w;
    }
    const world = new (CANNON as any).World();
    world.gravity.set(0, -9.82, 0);
    try { world.broadphase = new (CANNON as any).SAPBroadphase(world); } catch {}
    world.allowSleep = true;
    try { if (world.solver) { world.solver.iterations = 12; world.solver.tolerance = 0.001; } } catch {}
    return world;
  }

  release(world: PooledWorld) {
    try {
      // Remove bodies and contact materials
      const bodies = [...world.bodies];
      bodies.forEach((b: any) => { try { world.removeBody(b); } catch {} });
      if (world.contactMaterials) world.contactMaterials.length = 0;
      // Narrowphase caches
      if (world.narrowphase) {
        try { world.narrowphase.contactEquations.length = 0; } catch {}
      }
    } catch {}

    if (this.pool.length < this.maxSize) {
      this.pool.push(world);
    }
    // else let GC collect it
  }
}


