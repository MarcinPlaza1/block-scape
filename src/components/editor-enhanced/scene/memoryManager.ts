import * as BABYLON from '@babylonjs/core';

// Enhanced memory management with WeakMap patterns
export class SceneMemoryManager {
  private static instance: SceneMemoryManager;
  
  // WeakMaps for tracking objects without preventing garbage collection
  private meshRegistry = new WeakMap<BABYLON.Mesh, { id: string; type: string; createdAt: number }>();
  private geometryRegistry = new WeakMap<BABYLON.Geometry, { usage: number; createdAt: number }>();
  private materialRegistry = new WeakMap<BABYLON.Material, { usage: number; createdAt: number }>();
  private textureRegistry = new WeakMap<BABYLON.BaseTexture, { usage: number; createdAt: number }>();
  
  // Performance monitoring
  private disposeStats = {
    meshes: 0,
    geometries: 0,
    materials: 0,
    textures: 0,
    lastCleanup: Date.now()
  };

  static getInstance(): SceneMemoryManager {
    if (!SceneMemoryManager.instance) {
      SceneMemoryManager.instance = new SceneMemoryManager();
    }
    return SceneMemoryManager.instance;
  }

  // Register objects for tracking
  registerMesh(mesh: BABYLON.Mesh, id: string, type: string) {
    this.meshRegistry.set(mesh, { id, type, createdAt: Date.now() });
    
    // Also register geometry and material
    if (mesh.geometry) {
      this.registerGeometry(mesh.geometry);
    }
    if (mesh.material) {
      this.registerMaterial(mesh.material);
    }
  }

  registerGeometry(geometry: BABYLON.Geometry) {
    const existing = this.geometryRegistry.get(geometry);
    if (existing) {
      existing.usage++;
    } else {
      this.geometryRegistry.set(geometry, { usage: 1, createdAt: Date.now() });
    }
  }

  registerMaterial(material: BABYLON.Material) {
    const existing = this.materialRegistry.get(material);
    if (existing) {
      existing.usage++;
    } else {
      this.materialRegistry.set(material, { usage: 1, createdAt: Date.now() });
      
      // Register textures used by material
      if (material instanceof BABYLON.StandardMaterial) {
        if (material.diffuseTexture) this.registerTexture(material.diffuseTexture);
        if (material.ambientTexture) this.registerTexture(material.ambientTexture);
        if (material.opacityTexture) this.registerTexture(material.opacityTexture);
        if (material.reflectionTexture) this.registerTexture(material.reflectionTexture);
        if (material.emissiveTexture) this.registerTexture(material.emissiveTexture);
        if (material.specularTexture) this.registerTexture(material.specularTexture);
        if (material.bumpTexture) this.registerTexture(material.bumpTexture);
        if (material.refractionTexture) this.registerTexture(material.refractionTexture);
      } else if (material instanceof BABYLON.PBRMaterial) {
        if (material.albedoTexture) this.registerTexture(material.albedoTexture);
        if (material.ambientTexture) this.registerTexture(material.ambientTexture);
        if (material.opacityTexture) this.registerTexture(material.opacityTexture);
        if (material.reflectionTexture) this.registerTexture(material.reflectionTexture);
        if (material.emissiveTexture) this.registerTexture(material.emissiveTexture);
        if (material.reflectivityTexture) this.registerTexture(material.reflectivityTexture);
        if (material.metallicTexture) this.registerTexture(material.metallicTexture);
        if (material.microSurfaceTexture) this.registerTexture(material.microSurfaceTexture);
        if (material.bumpTexture) this.registerTexture(material.bumpTexture);
        if (material.refractionTexture) this.registerTexture(material.refractionTexture);
      }
    }
  }

  registerTexture(texture: BABYLON.BaseTexture) {
    const existing = this.textureRegistry.get(texture);
    if (existing) {
      existing.usage++;
    } else {
      this.textureRegistry.set(texture, { usage: 1, createdAt: Date.now() });
    }
  }

  // Dispose with reference counting
  disposeMesh(mesh: BABYLON.Mesh) {
    const info = this.meshRegistry.get(mesh);
    if (info) {
      this.disposeStats.meshes++;
    }
    
    // Dispose geometry if registered
    if (mesh.geometry) {
      this.disposeGeometry(mesh.geometry);
    }
    
    // Dispose materials if registered
    if (mesh.material) {
      this.disposeMaterial(mesh.material);
    }
  }

  disposeGeometry(geometry: BABYLON.Geometry) {
    const info = this.geometryRegistry.get(geometry);
    if (info) {
      info.usage--;
      if (info.usage <= 0) {
        try {
          geometry.dispose();
          this.disposeStats.geometries++;
        } catch (error) {
          console.warn('Error disposing geometry:', error);
        }
      }
    } else {
      // Not tracked, dispose immediately
      try {
        geometry.dispose();
        this.disposeStats.geometries++;
      } catch (error) {
        console.warn('Error disposing untracked geometry:', error);
      }
    }
  }

  disposeMaterial(material: BABYLON.Material) {
    const info = this.materialRegistry.get(material);
    if (info) {
      info.usage--;
      if (info.usage <= 0) {
        // Dispose textures first
        if (material instanceof BABYLON.StandardMaterial) {
          if (material.diffuseTexture) this.disposeTexture(material.diffuseTexture);
          if (material.ambientTexture) this.disposeTexture(material.ambientTexture);
          if (material.opacityTexture) this.disposeTexture(material.opacityTexture);
          if (material.reflectionTexture) this.disposeTexture(material.reflectionTexture);
          if (material.emissiveTexture) this.disposeTexture(material.emissiveTexture);
          if (material.specularTexture) this.disposeTexture(material.specularTexture);
          if (material.bumpTexture) this.disposeTexture(material.bumpTexture);
          if (material.refractionTexture) this.disposeTexture(material.refractionTexture);
        } else if (material instanceof BABYLON.PBRMaterial) {
          if (material.albedoTexture) this.disposeTexture(material.albedoTexture);
          if (material.ambientTexture) this.disposeTexture(material.ambientTexture);
          if (material.opacityTexture) this.disposeTexture(material.opacityTexture);
          if (material.reflectionTexture) this.disposeTexture(material.reflectionTexture);
          if (material.emissiveTexture) this.disposeTexture(material.emissiveTexture);
          if (material.reflectivityTexture) this.disposeTexture(material.reflectivityTexture);
          if (material.metallicTexture) this.disposeTexture(material.metallicTexture);
          if (material.microSurfaceTexture) this.disposeTexture(material.microSurfaceTexture);
          if (material.bumpTexture) this.disposeTexture(material.bumpTexture);
          if (material.refractionTexture) this.disposeTexture(material.refractionTexture);
        }
        
        try {
          material.dispose();
          this.disposeStats.materials++;
        } catch (error) {
          console.warn('Error disposing material:', error);
        }
      }
    } else {
      // Not tracked, dispose immediately
      try {
        material.dispose();
        this.disposeStats.materials++;
      } catch (error) {
        console.warn('Error disposing untracked material:', error);
      }
    }
  }

  disposeTexture(texture: BABYLON.BaseTexture) {
    const info = this.textureRegistry.get(texture);
    if (info) {
      info.usage--;
      if (info.usage <= 0) {
        try {
          texture.dispose();
          this.disposeStats.textures++;
        } catch (error) {
          console.warn('Error disposing texture:', error);
        }
      }
    } else {
      // Not tracked, dispose immediately
      try {
        texture.dispose();
        this.disposeStats.textures++;
      } catch (error) {
        console.warn('Error disposing untracked texture:', error);
      }
    }
  }

  // Debug and monitoring
  getMemoryStats() {
    return {
      ...this.disposeStats,
      timeSinceLastCleanup: Date.now() - this.disposeStats.lastCleanup
    };
  }

  // Force garbage collection hint (if available)
  forceGC() {
    if (typeof window !== 'undefined' && (window as any).gc) {
      try {
        (window as any).gc();
      } catch (error) {
        console.warn('GC not available:', error);
      }
    }
  }

  // Clear all stats
  resetStats() {
    this.disposeStats = {
      meshes: 0,
      geometries: 0,
      materials: 0,
      textures: 0,
      lastCleanup: Date.now()
    };
  }
}

// Singleton instance
export default SceneMemoryManager;