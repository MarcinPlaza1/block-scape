import * as BABYLON from '@babylonjs/core';
import * as CANNON from 'cannon-es';
import { PlayPhysics } from './PlayPhysics';
import { PlayCamera } from './PlayCamera';
import type { CannonBody } from '../../physics/types';
import { createSkinMesh, type PlayerSkinId, type PlayerSkinColors, type PlayerSkinConfig } from './skins/registry';

export interface PlayerControllerConfig {
  scene: BABYLON.Scene;
  physics: PlayPhysics;
  camera: PlayCamera;
  startPosition?: BABYLON.Vector3;
  moveSpeed?: number; // legacy, maps to acceleration
  jumpForce?: number;
  sprintMultiplier?: number;
  skinId?: PlayerSkinId;
  skinColors?: { primary: number; secondary?: number };
  skinConfig?: PlayerSkinConfig;
  maxSpeed?: number;
  accelerationGround?: number;
  accelerationAir?: number;
  groundFriction?: number;
  airFriction?: number;
  coyoteTimeMs?: number;
  jumpBufferMs?: number;
  slopeLimitDeg?: number;
  stepHeight?: number;
  // Hold jump
  jumpMaxHoldMs?: number;
  jumpHoldForce?: number;
  jumpCutFactor?: number; // 0..1, scales current upward velocity on early release
  // Dash
  dashImpulse?: number;
  dashDurationMs?: number;
  dashCooldownMs?: number;
  dashMaxSpeedMultiplier?: number;
  dashAirAllowed?: boolean;
}

export class PlayerController {
  private scene: BABYLON.Scene;
  private physics: PlayPhysics;
  private camera: PlayCamera;
  private mesh: BABYLON.Mesh;
  private body: CannonBody;
  private meshAnchorYOffset: number = 0.9;
  
  // Movement settings
  private moveSpeed: number;
  private jumpForce: number;
  private sprintMultiplier: number;
  private maxSpeed = 10;
  private airControl = 0.2;
  private accelerationGround = 100; // N (force) per input unit
  private accelerationAir = 40;
  private groundFriction = 0.92; // slightly higher to settle quicker on flats
  private airFriction = 0.985;   // a touch more glide in air
  private coyoteTimeMs = 130;
  private jumpBufferMs = 140;
  private slopeLimitDeg = 55;    // allow slightly steeper climbs with capsule
  private stepHeight = 0.4;
  // Capsule dimensions: half-height matches visual anchor (0.9), horizontal radius ~0.45
  private playerHalfHeight = 0.9;
  private playerHorizontalRadius = 0.45;
  private jumpMaxHoldMs = 180;
  private jumpHoldForce = 80;
  private jumpCutFactor = 0.5;
  private dashImpulse = 200;
  private dashDurationMs = 200;
  private dashCooldownMs = 750;
  private dashMaxSpeedMultiplier = 2.2;
  private dashAirAllowed = true;
  // Surface tuning
  private baseAccelerationGround = this.accelerationGround;
  private baseGroundFriction = this.groundFriction;
  private iceAccelFactor = 0.6;
  private iceFriction = 0.97;
  private bouncyAccelFactor = 1.1;
  private bouncyFriction = 0.85;
  private bouncyBounceBoost = 0.6;
  
  // State
  private keysPressed = new Set<string>();
  private isGrounded = false;
  private canJump = true;
  private isSprinting = false;
  private groundContactCount = 0;
  private lastGroundedAt = -Infinity;
  private lastJumpInputAt = -Infinity;
  private isJumping = false;
  private jumpStartedAt = -Infinity;
  private jumpCutApplied = false;
  private isDashing = false;
  private dashEndsAt = -Infinity;
  private lastDashAt = -Infinity;
  
  // Ground detection
  private groundRay: CANNON.Ray;
  private groundCheckDistance = 0.6;
  
  constructor(config: PlayerControllerConfig) {
    this.scene = config.scene;
    this.physics = config.physics;
    this.camera = config.camera;
    
    // Movement settings
    this.moveSpeed = config.moveSpeed ?? 50;
    this.jumpForce = config.jumpForce ?? 8;
    this.sprintMultiplier = config.sprintMultiplier ?? 1.5;
    this.maxSpeed = config.maxSpeed ?? this.maxSpeed;
    this.accelerationGround = config.accelerationGround ?? this.accelerationGround;
    this.accelerationAir = config.accelerationAir ?? this.accelerationAir;
    this.groundFriction = config.groundFriction ?? this.groundFriction;
    this.airFriction = config.airFriction ?? this.airFriction;
    this.coyoteTimeMs = config.coyoteTimeMs ?? this.coyoteTimeMs;
    this.jumpBufferMs = config.jumpBufferMs ?? this.jumpBufferMs;
    this.slopeLimitDeg = config.slopeLimitDeg ?? this.slopeLimitDeg;
    // Derive sensible default step height from capsule size for smoother stairs/ledges
    const defaultStepHeight = Math.min(0.6, Math.max(0.35, this.playerHalfHeight * 0.6));
    this.stepHeight = config.stepHeight ?? defaultStepHeight;
    this.jumpMaxHoldMs = config.jumpMaxHoldMs ?? this.jumpMaxHoldMs;
    this.jumpHoldForce = config.jumpHoldForce ?? this.jumpHoldForce;
    this.jumpCutFactor = config.jumpCutFactor ?? this.jumpCutFactor;
    this.dashImpulse = config.dashImpulse ?? this.dashImpulse;
    this.dashDurationMs = config.dashDurationMs ?? this.dashDurationMs;
    this.dashCooldownMs = config.dashCooldownMs ?? this.dashCooldownMs;
    this.dashMaxSpeedMultiplier = config.dashMaxSpeedMultiplier ?? this.dashMaxSpeedMultiplier;
    this.dashAirAllowed = config.dashAirAllowed ?? this.dashAirAllowed;

    // Rebase surface tuning baselines after config overrides
    this.baseAccelerationGround = this.accelerationGround;
    this.baseGroundFriction = this.groundFriction;
    
    // Create player mesh (skin)
    const skin = this.createPlayerMesh(config.skinId, config.skinColors, config.skinConfig);
    this.mesh = skin.mesh;
    this.meshAnchorYOffset = skin.anchorYOffset;
    
    // Create physics body
    const startPos = config.startPosition || new BABYLON.Vector3(0, 5, 0);
    this.body = this.createPhysicsBody(startPos);
    
    // Setup ground detection
    this.groundRay = new CANNON.Ray();
    
    // Setup controls
    this.setupControls();
    
    // Setup collision detection
    this.setupCollisionDetection();
  }
  
  private createPlayerMesh(skinId?: PlayerSkinId, skinColors?: { primary: number; secondary?: number }, skinConfig?: PlayerSkinConfig): { mesh: BABYLON.Mesh; anchorYOffset: number } {
    const colors: PlayerSkinColors | undefined = skinColors
      ? {
          primary: new BABYLON.Color3(
            ((skinColors.primary >> 16) & 0xff) / 255,
            ((skinColors.primary >> 8) & 0xff) / 255,
            (skinColors.primary & 0xff) / 255
          ),
          secondary: typeof skinColors.secondary === 'number'
            ? new BABYLON.Color3(
                ((skinColors.secondary >> 16) & 0xff) / 255,
                ((skinColors.secondary >> 8) & 0xff) / 255,
                (skinColors.secondary & 0xff) / 255
              )
            : undefined,
        }
      : undefined;
    const instance = createSkinMesh(this.scene, skinId || 'blocky', colors, skinConfig);
    // Normalize scaling so visual anchor offset matches legacy 0.9 for consistency
    const desiredAnchor = 0.9;
    const scale = instance.anchorYOffset > 0 ? (desiredAnchor / instance.anchorYOffset) : 1;
    try { instance.root.scaling.setAll(scale); } catch {}
    // Ensure root is not pickable to avoid camera collision issues
    instance.root.isPickable = false;
    // Name root mesh for references
    instance.root.name = 'player';
    return { mesh: instance.root, anchorYOffset: desiredAnchor };
  }
  
  private createPhysicsBody(position: BABYLON.Vector3): CannonBody {
    const body = this.physics.createPlayerBody(
      new CANNON.Vec3(position.x, position.y, position.z)
    );
    
    // Add the body to physics world
    this.physics.addBody(body, true);
    
    return body;
  }
  
  private setupControls(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }
  
  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keysPressed.add(e.code);
    
    // Buffer jump
    if (e.code === 'Space') {
      this.lastJumpInputAt = performance.now();
    }
    
    // Handle sprint
    if (e.code === 'ShiftLeft') {
      this.isSprinting = true;
    }

    // Dash on Q
    if (e.code === 'KeyQ') {
      this.tryDash();
    }
  };
  
  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysPressed.delete(e.code);
    
    // Handle sprint release
    if (e.code === 'ShiftLeft') {
      this.isSprinting = false;
    }
  };
  
  private setupCollisionDetection(): void {
    // Listen for collisions to detect ground contact
    this.physics.onCollision((event) => {
      if (event.bodyA === this.body || event.bodyB === this.body) {
        const otherBody = event.bodyA === this.body ? event.bodyB : event.bodyA;
        
        // Check if collision is from below (ground contact)
        if (event.contactNormal) {
          const normal = event.contactNormal;
          const dotProduct = normal.y;
          
          if (dotProduct > 0.5) {
            // Contact from below
            this.groundContactCount++;
          }
        }

        // Bounce surface reaction: add extra vertical impulse for 'bouncy' material
        const matName = (otherBody as any)?.material?.name as string | undefined;
        if (matName === 'bouncy') {
          // Give a small bounce only if moving downward
          if (this.body.velocity.y < -1) {
            const boost = Math.min(10, Math.abs(this.body.velocity.y) * this.bouncyBounceBoost);
            this.physics.applyImpulse(this.body, new CANNON.Vec3(0, boost, 0));
          }
        }
      }
    });
  }
  
  public setSkin(skinId?: PlayerSkinId, skinColors?: { primary: number; secondary?: number }, skinConfig?: PlayerSkinConfig): void {
    try { this.mesh?.dispose(); } catch {}
    const skin = this.createPlayerMesh(skinId, skinColors, skinConfig);
    this.mesh = skin.mesh;
    this.meshAnchorYOffset = skin.anchorYOffset;
    try { this.camera.setFollowTarget(this.mesh); } catch {}
  }

  public update(deltaTime: number): void {
    const now = performance.now();
    // Get movement input
    const forward = (this.keysPressed.has('KeyW') ? 1 : 0) - (this.keysPressed.has('KeyS') ? 1 : 0);
    const right = (this.keysPressed.has('KeyD') ? 1 : 0) - (this.keysPressed.has('KeyA') ? 1 : 0);
    
    // Check if grounded
    const slopeInfo = this.checkGrounded();
    if (this.isGrounded) {
      this.lastGroundedAt = now;
      this.canJump = Math.abs(this.body.velocity.y) < 0.1;
    }
    
    // Process buffered jump with coyote time
    const canUseCoyote = now - this.lastGroundedAt <= this.coyoteTimeMs;
    const hasJumpBuffered = now - this.lastJumpInputAt <= this.jumpBufferMs;
    if (hasJumpBuffered && (this.isGrounded || canUseCoyote) && this.canJump) {
      this.jump();
      // Prevent immediate re-trigger
      this.lastJumpInputAt = -Infinity;
    }

    // Hold jump: apply upward force while held within window
    if (this.isJumping) {
      const held = this.keysPressed.has('Space');
      const sinceStart = now - this.jumpStartedAt;
      if (held && sinceStart <= this.jumpMaxHoldMs && this.body.velocity.y > -0.1) {
        this.physics.applyForce(this.body, new CANNON.Vec3(0, this.jumpHoldForce, 0));
      } else {
        // If released early and still moving up, apply jump cut once
        if (!held && !this.jumpCutApplied && (now - this.jumpStartedAt) < this.jumpMaxHoldMs && this.body.velocity.y > 0.01) {
          this.body.velocity.y *= this.jumpCutFactor;
          this.jumpCutApplied = true;
        }
      }
      // End jumping state when ascending stops or grounded again
      if (this.body.velocity.y <= 0 || this.isGrounded) {
        this.isJumping = false;
      }
    }

    // Apply movement
    if (forward !== 0 || right !== 0) {
      this.move(forward, right, deltaTime);
    }
    
    // Apply friction when not moving
    if (forward === 0 && right === 0) {
      this.applyFriction();
    }
    
    // Limit horizontal velocity
    this.limitVelocity();

    // Slope slide if too steep
    if (this.isGrounded && slopeInfo && slopeInfo.tooSteep) {
      this.applySlopeSlide(slopeInfo.normal, deltaTime);
    }

    // Step climb assistance
    if (this.isGrounded && (forward !== 0 || right !== 0)) {
      this.tryStepUp(deltaTime, forward, right);
    }
    
    // Reset ground contact count
    this.groundContactCount = 0;
  }
  
  private checkGrounded(): { normal: BABYLON.Vector3; tooSteep: boolean } | null {
    // Cast ray downward from player position
    const from = new CANNON.Vec3(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    );
    const to = new CANNON.Vec3(
      this.body.position.x,
      this.body.position.y - Math.max(this.groundCheckDistance, this.playerHalfHeight + 0.1),
      this.body.position.z
    );
    
    const result = this.physics.raycast(from, to);
    // Consider grounded if ray hits or we have ground contacts
    this.isGrounded = (result !== null) || (this.groundContactCount > 0);

    // Apply per-surface tuning by physics material name
    try {
      const matName = (result as any)?.body?.material?.name as string | undefined;
      if (matName === 'ice') {
        this.accelerationGround = this.baseAccelerationGround * this.iceAccelFactor;
        this.groundFriction = this.iceFriction;
      } else if (matName === 'bouncy') {
        this.accelerationGround = this.baseAccelerationGround * this.bouncyAccelFactor;
        this.groundFriction = this.bouncyFriction;
      } else {
        this.accelerationGround = this.baseAccelerationGround;
        this.groundFriction = this.baseGroundFriction;
      }
    } catch {}

    if (result && (result as any).hitNormalWorld) {
      const n = (result as any).hitNormalWorld as CANNON.Vec3;
      const normal = new BABYLON.Vector3(n.x, n.y, n.z);
      const angleRad = Math.acos(Math.max(-1, Math.min(1, normal.y)));
      const slopeDeg = angleRad * 180 / Math.PI;
      return { normal, tooSteep: slopeDeg > this.slopeLimitDeg };
    }
    return null;
  }

  // Runtime tuning API for UI overlay
  public setSurfaceTuning(t: Partial<{
    iceAccelFactor: number;
    iceFriction: number;
    bouncyAccelFactor: number;
    bouncyFriction: number;
    bouncyBounceBoost: number;
  }>): void {
    if (t.iceAccelFactor !== undefined) this.iceAccelFactor = t.iceAccelFactor;
    if (t.iceFriction !== undefined) this.iceFriction = t.iceFriction;
    if (t.bouncyAccelFactor !== undefined) this.bouncyAccelFactor = t.bouncyAccelFactor;
    if (t.bouncyFriction !== undefined) this.bouncyFriction = t.bouncyFriction;
    if (t.bouncyBounceBoost !== undefined) this.bouncyBounceBoost = t.bouncyBounceBoost;
  }
  
  private move(forward: number, right: number, deltaTime: number): void {
    // Get camera direction
    const cameraYaw = this.camera.getYaw();
    
    // Calculate movement direction based on camera
    const moveDir = new BABYLON.Vector3(0, 0, 0);
    
    // Forward/backward
    moveDir.x += Math.sin(cameraYaw) * forward;
    moveDir.z += Math.cos(cameraYaw) * forward;
    
    // Left/right
    moveDir.x += Math.cos(cameraYaw) * right;
    moveDir.z += -Math.sin(cameraYaw) * right;
    
    // Normalize direction
    if (moveDir.length() > 0) {
      moveDir.normalize();
    }
    
    // Calculate acceleration-based movement
    const speedMultiplier = this.isSprinting ? this.sprintMultiplier : 1;
    const accel = this.isGrounded ? this.accelerationGround : this.accelerationAir;
    const control = this.isGrounded ? 1 : this.airControl;
    const ax = moveDir.x * accel * control * speedMultiplier;
    const az = moveDir.z * accel * control * speedMultiplier;
    this.physics.applyForce(this.body, new CANNON.Vec3(ax, 0, az));
  }
  
  private applyFriction(): void {
    // Apply friction/drag to horizontal velocity
    if (this.isDashing) return; // keep momentum during dash
    const friction = this.isGrounded ? this.groundFriction : this.airFriction;
    this.body.velocity.x *= friction;
    this.body.velocity.z *= friction;
  }
  
  private limitVelocity(): void {
    // Limit horizontal velocity
    const horizontalVel = new BABYLON.Vector2(this.body.velocity.x, this.body.velocity.z);
    const speed = horizontalVel.length();
    
    const maxAllowed = this.isDashing ? this.maxSpeed * this.dashMaxSpeedMultiplier : this.maxSpeed;
    if (speed > maxAllowed) {
      const scale = maxAllowed / speed;
      this.body.velocity.x *= scale;
      this.body.velocity.z *= scale;
    }
  }

  private applySlopeSlide(groundNormal: BABYLON.Vector3, deltaTime: number): void {
    // Compute slide direction along the plane
    const up = BABYLON.Vector3.Up();
    const slideDir = up.subtract(groundNormal.scale(BABYLON.Vector3.Dot(up, groundNormal)));
    if (slideDir.lengthSquared() === 0) return;
    slideDir.normalize();
    const slideStrength = 80; // tune
    const force = new CANNON.Vec3(slideDir.x * slideStrength, 0, slideDir.z * slideStrength);
    this.physics.applyForce(this.body, force);
  }

  private tryStepUp(deltaTime: number, forward: number, right: number): void {
    const cameraYaw = this.camera.getYaw();
    const dir = new BABYLON.Vector3(
      Math.cos(cameraYaw) * right + Math.sin(cameraYaw) * forward,
      0,
      -Math.sin(cameraYaw) * right + Math.cos(cameraYaw) * forward
    );
    if (dir.lengthSquared() === 0) return;
    dir.normalize();
    const footY = this.body.position.y - this.playerHalfHeight;
    const ahead = 0.6; // lookahead distance

    // Ray at foot level to detect low obstacle
    const fromLow = new CANNON.Vec3(
      this.body.position.x,
      footY + 0.05,
      this.body.position.z
    );
    const toLow = new CANNON.Vec3(
      this.body.position.x + dir.x * ahead,
      footY + 0.05,
      this.body.position.z + dir.z * ahead
    );
    const hitLow = this.physics.raycast(fromLow, toLow);
    if (!hitLow) return;

    // Check space above obstacle up to stepHeight
    const fromHigh = new CANNON.Vec3(
      fromLow.x,
      fromLow.y + this.stepHeight + 0.1,
      fromLow.z
    );
    const toHigh = new CANNON.Vec3(
      toLow.x,
      toLow.y + this.stepHeight + 0.1,
      toLow.z
    );
    const hitHigh = this.physics.raycast(fromHigh, toHigh);
    if (hitHigh) return; // blocked above; not a small step

    // Apply a small upward impulse to step up
    const impulseY = Math.max(2.5, this.stepHeight * 10);
    this.physics.applyImpulse(this.body, new CANNON.Vec3(0, impulseY, 0));
  }

  private tryDash(): void {
    const now = performance.now();
    if (now - this.lastDashAt < this.dashCooldownMs) return;
    if (!this.isGrounded && !this.dashAirAllowed) return;

    // Movement input direction or camera forward
    const camYaw = this.camera.getYaw();
    const forward = (this.keysPressed.has('KeyW') ? 1 : 0) - (this.keysPressed.has('KeyS') ? 1 : 0);
    const right = (this.keysPressed.has('KeyD') ? 1 : 0) - (this.keysPressed.has('KeyA') ? 1 : 0);
    let dirX = 0;
    let dirZ = 0;
    if (forward !== 0 || right !== 0) {
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      dirX = right * cos + forward * sin;
      dirZ = -right * sin + forward * cos;
    } else {
      // camera forward, horizontal only
      dirX = Math.sin(camYaw);
      dirZ = Math.cos(camYaw);
    }
    const len = Math.hypot(dirX, dirZ) || 1;
    dirX /= len; dirZ /= len;

    // Apply horizontal impulse
    const impulse = new CANNON.Vec3(dirX * this.dashImpulse, 0, dirZ * this.dashImpulse);
    this.physics.applyImpulse(this.body, impulse);

    this.isDashing = true;
    this.dashEndsAt = now + this.dashDurationMs;
    this.lastDashAt = now;
  }
  
  private jump(): void {
    if (!this.isGrounded || !this.canJump) return;
    
    // Apply upward impulse
    const jumpImpulse = new CANNON.Vec3(0, this.jumpForce, 0);
    this.physics.applyImpulse(this.body, jumpImpulse);
    
    this.canJump = false;
    this.isGrounded = false;
    this.isJumping = true;
    this.jumpStartedAt = performance.now();
    this.jumpCutApplied = false;
  }
  
  public syncMeshToPhysics(): void {
    // Sync mesh position with physics body
    this.mesh.position.x = this.body.position.x;
    this.mesh.position.y = this.body.position.y - this.meshAnchorYOffset;
    this.mesh.position.z = this.body.position.z;
    
    // No rotation for player mesh (always upright)
    this.mesh.rotation = BABYLON.Vector3.Zero();
  }
  
  public teleportTo(position: BABYLON.Vector3): void {
    // Reset velocity
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    
    // Set new position
    this.body.position.set(position.x, position.y, position.z);
    
    // Sync mesh immediately
    this.syncMeshToPhysics();
  }
  
  public getPosition(): BABYLON.Vector3 {
    return new BABYLON.Vector3(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    );
  }
  
  public getVelocity(): BABYLON.Vector3 {
    return new BABYLON.Vector3(
      this.body.velocity.x,
      this.body.velocity.y,
      this.body.velocity.z
    );
  }
  
  public getMesh(): BABYLON.Mesh {
    return this.mesh;
  }
  
  public getBody(): CannonBody {
    return this.body;
  }
  
  public isOnGround(): boolean {
    return this.isGrounded;
  }
  
  public setMoveSpeed(speed: number): void {
    this.moveSpeed = Math.max(0, speed);
  }
  
  public setJumpForce(force: number): void {
    this.jumpForce = Math.max(0, force);
  }
  
  public dispose(): void {
    // Remove event listeners
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    
    // Remove from physics
    this.physics.removeBody(this.body);
    
    // Dispose mesh
    this.mesh.dispose();
  }
}
