import * as BABYLON from '@babylonjs/core';
import * as CANNON from 'cannon-es';
import type { IShadowLight } from '@babylonjs/core/Lights/shadowLight';
import type { Block } from '../types';
import TextureCache from './textureCache';
import SceneMemoryManager from '../memoryManager';
import type { CannonWorld, CannonBody, CannonMaterial, CannonShape } from '../physics/types';
import { setupMeshLOD, optimizeMeshForRendering } from '../optimization/lodManager';

// Get the singleton instances
const textureCache = TextureCache.getInstance();
const memoryManager = SceneMemoryManager.getInstance();

export type CreateBlockParams = {
  type: 'cube' | 'cube_bouncy' | 'cube_ice' | 'cube_conveyor' | 'cube_boost' | 'cube_slow' | 'cube_sticky' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'plate' | 'ramp' | 'torus' | 'wedge' | 'door' | 'window' | 'fence' | 'start' | 'checkpoint' | 'finish' | 'hazard';
  position: BABYLON.Vector3;
  id?: string;
  rotationYDeg?: number;
  rotationXDeg?: number;
  rotationZDeg?: number;
  uniformScale?: number;
  color?: number;
  // Optional PBR textures to override defaults
  textures?: {
    albedoUrl?: string;
    normalUrl?: string;
    ormUrl?: string; // occlusion-roughness-metalness packed
  };
};

export function createBlock(
  params: CreateBlockParams,
  deps: { scene: BABYLON.Scene; world: CannonWorld; dynamicMaterial?: CannonMaterial }
): Block {
  const { type, position, id, rotationYDeg, rotationXDeg, rotationZDeg, uniformScale, color, textures } = params;
  const { scene, world, dynamicMaterial } = deps;

  let mesh: BABYLON.Mesh;
  let material: BABYLON.Material;
  let shape: CannonShape | null = null;

  const scale = typeof uniformScale === 'number' && isFinite(uniformScale) ? Math.max(0.1, Math.min(10, uniformScale)) : 1;

  if (type === 'cube' || type === 'cube_bouncy' || type === 'cube_ice' || type === 'cube_conveyor' || type === 'cube_boost' || type === 'cube_slow' || type === 'cube_sticky') {
    mesh = BABYLON.MeshBuilder.CreateBox('block', { size: 1 }, scene);
    
    if (type === 'cube_conveyor') {
      const tex = textureCache.getTexture('conveyor');
      const bump = textureCache.getBumpTexture('conveyor');
      material = new BABYLON.PBRMaterial('material', scene);
      (material as BABYLON.PBRMaterial).albedoTexture = tex as BABYLON.Texture;
      (material as BABYLON.PBRMaterial).bumpTexture = bump as BABYLON.Texture;
      (material as BABYLON.PBRMaterial).metallic = 0.0;
      (material as BABYLON.PBRMaterial).roughness = 0.4;
      (material as BABYLON.PBRMaterial).environmentIntensity = 0.8;
      (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    } else if (type === 'cube_bouncy') {
      const tex = textureCache.getTexture('bouncy');
      const bump = textureCache.getBumpTexture('bouncy');
      material = new BABYLON.PBRMaterial('material', scene);
      (material as BABYLON.PBRMaterial).albedoTexture = tex as BABYLON.Texture;
      (material as BABYLON.PBRMaterial).bumpTexture = bump as BABYLON.Texture;
      (material as BABYLON.PBRMaterial).metallic = 0.0;
      (material as BABYLON.PBRMaterial).roughness = 0.3;
      (material as BABYLON.PBRMaterial).environmentIntensity = 0.8;
      (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    } else if (type === 'cube_ice') {
      const tex = textureCache.getTexture('ice');
      const bump = textureCache.getBumpTexture('ice');
      material = new BABYLON.PBRMaterial('material', scene);
      (material as BABYLON.PBRMaterial).albedoTexture = tex as BABYLON.Texture;
      (material as BABYLON.PBRMaterial).bumpTexture = bump as BABYLON.Texture;
      (material as BABYLON.PBRMaterial).metallic = 0.0;
      (material as BABYLON.PBRMaterial).roughness = 0.05;
      (material as BABYLON.PBRMaterial).alpha = 0.95;
      (material as BABYLON.PBRMaterial).indexOfRefraction = 1.31; // Ice IOR
      (material as BABYLON.PBRMaterial).subSurface.isRefractionEnabled = true;
      (material as BABYLON.PBRMaterial).environmentIntensity = 1.0;
      (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    } else {
      const mechColor = (() => {
        if (type === 'cube_boost') return 0xa855f7;
        if (type === 'cube_slow') return 0xeab308;
        if (type === 'cube_sticky') return 0x84cc16;
        return undefined;
      })();
      material = new BABYLON.PBRMaterial('material', scene);
      const finalColor = mechColor ?? (color ?? Math.random() * 0xffffff);
      (material as BABYLON.PBRMaterial).albedoColor = BABYLON.Color3.FromHexString('#' + finalColor.toString(16).padStart(6, '0'));
      (material as BABYLON.PBRMaterial).metallic = 0.0;
      (material as BABYLON.PBRMaterial).roughness = 0.6;
      (material as BABYLON.PBRMaterial).environmentIntensity = 0.8;
      (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    }
    shape = new (CANNON as any).Box(new (CANNON as any).Vec3(0.5 * scale, 0.5 * scale, 0.5 * scale));
  } else if (type === 'sphere') {
    mesh = BABYLON.MeshBuilder.CreateSphere('block', { diameter: 1, segments: 16 }, scene);
    material = new BABYLON.PBRMaterial('material', scene);
    const finalColor = color ?? Math.random() * 0xffffff;
    (material as BABYLON.PBRMaterial).albedoColor = BABYLON.Color3.FromHexString('#' + finalColor.toString(16).padStart(6, '0'));
    (material as BABYLON.PBRMaterial).metallic = 0.0;
    (material as BABYLON.PBRMaterial).roughness = 0.7;
    (material as BABYLON.PBRMaterial).environmentIntensity = 0.8;
    (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    shape = new (CANNON as any).Sphere(0.5 * scale);
  } else if (type === 'cylinder') {
    mesh = BABYLON.MeshBuilder.CreateCylinder('block', { diameter: 1, height: 1, tessellation: 16 }, scene);
    material = new BABYLON.PBRMaterial('material', scene);
    const finalColor = color ?? Math.random() * 0xffffff;
    (material as BABYLON.PBRMaterial).albedoColor = BABYLON.Color3.FromHexString('#' + finalColor.toString(16).padStart(6, '0'));
    (material as BABYLON.PBRMaterial).metallic = 0.0;
    (material as BABYLON.PBRMaterial).roughness = 0.7;
    (material as BABYLON.PBRMaterial).environmentIntensity = 0.8;
    (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    shape = new (CANNON as any).Cylinder(0.5 * scale, 0.5 * scale, 1 * scale, 16);
  } else if (type === 'cone') {
    mesh = BABYLON.MeshBuilder.CreateCylinder('block', { diameterTop: 0, diameterBottom: 1, height: 1, tessellation: 16 }, scene);
    material = new BABYLON.PBRMaterial('material', scene);
    const finalColor = color ?? Math.random() * 0xffffff;
    (material as BABYLON.PBRMaterial).albedoColor = BABYLON.Color3.FromHexString('#' + finalColor.toString(16).padStart(6, '0'));
    (material as BABYLON.PBRMaterial).metallic = 0.0;
    (material as BABYLON.PBRMaterial).roughness = 0.7;
    (material as BABYLON.PBRMaterial).environmentIntensity = 0.8;
    (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    shape = new (CANNON as any).Sphere(0.6 * scale);
  } else if (type === 'pyramid') {
    mesh = BABYLON.MeshBuilder.CreateCylinder('block', { diameterTop: 0, diameterBottom: 1.2, height: 1, tessellation: 4 }, scene);
    material = new BABYLON.PBRMaterial('material', scene);
    const finalColor = color ?? Math.random() * 0xffffff;
    (material as BABYLON.PBRMaterial).albedoColor = BABYLON.Color3.FromHexString('#' + finalColor.toString(16).padStart(6, '0'));
    (material as BABYLON.PBRMaterial).metallic = 0.0;
    (material as BABYLON.PBRMaterial).roughness = 0.7;
    (material as BABYLON.PBRMaterial).environmentIntensity = 0.8;
    (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    shape = new (CANNON as any).Sphere(0.65 * scale);
  } else if (type === 'plate') {
    mesh = BABYLON.MeshBuilder.CreateBox('block', { width: 1, height: 0.2, depth: 1 }, scene);
    material = new BABYLON.PBRMaterial('material', scene);
    const finalColor = color ?? Math.random() * 0xffffff;
    (material as BABYLON.PBRMaterial).albedoColor = BABYLON.Color3.FromHexString('#' + finalColor.toString(16).padStart(6, '0'));
    (material as BABYLON.PBRMaterial).metallic = 0.0;
    (material as BABYLON.PBRMaterial).roughness = 0.7;
    (material as BABYLON.PBRMaterial).environmentIntensity = 0.8;
    (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    shape = new (CANNON as any).Box(new (CANNON as any).Vec3(0.5 * scale, 0.1 * scale, 0.5 * scale));
  } else if (type === 'ramp') {
    mesh = BABYLON.MeshBuilder.CreateCylinder('block', { diameterTop: 1, diameterBottom: 1, height: 1, tessellation: 3, arc: Math.PI }, scene);
    material = new BABYLON.PBRMaterial('material', scene);
    const finalColor = color ?? Math.random() * 0xffffff;
    (material as BABYLON.PBRMaterial).albedoColor = BABYLON.Color3.FromHexString('#' + finalColor.toString(16).padStart(6, '0'));
    (material as BABYLON.PBRMaterial).metallic = 0.0;
    (material as BABYLON.PBRMaterial).roughness = 0.7;
    (material as BABYLON.PBRMaterial).environmentIntensity = 0.8;
    (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    shape = new (CANNON as any).Box(new (CANNON as any).Vec3(0.6 * scale, 0.5 * scale, 0.6 * scale));
  } else if (type === 'torus') {
    mesh = BABYLON.MeshBuilder.CreateTorus('block', { diameter: 1.2, thickness: 0.4, tessellation: 24 }, scene);
    material = new BABYLON.PBRMaterial('material', scene);
    const finalColor = color ?? Math.random() * 0xffffff;
    (material as BABYLON.PBRMaterial).albedoColor = BABYLON.Color3.FromHexString('#' + finalColor.toString(16).padStart(6, '0'));
    (material as BABYLON.PBRMaterial).metallic = 0.0;
    (material as BABYLON.PBRMaterial).roughness = 0.7;
    (material as BABYLON.PBRMaterial).environmentIntensity = 0.8;
    (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    shape = new (CANNON as any).Sphere(0.8 * scale);
  } else if (type === 'wedge') {
    // Custom wedge geometry
    const base = 1 * scale;
    const height = 0.5 * scale;
    const positions = [
      // bottom square
      -base/2, 0, -base/2,
       base/2, 0, -base/2,
       base/2, 0,  base/2,
      -base/2, 0, -base/2,
       base/2, 0,  base/2,
      -base/2, 0,  base/2,
      // sloped sides
      -base/2, 0,  base/2,
       base/2, 0,  base/2,
       0,      height, 0,
       base/2, 0,  base/2,
       base/2, 0, -base/2,
       0,      height, 0,
       base/2, 0, -base/2,
      -base/2, 0, -base/2,
       0,      height, 0,
      -base/2, 0, -base/2,
      -base/2, 0,  base/2,
       0,      height, 0,
    ];
    
    const customMesh = new BABYLON.Mesh('wedge', scene);
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.indices = [];
    for (let i = 0; i < positions.length / 3; i += 3) {
      vertexData.indices.push(i, i + 1, i + 2);
    }
    vertexData.applyToMesh(customMesh);
    customMesh.computeWorldMatrix(true);
    mesh = customMesh;
    
    material = new BABYLON.PBRMaterial('material', scene);
    const finalColor = color ?? Math.random() * 0xffffff;
    (material as BABYLON.PBRMaterial).albedoColor = BABYLON.Color3.FromHexString('#' + finalColor.toString(16).padStart(6, '0'));
    (material as BABYLON.PBRMaterial).metallic = 0.0;
    (material as BABYLON.PBRMaterial).roughness = 0.7;
    (material as BABYLON.PBRMaterial).environmentIntensity = 0.8;
    (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    
    // Physics compound via multiple shapes added to the body later
    const box1 = new (CANNON as any).Box(new (CANNON as any).Vec3(0.5 * scale, 0.15 * scale, 0.5 * scale));
    const box2 = new (CANNON as any).Box(new (CANNON as any).Vec3(0.5 * scale, 0.10 * scale, 0.25 * scale));
    shape = null as any;
    // We'll add these shapes directly to the body after it's constructed
    (mesh as any).__compoundShapes = [
      { shape: box1, offset: new (CANNON as any).Vec3(0, 0.15 * scale, 0), quat: new (CANNON as any).Quaternion(0, 0, 0, 1) },
      { shape: box2, offset: new (CANNON as any).Vec3(0, 0.35 * scale, 0.125 * scale), quat: new (CANNON as any).Quaternion(0, 0, 0, 1) },
    ];
  } else if (type === 'door') {
    mesh = BABYLON.MeshBuilder.CreateBox('block', { width: 1, height: 2, depth: 0.12 }, scene);
    material = new BABYLON.PBRMaterial('material', scene);
    (material as BABYLON.PBRMaterial).albedoColor = new BABYLON.Color3(0.42, 0.31, 0.16); // #6b4f2a
    (material as BABYLON.PBRMaterial).metallic = 0.0;
    (material as BABYLON.PBRMaterial).roughness = 0.8;
    (material as BABYLON.PBRMaterial).environmentIntensity = 0.7;
    (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    shape = new (CANNON as any).Box(new (CANNON as any).Vec3(0.5 * scale, 1 * scale, 0.06 * scale));
  } else if (type === 'window') {
    mesh = BABYLON.MeshBuilder.CreateBox('block', { width: 1.2, height: 1, depth: 0.08 }, scene);
    material = new BABYLON.PBRMaterial('material', scene);
    (material as BABYLON.PBRMaterial).albedoColor = new BABYLON.Color3(0.53, 0.75, 1); // #88c0ff
    (material as BABYLON.PBRMaterial).alpha = 0.5;
    (material as BABYLON.PBRMaterial).metallic = 0.0;
    (material as BABYLON.PBRMaterial).roughness = 0.05;
    (material as BABYLON.PBRMaterial).indexOfRefraction = 1.52; // Glass IOR
    (material as BABYLON.PBRMaterial).subSurface.isRefractionEnabled = true;
    (material as BABYLON.PBRMaterial).environmentIntensity = 1.0;
    (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    shape = new (CANNON as any).Box(new (CANNON as any).Vec3(0.6 * scale, 0.5 * scale, 0.04 * scale));
  } else if (type === 'start') {
    mesh = BABYLON.MeshBuilder.CreateCylinder('block', { diameter: 1.6, height: 0.2, tessellation: 24 }, scene);
    material = new BABYLON.PBRMaterial('material', scene);
    (material as BABYLON.PBRMaterial).albedoColor = new BABYLON.Color3(0, 1, 0.53); // #00ff88
    (material as BABYLON.PBRMaterial).emissiveColor = new BABYLON.Color3(0, 0.2, 0.067); // #003311
    (material as BABYLON.PBRMaterial).metallic = 0.0;
    (material as BABYLON.PBRMaterial).roughness = 0.4;
    (material as BABYLON.PBRMaterial).emissiveIntensity = 0.5;
    (material as BABYLON.PBRMaterial).environmentIntensity = 0.9;
    (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    // Compound shape
    const cyl = new (CANNON as any).Cylinder(0.8 * scale, 0.8 * scale, 0.2 * scale, 12);
    const center = new (CANNON as any).Box(new (CANNON as any).Vec3(0.2 * scale, 0.05 * scale, 0.2 * scale));
    shape = null as any;
    (mesh as any).__compoundShapes = [
      { shape: cyl, offset: new (CANNON as any).Vec3(0, 0, 0), quat: new (CANNON as any).Quaternion(0, 0, 0, 1) },
      { shape: center, offset: new (CANNON as any).Vec3(0, 0.02 * scale, 0), quat: new (CANNON as any).Quaternion(0, 0, 0, 1) },
    ];
  } else if (type === 'checkpoint') {
    mesh = BABYLON.MeshBuilder.CreateCylinder('block', { diameter: 1.6, height: 0.2, tessellation: 24 }, scene);
    material = new BABYLON.PBRMaterial('material', scene);
    (material as BABYLON.PBRMaterial).albedoColor = new BABYLON.Color3(1, 0.8, 0); // #ffcc00
    (material as BABYLON.PBRMaterial).emissiveColor = new BABYLON.Color3(0.2, 0.13, 0); // #332200
    (material as BABYLON.PBRMaterial).metallic = 0.0;
    (material as BABYLON.PBRMaterial).roughness = 0.4;
    (material as BABYLON.PBRMaterial).emissiveIntensity = 0.5;
    (material as BABYLON.PBRMaterial).environmentIntensity = 0.9;
    (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    const cyl = new (CANNON as any).Cylinder(0.8 * scale, 0.8 * scale, 0.2 * scale, 12);
    const center = new (CANNON as any).Box(new (CANNON as any).Vec3(0.2 * scale, 0.05 * scale, 0.2 * scale));
    shape = null as any;
    (mesh as any).__compoundShapes = [
      { shape: cyl, offset: new (CANNON as any).Vec3(0, 0, 0), quat: new (CANNON as any).Quaternion(0, 0, 0, 1) },
      { shape: center, offset: new (CANNON as any).Vec3(0, 0.02 * scale, 0), quat: new (CANNON as any).Quaternion(0, 0, 0, 1) },
    ];
  } else if (type === 'finish') {
    mesh = BABYLON.MeshBuilder.CreateCylinder('block', { diameter: 1.6, height: 0.2, tessellation: 24 }, scene);
    material = new BABYLON.PBRMaterial('material', scene);
    (material as BABYLON.PBRMaterial).albedoColor = new BABYLON.Color3(0, 0.8, 1); // #00ccff
    (material as BABYLON.PBRMaterial).emissiveColor = new BABYLON.Color3(0, 0.13, 0.2); // #002233
    (material as BABYLON.PBRMaterial).metallic = 0.0;
    (material as BABYLON.PBRMaterial).roughness = 0.4;
    (material as BABYLON.PBRMaterial).emissiveIntensity = 0.5;
    (material as BABYLON.PBRMaterial).environmentIntensity = 0.9;
    (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    const cyl = new (CANNON as any).Cylinder(0.8 * scale, 0.8 * scale, 0.2 * scale, 12);
    const center = new (CANNON as any).Box(new (CANNON as any).Vec3(0.2 * scale, 0.05 * scale, 0.2 * scale));
    shape = null as any;
    (mesh as any).__compoundShapes = [
      { shape: cyl, offset: new (CANNON as any).Vec3(0, 0, 0), quat: new (CANNON as any).Quaternion(0, 0, 0, 1) },
      { shape: center, offset: new (CANNON as any).Vec3(0, 0.02 * scale, 0), quat: new (CANNON as any).Quaternion(0, 0, 0, 1) },
    ];
  } else if (type === 'hazard') {
    mesh = BABYLON.MeshBuilder.CreateBox('block', { width: 1, height: 0.2, depth: 1 }, scene);
    material = new BABYLON.PBRMaterial('material', scene);
    (material as BABYLON.PBRMaterial).albedoColor = new BABYLON.Color3(1, 0.2, 0.27); // #ff3344
    (material as BABYLON.PBRMaterial).emissiveColor = new BABYLON.Color3(0.2, 0, 0); // #330000
    (material as BABYLON.PBRMaterial).metallic = 0.0;
    (material as BABYLON.PBRMaterial).roughness = 0.6;
    (material as BABYLON.PBRMaterial).emissiveIntensity = 0.8;
    (material as BABYLON.PBRMaterial).environmentIntensity = 0.8;
    (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    shape = new (CANNON as any).Box(new (CANNON as any).Vec3(0.5 * scale, 0.1 * scale, 0.5 * scale));
  } else {
    // Fence
    mesh = BABYLON.MeshBuilder.CreateBox('block', { width: 1.4, height: 1, depth: 0.06 }, scene);
    material = new BABYLON.PBRMaterial('material', scene);
    (material as BABYLON.PBRMaterial).albedoColor = new BABYLON.Color3(0.61, 0.64, 0.69); // #9ca3af
    (material as BABYLON.PBRMaterial).metallic = 0.2;
    (material as BABYLON.PBRMaterial).roughness = 0.7;
    (material as BABYLON.PBRMaterial).environmentIntensity = 0.7;
    (material as BABYLON.PBRMaterial).enableSpecularAntiAliasing = true;
    shape = new (CANNON as any).Box(new (CANNON as any).Vec3(0.7 * scale, 0.5 * scale, 0.03 * scale));
  }

  // Apply optional PBR texture overrides for any block
  if (material instanceof BABYLON.PBRMaterial && textures) {
    try {
      if (textures.albedoUrl) {
        (material as BABYLON.PBRMaterial).albedoTexture = textureCache.getUrlTexture(textures.albedoUrl, { hasAlpha: true });
      }
      if (textures.normalUrl) {
        (material as BABYLON.PBRMaterial).bumpTexture = textureCache.getUrlTexture(textures.normalUrl, { invertY: true });
      }
      if (textures.ormUrl) {
        const orm = textureCache.getUrlTexture(textures.ormUrl, {});
        (material as BABYLON.PBRMaterial).metallicTexture = orm;
        (material as BABYLON.PBRMaterial).useRoughnessFromMetallicTextureAlpha = false;
        (material as BABYLON.PBRMaterial).useRoughnessFromMetallicTextureGreen = true;
        (material as BABYLON.PBRMaterial).useMetallnessFromMetallicTextureBlue = true as any;
        (material as BABYLON.PBRMaterial).useAmbientOcclusionFromMetallicTextureRed = true as any;
      }
    } catch {}
  }

  // Apply material and transformations
  mesh.material = material;
  mesh.position.copyFrom(position);
  mesh.receiveShadows = true;
  try {
    // Prefer generator exposed by SceneEngine
    const sg = ((scene as any).__shadowGenerator as BABYLON.ShadowGenerator) 
      || ((scene.getLightByName('directionalLight') as IShadowLight | null)?.getShadowGenerator() as BABYLON.ShadowGenerator | null)
      || null;
    if (sg && typeof (sg as any).addShadowCaster === 'function') {
      (sg as any).addShadowCaster(mesh, true);
    } else {
      // Fallback: push to render list if available
      const shadowMap = (sg as any)?.getShadowMap?.();
      if (shadowMap && shadowMap.renderList) {
        shadowMap.renderList.push(mesh);
      }
    }
  } catch {}
  
  // Setup LOD based on current quality mode
  try {
    const qualityMode = (scene as any).__qualityMode || 'balanced';
    setupMeshLOD(mesh, type, qualityMode);
    optimizeMeshForRendering(mesh);
  } catch {}
  
  mesh.scaling.setAll(scale);
  const rx = (rotationXDeg || 0) * Math.PI / 180;
  const ry = (rotationYDeg || 0) * Math.PI / 180;
  const rz = (rotationZDeg || 0) * Math.PI / 180;
  mesh.rotation = new BABYLON.Vector3(rx, ry, rz);
  
  const newId = id || Date.now().toString();
  mesh.metadata = { blockId: newId, blockType: type };

  // Register mesh with memory manager for tracking
  memoryManager.registerMesh(mesh as any, newId, type);

  // Create physics body
  const body: CannonBody = new (CANNON as any).Body({ mass: 0, material: dynamicMaterial || undefined });
  try { body.type = (CANNON as any).Body.STATIC; } catch {}
  body.allowSleep = true;
  body.sleepSpeedLimit = 0.1;
  body.sleepTimeLimit = 0.5;
  if (shape) {
    body.addShape(shape);
  } else if ((mesh as any).__compoundShapes) {
    try {
      for (const part of (mesh as any).__compoundShapes as Array<{ shape: any; offset: any; quat: any }>) {
        body.addShape(part.shape, part.offset, part.quat);
      }
    } catch {}
  }
  body.position.set(position.x, position.y, position.z);
  try { body.quaternion?.setFromEuler?.(rx, ry, rz); } catch {}
  try { body.velocity.set(0, 0, 0); body.angularVelocity.set(0, 0, 0); } catch {}
  
  // Mark sensors to not physically respond
  if (type === 'start' || type === 'checkpoint' || type === 'finish' || type === 'hazard') {
    try { body.collisionResponse = false; } catch {}
  }
  (body as any).userData = { blockId: newId, blockType: type };
  world.addBody(body);

  // Get color for block data
  let blockColor: number | undefined;
  if (material instanceof BABYLON.PBRMaterial && material.albedoColor) {
    const c = material.albedoColor;
    blockColor = Math.round(c.r * 255) << 16 | Math.round(c.g * 255) << 8 | Math.round(c.b * 255);
  }

  const block: Block = {
    id: newId,
    type,
    position: { x: position.x, y: position.y, z: position.z },
    color: blockColor,
    rotationY: typeof rotationYDeg === 'number' ? rotationYDeg : 0,
    rotationX: typeof rotationXDeg === 'number' ? rotationXDeg : 0,
    rotationZ: typeof rotationZDeg === 'number' ? rotationZDeg : 0,
    scale: scale,
    mesh: mesh as any,
    body,
  };

  return block;
}

// Cleanup function for texture cache
export function disposeTextureCache() {
  textureCache.disposeAll();
}

// Get debug info
export function getTextureCacheInfo() {
  return {
    cachedTextures: textureCache.getCachedTextureCount()
  };
}

// Memory management functions
export function getMemoryStats() {
  return memoryManager.getMemoryStats();
}

export function resetMemoryStats() {
  memoryManager.resetStats();
}

export function forceGarbageCollection() {
  memoryManager.forceGC();
}