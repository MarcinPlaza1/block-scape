import * as BABYLON from '@babylonjs/core';
import type { Block } from '../../../../types';
import type { CannonBody } from '../../physics/types';
import { SceneCore } from './SceneCore';

export interface RenderableBlock {
  mesh?: BABYLON.Mesh;
  body?: CannonBody;
  block: Block;
}

export interface RendererConfig {
  maxDistance?: number;
  targetFps?: number;
  enableCulling?: boolean;
  enableLOD?: boolean;
}

export class Renderer {
  private sceneCore: SceneCore;
  private blocks: RenderableBlock[] = [];
  private config: Required<RendererConfig>;
  private lastRenderTime = 0;
  private frameInterval: number;
  private isRunning = false;
  private renderLoopId: number | null = null;
  
  constructor(sceneCore: SceneCore, config?: RendererConfig) {
    this.sceneCore = sceneCore;
    this.config = {
      maxDistance: config?.maxDistance ?? 250,
      targetFps: config?.targetFps ?? 60,
      enableCulling: config?.enableCulling ?? true,
      enableLOD: config?.enableLOD ?? true,
    };
    
    this.frameInterval = 1 / Math.max(1, Math.min(120, this.config.targetFps));
  }
  
  public setBlocks(blocks: RenderableBlock[]): void {
    this.blocks = blocks;
  }
  
  public addBlock(block: RenderableBlock): void {
    this.blocks.push(block);
  }
  
  public removeBlock(block: RenderableBlock): void {
    const index = this.blocks.indexOf(block);
    if (index > -1) {
      this.blocks.splice(index, 1);
    }
  }
  
  public clearBlocks(): void {
    this.blocks = [];
  }
  
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.sceneCore.engine.runRenderLoop(() => this.render());
  }
  
  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.sceneCore.engine.stopRenderLoop(() => this.render());
  }
  
  private render(): void {
    const now = performance.now() / 1000;
    
    // Frame rate limiting
    if (now - this.lastRenderTime < this.frameInterval) {
      return;
    }
    this.lastRenderTime = now;
    
    // Apply culling if enabled
    if (this.config.enableCulling) {
      this.applyCulling();
    }
    
    // Update LODs if enabled
    if (this.config.enableLOD) {
      this.applyLODs();
    }
    
    // Render the scene
    this.sceneCore.scene.render();
  }
  
  private applyCulling(): void {
    const camera = this.sceneCore.scene.activeCamera;
    if (!camera) return;
    
    const cameraPos = camera.position;
    const maxDistanceSq = this.config.maxDistance * this.config.maxDistance;
    
    for (const block of this.blocks) {
      if (!block.mesh) continue;
      
      // Distance culling
      const distSq = BABYLON.Vector3.DistanceSquared(cameraPos, block.mesh.position);
      if (distSq > maxDistanceSq) {
        block.mesh.setEnabled(false);
        continue;
      }
      
      // Frustum culling - check if mesh is in camera frustum
      if (this.isMeshInFrustum(block.mesh, camera)) {
        block.mesh.setEnabled(true);
      } else {
        block.mesh.setEnabled(false);
      }
    }
  }
  
  private applyLODs(): void {
    const camera = this.sceneCore.scene.activeCamera;
    if (!camera) return;
    const cameraPos = camera.position;
    
    for (const block of this.blocks) {
      if (!block.mesh) continue;
      const mesh = block.mesh;
      
      // If LOD levels are not set yet, create simple geometric LOD chain
      if (!mesh.getLODLevelAtDistance || (mesh as any).__lodSetupDone) continue;
      
      try {
        const hasLODs = (mesh as any)._LODLevels && (mesh as any)._LODLevels.length > 0;
        if (!hasLODs) {
          const dist1 = 50;
          const dist2 = 120;
          
          const lod1 = mesh.clone(mesh.name + "_lod1");
          const lod2 = mesh.clone(mesh.name + "_lod2");
          if (!lod1 || !lod2) continue;
          
          // Simplify visual cost: scale down detail via flat shading / fewer segments (approx)
          lod1.convertToFlatShadedMesh();
          lod2.convertToFlatShadedMesh();
          lod2.scaling.scaleInPlace(0.98);
          
          lod1.isVisible = false;
          lod2.isVisible = false;
          
          mesh.addLODLevel(dist1, lod1);
          mesh.addLODLevel(dist2, lod2);
          mesh.addLODLevel(Number.MAX_VALUE, null);
          (mesh as any).__lodSetupDone = true;
        }
      } catch {}
    }
  }
  
  private isMeshInFrustum(mesh: BABYLON.Mesh, camera: BABYLON.Camera): boolean {
    const frustumPlanes = camera.getScene().frustumPlanes;
    if (!frustumPlanes || !mesh.getBoundingInfo) return true;
    
    const boundingInfo = mesh.getBoundingInfo();
    const boundingSphere = boundingInfo.boundingSphere;
    
    for (let i = 0; i < 6; i++) {
      const plane = frustumPlanes[i];
      const distance = plane.dotCoordinate(boundingSphere.centerWorld) + plane.d;
      if (distance < -boundingSphere.radiusWorld) {
        return false;
      }
    }
    
    return true;
  }
  
  public updateConfig(config: Partial<RendererConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.targetFps !== undefined) {
      this.frameInterval = 1 / Math.max(1, Math.min(120, this.config.targetFps));
    }
  }
  
  public getStats(): { fps: number; drawCalls: number; activeIndices: number } {
    const engine = this.sceneCore.engine;
    return {
      fps: engine.getFps(),
      drawCalls: this.sceneCore.scene.getActiveIndices(),
      activeIndices: this.sceneCore.scene.getActiveIndices(),
    };
  }
}
