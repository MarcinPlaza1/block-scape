import * as BABYLON from '@babylonjs/core';
import { SphericalCompat } from '../compatibility/three-babylon-compat';

type CameraMode = 'orbit' | 'play' | 'ortho';

export function attachCameraController(params: {
  mount: HTMLElement;
  cameraRef: React.MutableRefObject<BABYLON.Camera | null>;
  cameraModeRef: React.MutableRefObject<CameraMode>;
  isPlayMode: boolean;
  cameraDistanceRef: React.MutableRefObject<number>;
  tempSpherical: React.MutableRefObject<SphericalCompat>;
  onDragActiveChange?: (active: boolean) => void;
  isBlockDraggingRef?: React.MutableRefObject<boolean>;
}) {
  let isOrbiting = false;
  let prev = { x: 0, y: 0 };
  let dragDistance = 0;
  
  // Free camera movement state for editor mode
  const keysPressed = new Set<string>();
  const moveSpeed = 0.5;
  const fastMoveSpeed = 2.0;
  let animationFrame: number | null = null;

  const canControl = () => {
    if (params.isPlayMode) return false;
    if (params.cameraModeRef.current === 'play') return false;
    if (params.isBlockDraggingRef?.current) return false;
    return true;
  };
  
  const canMoveWithKeys = () => {
    if (params.isPlayMode) return false;
    if (params.isBlockDraggingRef?.current) return false;
    // Do not process WASD movement while orbit-dragging
    if (isOrbiting) return false;
    // Allow movement in editor mode for all camera types
    return true;
  };
  
  // Free camera movement update function
  const updateCameraMovement = () => {
    if (!canMoveWithKeys() || !params.cameraRef.current) {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      return;
    }

    const camera = params.cameraRef.current;
    const isShiftPressed = keysPressed.has('ShiftLeft') || keysPressed.has('ShiftRight');
    const speed = isShiftPressed ? fastMoveSpeed : moveSpeed;

    // Get camera's current orientation
    const direction = BABYLON.Vector3.Forward();
    const right = BABYLON.Vector3.Right();
    const up = BABYLON.Vector3.Up();
    
    if (camera instanceof BABYLON.UniversalCamera || camera instanceof BABYLON.ArcRotateCamera) {
      // Get camera forward direction
      const matrix = camera.getViewMatrix().invert();
      direction.copyFrom(BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.Forward(), matrix));
      direction.y = 0; // Keep movement horizontal
      direction.normalize();
      
      // Calculate right vector
      right.copyFrom(BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.Right(), matrix));
      right.y = 0; // Keep movement horizontal
      right.normalize();
    }

    const movement = new BABYLON.Vector3();

    // WSAD movement
    if (keysPressed.has('KeyW')) movement.addInPlace(direction.scale(speed));
    if (keysPressed.has('KeyS')) movement.addInPlace(direction.scale(-speed));
    if (keysPressed.has('KeyA')) movement.addInPlace(right.scale(-speed));
    if (keysPressed.has('KeyD')) movement.addInPlace(right.scale(speed));
    
    // Space/C for up/down movement
    if (keysPressed.has('Space')) movement.addInPlace(up.scale(speed));
    if (keysPressed.has('KeyC')) movement.addInPlace(up.scale(-speed));

    // Apply movement to camera
    if (movement.lengthSquared() > 0) {
      camera.position.addInPlace(movement);
      
      // For ArcRotate camera, update target
      if (camera instanceof BABYLON.ArcRotateCamera) {
        camera.setTarget(camera.getTarget().add(movement));
      }
      
      // Update distance for orbit mode
      if (params.cameraModeRef.current === 'orbit') {
        params.cameraDistanceRef.current = camera.position.length();
      }
    }

    // Continue animation loop if any keys are pressed
    if (keysPressed.size > 0) {
      animationFrame = requestAnimationFrame(updateCameraMovement);
    } else {
      animationFrame = null;
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    if (!canControl()) return;
    // Only start orbit with left mouse button
    if (e.button !== 0) return;
    isOrbiting = true;
    prev = { x: e.clientX, y: e.clientY };
    dragDistance = 0;
    // Stop free-move RAF and clear pressed keys to avoid conflicting camera updates
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    keysPressed.clear();
    params.onDragActiveChange?.(false);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!canControl()) return;
    if (!isOrbiting || !params.cameraRef.current) return;
    const deltaX = e.clientX - prev.x;
    const deltaY = e.clientY - prev.y;
    dragDistance += Math.abs(deltaX) + Math.abs(deltaY);
    params.onDragActiveChange?.(dragDistance > 6);

    const cam = params.cameraRef.current;
    
    if (cam instanceof BABYLON.ArcRotateCamera) {
      // For ArcRotate camera, adjust alpha and beta
      cam.alpha -= deltaX * 0.01;
      cam.beta += deltaY * 0.01;
      cam.beta = Math.max(0.1, Math.min(Math.PI - 0.1, cam.beta));
    } else if (cam instanceof BABYLON.UniversalCamera) {
      if (params.cameraModeRef.current === 'orbit') {
        // Manual orbit for UniversalCamera
        const spherical = params.tempSpherical.current;
        spherical.setFromVector3(cam.position);
        spherical.theta -= deltaX * 0.01;
        spherical.phi += deltaY * 0.01;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        
        // Convert back to Cartesian coordinates
        const radius = spherical.radius;
        const sinPhiRadius = Math.sin(spherical.phi) * radius;
        cam.position.x = sinPhiRadius * Math.sin(spherical.theta);
        cam.position.y = Math.cos(spherical.phi) * radius;
        cam.position.z = sinPhiRadius * Math.cos(spherical.theta);
        cam.setTarget(BABYLON.Vector3.Zero());
      } else if (cam.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
        // Pan for orthographic camera
        const panSpeed = 0.02;
        cam.position.x -= deltaX * panSpeed;
        cam.position.y += deltaY * panSpeed;
      }
    }
    
    prev = { x: e.clientX, y: e.clientY };
  };

  const onMouseUp = () => {
    if (!isOrbiting) return;
    isOrbiting = false;
    params.onDragActiveChange?.(false);
  };

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  const onWheel = (e: WheelEvent) => {
    if (!canControl()) return;
    const cam = params.cameraRef.current;
    if (!cam) return;
    
    if (cam instanceof BABYLON.UniversalCamera && cam.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
      // Orthographic zoom
      const zoomFactor = 1 + e.deltaY * 0.001;
      const currentOrthoSize = Math.abs(cam.orthoTop! - cam.orthoBottom!);
      const newSize = currentOrthoSize * zoomFactor;
      const clampedSize = Math.max(6, Math.min(60, newSize));
      const aspect = Math.abs(cam.orthoRight! - cam.orthoLeft!) / currentOrthoSize;
      
      cam.orthoTop = clampedSize / 2;
      cam.orthoBottom = -clampedSize / 2;
      cam.orthoRight = (clampedSize * aspect) / 2;
      cam.orthoLeft = -(clampedSize * aspect) / 2;
    } else if (cam instanceof BABYLON.ArcRotateCamera) {
      // ArcRotate camera radius adjustment
      cam.radius = Math.max(4, Math.min(24, cam.radius + e.deltaY * 0.01));
      params.cameraDistanceRef.current = cam.radius;
    } else if (cam instanceof BABYLON.UniversalCamera) {
      // Perspective camera zoom by moving position
      const spherical = params.tempSpherical.current;
      spherical.setFromVector3(cam.position);
      spherical.radius = Math.max(4, Math.min(24, spherical.radius + e.deltaY * 0.01));
      
      const sinPhiRadius = Math.sin(spherical.phi) * spherical.radius;
      cam.position.x = sinPhiRadius * Math.sin(spherical.theta);
      cam.position.y = Math.cos(spherical.phi) * spherical.radius;
      cam.position.z = sinPhiRadius * Math.cos(spherical.theta);
      cam.setTarget(BABYLON.Vector3.Zero());
      params.cameraDistanceRef.current = spherical.radius;
    }
  };
  
  const onKeyDown = (e: KeyboardEvent) => {
    // Ignore if typing in input fields
    if ((e.target as HTMLElement)?.tagName === 'INPUT' || 
        (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
      return;
    }
    
    // Only handle WSAD movement keys and Space/C for up/down
    const movementKeys = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'KeyC', 'ShiftLeft', 'ShiftRight'];
    
    if (canMoveWithKeys() && movementKeys.includes(e.code)) {
      const wasEmpty = keysPressed.size === 0;
      keysPressed.add(e.code);
      
      // Start animation loop if this is the first key pressed
      if (wasEmpty && keysPressed.size > 0 && !animationFrame) {
        updateCameraMovement();
      }
    }
  };
  
  const onKeyUp = (e: KeyboardEvent) => {
    keysPressed.delete(e.code);
  };

  const onBlur = () => {
    // Stop camera movement and orbiting when window loses focus
    keysPressed.clear();
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    isOrbiting = false;
    params.onDragActiveChange?.(false);
  };

  params.mount.addEventListener('mousedown', onMouseDown);
  params.mount.addEventListener('mousemove', onMouseMove);
  params.mount.addEventListener('mouseup', onMouseUp);
  params.mount.addEventListener('mouseleave', onMouseUp);
  params.mount.addEventListener('wheel', onWheel);
  params.mount.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return () => {
    params.mount.removeEventListener('mousedown', onMouseDown);
    params.mount.removeEventListener('mousemove', onMouseMove);
    params.mount.removeEventListener('mouseup', onMouseUp);
    params.mount.removeEventListener('wheel', onWheel);
    params.mount.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    
    // Cleanup animation frame
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    keysPressed.clear();
  };
}