import * as BABYLON from '@babylonjs/core';
import { BlockType } from '../types';

interface InstanceData {
  id: string;
  index: number;
  position: BABYLON.Vector3;
  rotation: BABYLON.Vector3;
  scale: number;
  color: BABYLON.Color3;
}

export class ThinInstanceManager {
  private static instance: ThinInstanceManager;
  private scene: BABYLON.Scene | null = null;
  private instanceManagers = new Map<BlockType, {
    baseMesh: BABYLON.Mesh;
    instances: Map<string, InstanceData>;
    matrices: Float32Array;
    colors: Float32Array;
    needsUpdate: boolean;
  }>();

  static getInstance(): ThinInstanceManager {
    if (!ThinInstanceManager.instance) {
      ThinInstanceManager.instance = new ThinInstanceManager();
    }
    return ThinInstanceManager.instance;
  }

  setScene(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  private getOrCreateBaseMesh(type: BlockType): BABYLON.Mesh {
    if (!this.scene) throw new Error('Scene not set');

    const existing = this.instanceManagers.get(type);
    if (existing) return existing.baseMesh;

    let mesh: BABYLON.Mesh;

    // Create base mesh for each block type
    switch (type) {
      case 'cube':
      case 'cube_bouncy':
      case 'cube_ice':
      case 'cube_conveyor':
      case 'cube_boost':
      case 'cube_slow':
      case 'cube_sticky':
        mesh = BABYLON.MeshBuilder.CreateBox(`base_${type}`, { size: 1 }, this.scene);
        break;
      case 'sphere':
        mesh = BABYLON.MeshBuilder.CreateSphere(`base_${type}`, { diameter: 1, segments: 16 }, this.scene);
        break;
      case 'cylinder':
        mesh = BABYLON.MeshBuilder.CreateCylinder(`base_${type}`, { diameter: 1, height: 1, tessellation: 16 }, this.scene);
        break;
      case 'cone':
        mesh = BABYLON.MeshBuilder.CreateCylinder(`base_${type}`, { 
          diameterTop: 0, 
          diameterBottom: 1, 
          height: 1, 
          tessellation: 16 
        }, this.scene);
        break;
      case 'pyramid':
        mesh = BABYLON.MeshBuilder.CreateCylinder(`base_${type}`, { 
          diameterTop: 0, 
          diameterBottom: 1.2, 
          height: 1, 
          tessellation: 4 
        }, this.scene);
        break;
      case 'plate':
        mesh = BABYLON.MeshBuilder.CreateBox(`base_${type}`, { width: 1, height: 0.2, depth: 1 }, this.scene);
        break;
      case 'torus':
        mesh = BABYLON.MeshBuilder.CreateTorus(`base_${type}`, { diameter: 1.2, thickness: 0.4, tessellation: 24 }, this.scene);
        break;
      default:
        // Fallback to box
        mesh = BABYLON.MeshBuilder.CreateBox(`base_${type}`, { size: 1 }, this.scene);
    }

    // Create PBR material for better quality
    const material = new BABYLON.PBRMaterial(`mat_${type}`, this.scene);
    material.metallic = 0.0;
    material.roughness = 0.7;
    material.environmentIntensity = 0.8;
    material.enableSpecularAntiAliasing = true;
    
    // Special materials for certain types
    if (type === 'cube_ice') {
      material.metallic = 0.0;
      material.roughness = 0.1;
      material.alpha = 0.95;
      material.indexOfRefraction = 1.31; // Ice IOR
      material.environmentIntensity = 1.0;
    } else if (type === 'window') {
      material.metallic = 0.0;
      material.roughness = 0.0;
      material.alpha = 0.5;
      material.indexOfRefraction = 1.52; // Glass IOR
      material.environmentIntensity = 1.0;
    }

    mesh.material = material;
    mesh.isVisible = false; // Base mesh is invisible
    mesh.alwaysSelectAsActiveMesh = true; // Always render

    // Enable picking for thin instances and register custom attributes
    mesh.thinInstanceEnablePicking = true;
    mesh.thinInstanceRegisterAttribute("color", 4);

    this.instanceManagers.set(type, {
      baseMesh: mesh,
      instances: new Map(),
      matrices: new Float32Array(0),
      colors: new Float32Array(0),
      needsUpdate: false
    });

    return mesh;
  }

  addInstance(
    type: BlockType,
    id: string,
    position: BABYLON.Vector3,
    rotation: BABYLON.Vector3,
    scale: number = 1,
    color?: BABYLON.Color3
  ): void {
    const baseMesh = this.getOrCreateBaseMesh(type);
    const manager = this.instanceManagers.get(type)!;
    
    const instanceData: InstanceData = {
      id,
      index: manager.instances.size,
      position: position.clone(),
      rotation: rotation.clone(),
      scale,
      color: color || this.getDefaultColor(type)
    };

    manager.instances.set(id, instanceData);
    manager.needsUpdate = true;
  }

  removeInstance(type: BlockType, id: string): void {
    const manager = this.instanceManagers.get(type);
    if (!manager) return;

    manager.instances.delete(id);
    manager.needsUpdate = true;
  }

  updateInstance(
    type: BlockType,
    id: string,
    updates: {
      position?: BABYLON.Vector3;
      rotation?: BABYLON.Vector3;
      scale?: number;
      color?: BABYLON.Color3;
    }
  ): void {
    const manager = this.instanceManagers.get(type);
    if (!manager) return;

    const instance = manager.instances.get(id);
    if (!instance) return;

    if (updates.position) instance.position = updates.position.clone();
    if (updates.rotation) instance.rotation = updates.rotation.clone();
    if (updates.scale !== undefined) instance.scale = updates.scale;
    if (updates.color) instance.color = updates.color.clone();

    manager.needsUpdate = true;
  }

  updateAllInstances(): void {
    for (const [type, manager] of this.instanceManagers) {
      if (!manager.needsUpdate) continue;

      const instanceCount = manager.instances.size;
      if (instanceCount === 0) {
        manager.baseMesh.thinInstanceCount = 0;
        continue;
      }

      // Reallocate arrays if size changed
      if (manager.matrices.length !== instanceCount * 16) {
        manager.matrices = new Float32Array(instanceCount * 16);
        manager.colors = new Float32Array(instanceCount * 4);
      }

      // Update matrices and colors
      let index = 0;
      for (const [id, instance] of manager.instances) {
        // Update index
        instance.index = index;

        // Create transformation matrix
        const matrix = BABYLON.Matrix.Compose(
          new BABYLON.Vector3(instance.scale, instance.scale, instance.scale),
          BABYLON.Quaternion.FromEulerAngles(instance.rotation.x, instance.rotation.y, instance.rotation.z),
          instance.position
        );

        // Copy matrix to array
        matrix.copyToArray(manager.matrices, index * 16);

        // Copy color to array
        manager.colors[index * 4] = instance.color.r;
        manager.colors[index * 4 + 1] = instance.color.g;
        manager.colors[index * 4 + 2] = instance.color.b;
        manager.colors[index * 4 + 3] = 1.0; // Alpha

        index++;
      }

      // Update thin instances
      manager.baseMesh.thinInstanceSetBuffer("matrix", manager.matrices, 16);
      manager.baseMesh.thinInstanceSetBuffer("color", manager.colors, 4);

      manager.needsUpdate = false;
    }
  }

  private getDefaultColor(type: BlockType): BABYLON.Color3 {
    switch (type) {
      case 'cube_boost': return new BABYLON.Color3(0.66, 0.33, 0.97); // #a855f7
      case 'cube_slow': return new BABYLON.Color3(0.92, 0.70, 0.03); // #eab308
      case 'cube_sticky': return new BABYLON.Color3(0.52, 0.80, 0.09); // #84cc16
      case 'cube_bouncy': return new BABYLON.Color3(0.13, 0.77, 0.37); // #22c55e
      case 'start': return new BABYLON.Color3(0, 1, 0.53); // #00ff88
      case 'checkpoint': return new BABYLON.Color3(1, 0.8, 0); // #ffcc00
      case 'finish': return new BABYLON.Color3(0, 0.8, 1); // #00ccff
      case 'hazard': return new BABYLON.Color3(1, 0.2, 0.27); // #ff3344
      default: return new BABYLON.Color3(0.5, 0.5, 0.5);
    }
  }

  getInstanceAtIndex(type: BlockType, index: number): InstanceData | null {
    const manager = this.instanceManagers.get(type);
    if (!manager) return null;

    for (const instance of manager.instances.values()) {
      if (instance.index === index) return instance;
    }
    return null;
  }

  dispose(): void {
    for (const manager of this.instanceManagers.values()) {
      manager.baseMesh.dispose(false, true);
    }
    this.instanceManagers.clear();
  }

  getStats(): { type: BlockType; count: number }[] {
    const stats: { type: BlockType; count: number }[] = [];
    for (const [type, manager] of this.instanceManagers) {
      if (manager.instances.size > 0) {
        stats.push({ type, count: manager.instances.size });
      }
    }
    return stats;
  }
}
