import * as BABYLON from '@babylonjs/core';

export function disposeMaterial(material: BABYLON.Material | BABYLON.Material[] | undefined | null) {
  if (!material) return;
  try {
    if (Array.isArray(material)) {
      material.forEach((m) => {
        if (m) {
          // Dispose textures if present
          if (m instanceof BABYLON.StandardMaterial) {
            if (m.diffuseTexture) m.diffuseTexture.dispose();
            if (m.ambientTexture) m.ambientTexture.dispose();
            if (m.opacityTexture) m.opacityTexture.dispose();
            if (m.reflectionTexture) m.reflectionTexture.dispose();
            if (m.emissiveTexture) m.emissiveTexture.dispose();
            if (m.specularTexture) m.specularTexture.dispose();
            if (m.bumpTexture) m.bumpTexture.dispose();
            if (m.refractionTexture) m.refractionTexture.dispose();
          } else if (m instanceof BABYLON.PBRMaterial) {
            if (m.albedoTexture) m.albedoTexture.dispose();
            if (m.ambientTexture) m.ambientTexture.dispose();
            if (m.opacityTexture) m.opacityTexture.dispose();
            if (m.reflectionTexture) m.reflectionTexture.dispose();
            if (m.emissiveTexture) m.emissiveTexture.dispose();
            if (m.reflectivityTexture) m.reflectivityTexture.dispose();
            if (m.metallicTexture) m.metallicTexture.dispose();
            if (m.microSurfaceTexture) m.microSurfaceTexture.dispose();
            if (m.bumpTexture) m.bumpTexture.dispose();
            if (m.refractionTexture) m.refractionTexture.dispose();
          }
          m.dispose();
        }
      });
    } else {
      // Dispose textures if present
      if (material instanceof BABYLON.StandardMaterial) {
        if (material.diffuseTexture) material.diffuseTexture.dispose();
        if (material.ambientTexture) material.ambientTexture.dispose();
        if (material.opacityTexture) material.opacityTexture.dispose();
        if (material.reflectionTexture) material.reflectionTexture.dispose();
        if (material.emissiveTexture) material.emissiveTexture.dispose();
        if (material.specularTexture) material.specularTexture.dispose();
        if (material.bumpTexture) material.bumpTexture.dispose();
        if (material.refractionTexture) material.refractionTexture.dispose();
      } else if (material instanceof BABYLON.PBRMaterial) {
        if (material.albedoTexture) material.albedoTexture.dispose();
        if (material.ambientTexture) material.ambientTexture.dispose();
        if (material.opacityTexture) material.opacityTexture.dispose();
        if (material.reflectionTexture) material.reflectionTexture.dispose();
        if (material.emissiveTexture) material.emissiveTexture.dispose();
        if (material.reflectivityTexture) material.reflectivityTexture.dispose();
        if (material.metallicTexture) material.metallicTexture.dispose();
        if (material.microSurfaceTexture) material.microSurfaceTexture.dispose();
        if (material.bumpTexture) material.bumpTexture.dispose();
        if (material.refractionTexture) material.refractionTexture.dispose();
      }
      material.dispose();
    }
  } catch (error) {
    console.warn('Error disposing material:', error);
  }
}

export function disposeMesh(mesh: BABYLON.Mesh | null | undefined, scene?: BABYLON.Scene) {
  if (!mesh) return;
  try {
    // Dispose material(s)
    if (mesh.material) {
      disposeMaterial(mesh.material);
    }
    
    // Remove from scene and dispose
    mesh.dispose(false, true); // Don't dispose materials (we did it above), but dispose textures
    
  } catch (error) {
    console.warn('Error disposing mesh:', error);
  }
}

export function safeRemoveObject(object: BABYLON.AbstractMesh | BABYLON.TransformNode | null | undefined, scene?: BABYLON.Scene) {
  if (!object) return;
  try {
    // Recursively dispose children first
    const children = [...object.getChildMeshes()]; // Copy array to avoid mutation issues
    children.forEach(child => {
      if (child instanceof BABYLON.Mesh) {
        disposeMesh(child);
      } else {
        safeRemoveObject(child);
      }
    });
    
    // If it's a mesh, dispose properly
    if (object instanceof BABYLON.Mesh) {
      disposeMesh(object);
    } else {
      // For transform nodes, just dispose
      object.dispose();
    }
    
  } catch (error) {
    console.warn('Error removing object:', error);
  }
}

export function disposeScene(scene: BABYLON.Scene) {
  if (!scene) return;
  try {
    // Dispose all meshes
    const meshes = [...scene.meshes];
    meshes.forEach(mesh => {
      if (mesh instanceof BABYLON.Mesh) {
        disposeMesh(mesh);
      }
    });
    
    // Dispose all materials
    const materials = [...scene.materials];
    materials.forEach(material => disposeMaterial(material));
    
    // Dispose all textures
    const textures = [...scene.textures];
    textures.forEach(texture => texture.dispose());
    
    // Dispose the scene
    scene.dispose();
    
  } catch (error) {
    console.warn('Error disposing scene:', error);
  }
}

export function disposeRenderer(renderer: any) {
  if (!renderer) return;
  try {
    // In Babylon.js, the renderer is the Engine
    if (renderer.dispose) {
      renderer.dispose();
    }
    
    // Remove canvas from DOM if present
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    } else if (renderer.getRenderingCanvas) {
      const canvas = renderer.getRenderingCanvas();
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }
    
  } catch (error) {
    console.warn('Error disposing renderer:', error);
  }
}

export function setMeshShadowDefaults(mesh: BABYLON.Mesh) {
  mesh.receiveShadows = true;
  // In Babylon.js, casting shadows is handled by adding mesh to shadow generator
  const scene = mesh.getScene();
  if (scene && scene.lights && scene.lights.length > 0) {
    const light = scene.lights[0];
    if (light && light.getShadowGenerator) {
      const shadowGenerator = light.getShadowGenerator();
      const shadowMap = shadowGenerator?.getShadowMap?.();
      if (shadowMap && shadowMap.renderList && !shadowMap.renderList.includes(mesh)) {
        shadowMap.renderList.push(mesh);
      }
    }
  }
}

// Memory management helpers
export class BabylonMemoryManager {
  private static disposed = new WeakSet();
  
  static markDisposed(object: any) {
    this.disposed.add(object);
  }
  
  static isDisposed(object: any): boolean {
    return this.disposed.has(object);
  }
  
  static getMemoryUsage(): { geometries: number; textures: number; materials: number } {
    const scene = BABYLON.Engine.LastCreatedScene;
    if (!scene) {
      return { geometries: 0, textures: 0, materials: 0 };
    }
    
    return {
      geometries: scene.geometries.length,
      textures: scene.textures.length,
      materials: scene.materials.length
    };
  }
  
  static logMemoryStats() {
    const stats = this.getMemoryUsage();
    console.log('Babylon Memory Stats:', stats);
  }
}

export function encodeFloat32Base64(arr: Float32Array): string {
  try {
    const buf = new Uint8Array(arr.buffer);
    let binary = '';
    for (let i = 0; i < buf.byteLength; i++) binary += String.fromCharCode(buf[i]);
    return btoa(binary);
  } catch { return ''; }
}

export function decodeFloat32Base64(b64: string): Float32Array {
  try {
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Float32Array(bytes.buffer);
  } catch { return new Float32Array(); }
}