import { useEffect, useRef } from 'react';
import * as THREE from 'three';
// @ts-ignore - using CDN module in app, type as any here for isolation
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

export function usePhysicsWorld(terrainMode: 'flat' | 'hilly') {
  const worldRef = useRef<any>(null);
  const groundBodyRef = useRef<any>(null);
  const groundMaterialRef = useRef<any>(null);
  const dynamicMaterialRef = useRef<any>(null);
  const collisionListenersRef = useRef<Set<(a: any, b: any, phase: 'begin' | 'end' | 'stay') => void>>(new Set());
  const prevPairsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const world = new (CANNON as any).World();
    world.gravity.set(0, -9.82, 0);
    try { world.broadphase = new (CANNON as any).SAPBroadphase(world); } catch {}
    world.allowSleep = true;
    try {
      if (world.solver) {
        world.solver.iterations = 12;
        world.solver.tolerance = 0.001;
      }
    } catch {}

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
        worldRef.current.bodies.forEach((b: any) => worldRef.current.removeBody(b));
      } catch {}
    };
  }, []);

  const addCollisionListener = (fn: (a: any, b: any, phase: 'begin' | 'end' | 'stay') => void) => {
    collisionListenersRef.current.add(fn);
    return () => collisionListenersRef.current.delete(fn);
  };

  const emitCollisionEvents = () => {
    const world: any = worldRef.current;
    if (!world) return;
    try {
      const currentPairs = new Set<string>();
      const equations: any[] = world.narrowphase?.contactEquations || [];
      for (const eq of equations) {
        const bi = eq.bi;
        const bj = eq.bj;
        if (!bi || !bj) continue;
        const idA = bi.id ?? bi._id ?? String(bi);
        const idB = bj.id ?? bj._id ?? String(bj);
        const key = idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
        currentPairs.add(key);
      }

      const prev = prevPairsRef.current;
      // begin
      for (const key of currentPairs) {
        if (!prev.has(key)) {
          const [aId, bId] = key.split('|');
          const a = world.bodies.find((b: any) => String(b.id ?? b._id ?? b) === aId);
          const b = world.bodies.find((b: any) => String(b.id ?? b._id ?? b) === bId);
          if (a && b) collisionListenersRef.current.forEach((fn) => fn(a, b, 'begin'));
        } else {
          const [aId, bId] = key.split('|');
          const a = world.bodies.find((b: any) => String(b.id ?? b._id ?? b) === aId);
          const b = world.bodies.find((b: any) => String(b.id ?? b._id ?? b) === bId);
          if (a && b) collisionListenersRef.current.forEach((fn) => fn(a, b, 'stay'));
        }
      }
      // end
      for (const key of prev) {
        if (!currentPairs.has(key)) {
          const [aId, bId] = key.split('|');
          const a = world.bodies.find((b: any) => String(b.id ?? b._id ?? b) === aId);
          const b = world.bodies.find((b: any) => String(b.id ?? b._id ?? b) === bId);
          if (a && b) collisionListenersRef.current.forEach((fn) => fn(a, b, 'end'));
        }
      }
      prevPairsRef.current = currentPairs;
    } catch {}
  };

  const setCollisionFilter = (body: any, group: number, mask: number) => {
    try {
      body.collisionFilterGroup = group;
      body.collisionFilterMask = mask;
    } catch {}
  };

  const createSensorSphere = (position: THREE.Vector3, radius: number) => {
    const world: any = worldRef.current;
    if (!world) return null as any;
    try {
      const shape = new (CANNON as any).Sphere(radius);
      const body = new (CANNON as any).Body({ mass: 0 });
      body.addShape(shape);
      body.position.set(position.x, position.y, position.z);
      // Do not physically respond but still generate contacts
      body.collisionResponse = false;
      world.addBody(body);
      return body;
    } catch { return null as any; }
  };

  const updatePhysicsSettings = (opts: { gravity?: { x: number; y: number; z: number }; friction?: number; restitution?: number; solverIterations?: number; solverTolerance?: number }) => {
    const world: any = worldRef.current;
    if (!world) return;
    try {
      if (opts.gravity) world.gravity.set(opts.gravity.x, opts.gravity.y, opts.gravity.z);
      if (typeof opts.friction === 'number') world.defaultContactMaterial.friction = opts.friction;
      if (typeof opts.restitution === 'number') world.defaultContactMaterial.restitution = opts.restitution;
      if (typeof opts.solverIterations === 'number' && world.solver) world.solver.iterations = opts.solverIterations;
      if (typeof opts.solverTolerance === 'number' && world.solver) world.solver.tolerance = opts.solverTolerance;
    } catch {}
  };

  const raycastClosest = (from: THREE.Vector3, to: THREE.Vector3) => {
    const worldAny: any = worldRef.current;
    if (!worldAny) return { hasHit: false } as const;
    try {
      const fromV = new (CANNON as any).Vec3(from.x, from.y, from.z);
      const toV = new (CANNON as any).Vec3(to.x, to.y, to.z);
      const result: any = new (CANNON as any).RaycastResult();
      if (typeof worldAny.raycastClosest === 'function') {
        worldAny.raycastClosest(fromV, toV, {}, result);
        return {
          hasHit: !!result.hasHit,
          point: result.hasHit ? new THREE.Vector3(result.hitPointWorld.x, result.hitPointWorld.y, result.hitPointWorld.z) : undefined,
          normal: result.hasHit && result.hitNormalWorld ? new THREE.Vector3(result.hitNormalWorld.x, result.hitNormalWorld.y, result.hitNormalWorld.z) : undefined,
          body: result.body || undefined,
        } as const;
      } else {
        const ray: any = new (CANNON as any).Ray(fromV, toV);
        const res: any = new (CANNON as any).RaycastResult();
        ray.intersectWorld(worldAny, { skipBackfaces: true, collisionFilterMask: -1 }, res);
        return {
          hasHit: !!res.hasHit,
          point: res.hasHit ? new THREE.Vector3(res.hitPointWorld.x, res.hitPointWorld.y, res.hitPointWorld.z) : undefined,
          normal: res.hasHit && res.hitNormalWorld ? new THREE.Vector3(res.hitNormalWorld.x, res.hitNormalWorld.y, res.hitNormalWorld.z) : undefined,
          body: res.body || undefined,
        } as const;
      }
    } catch {
      return { hasHit: false } as const;
    }
  };

  const createGround = (scene: THREE.Scene) => {
    const isHilly = terrainMode === 'hilly';
    const segs = isHilly ? 64 : 1;
    const groundGeometry = new THREE.PlaneGeometry(50, 50, segs, segs);
    if (isHilly) {
      const vertices = groundGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        const height = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 2;
        vertices[i + 2] = height;
      }
      groundGeometry.computeVertexNormals();
    }

    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x4a9d4a });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ground';
    scene.add(ground);

    if (worldRef.current) {
      try {
        let groundBody: any;
        if (isHilly) {
          const posAttr = groundGeometry.attributes.position as THREE.BufferAttribute;
          const vertices = new Float32Array(posAttr.array as ArrayLike<number>);
          let indices: number[] = [];
          if (groundGeometry.index) {
            indices = Array.from(groundGeometry.index.array as ArrayLike<number>);
          } else {
            const widthSegments = segs;
            const heightSegments = segs;
            for (let iy = 0; iy < heightSegments; iy++) {
              for (let ix = 0; ix < widthSegments; ix++) {
                const a = ix + (widthSegments + 1) * iy;
                const b = ix + (widthSegments + 1) * (iy + 1);
                const c = (ix + 1) + (widthSegments + 1) * (iy + 1);
                const d = (ix + 1) + (widthSegments + 1) * iy;
                indices.push(a, b, d, b, c, d);
              }
            }
          }
          const shape = new (CANNON as any).Trimesh(vertices, indices);
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
    }

    return { ground, groundGeometry };
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
    emitCollisionEvents,
    setCollisionFilter,
    createSensorSphere,
  } as const;
}


