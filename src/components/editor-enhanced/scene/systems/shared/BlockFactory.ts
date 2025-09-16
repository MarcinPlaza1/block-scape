import * as BABYLON from '@babylonjs/core';
import * as CANNON from 'cannon-es';
import type { Block } from '../../../../../types';
import type { RenderableBlock } from './Renderer';
import type { CannonBody, CannonWorld } from '../../physics/types';

export class BlockFactory {
  private scene: BABYLON.Scene;
  private materialCache: Map<string, BABYLON.Material> = new Map();
  
  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.initializeMaterials();
  }
  
  private initializeMaterials(): void {
    // Create default materials
    const colors = {
      red: new BABYLON.Color3(1, 0.2, 0.2),
      green: new BABYLON.Color3(0.2, 1, 0.2),
      blue: new BABYLON.Color3(0.2, 0.2, 1),
      yellow: new BABYLON.Color3(1, 1, 0.2),
      purple: new BABYLON.Color3(0.8, 0.2, 0.8),
      orange: new BABYLON.Color3(1, 0.6, 0.2),
      white: new BABYLON.Color3(0.9, 0.9, 0.9),
      black: new BABYLON.Color3(0.1, 0.1, 0.1),
      gray: new BABYLON.Color3(0.5, 0.5, 0.5),
    };
    
    // Create PBR materials for each color
    for (const [name, color] of Object.entries(colors)) {
      const material = new BABYLON.PBRMaterial(`material_${name}`, this.scene);
      material.albedoColor = color;
      material.metallic = 0.2;
      material.roughness = 0.7;
      material.environmentIntensity = 0.6;
      this.materialCache.set(name, material);
    }
    
    // Special materials
    const glassMaterial = new BABYLON.PBRMaterial('material_glass', this.scene);
    glassMaterial.albedoColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    glassMaterial.metallic = 0.1;
    glassMaterial.roughness = 0.1;
    glassMaterial.alpha = 0.3;
    glassMaterial.transparencyMode = BABYLON.PBRMaterial.MATERIAL_ALPHABLEND;
    this.materialCache.set('glass', glassMaterial);
    
    const iceMaterial = new BABYLON.PBRMaterial('material_ice', this.scene);
    iceMaterial.albedoColor = new BABYLON.Color3(0.8, 0.9, 1);
    iceMaterial.metallic = 0.0;
    iceMaterial.roughness = 0.1;
    iceMaterial.alpha = 0.7;
    iceMaterial.transparencyMode = BABYLON.PBRMaterial.MATERIAL_ALPHABLEND;
    this.materialCache.set('ice', iceMaterial);
    
    const bouncyMaterial = new BABYLON.PBRMaterial('material_bouncy', this.scene);
    bouncyMaterial.albedoColor = new BABYLON.Color3(1, 0.4, 0.7);
    bouncyMaterial.metallic = 0.8;
    bouncyMaterial.roughness = 0.2;
    bouncyMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.05, 0.1);
    this.materialCache.set('bouncy', bouncyMaterial);
  }
  
  public createBlock(block: Block, includePhysics: boolean = false): RenderableBlock | null {
    const mesh = this.createMesh(block);
    if (!mesh) return null;
    
    // Apply material
    const material = this.getMaterial(block.color || '#808080');
    mesh.material = material;
    
    // Set position
    mesh.position.set(
      block.position.x,
      block.position.y,
      block.position.z
    );
    
    // Set rotation if provided
    if (block.rotation) {
      mesh.rotation.set(
        block.rotation.x,
        block.rotation.y,
        block.rotation.z
      );
    }
    
    // Set scale if provided
    if (block.scale) {
      mesh.scaling.set(
        block.scale.x,
        block.scale.y,
        block.scale.z
      );
    }
    
    // Store block data on mesh
    (mesh as any).blockData = block;
    
    // Create physics body if requested
    let body: CannonBody | undefined;
    if (includePhysics) {
      body = this.createPhysicsBody(block);
    }
    
    return {
      mesh,
      body,
      block,
    };
  }
  
  private createMesh(block: Block): BABYLON.Mesh | null {
    let mesh: BABYLON.Mesh;
    
    switch (block.type) {
      case 'cube':
      case 'cube_ice':
      case 'cube_bouncy':
        mesh = BABYLON.MeshBuilder.CreateBox(
          `block_${block.id}`,
          { size: 1 },
          this.scene
        );
        break;
        
      case 'sphere':
        mesh = BABYLON.MeshBuilder.CreateSphere(
          `block_${block.id}`,
          { diameter: 1, segments: 16 },
          this.scene
        );
        break;
        
      case 'cylinder':
        mesh = BABYLON.MeshBuilder.CreateCylinder(
          `block_${block.id}`,
          { height: 1, diameter: 1, tessellation: 16 },
          this.scene
        );
        break;
        
      case 'cone':
        mesh = BABYLON.MeshBuilder.CreateCylinder(
          `block_${block.id}`,
          { height: 1, diameterTop: 0, diameterBottom: 1, tessellation: 16 },
          this.scene
        );
        break;
        
      case 'pyramid':
        mesh = BABYLON.MeshBuilder.CreateCylinder(
          `block_${block.id}`,
          { height: 1, diameterTop: 0, diameterBottom: 1.414, tessellation: 4 },
          this.scene
        );
        break;
        
      case 'plate':
        mesh = BABYLON.MeshBuilder.CreateBox(
          `block_${block.id}`,
          { width: 1, height: 0.1, depth: 1 },
          this.scene
        );
        break;
        
      case 'ramp':
        // Create a ramp using a wedge shape
        const rampPath = [
          new BABYLON.Vector3(-0.5, -0.5, 0),
          new BABYLON.Vector3(0.5, -0.5, 0),
          new BABYLON.Vector3(0.5, 0.5, 0),
          new BABYLON.Vector3(-0.5, -0.5, 0),
        ];
        mesh = BABYLON.MeshBuilder.CreatePolygon(
          `block_${block.id}`,
          { shape: rampPath, depth: 1 },
          this.scene
        );
        mesh.rotation.x = Math.PI / 2;
        break;
        
      case 'start':
        mesh = BABYLON.MeshBuilder.CreateBox(
          `block_${block.id}`,
          { size: 1 },
          this.scene
        );
        // Add glow for start block
        mesh.enableEdgesRendering();
        mesh.edgesWidth = 4.0;
        mesh.edgesColor = new BABYLON.Color4(0, 1, 0, 1);
        break;
        
      case 'checkpoint':
        mesh = BABYLON.MeshBuilder.CreateTorus(
          `block_${block.id}`,
          { diameter: 1, thickness: 0.2, tessellation: 16 },
          this.scene
        );
        mesh.rotation.x = Math.PI / 2;
        break;
        
      case 'finish':
        mesh = BABYLON.MeshBuilder.CreateBox(
          `block_${block.id}`,
          { size: 1 },
          this.scene
        );
        // Add glow for finish block
        mesh.enableEdgesRendering();
        mesh.edgesWidth = 4.0;
        mesh.edgesColor = new BABYLON.Color4(1, 0.8, 0, 1);
        break;
        
      case 'hazard':
        // Create spikes for hazard
        mesh = BABYLON.MeshBuilder.CreateCylinder(
          `block_${block.id}`,
          { height: 1, diameterTop: 0, diameterBottom: 0.5, tessellation: 4 },
          this.scene
        );
        break;
        
      default:
        // Default to cube
        mesh = BABYLON.MeshBuilder.CreateBox(
          `block_${block.id}`,
          { size: 1 },
          this.scene
        );
    }
    
    // Optimize mesh
    mesh.freezeNormals();
    mesh.receiveShadows = true;
    mesh.checkCollisions = true;
    
    return mesh;
  }
  
  private getMaterial(color: string): BABYLON.Material {
    // Special material mappings
    if (color === '#00ff00' || color === 'green') {
      return this.materialCache.get('green')!;
    } else if (color === '#ff0000' || color === 'red') {
      return this.materialCache.get('red')!;
    } else if (color === '#0000ff' || color === 'blue') {
      return this.materialCache.get('blue')!;
    } else if (color === '#ffff00' || color === 'yellow') {
      return this.materialCache.get('yellow')!;
    } else if (color === '#ff00ff' || color === 'purple') {
      return this.materialCache.get('purple')!;
    } else if (color === '#ffa500' || color === 'orange') {
      return this.materialCache.get('orange')!;
    } else if (color === '#ffffff' || color === 'white') {
      return this.materialCache.get('white')!;
    } else if (color === '#000000' || color === 'black') {
      return this.materialCache.get('black')!;
    } else if (color === 'glass') {
      return this.materialCache.get('glass')!;
    } else if (color === 'ice') {
      return this.materialCache.get('ice')!;
    } else if (color === 'bouncy') {
      return this.materialCache.get('bouncy')!;
    }
    
    // Default to gray
    return this.materialCache.get('gray')!;
  }
  
  private createPhysicsBody(block: Block): CannonBody {
    let shape: CANNON.Shape;
    const scale = block.scale || { x: 1, y: 1, z: 1 };
    
    switch (block.type) {
      case 'sphere':
        shape = new CANNON.Sphere(0.5 * Math.max(scale.x, scale.y, scale.z));
        break;
        
      case 'cylinder':
        // Cannon doesn't have cylinder, use box approximation
        shape = new CANNON.Box(new CANNON.Vec3(
          0.5 * scale.x,
          0.5 * scale.y,
          0.5 * scale.z
        ));
        break;
        
      case 'plate':
        shape = new CANNON.Box(new CANNON.Vec3(
          0.5 * scale.x,
          0.05 * scale.y,
          0.5 * scale.z
        ));
        break;
        
      default:
        // Default to box
        shape = new CANNON.Box(new CANNON.Vec3(
          0.5 * scale.x,
          0.5 * scale.y,
          0.5 * scale.z
        ));
    }
    
    const body = new CANNON.Body({
      mass: 0, // Static by default
      shape: shape,
      position: new CANNON.Vec3(
        block.position.x,
        block.position.y,
        block.position.z
      ),
    }) as CannonBody;
    
    // Apply rotation if provided
    if (block.rotation) {
      const quaternion = new CANNON.Quaternion();
      quaternion.setFromEuler(block.rotation.x, block.rotation.y, block.rotation.z);
      body.quaternion = quaternion;
    }
    
    return body;
  }
  
  public dispose(): void {
    // Dispose materials
    for (const material of this.materialCache.values()) {
      material.dispose();
    }
    this.materialCache.clear();
  }
}

// Helper function for backward compatibility
export function createBlock(
  block: Block,
  scene: BABYLON.Scene,
  includePhysics: boolean = false
): RenderableBlock | null {
  const factory = new BlockFactory(scene);
  const result = factory.createBlock(block, includePhysics);
  // Note: In production, you'd want to reuse the factory instance
  return result;
}

export function disposeBlock(block: RenderableBlock): void {
  if (block.mesh) {
    block.mesh.dispose();
  }
  // Physics body disposal is handled by the physics system
}
