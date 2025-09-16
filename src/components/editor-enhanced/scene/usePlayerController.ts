import { useRef, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import * as CANNON from 'cannon-es';
import type { CannonWorld, CannonBody, CannonMaterial } from './physics/types';

type PlayerControllerConfig = {
  moveForce?: number;
  maxSpeed?: number;
  jumpImpulse?: number;
  mouseSensitivity?: number;
  cameraDistance?: number;
  cameraSmoothing?: number; // 0..1
};

export function usePlayerController(params: {
  isPlayMode: boolean;
  mountRef: React.RefObject<HTMLDivElement>;
  worldRef: React.MutableRefObject<CannonWorld | null>;
  sceneRef: React.MutableRefObject<BABYLON.Scene | null>;
  cameraRef: React.MutableRefObject<BABYLON.Camera | null>;
  dynamicMaterialRef: React.MutableRefObject<CannonMaterial | null>;
  config?: PlayerControllerConfig;
}) {
  const playerRef = useRef<{ mesh: BABYLON.Mesh; body: CannonBody } | null>(null);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const yawRef = useRef<number>(0);
  const pitchRef = useRef<number>(-0.3);
  const defaultConfig: Required<PlayerControllerConfig> = {
    moveForce: 55,
    maxSpeed: 8,
    jumpImpulse: 6.5,
    mouseSensitivity: 0.0025,
    cameraDistance: 12,
    cameraSmoothing: 0.15
  };
  const configRef = useRef<Required<PlayerControllerConfig>>({ ...defaultConfig, ...(params.config || {}) });
  const cameraDistanceRef = useRef<number>(configRef.current.cameraDistance);
  const pointerLockedRef = useRef<boolean>(false);
  const smoothedTargetRef = useRef<BABYLON.Vector3>(new BABYLON.Vector3());

  useEffect(() => {
    // Update runtime config if provided changes
    if (params.config) {
      configRef.current = { ...defaultConfig, ...params.config };
    }
  }, [params.config]);

  useEffect(() => {
    if (params.isPlayMode && params.worldRef.current && params.sceneRef.current) {
      createPlayer();
    } else {
      removePlayer();
    }
  }, [params.isPlayMode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!params.isPlayMode) return;
      keysRef.current[event.code] = true;
      if (event.code === 'Space' && playerRef.current) tryJump();
    };
    const handleKeyUp = (event: KeyboardEvent) => { 
      if (!params.isPlayMode) return; 
      keysRef.current[event.code] = false; 
    };
    const handleMouseMove = (event: MouseEvent) => {
      if (!params.isPlayMode || !pointerLockedRef.current) return;
      const sensitivity = configRef.current.mouseSensitivity;
      yawRef.current -= event.movementX * sensitivity;
      pitchRef.current -= event.movementY * sensitivity;
      const limit = Math.PI / 2 - 0.1;
      pitchRef.current = Math.max(-limit, Math.min(limit, pitchRef.current));
    };
    const handleClickPointerLock = () => {
      if (!params.isPlayMode) return;
      params.mountRef.current?.requestPointerLock?.();
    };
    const handlePointerLockChange = () => { 
      pointerLockedRef.current = document.pointerLockElement === params.mountRef.current; 
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);

    // Only enable pointer lock listeners while in play mode
    if (params.isPlayMode) {
      document.addEventListener('pointerlockchange', handlePointerLockChange);
      params.mountRef.current?.addEventListener('click', handleClickPointerLock);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      if (params.isPlayMode) {
        document.removeEventListener('pointerlockchange', handlePointerLockChange);
        params.mountRef.current?.removeEventListener('click', handleClickPointerLock);
      }
      // Ensure pointer lock is released when leaving play mode or unmounting
      try {
        if (document.pointerLockElement === params.mountRef.current) {
          document.exitPointerLock();
          pointerLockedRef.current = false;
        }
      } catch {}
    };
  }, [params.isPlayMode]);

  const createPlayer = () => {
    if (!params.worldRef.current || !params.sceneRef.current) return;
    
    const mesh = BABYLON.MeshBuilder.CreateBox('player', { width: 1, height: 2, depth: 1 }, params.sceneRef.current);
    mesh.position.set(0, 5, 0);
    mesh.receiveShadows = true;
    
    // Add to shadow casters
    const scene = params.sceneRef.current;
    if (scene.lights && scene.lights.length > 0) {
      const light = scene.lights[0];
      if (light && light.getShadowGenerator) {
        const shadowGenerator = light.getShadowGenerator();
        const shadowMap = shadowGenerator?.getShadowMap?.();
        if (shadowMap && shadowMap.renderList && !shadowMap.renderList.includes(mesh)) {
          shadowMap.renderList.push(mesh);
        }
      }
    }
    
    const material = new BABYLON.StandardMaterial('playerMaterial', params.sceneRef.current);
    material.diffuseColor = new BABYLON.Color3(1, 0, 0); // Red
    material.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    mesh.material = material;

    const shape = new (CANNON as any).Box(new (CANNON as any).Vec3(0.5, 1, 0.5));
    const body = new (CANNON as any).Body({ mass: 1, material: params.dynamicMaterialRef.current || undefined });
    body.allowSleep = true;
    body.sleepSpeedLimit = 0.1;
    body.sleepTimeLimit = 0.5;
    body.addShape(shape);
    body.position.set(0, 5, 0);
    body.angularDamping = 0.9;
    body.linearDamping = 0.1;
    try {
      // Restrict rotation so player stays upright
      body.fixedRotation = true;
      body.updateMassProperties?.();
    } catch {}
    ;(body as any).userData = { isPlayer: true };
    params.worldRef.current.addBody(body);
    playerRef.current = { mesh, body };
    smoothedTargetRef.current.set(mesh.position.x, mesh.position.y + 1, mesh.position.z);
  };

  const removePlayer = () => {
    if (!playerRef.current) return;
    try {
      playerRef.current.mesh.dispose();
      params.worldRef.current?.removeBody(playerRef.current.body);
    } catch {}
    playerRef.current = null;
  };

  const isGrounded = (): boolean => {
    if (!playerRef.current || !params.worldRef.current) return false;
    try {
      const body = playerRef.current.body;
      const from = new (CANNON as any).Vec3(body.position.x, body.position.y - 0.9, body.position.z);
      const to = new (CANNON as any).Vec3(body.position.x, body.position.y - 1.3, body.position.z);
      const result: any = new (CANNON as any).RaycastResult();
      const worldAny: any = params.worldRef.current;
      if (typeof worldAny.raycastClosest === 'function') {
        worldAny.raycastClosest(from, to, {}, result);
        return !!result.hasHit;
      } else {
        const ray: any = new (CANNON as any).Ray(from, to);
        const options = { skipBackfaces: true, collisionFilterMask: -1 };
        ray.intersectWorld(params.worldRef.current, options, result);
        return !!result.hasHit;
      }
    } catch { return false; }
  };

  const tryJump = () => {
    if (!playerRef.current) return;
    if (isGrounded()) {
      const body = playerRef.current.body;
      body.applyImpulse(new (CANNON as any).Vec3(0, configRef.current.jumpImpulse, 0), body.position.clone());
    }
  };

  const update = () => {
    if (!playerRef.current || !params.cameraRef.current) return;
    const body = playerRef.current.body;
    const mesh = playerRef.current.mesh;
    const forward = (keysRef.current['KeyW'] ? 1 : 0) + (keysRef.current['ArrowUp'] ? 1 : 0);
    const backward = (keysRef.current['KeyS'] ? 1 : 0) + (keysRef.current['ArrowDown'] ? 1 : 0);
    const left = (keysRef.current['KeyA'] ? 1 : 0) + (keysRef.current['ArrowLeft'] ? 1 : 0);
    const right = (keysRef.current['KeyD'] ? 1 : 0) + (keysRef.current['ArrowRight'] ? 1 : 0);
    const moveZ = forward - backward;
    const moveX = right - left;
    const camYaw = yawRef.current;
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    const dirX = moveX * cos + moveZ * sin;
    const dirZ = -moveX * sin + moveZ * cos;
    const hasInput = Math.abs(dirX) > 0 || Math.abs(dirZ) > 0;
    const desiredDir = new BABYLON.Vector3(dirX, 0, dirZ);
    if (hasInput) desiredDir.normalize();
    const moveForce = configRef.current.moveForce;
    if (hasInput) {
      const force = new (CANNON as any).Vec3(desiredDir.x * moveForce, 0, desiredDir.z * moveForce);
      body.applyForce(force, body.position.clone());
    }
    const maxSpeed = configRef.current.maxSpeed;
    const horizSpeed = Math.hypot(body.velocity.x, body.velocity.z);
    if (horizSpeed > maxSpeed) {
      const scale = maxSpeed / horizSpeed;
      body.velocity.x *= scale;
      body.velocity.z *= scale;
    }
    if (hasInput) {
      const targetYaw = Math.atan2(desiredDir.x, desiredDir.z);
      const q = new (CANNON as any).Quaternion();
      q.setFromAxisAngle(new (CANNON as any).Vec3(0, 1, 0), targetYaw);
      body.quaternion.copy(q);
    }
    const playerPosition = new BABYLON.Vector3(body.position.x, body.position.y, body.position.z);
    const target = new BABYLON.Vector3(playerPosition.x, playerPosition.y + 1, playerPosition.z);
    smoothedTargetRef.current = BABYLON.Vector3.Lerp(smoothedTargetRef.current, target, configRef.current.cameraSmoothing);
    const r = cameraDistanceRef.current;
    const offset = new BABYLON.Vector3(
      Math.sin(yawRef.current) * r * Math.cos(pitchRef.current),
      Math.sin(-pitchRef.current) * r,
      Math.cos(yawRef.current) * r * Math.cos(pitchRef.current)
    );
    const camPos = smoothedTargetRef.current.add(offset);
    params.cameraRef.current.position.copyFrom(camPos);
    
    // Update camera target
    if (params.cameraRef.current instanceof BABYLON.UniversalCamera) {
      params.cameraRef.current.setTarget(smoothedTargetRef.current);
    } else if (params.cameraRef.current instanceof BABYLON.ArcRotateCamera) {
      params.cameraRef.current.setTarget(smoothedTargetRef.current);
    }
    
    mesh.position.set(body.position.x, body.position.y, body.position.z);
    mesh.rotationQuaternion = new BABYLON.Quaternion(
      body.quaternion.x,
      body.quaternion.y,
      body.quaternion.z,
      body.quaternion.w
    );
  };

  return { playerRef, update } as const;
}