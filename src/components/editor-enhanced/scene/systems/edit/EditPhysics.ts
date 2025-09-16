import * as CANNON from 'cannon-es';
import type { CannonBody, CannonWorld } from '../../physics/types';

/**
 * Simplified physics system for edit mode.
 * Only handles collision detection for block placement validation.
 * No continuous simulation or dynamics.
 */
export class EditPhysics {
  private world: CannonWorld;
  private bodies: Set<CannonBody> = new Set();
  
  constructor() {
    // Create physics world with no gravity (edit mode doesn't need it)
    this.world = new CANNON.World() as CannonWorld;
    this.world.gravity.set(0, 0, 0);
    
    // Disable continuous collision detection for better performance
    this.world.broadphase = new CANNON.NaiveBroadphase();
    (this.world.solver as CANNON.GSSolver).iterations = 2; // Minimal iterations
  }
  
  public addBody(body: CannonBody): void {
    if (this.bodies.has(body)) return;
    
    this.bodies.add(body);
    this.world.addBody(body);
    
    // Make body static for edit mode
    body.type = CANNON.Body.STATIC;
    body.mass = 0;
    body.updateMassProperties();
  }
  
  public removeBody(body: CannonBody): void {
    if (!this.bodies.has(body)) return;
    
    this.bodies.delete(body);
    this.world.removeBody(body);
  }
  
  /**
   * Check if a position is valid for block placement
   */
  public checkPlacementCollision(
    position: { x: number; y: number; z: number },
    size: { x: number; y: number; z: number }
  ): boolean {
    // Create temporary body for collision check
    const shape = new CANNON.Box(
      new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)
    );
    
    const tempBody = new CANNON.Body({
      mass: 0,
      shape: shape,
      position: new CANNON.Vec3(position.x, position.y, position.z),
      type: CANNON.Body.STATIC,
    }) as CannonBody;
    
    // Check for overlaps
    let hasCollision = false;
    
    for (const body of this.bodies) {
      if (this.checkBodyOverlap(tempBody, body)) {
        hasCollision = true;
        break;
      }
    }
    
    return !hasCollision;
  }
  
  /**
   * Get all bodies that intersect with a given bounding box
   */
  public getBodiesInBounds(
    min: { x: number; y: number; z: number },
    max: { x: number; y: number; z: number }
  ): CannonBody[] {
    const result: CannonBody[] = [];
    
    for (const body of this.bodies) {
      const pos = body.position;
      const shape = body.shapes[0];
      
      if (shape instanceof CANNON.Box) {
        const halfExtents = shape.halfExtents;
        const bodyMin = {
          x: pos.x - halfExtents.x,
          y: pos.y - halfExtents.y,
          z: pos.z - halfExtents.z,
        };
        const bodyMax = {
          x: pos.x + halfExtents.x,
          y: pos.y + halfExtents.y,
          z: pos.z + halfExtents.z,
        };
        
        // Check AABB intersection
        if (
          bodyMax.x >= min.x && bodyMin.x <= max.x &&
          bodyMax.y >= min.y && bodyMin.y <= max.y &&
          bodyMax.z >= min.z && bodyMin.z <= max.z
        ) {
          result.push(body);
        }
      }
    }
    
    return result;
  }
  
  /**
   * Perform a raycast to find the first body hit
   */
  public raycast(
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number }
  ): { body: CannonBody; point: CANNON.Vec3 } | null {
    const ray = new CANNON.Ray(
      new CANNON.Vec3(from.x, from.y, from.z),
      new CANNON.Vec3(to.x, to.y, to.z)
    );
    
    const result = new CANNON.RaycastResult();
    ray.intersectWorld(this.world, {
      mode: CANNON.Ray.CLOSEST,
      result: result,
      skipBackfaces: true,
      collisionFilterMask: -1,
      collisionFilterGroup: -1,
      checkCollisionResponse: true,
    });
    
    if (result.hasHit && result.body) {
      return {
        body: result.body as CannonBody,
        point: result.hitPointWorld,
      };
    }
    
    return null;
  }
  
  private checkBodyOverlap(bodyA: CannonBody, bodyB: CannonBody): boolean {
    // Simple AABB overlap check for box shapes
    const shapeA = bodyA.shapes[0];
    const shapeB = bodyB.shapes[0];
    
    if (shapeA instanceof CANNON.Box && shapeB instanceof CANNON.Box) {
      const posA = bodyA.position;
      const posB = bodyB.position;
      const halfA = shapeA.halfExtents;
      const halfB = shapeB.halfExtents;
      
      const overlapX = Math.abs(posA.x - posB.x) < (halfA.x + halfB.x);
      const overlapY = Math.abs(posA.y - posB.y) < (halfA.y + halfB.y);
      const overlapZ = Math.abs(posA.z - posB.z) < (halfA.z + halfB.z);
      
      return overlapX && overlapY && overlapZ;
    }
    
    return false;
  }
  
  /**
   * Update physics world - minimal update for edit mode
   */
  public update(): void {
    // Only update if needed (e.g., after adding/removing bodies)
    // Edit mode doesn't need continuous physics simulation
    if (this.bodies.size > 0) {
      this.world.step(1 / 60);
    }
  }
  
  public dispose(): void {
    // Remove all bodies
    for (const body of this.bodies) {
      this.world.removeBody(body);
    }
    this.bodies.clear();
    
    // Clear constraints
    const constraints = [...this.world.constraints];
    for (const constraint of constraints) {
      this.world.removeConstraint(constraint);
    }
  }
  
  public getWorld(): CannonWorld {
    return this.world;
  }
}
