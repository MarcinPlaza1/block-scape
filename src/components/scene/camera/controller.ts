import * as THREE from 'three';

type CameraMode = 'orbit' | 'first' | 'ortho';

export function attachCameraController(params: {
  mount: HTMLElement;
  cameraRef: React.MutableRefObject<THREE.Camera | null>;
  cameraModeRef: React.MutableRefObject<CameraMode>;
  isPlayMode: boolean;
  cameraDistanceRef: React.MutableRefObject<number>;
  tempSpherical: React.MutableRefObject<THREE.Spherical>;
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
    if (params.cameraModeRef.current === 'first') return false;
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
    const direction = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    
    if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
      camera.getWorldDirection(direction);
      direction.normalize();
      
      // Calculate right vector (cross product of camera direction and world up)
      right.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
      
      // Calculate up vector relative to camera
      up.crossVectors(right, direction).normalize();
    }

    const movement = new THREE.Vector3();

    // WSAD movement
    if (keysPressed.has('KeyW')) movement.add(direction.clone().multiplyScalar(speed));
    if (keysPressed.has('KeyS')) movement.add(direction.clone().multiplyScalar(-speed));
    if (keysPressed.has('KeyA')) movement.add(right.clone().multiplyScalar(-speed));
    if (keysPressed.has('KeyD')) movement.add(right.clone().multiplyScalar(speed));
    
    // Space/C for up/down movement
    if (keysPressed.has('Space')) movement.add(up.clone().multiplyScalar(speed));
    if (keysPressed.has('KeyC')) movement.add(up.clone().multiplyScalar(-speed));

    // Apply movement to camera
    if (movement.lengthSq() > 0) {
      camera.position.add(movement);
      
      // For orbit camera, also move the target point to maintain relative position
      if (params.cameraModeRef.current === 'orbit') {
        // Update distance based on new position
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
    if (cam instanceof THREE.PerspectiveCamera) {
      const spherical = params.tempSpherical.current;
      spherical.setFromVector3(cam.position);
      spherical.theta -= deltaX * 0.01;
      spherical.phi += deltaY * 0.01;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
      cam.position.setFromSpherical(spherical);
      cam.lookAt(0, 0, 0);
    } else if (cam instanceof THREE.OrthographicCamera) {
      const panSpeed = 0.02;
      cam.position.x -= deltaX * panSpeed;
      cam.position.y += deltaY * panSpeed;
    }
    prev = { x: e.clientX, y: e.clientY };
  };

  const onMouseUp = () => {
    if (!isOrbiting) return;
    isOrbiting = false;
    params.onDragActiveChange?.(false);
  };

  const onWheel = (e: WheelEvent) => {
    if (!canControl()) return;
    const cam = params.cameraRef.current;
    if (!cam) return;
    if (cam instanceof THREE.OrthographicCamera) {
      const zoomFactor = 1 + e.deltaY * 0.001;
      cam.zoom = Math.max(0.2, Math.min(5, cam.zoom / zoomFactor));
      cam.updateProjectionMatrix();
    } else {
      // Perspective: zoom by adjusting spherical radius around the origin
      const spherical = params.tempSpherical.current;
      spherical.setFromVector3((cam as THREE.PerspectiveCamera).position);
      spherical.radius = Math.max(4, Math.min(24, spherical.radius + e.deltaY * 0.01));
      (cam as THREE.PerspectiveCamera).position.setFromSpherical(spherical);
      params.cameraDistanceRef.current = spherical.radius;
      (cam as THREE.PerspectiveCamera).lookAt(0, 0, 0);
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

  params.mount.addEventListener('mousedown', onMouseDown);
  params.mount.addEventListener('mousemove', onMouseMove);
  params.mount.addEventListener('mouseup', onMouseUp);
  params.mount.addEventListener('wheel', onWheel);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return () => {
    params.mount.removeEventListener('mousedown', onMouseDown);
    params.mount.removeEventListener('mousemove', onMouseMove);
    params.mount.removeEventListener('mouseup', onMouseUp);
    params.mount.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    
    // Cleanup animation frame
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    keysPressed.clear();
  };
}


