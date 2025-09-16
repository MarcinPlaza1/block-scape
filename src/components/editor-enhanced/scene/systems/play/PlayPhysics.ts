import * as CANNON from 'cannon-es';
import type { CannonBody, CannonWorld, CannonMaterial } from '../../physics/types';

export interface CollisionEvent {
  bodyA: CannonBody;
  bodyB: CannonBody;
  contactPoint?: CANNON.Vec3;
  contactNormal?: CANNON.Vec3;
  impulse?: number;
}

/**
 * Full physics system for play mode.
 * Handles dynamics, collisions, and continuous simulation.
 */
export class PlayPhysics {
  private world: CannonWorld;
  private bodies: Map<CannonBody, { isDynamic: boolean }> = new Map();
  private materials: Map<string, CannonMaterial> = new Map();
  private collisionCallbacks: ((event: CollisionEvent) => void)[] = [];
  
  // Physics materials
  private defaultMaterial: CannonMaterial;
  private playerMaterial: CannonMaterial;
  private iceMaterial: CannonMaterial;
  private bouncyMaterial: CannonMaterial;
  
  constructor() {
    // Create physics world with gravity
    this.world = new CANNON.World() as CannonWorld;
    this.world.gravity.set(0, -9.81, 0);
    
    // Performance settings
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    (this.world.solver as CANNON.GSSolver).iterations = 10;
    this.world.defaultContactMaterial.friction = 0.4;
    this.world.defaultContactMaterial.restitution = 0.3;
    
    // Setup materials
    this.setupMaterials();
    
    // Setup collision detection
    this.setupCollisionDetection();
  }
  
  private setupMaterials(): void {
    // Default material for most blocks
    this.defaultMaterial = new CANNON.Material('default') as CannonMaterial;
    this.defaultMaterial.friction = 0.4;
    this.defaultMaterial.restitution = 0.3;
    
    // Player material - lower friction for better movement
    this.playerMaterial = new CANNON.Material('player') as CannonMaterial;
    this.playerMaterial.friction = 0.0;
    this.playerMaterial.restitution = 0.0;
    
    // Ice material - very low friction
    this.iceMaterial = new CANNON.Material('ice') as CannonMaterial;
    this.iceMaterial.friction = 0.02;
    this.iceMaterial.restitution = 0.1;
    
    // Bouncy material
    this.bouncyMaterial = new CANNON.Material('bouncy') as CannonMaterial;
    this.bouncyMaterial.friction = 0.4;
    this.bouncyMaterial.restitution = 0.9;
    
    // Store materials
    this.materials.set('default', this.defaultMaterial);
    this.materials.set('player', this.playerMaterial);
    this.materials.set('ice', this.iceMaterial);
    this.materials.set('bouncy', this.bouncyMaterial);
    
    // Create contact materials
    this.createContactMaterials();
  }
  
  private createContactMaterials(): void {
    // Player vs default: low surface friction (movement control via forces), no bounce
    const playerDefault = new CANNON.ContactMaterial(
      this.playerMaterial,
      this.defaultMaterial,
      {
        friction: 0.05,
        restitution: 0.0,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 3,
        frictionEquationStiffness: 1e7,
        frictionEquationRelaxation: 3,
      }
    );
    this.world.addContactMaterial(playerDefault);
    
    // Player vs ice: very ślisko, zero bounce, stabilne równania
    const playerIce = new CANNON.ContactMaterial(
      this.playerMaterial,
      this.iceMaterial,
      {
        friction: 0.005,
        restitution: 0.0,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 3,
        frictionEquationStiffness: 1e7,
        frictionEquationRelaxation: 3,
      }
    );
    this.world.addContactMaterial(playerIce);
    
    // Player vs bouncy: minimal tarcie, wyższe odbicie, ale stabilnie
    const playerBouncy = new CANNON.ContactMaterial(
      this.playerMaterial,
      this.bouncyMaterial,
      {
        friction: 0.04,
        restitution: 1.0,
        contactEquationStiffness: 8e6,
        contactEquationRelaxation: 4,
        frictionEquationStiffness: 8e6,
        frictionEquationRelaxation: 4,
      }
    );
    this.world.addContactMaterial(playerBouncy);
    
    // Default vs bouncy
    const defaultBouncy = new CANNON.ContactMaterial(
      this.defaultMaterial,
      this.bouncyMaterial,
      {
        friction: 0.35,
        restitution: 0.9,
      }
    );
    this.world.addContactMaterial(defaultBouncy);
  }
  
  private setupCollisionDetection(): void {
    this.world.addEventListener('beginContact', (event: any) => {
      const collisionEvent: CollisionEvent = {
        bodyA: event.bodyA,
        bodyB: event.bodyB,
      };
      
      // Get contact information
      if (event.contactEquations.length > 0) {
        const contact = event.contactEquations[0];
        collisionEvent.contactPoint = contact.ri.clone().vadd(event.bodyA.position);
        collisionEvent.contactNormal = contact.ni.clone();
      }
      
      // Notify listeners
      this.collisionCallbacks.forEach(callback => callback(collisionEvent));
    });
  }
  
  public addBody(body: CannonBody, isDynamic: boolean = false): void {
    this.bodies.set(body, { isDynamic });
    this.world.addBody(body);
    
    // Set appropriate body type
    if (isDynamic) {
      body.type = CANNON.Body.DYNAMIC;
      body.mass = body.mass || 1;
    } else {
      body.type = CANNON.Body.STATIC;
      body.mass = 0;
    }
    
    body.updateMassProperties();
  }
  
  public removeBody(body: CannonBody): void {
    if (this.bodies.has(body)) {
      this.bodies.delete(body);
      this.world.removeBody(body);
    }
  }
  
  public createPlayerBody(position: CANNON.Vec3): CannonBody {
    // Precise capsule collider via compound shapes (two spheres + a cylinder)
    // Target overall height ~1.8 to match visual skin (anchorYOffset 0.9)
    const capsuleRadius = 0.45; // slightly slimmer than 0.5 for smoother navigation
    const capsuleHeight = 1.8; // total height (end-to-end)
    const cylinderHeight = Math.max(0.01, capsuleHeight - 2 * capsuleRadius);

    const body = new CANNON.Body({
      mass: 70, // 70kg player
      position: position,
      material: this.playerMaterial,
      fixedRotation: true, // Prevent player from rotating
      linearDamping: 0.4, // Some air resistance
      angularDamping: 0.0,
      type: CANNON.Body.DYNAMIC,
    }) as CannonBody;

    // Create shapes
    const sphereTop = new CANNON.Sphere(capsuleRadius);
    const sphereBottom = new CANNON.Sphere(capsuleRadius);
    const cylinder = new CANNON.Cylinder(capsuleRadius, capsuleRadius, cylinderHeight, 8);

    // Rotate cylinder so its axis aligns with Y (Cannon's cylinder axis is X by default)
    const cylQuat = new CANNON.Quaternion();
    cylQuat.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 2);

    // Offsets along Y to place the spheres at the ends of the cylinder
    const halfCyl = cylinderHeight / 2;
    body.addShape(sphereTop, new CANNON.Vec3(0, +halfCyl, 0));
    body.addShape(sphereBottom, new CANNON.Vec3(0, -halfCyl, 0));
    body.addShape(cylinder, new CANNON.Vec3(0, 0, 0), cylQuat);

    // Finalize mass properties
    body.updateMassProperties();

    return body;
  }
  
  public createBlockBody(
    position: CANNON.Vec3,
    size: CANNON.Vec3,
    materialType: string = 'default',
    isDynamic: boolean = false
  ): CannonBody {
    const shape = new CANNON.Box(size);
    const material = this.materials.get(materialType) || this.defaultMaterial;
    
    const body = new CANNON.Body({
      mass: isDynamic ? size.x * size.y * size.z * 100 : 0, // Density of 100 kg/m³
      shape: shape,
      position: position,
      material: material,
      type: isDynamic ? CANNON.Body.DYNAMIC : CANNON.Body.STATIC,
    }) as CannonBody;
    
    return body;
  }
  
  public applyImpulse(body: CannonBody, impulse: CANNON.Vec3, point?: CANNON.Vec3): void {
    body.applyImpulse(impulse, point || body.position);
  }
  
  public applyForce(body: CannonBody, force: CANNON.Vec3, point?: CANNON.Vec3): void {
    body.applyForce(force, point || body.position);
  }
  
  public setGravity(gravity: { x: number; y: number; z: number }): void {
    this.world.gravity.set(gravity.x, gravity.y, gravity.z);
  }
  
  public step(deltaTime: number): void {
    // Step the physics world
    this.world.step(deltaTime);
  }
  
  public raycast(
    from: CANNON.Vec3,
    to: CANNON.Vec3,
    options?: {
      collisionFilterMask?: number;
      collisionFilterGroup?: number;
      skipBackfaces?: boolean;
    }
  ): CANNON.RaycastResult | null {
    const ray = new CANNON.Ray(from, to);
    const result = new CANNON.RaycastResult();
    
    ray.intersectWorld(this.world, {
      mode: CANNON.Ray.CLOSEST,
      result: result,
      skipBackfaces: options?.skipBackfaces ?? true,
      collisionFilterMask: options?.collisionFilterMask ?? -1,
      collisionFilterGroup: options?.collisionFilterGroup ?? -1,
      checkCollisionResponse: true,
    });
    
    return result.hasHit ? result : null;
  }
  
  public onCollision(callback: (event: CollisionEvent) => void): void {
    this.collisionCallbacks.push(callback);
  }
  
  public offCollision(callback: (event: CollisionEvent) => void): void {
    const index = this.collisionCallbacks.indexOf(callback);
    if (index > -1) {
      this.collisionCallbacks.splice(index, 1);
    }
  }
  
  public getMaterial(name: string): CannonMaterial | undefined {
    return this.materials.get(name);
  }
  
  public getDefaultMaterial(): CannonMaterial {
    return this.defaultMaterial;
  }
  
  public getPlayerMaterial(): CannonMaterial {
    return this.playerMaterial;
  }
  
  public dispose(): void {
    // Remove all bodies
    for (const [body] of this.bodies) {
      this.world.removeBody(body);
    }
    this.bodies.clear();
    
    // Clear constraints
    const constraints = [...this.world.constraints];
    for (const constraint of constraints) {
      this.world.removeConstraint(constraint);
    }
    
    // Clear callbacks
    this.collisionCallbacks = [];
    
    // Remove event listeners
    this.world.removeEventListener('beginContact');
  }
  
  public getWorld(): CannonWorld {
    return this.world;
  }
  
  public getStats(): { bodies: number; dynamicBodies: number } {
    let dynamicCount = 0;
    for (const [_, info] of this.bodies) {
      if (info.isDynamic) dynamicCount++;
    }
    
    return {
      bodies: this.bodies.size,
      dynamicBodies: dynamicCount,
    };
  }
}
