import * as BABYLON from '@babylonjs/core';
import { SceneCore } from '../shared/SceneCore';
import { Renderer, RenderableBlock } from '../shared/Renderer';
import { PlayPhysics } from './PlayPhysics';
import { PlayCamera } from './PlayCamera';
import { PlayerController } from './PlayerController';
import type { PlayerSkinId, PlayerSkinConfig } from './skins/registry';
import type { Block } from '../../../../../types';

export interface PlayEngineConfig {
  canvas: HTMLCanvasElement;
  mount: HTMLElement;
  onFinish?: () => void;
  onCheckpoint?: (checkpoint: number) => void;
  onHazard?: () => void;
  enableMultiplayer?: boolean;
  spectator?: boolean; // Preview-like mode: no player, free camera, no pointer lock
  gameMode?: 'PARKOUR' | 'PVP' | 'RACE' | 'SANDBOX';
  gameModeConfig?: string | object | null;
  skinId?: PlayerSkinId;
  skinColors?: { primary: number; secondary?: number };
  skinConfig?: PlayerSkinConfig;
}

export class PlayEngine {
  private sceneCore: SceneCore;
  private renderer: Renderer;
  private physics: PlayPhysics;
  private camera: PlayCamera;
  private playerController: PlayerController | null = null;
  private blocks: RenderableBlock[] = [];
  private isRunning = false;
  private lastTime = performance.now();
  private accumulator = 0;
  private fixedTimeStep = 1 / 60;
  private isSpectator: boolean = false;
  
  // Game state
  private startPosition: BABYLON.Vector3 | null = null;
  private checkpoints: { position: BABYLON.Vector3; id: number }[] = [];
  private currentCheckpoint = 0;
  private isFinished = false;
  private gameMode: 'PARKOUR' | 'PVP' | 'RACE' | 'SANDBOX' = 'PARKOUR';
  private gameModeConfig: any = null;
  
  constructor(private config: PlayEngineConfig) {
    this.isSpectator = !!config.spectator;
    this.gameMode = config.gameMode || 'PARKOUR';
    this.gameModeConfig = config.gameModeConfig || null;
    // Initialize core scene
    this.sceneCore = new SceneCore({
      canvas: config.canvas,
      antialias: true,
      preserveDrawingBuffer: false,
      stencil: false, // Not needed for play mode
      powerPreference: 'high-performance',
    });
    
    // Initialize renderer with play-optimized settings
    this.renderer = new Renderer(this.sceneCore, {
      maxDistance: 250,
      targetFps: 60,
      enableCulling: true,
      enableLOD: true,
    });
    
    // Initialize full physics simulation
    this.physics = new PlayPhysics();
    
    // Initialize camera controller
    this.camera = new PlayCamera(this.sceneCore.scene, config.mount);
    if (this.isSpectator) {
      this.camera.setMode('free');
    }
    
    // Setup play mode features
    this.setupPlayFeatures();
    
    // Handle window resize
    window.addEventListener('resize', this.handleResize);
  }
  
  private setupPlayFeatures(): void {
    // Remove grid and helpers from play mode
    this.sceneCore.scene.meshes.forEach(mesh => {
      if (mesh.name === 'grid' || mesh.name.includes('helper')) {
        mesh.dispose();
      }
    });
    
    // Setup game triggers
    this.setupGameTriggers();
    
    // Setup collision events
    this.physics.onCollision((event) => {
      this.handleCollision(event);
    });
  }
  
  private setupGameTriggers(): void {
    // Will be called when blocks are added to identify special blocks
  }
  
  private handleCollision(event: { bodyA: any; bodyB: any }): void {
    if (!this.playerController) return;
    
    const playerBody = this.playerController.getBody();
    if (!playerBody) return;
    
    // Check if player collided with something
    const otherBody = event.bodyA === playerBody ? event.bodyB : 
                     event.bodyB === playerBody ? event.bodyA : null;
    
    if (!otherBody) return;
    
    // Find the block associated with this body
    const block = this.blocks.find(b => b.body === otherBody);
    if (!block) return;
    
    // Handle special block types (generic)
    switch (block.block.type) {
      case 'checkpoint':
        this.handleCheckpoint(block);
        break;
        
      case 'finish':
        this.handleFinish();
        break;
        
      case 'hazard':
        this.handleHazard();
        break;
    }

    // Mode-specific collision logic (minimal skeleton)
    if (this.gameMode === 'RACE') {
      // Example: detect laps via finish line crossings if configured
      // Placeholder: future implementation using this.gameModeConfig
    } else if (this.gameMode === 'PVP') {
      // Example: apply damage on specific block types or bullets
      // Placeholder: future implementation
    }
  }
  
  private handleCheckpoint(block: RenderableBlock): void {
    const checkpointId = block.block.metadata?.checkpointId || 0;
    
    if (checkpointId > this.currentCheckpoint) {
      this.currentCheckpoint = checkpointId;
      this.config.onCheckpoint?.(checkpointId);
      
      // Visual feedback
      if (block.mesh) {
        const material = block.mesh.material as BABYLON.StandardMaterial;
        if (material) {
          material.emissiveColor = new BABYLON.Color3(0, 1, 0);
          
          // Reset after a moment
          setTimeout(() => {
            material.emissiveColor = new BABYLON.Color3(0, 0, 0);
          }, 1000);
        }
      }
    }
  }
  
  private handleFinish(): void {
    if (!this.isFinished) {
      this.isFinished = true;
      this.config.onFinish?.();
    }
  }
  
  private handleHazard(): void {
    // Respawn player at last checkpoint or start
    this.respawnPlayer();
    this.config.onHazard?.();
  }
  
  private respawnPlayer(): void {
    if (!this.playerController) return;
    
    let respawnPosition = this.startPosition;
    
    // Find last checkpoint position
    if (this.currentCheckpoint > 0) {
      const checkpoint = this.checkpoints.find(c => c.id === this.currentCheckpoint);
      if (checkpoint) {
        respawnPosition = checkpoint.position;
      }
    }
    
    if (respawnPosition) {
      this.playerController.teleportTo(respawnPosition);
    }
  }
  
  public initializePlayer(startPosition?: BABYLON.Vector3): void {
    // Create player controller
    this.playerController = new PlayerController({
      scene: this.sceneCore.scene,
      physics: this.physics,
      camera: this.camera,
      startPosition: startPosition || new BABYLON.Vector3(0, 5, 0),
      skinId: this.config.skinId,
      skinColors: this.config.skinColors,
      skinConfig: this.config.skinConfig,
    });
    
    this.startPosition = startPosition || new BABYLON.Vector3(0, 5, 0);
    
    // Set camera to follow player
    this.camera.setFollowTarget(this.playerController.getMesh());
  }
  
  public addBlock(block: RenderableBlock): void {
    this.blocks.push(block);
    this.renderer.addBlock(block);
    
    // Add physics body
    if (block.body) {
      // Assign physics material based on block type (per-surface modifiers)
      try {
        let mat: any | undefined;
        if ((block.block.type as string).includes('ice')) {
          mat = this.physics.getMaterial('ice');
        } else if ((block.block.type as string).includes('bouncy')) {
          mat = this.physics.getMaterial('bouncy');
        } else {
          mat = this.physics.getMaterial('default');
        }
        if (mat) {
          (block.body as any).material = mat;
        }
      } catch {}
      this.physics.addBody(block.body, block.block.type === 'dynamic');
    }
    
    // Check for special blocks
    if (block.block.type === 'start' && !this.startPosition) {
      this.startPosition = new BABYLON.Vector3(
        block.block.position.x,
        block.block.position.y + 2,
        block.block.position.z
      );
    } else if (block.block.type === 'checkpoint') {
      const checkpointId = block.block.metadata?.checkpointId || 0;
      this.checkpoints.push({
        position: new BABYLON.Vector3(
          block.block.position.x,
          block.block.position.y + 2,
          block.block.position.z
        ),
        id: checkpointId,
      });
    }
  }
  
  public removeBlock(block: RenderableBlock): void {
    const index = this.blocks.indexOf(block);
    if (index > -1) {
      this.blocks.splice(index, 1);
      this.renderer.removeBlock(block);
      
      // Remove physics body
      if (block.body) {
        this.physics.removeBody(block.body);
      }
    }
  }
  
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Initialize player if not spectator and not already done
    if (!this.isSpectator && !this.playerController) {
      this.initializePlayer(this.startPosition || undefined);
    }
    
    // Ensure play camera controls are active in play mode
    if (this.isSpectator) {
      // Free camera without pointer lock
      this.camera.setMode('free');
      this.camera.activate();
    } else {
      this.camera.activate();
    }

    // Start renderer
    this.renderer.start();
    
    // After first frame, optimize static content
    requestAnimationFrame(() => this.optimizeStaticScene());
    
    // Start game loop
    this.startGameLoop();
  }

  public setGameMode(mode: 'PARKOUR' | 'PVP' | 'RACE' | 'SANDBOX', config?: any): void {
    this.gameMode = mode;
    if (config !== undefined) this.gameModeConfig = config;
  }
  
  private startGameLoop(): void {
    const gameLoop = () => {
      if (!this.isRunning) return;
      
      const currentTime = performance.now();
      const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap at 100ms
      this.lastTime = currentTime;
      
      // Fixed timestep with interpolation
      this.accumulator += deltaTime;
      
      while (this.accumulator >= this.fixedTimeStep) {
        // Update physics
        this.physics.step(this.fixedTimeStep);
        
        // Update player
        if (!this.isSpectator) {
          this.playerController?.update(this.fixedTimeStep);
        }
        
        this.accumulator -= this.fixedTimeStep;
      }
      
      // Interpolation factor for smooth rendering
      const alpha = this.accumulator / this.fixedTimeStep;
      
      // Sync physics to rendering with interpolation
      this.syncPhysicsToRender(alpha);
      
      // Update camera (can use variable timestep)
      this.camera.update(deltaTime);
      
      // Request next frame
      requestAnimationFrame(gameLoop);
    };
    
    this.lastTime = performance.now();
    gameLoop();
  }

  /**
   * Optimize scene: freeze static meshes/materials/world matrices and enable engine-level freezing.
   * Should be called after blocks are created and before heavy gameplay.
   */
  public optimizeStaticScene(): void {
    const scene = this.sceneCore.scene;
    try {
      for (const mesh of scene.meshes) {
        // Skip dynamic player and any mesh with physics (heuristic)
        const isPlayer = mesh === this.playerController?.getMesh();
        const hasAnim = mesh.getAnimationRanges && mesh.getAnimationRanges().length > 0;
        if (isPlayer || hasAnim) continue;
        
        try { mesh.freezeWorldMatrix(); } catch {}
        if (mesh.material && 'freeze' in mesh.material) {
          try { (mesh.material as any).freeze(); } catch {}
        }
      }
      // Freeze active meshes list for performance
      try { scene.freezeActiveMeshes(); } catch {}
    } catch {}
  }
  
  private syncPhysicsToRender(alpha: number): void {
    for (const block of this.blocks) {
      if (block.mesh && block.body && block.block.type === 'dynamic') {
        // Interpolate position for smooth rendering
        const body = block.body;
        const mesh = block.mesh;
        
        // Simple position sync (could add interpolation if needed)
        mesh.position.x = body.position.x;
        mesh.position.y = body.position.y;
        mesh.position.z = body.position.z;
        
        // Sync rotation
        if (body.quaternion) {
          mesh.rotationQuaternion = new BABYLON.Quaternion(
            body.quaternion.x,
            body.quaternion.y,
            body.quaternion.z,
            body.quaternion.w
          );
        }
      }
    }
    
    // Sync player mesh
    if (!this.isSpectator) {
      this.playerController?.syncMeshToPhysics();
    }
  }
  
  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    
    // Stop renderer
    this.renderer.stop();

    // Deactivate input controls and release pointer lock when leaving play mode
    this.camera.deactivate();
  }
  
  private handleResize = (): void => {
    this.sceneCore.resize();
  };
  
  public dispose(): void {
    this.stop();
    
    // Clean up event listeners
    window.removeEventListener('resize', this.handleResize);
    
    // Dispose subsystems
    this.playerController?.dispose();
    this.camera.dispose();
    this.physics.dispose();
    this.renderer.stop();
    
    // Dispose core
    this.sceneCore.dispose();
  }
  
  public getCamera(): PlayCamera {
    return this.camera;
  }
  
  public getScene(): BABYLON.Scene {
    return this.sceneCore.scene;
  }
  
  public setRenderingQuality(quality: 'low' | 'medium' | 'high'): void {
    this.sceneCore.setRenderingQuality(quality);
  }
  
  public getPlayerController(): PlayerController | null {
    return this.playerController;
  }

  public applyPlayerSkin(id?: PlayerSkinId, colors?: { primary: number; secondary?: number }, cfg?: PlayerSkinConfig): void {
    if (!this.playerController) return;
    try { this.playerController.setSkin(id, colors, cfg); } catch {}
  }
  
  public enableMultiplayer(enable: boolean): void {
    // TODO: Implement multiplayer support
    console.log('Multiplayer:', enable);
  }

  public setSpectatorMode(enable: boolean): void {
    this.isSpectator = !!enable;
    if (this.isSpectator) {
      // Dispose player to fully disable control/physics coupling
      if (this.playerController) {
        try { this.playerController.dispose(); } catch {}
        this.playerController = null;
      }
      this.camera.setMode('free');
    }
  }
}
