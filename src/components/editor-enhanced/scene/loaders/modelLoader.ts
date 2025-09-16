import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { setupMeshLOD, optimizeMeshForRendering } from '../optimization/lodManager';

export interface ModelLoadOptions {
  position?: BABYLON.Vector3;
  rotation?: BABYLON.Vector3;
  scale?: number | BABYLON.Vector3;
  receiveShadows?: boolean;
  castShadows?: boolean;
  optimizeMaterials?: boolean;
  setupLOD?: boolean;
  qualityMode?: 'performance' | 'balanced' | 'quality';
}

export class ModelLoader {
  private static loadedModels = new Map<string, BABYLON.AssetContainer>();

  static async loadModel(
    url: string,
    scene: BABYLON.Scene,
    options: ModelLoadOptions = {}
  ): Promise<BABYLON.AbstractMesh[]> {
    try {
      // Check cache first
      let container = this.loadedModels.get(url);
      
      if (!container) {
        // Load the model
        container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
          url.substring(0, url.lastIndexOf('/') + 1),
          url.substring(url.lastIndexOf('/') + 1),
          scene
        );
        
        this.loadedModels.set(url, container);
      }

      // Instantiate the model
      const entries = container.instantiateModelsToScene();
      const rootMesh = entries.rootNodes[0] as BABYLON.AbstractMesh;
      const meshes = entries.rootNodes.filter(n => n instanceof BABYLON.AbstractMesh) as BABYLON.AbstractMesh[];

      // Apply transformations
      if (options.position) {
        rootMesh.position = options.position;
      }
      if (options.rotation) {
        rootMesh.rotation = options.rotation;
      }
      if (options.scale) {
        if (typeof options.scale === 'number') {
          rootMesh.scaling = new BABYLON.Vector3(options.scale, options.scale, options.scale);
        } else {
          rootMesh.scaling = options.scale;
        }
      }

      // Process each mesh
      meshes.forEach(mesh => {
        if (mesh instanceof BABYLON.Mesh) {
          // Shadow settings
          if (options.receiveShadows !== false) {
            mesh.receiveShadows = true;
          }
          if (options.castShadows !== false && scene.lights.length > 0) {
            const shadowLight = scene.lights[0];
            const shadowGenerator = (shadowLight as any).getShadowGenerator?.();
            if (shadowGenerator) {
              shadowGenerator.addShadowCaster(mesh);
            }
          }

          // Optimize materials for PBR
          if (options.optimizeMaterials !== false && mesh.material) {
            this.optimizeMaterial(mesh.material);
          }

          // Setup LOD
          if (options.setupLOD !== false) {
            const quality = options.qualityMode || (scene as any).__qualityMode || 'balanced';
            setupMeshLOD(mesh, 'model', quality);
          }

          // General optimizations
          optimizeMeshForRendering(mesh);
        }
      });

      return meshes;
    } catch (error) {
      console.error('Failed to load model:', url, error);
      throw error;
    }
  }

  private static optimizeMaterial(material: BABYLON.Material): void {
    if (material instanceof BABYLON.PBRMaterial) {
      // Already PBR, just optimize settings
      material.enableSpecularAntiAliasing = true;
      if (material.environmentIntensity === undefined) {
        material.environmentIntensity = 0.8;
      }
    } else if (material instanceof BABYLON.StandardMaterial) {
      // Convert to PBR for better quality
      const scene = material.getScene();
      const pbrMat = new BABYLON.PBRMaterial(material.name + '_pbr', scene);
      
      // Transfer properties
      if (material.diffuseTexture) {
        pbrMat.albedoTexture = material.diffuseTexture;
      } else if (material.diffuseColor) {
        pbrMat.albedoColor = material.diffuseColor;
      }
      
      if (material.bumpTexture) {
        pbrMat.bumpTexture = material.bumpTexture;
      }
      
      if (material.specularTexture) {
        pbrMat.metallicTexture = material.specularTexture;
      }
      
      // Set PBR defaults
      pbrMat.metallic = material.specularPower ? 0.1 : 0.0;
      pbrMat.roughness = 0.7;
      pbrMat.environmentIntensity = 0.8;
      pbrMat.enableSpecularAntiAliasing = true;
      
      // Replace material on all meshes using it
      const meshes = scene.meshes.filter(m => m.material === material);
      meshes.forEach(m => m.material = pbrMat);
      
      // Dispose old material
      material.dispose();
    }
  }

  static disposeModel(url: string): void {
    const container = this.loadedModels.get(url);
    if (container) {
      container.dispose();
      this.loadedModels.delete(url);
    }
  }

  static clearCache(): void {
    for (const container of this.loadedModels.values()) {
      container.dispose();
    }
    this.loadedModels.clear();
  }
}
