import { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import * as CANNON from 'cannon-es';
import { PhysicsWorldPool } from '@/components/editor-enhanced/scene/physics/worldPool';
import type { CannonWorld, CannonBody, CannonMaterial, BlockCollisionEvent } from './physics/types';

export function usePhysicsWorld(terrainMode: 'flat' | 'hilly') {
  const worldRef = useRef<CannonWorld | null>(null);
  const groundBodyRef = useRef<CannonBody | null>(null);
  const groundMaterialRef = useRef<CannonMaterial | null>(null);
  const dynamicMaterialRef = useRef<CannonMaterial | null>(null);
  const collisionListenersRef = useRef<Set<(event: BlockCollisionEvent) => void>>(new Set());
  const prevPairsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pool = PhysicsWorldPool.getInstance();
    const world = pool.acquire();

    const groundMaterial = new (CANNON as any).Material('ground');
    const dynamicMaterial = new (CANNON as any).Material('dynamic');
    groundMaterialRef.current = groundMaterial;
    dynamicMaterialRef.current = dynamicMaterial;
    try {
      const groundDynamic = new (CANNON as any).ContactMaterial(groundMaterial, dynamicMaterial, { friction: 0.6, restitution: 0.1 });
      world.addContactMaterial(groundDynamic);
      const dynamicDynamic = new (CANNON as any).ContactMaterial(dynamicMaterial, dynamicMaterial, { friction: 0.5, restitution: 0.05 });
      world.addContactMaterial(dynamicDynamic);
      world.defaultContactMaterial.friction = 0.5;
      world.defaultContactMaterial.restitution = 0.05;
    } catch {}
    worldRef.current = world;

    return () => {
      if (!worldRef.current) return;
      try {
        // Clear collision listeners
        collisionListenersRef.current.clear();
        prevPairsRef.current.clear();
        
        // Return world to pool (it will be reset there)
        pool.release(worldRef.current);
        
        // Clear refs
        worldRef.current = null;
        groundBodyRef.current = null;
        groundMaterialRef.current = null;
        dynamicMaterialRef.current = null;
        
      } catch (error) {
        console.warn('Error during physics world cleanup:', error);
      }
    };
  }, []);

  const addCollisionListener = (fn: (event: BlockCollisionEvent) => void) => {
    collisionListenersRef.current.add(fn);
    return () => { collisionListenersRef.current.delete(fn); };
  };

  const emitCollisionEvents = () => {
    const world = worldRef.current;
    if (!world) return;
    try {
      const currentPairs = new Set<string>();
      const pairToEq = new Map<string, any>();
      const equations = (world.narrowphase as any)?.contactEquations || [];
      for (const eq of equations) {
        const bi = eq.bi as CannonBody;
        const bj = eq.bj as CannonBody;
        if (!bi || !bj) continue;
        const idA = bi.id;
        const idB = bj.id;
        const key = idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
        currentPairs.add(key);
        pairToEq.set(key, eq);
      }

      const prev = prevPairsRef.current;
      // begin
      for (const key of currentPairs) {
        if (!prev.has(key)) {
          const [aId, bId] = key.split('|');
          const a = world.bodies.find((b) => b.id === Number(aId));
          const b = world.bodies.find((b) => b.id === Number(bId));
          if (a && b) collisionListenersRef.current.forEach((fn) => fn({ bodyA: a, bodyB: b, contact: pairToEq.get(key), phase: 'begin' }));
        } else {
          const [aId, bId] = key.split('|');
          const a = world.bodies.find((b) => b.id === Number(aId));
          const b = world.bodies.find((b) => b.id === Number(bId));
          if (a && b) collisionListenersRef.current.forEach((fn) => fn({ bodyA: a, bodyB: b, contact: pairToEq.get(key), phase: 'stay' }));
        }
      }
      // end
      for (const key of prev) {
        if (!currentPairs.has(key)) {
          const [aId, bId] = key.split('|');
          const a = world.bodies.find((b) => b.id === Number(aId));
          const b = world.bodies.find((b) => b.id === Number(bId));
          if (a && b) collisionListenersRef.current.forEach((fn) => fn({ bodyA: a, bodyB: b, contact: undefined, phase: 'end' }));
        }
      }
      prevPairsRef.current = currentPairs;
    } catch {}
  };

  const setCollisionFilter = (body: CannonBody, group: number, mask: number) => {
    try {
      body.collisionFilterGroup = group;
      body.collisionFilterMask = mask;
    } catch {}
  };

  const createSensorSphere = (position: BABYLON.Vector3, radius: number): CannonBody | null => {
    const world = worldRef.current;
    if (!world) return null;
    try {
      const shape = new (CANNON as any).Sphere(radius);
      const body = new (CANNON as any).Body({ mass: 0 });
      body.addShape(shape);
      body.position.set(position.x, position.y, position.z);
      // Do not physically respond but still generate contacts
      body.collisionResponse = false;
      world.addBody(body);
      return body;
    } catch { return null; }
  };

  const updatePhysicsSettings = (opts: { gravity?: { x: number; y: number; z: number }; friction?: number; restitution?: number; solverIterations?: number; solverTolerance?: number }) => {
    const world = worldRef.current;
    if (!world) return;
    try {
      if (opts.gravity) world.gravity.set(opts.gravity.x, opts.gravity.y, opts.gravity.z);
      if (typeof opts.friction === 'number') world.defaultContactMaterial.friction = opts.friction;
      if (typeof opts.restitution === 'number') world.defaultContactMaterial.restitution = opts.restitution;
      if (typeof opts.solverIterations === 'number' && (world.solver as any)) (world.solver as any).iterations = opts.solverIterations;
      if (typeof opts.solverTolerance === 'number' && (world.solver as any)) (world.solver as any).tolerance = opts.solverTolerance;
    } catch {}
  };

  const raycastClosest = (from: BABYLON.Vector3, to: BABYLON.Vector3) => {
    const world = worldRef.current;
    if (!world) return { hasHit: false } as const;
    try {
      const fromV = new (CANNON as any).Vec3(from.x, from.y, from.z);
      const toV = new (CANNON as any).Vec3(to.x, to.y, to.z);
      const result: any = new (CANNON as any).RaycastResult();
      if (typeof (world as any).raycastClosest === 'function') {
        (world as any).raycastClosest(fromV, toV, {}, result);
        return {
          hasHit: !!result.hasHit,
          point: result.hasHit ? new BABYLON.Vector3(result.hitPointWorld.x, result.hitPointWorld.y, result.hitPointWorld.z) : undefined,
          normal: result.hasHit && result.hitNormalWorld ? new BABYLON.Vector3(result.hitNormalWorld.x, result.hitNormalWorld.y, result.hitNormalWorld.z) : undefined,
          body: result.body as CannonBody || undefined,
        } as const;
      } else {
        const ray: any = new (CANNON as any).Ray(fromV, toV);
        const res: any = new (CANNON as any).RaycastResult();
        ray.intersectWorld(world, { skipBackfaces: true, collisionFilterMask: -1 }, res);
        return {
          hasHit: !!res.hasHit,
          point: res.hasHit ? new BABYLON.Vector3(res.hitPointWorld.x, res.hitPointWorld.y, res.hitPointWorld.z) : undefined,
          normal: res.hasHit && res.hitNormalWorld ? new BABYLON.Vector3(res.hitNormalWorld.x, res.hitNormalWorld.y, res.hitNormalWorld.z) : undefined,
          body: res.body as CannonBody || undefined,
        } as const;
      }
    } catch {
      return { hasHit: false } as const;
    }
  };

  const createGround = (scene: BABYLON.Scene, presetType?: 'flat' | 'hilly' | 'mountains') => {
    const mode = presetType || terrainMode;
    const isFlat = mode === 'flat';
    const isHilly = mode === 'hilly';
    const isMountains = mode === 'mountains';
    
    const segs = isFlat ? 4 : 64; // Even flat terrain needs some subdivisions for editing
    
    let ground: BABYLON.Mesh;
    
    // Always create updatable ground for terrain editing
    ground = BABYLON.MeshBuilder.CreateGround('ground', { 
      width: 200, 
      height: 200, 
      subdivisions: segs, 
      updatable: true 
    }, scene);
    
    // Apply height based on mode
    if (!isFlat) {
      const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      if (positions) {
        for (let i = 0; i < positions.length; i += 3) {
          const x = positions[i];
          const z = positions[i + 2];
          let height = 0;
          
          if (isHilly) {
            // Gentle hills
            height = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2;
          } else if (isMountains) {
            // Mountains with more dramatic height variation
            const noise1 = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 5;
            const noise2 = Math.sin(x * 0.2) * Math.cos(z * 0.2) * 1;
            height = noise1 + noise2;
          }
          
          positions[i + 1] = height;
        }
        ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
        ground.createNormals(true);
      }
    }
    
    const groundMaterial = new BABYLON.PBRMaterial('groundMaterial', scene);
    groundMaterial.albedoColor = new BABYLON.Color3(0.29, 0.62, 0.29); // 0x4a9d4a
    groundMaterial.metallic = 0.0;
    groundMaterial.roughness = 0.9;
    groundMaterial.environmentIntensity = 0.7;
    groundMaterial.enableSpecularAntiAliasing = true;
    // Enable vertex colors for paint mode
    (groundMaterial as any).useVertexColors = true;
    ground.material = groundMaterial;
    ground.receiveShadows = true;

    // Ensure position buffer is updatable (for heightmap variant as well)
    try {
      const pos = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      if (pos && pos.length) {
        ground.setVerticesData(BABYLON.VertexBuffer.PositionKind, pos, true);
      }
    } catch {}

    if (worldRef.current) {
      try {
        let groundBody: any;
        if (isHilly) {
          // Get vertex data from Babylon mesh
          const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
          const indices = ground.getIndices();
          
          if (positions && indices) {
            // Convert to CANNON format
            const vertices = new Float32Array(positions);
            const cannonIndices = Array.from(indices);
            
            const shape = new (CANNON as any).Trimesh(vertices, cannonIndices);
            groundBody = new (CANNON as any).Body({ mass: 0, shape });
          } else {
            // Fallback to plane if mesh data unavailable
            const shape = new (CANNON as any).Plane();
            groundBody = new (CANNON as any).Body({ mass: 0 });
            groundBody.addShape(shape);
          }
        } else {
          const shape = new (CANNON as any).Plane();
          groundBody = new (CANNON as any).Body({ mass: 0 });
          groundBody.addShape(shape);
        }
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        groundBody.material = groundMaterialRef.current || undefined;
        worldRef.current.addBody(groundBody);
        groundBodyRef.current = groundBody;
      } catch {}
    }

    return { ground };
  };

  /**
   * Rebuild ground physics body from a Babylon mesh. Call after terrain vertex edits.
   */
  const rebuildGroundBodyFromMesh = (ground: BABYLON.Mesh | null) => {
    if (!ground || !worldRef.current) return;
    try {
      // Remove previous ground body
      if (groundBodyRef.current) {
        try { worldRef.current.removeBody(groundBodyRef.current); } catch {}
        groundBodyRef.current = null as any;
      }
      // Build Trimesh if possible, else Plane
      const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      const indices = ground.getIndices();
      let groundBody: any;
      if (positions && indices && positions.length >= 9 && indices.length >= 3) {
        const vertices = new Float32Array(positions);
        const cannonIndices = Array.from(indices);
        const shape = new (CANNON as any).Trimesh(vertices, cannonIndices);
        groundBody = new (CANNON as any).Body({ mass: 0, shape });
      } else {
        const shape = new (CANNON as any).Plane();
        groundBody = new (CANNON as any).Body({ mass: 0 });
        groundBody.addShape(shape);
      }
      groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
      groundBody.material = groundMaterialRef.current || undefined;
      worldRef.current.addBody(groundBody);
      groundBodyRef.current = groundBody;
    } catch {}
  };

  const applyTerrainPreset = (scene: BABYLON.Scene, presetType: 'flat' | 'hilly' | 'mountains') => {
    // Remove existing ground
    const existingGround = scene.getMeshByName('ground');
    if (existingGround) {
      existingGround.dispose();
    }
    
    // Remove existing ground body
    if (groundBodyRef.current && worldRef.current) {
      worldRef.current.removeBody(groundBodyRef.current);
      groundBodyRef.current = null;
    }
    
    // Create new ground with preset
    const { ground } = createGround(scene, presetType);
    
    // Return the new ground mesh
    return ground;
  };

  return {
    worldRef,
    groundBodyRef,
    groundMaterialRef,
    dynamicMaterialRef,
    createGround,
    updatePhysicsSettings,
    raycastClosest,
    addCollisionListener,
    applyTerrainPreset,
    emitCollisionEvents,
    setCollisionFilter,
    createSensorSphere,
    rebuildGroundBodyFromMesh,
  } as const;
}


