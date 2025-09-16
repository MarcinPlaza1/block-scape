import * as BABYLON from '@babylonjs/core';
import type { CannonBody, CannonWorld } from '../physics/types';

type CameraMode = 'orbit' | 'play' | 'ortho';

export function startEngineLoop(params: {
  worldRef: { current: CannonWorld | null };
  emitCollisionEvents?: () => void;
  isPlayMode: boolean;
  cameraModeRef: { current: CameraMode };
  updatePlayer: () => void;
  blocksRef: { current: Array<{ mesh?: BABYLON.Mesh; body?: CannonBody }> };
  cameraRef: { current: BABYLON.Camera | null };
  renderer: any; // Compatibility layer renderer
  scene: BABYLON.Scene;
}) {
  const fixedTimeStep = 1 / 60;
  let lastRenderTime = 0;
  let deltaTime = 0;
  let lastTime = performance.now();
  
  const targetFps = (window as any).__scene_targetFps ?? 60;
  const frameInterval = 1 / Math.max(1, Math.min(120, targetFps));

  // Distance culling settings
  const maxDistance = (window as any).__scene_maxDistance ?? 250;

  // Get the Babylon engine from the scene
  const engine = params.scene.getEngine();

  const handleVisibilityChange = () => {
    if (document.hidden) {
      lastTime = performance.now();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Create render loop function
  const renderLoop = () => {
    const currentTime = performance.now();
    deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Physics step
    if (params.worldRef.current && !document.hidden) {
      try {
        const ts = (window as any).__scene_timeScale ?? 1;
        const dt = deltaTime * ts;
        params.worldRef.current.step(fixedTimeStep, dt, 3);
      } catch (error) {
        // Silent fail for physics errors
      }
    }

    // Emit collision events
    try { 
      params.emitCollisionEvents?.(); 
    } catch {}

    // Update player in play mode
    if (params.cameraModeRef.current === 'play' && params.isPlayMode && !document.hidden) {
      try { 
        params.updatePlayer(); 
      } catch {}
    }

    // Throttling
    const now = currentTime / 1000; // Convert to seconds
    if (now - lastRenderTime < frameInterval) {
      return; // Skip this frame's render work
    }
    lastRenderTime = now;

    // Sync physics with meshes and apply culling
    try {
      const camera = params.cameraRef.current;
      const cameraPos = camera?.position;

      params.blocksRef.current.forEach((block) => {
        if (block.mesh && block.body) {
          // Sync transforms from physics to mesh
          block.mesh.position.x = block.body.position.x;
          block.mesh.position.y = block.body.position.y;
          block.mesh.position.z = block.body.position.z;
          
          if (block.body.quaternion) {
            block.mesh.rotationQuaternion = new BABYLON.Quaternion(
              block.body.quaternion.x,
              block.body.quaternion.y,
              block.body.quaternion.z,
              block.body.quaternion.w
            );
          }

          // Distance culling
          if (cameraPos) {
            const distSq = BABYLON.Vector3.DistanceSquared(cameraPos, block.mesh.position);
            if (distSq > maxDistance * maxDistance) {
              block.mesh.setEnabled(false);
              return;
            }
          }

          // Frustum culling - Babylon.js handles this automatically when meshes are enabled
          // but we can do additional optimization here
          if (camera) {
            // Check if mesh is in frustum
            const frustumPlanes = camera.getScene().frustumPlanes;
            if (frustumPlanes && block.mesh.getBoundingInfo) {
              const boundingInfo = block.mesh.getBoundingInfo();
              const boundingSphere = boundingInfo.boundingSphere;
              
              let inFrustum = true;
              for (let i = 0; i < 6; i++) {
                const plane = frustumPlanes[i];
                const distance = plane.dotCoordinate(boundingSphere.centerWorld) + plane.d;
                if (distance < -boundingSphere.radiusWorld) {
                  inFrustum = false;
                  break;
                }
              }
              
              block.mesh.setEnabled(inFrustum);
            } else {
              block.mesh.setEnabled(true);
            }
          } else {
            block.mesh.setEnabled(true);
          }
        }
      });
    } catch (error) {
      // Silent fail for rendering errors
    }

    // Update thin instances if used
    try {
      const tim = (window as any).__thinInstanceManager ?? null;
      if (tim && typeof tim.updateAllInstances === 'function') tim.updateAllInstances();
    } catch {}

    // Render the scene
    params.scene.render();
  };

  // Register the render loop with Babylon engine
  engine.runRenderLoop(renderLoop);

  // Stop function
  const stop = () => {
    try {
      // Stop Babylon's render loop
      engine.stopRenderLoop(renderLoop);
    } catch (error) {
      console.warn('Error stopping render loop:', error);
    }
    
    // Clean up event listeners
    try {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    } catch (error) {
      console.warn('Error removing visibility change listener:', error);
    }
    
    // Clear any performance monitoring
    if ((window as any).__scene_timeScale) {
      (window as any).__scene_timeScale = undefined;
    }
  };

  return { stop } as const;
}