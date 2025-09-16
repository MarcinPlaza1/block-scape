import * as BABYLON from '@babylonjs/core';

export type EditCameraMode = 'orbit' | 'free' | 'ortho';

export class EditCamera {
  private camera: BABYLON.UniversalCamera;
  private scene: BABYLON.Scene;
  private mount: HTMLElement;
  private mode: EditCameraMode = 'free';
  
  // Orbit mode state
  private orbitTarget = new BABYLON.Vector3(0, 0, 0);
  private orbitRadius = 50;
  private orbitAlpha = Math.PI / 4; // Horizontal angle
  private orbitBeta = Math.PI / 3;  // Vertical angle
  private isOrbiting = false;
  private lastPointer = { x: 0, y: 0 };
  
  // Free camera movement
  private keysPressed = new Set<string>();
  private moveSpeed = 0.5;
  private fastMoveSpeed = 2.0;
  
  // Camera limits
  private minRadius = 5;
  private maxRadius = 200;
  private minBeta = 0.1;
  private maxBeta = Math.PI - 0.1;
  
  constructor(scene: BABYLON.Scene, mount: HTMLElement) {
    this.scene = scene;
    this.mount = mount;
    
    // Create universal camera
    this.camera = new BABYLON.UniversalCamera(
      'editCamera',
      new BABYLON.Vector3(20, 20, -20),
      scene
    );
    
    this.camera.attachControl(false);
    this.camera.speed = this.moveSpeed;
    // Disable built-in keyboard movement to avoid conflicts with custom controls
    try {
      (this.camera as any).keysUp = [];
      (this.camera as any).keysDown = [];
      (this.camera as any).keysLeft = [];
      (this.camera as any).keysRight = [];
    } catch {}
    
    // Set as active camera
    scene.activeCamera = this.camera;
    
    // Setup controls
    this.setupControls();
    
    // Initialize camera position
    this.updateCameraFromOrbit();
    // Start in free mode for WSAD navigation
    this.setMode('free');
  }
  
  private setupControls(): void {
    // Mouse controls
    this.mount.addEventListener('pointerdown', this.handlePointerDown);
    this.mount.addEventListener('pointermove', this.handlePointerMove);
    this.mount.addEventListener('pointerup', this.handlePointerUp);
    this.mount.addEventListener('wheel', this.handleWheel);
    
    // Keyboard controls
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    
    // Prevent context menu on right click
    this.mount.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  
  private handlePointerDown = (e: PointerEvent): void => {
    // Right mouse button or middle mouse button for orbiting
    if (e.button === 2 || e.button === 1) {
      this.isOrbiting = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  };
  
  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.isOrbiting) return;
    
    const deltaX = e.clientX - this.lastPointer.x;
    const deltaY = e.clientY - this.lastPointer.y;
    
    // Update orbit angles
    this.orbitAlpha -= deltaX * 0.01;
    this.orbitBeta += deltaY * 0.01;
    
    // Clamp beta
    this.orbitBeta = Math.max(this.minBeta, Math.min(this.maxBeta, this.orbitBeta));
    
    this.lastPointer = { x: e.clientX, y: e.clientY };
    
    if (this.mode === 'orbit') {
      this.updateCameraFromOrbit();
    }
  };
  
  private handlePointerUp = (e: PointerEvent): void => {
    if (e.button === 2 || e.button === 1) {
      this.isOrbiting = false;
    }
  };
  
  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const isScrollOut = e.deltaY > 0;
    if (this.mode === 'orbit') {
      const delta = isScrollOut ? 1.1 : 0.9;
      this.orbitRadius *= delta;
      this.orbitRadius = Math.max(this.minRadius, Math.min(this.maxRadius, this.orbitRadius));
      this.updateCameraFromOrbit();
    } else {
      // Zoom by moving along camera forward vector in free/other modes
      const camera = this.camera;
      const forward = camera.getDirection(BABYLON.Vector3.Forward());
      const stepBase = this.keysPressed.has('ShiftLeft') ? this.fastMoveSpeed : this.moveSpeed;
      const step = stepBase * 5;
      const direction = isScrollOut ? -1 : 1; // out = away, in = closer
      camera.position.addInPlace(forward.scale(step * direction));
    }
  };
  
  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keysPressed.add(e.code);
    // Prevent browser scrolling on WASD and E
    if (['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft'].includes(e.code)) {
      e.preventDefault();
    }
    
    // Mode switching
    if (e.code === 'KeyV') {
      this.cycleMode();
    }
    
    // Focus on selected object
    if (e.code === 'KeyF') {
      this.focusOnSelection();
    }
  };
  
  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysPressed.delete(e.code);
  };
  
  private updateCameraFromOrbit(): void {
    const x = this.orbitRadius * Math.sin(this.orbitBeta) * Math.cos(this.orbitAlpha);
    const y = this.orbitRadius * Math.cos(this.orbitBeta);
    const z = this.orbitRadius * Math.sin(this.orbitBeta) * Math.sin(this.orbitAlpha);
    
    this.camera.position.x = this.orbitTarget.x + x;
    this.camera.position.y = this.orbitTarget.y + y;
    this.camera.position.z = this.orbitTarget.z + z;
    
    this.camera.setTarget(this.orbitTarget);
  }
  
  public update(): void {
    // Update free camera movement
    if (this.mode === 'free' && !this.isOrbiting) {
      this.updateFreeCameraMovement();
    }
  }
  
  private updateFreeCameraMovement(): void {
    const camera = this.camera;
    const speed = this.moveSpeed;
    
    // Get camera direction vectors
    const forward = camera.getDirection(BABYLON.Vector3.Forward());
    const right = camera.getDirection(BABYLON.Vector3.Right());
    // Constrain movement to horizontal plane for WSAD; vertical handled by E/Shift
    forward.y = 0; right.y = 0;
    if (forward.lengthSquared() > 0) forward.normalize();
    if (right.lengthSquared() > 0) right.normalize();
    
    // Calculate movement
    let moveVector = BABYLON.Vector3.Zero();
    
    if (this.keysPressed.has('KeyW')) {
      moveVector.addInPlace(forward.scale(speed));
    }
    if (this.keysPressed.has('KeyS')) {
      moveVector.subtractInPlace(forward.scale(speed));
    }
    if (this.keysPressed.has('KeyA')) {
      moveVector.subtractInPlace(right.scale(speed));
    }
    if (this.keysPressed.has('KeyD')) {
      moveVector.addInPlace(right.scale(speed));
    }
    // Left Shift moves down
    if (this.keysPressed.has('ShiftLeft')) {
      moveVector.y -= speed;
    }
    if (this.keysPressed.has('Space')) {
      moveVector.y += speed;
    }
    
    // Apply movement
    camera.position.addInPlace(moveVector);
  }
  
  public setMode(mode: EditCameraMode): void {
    this.mode = mode;
    
    switch (mode) {
      case 'orbit':
        this.camera.detachControl();
        this.updateCameraFromOrbit();
        break;
        
      case 'free':
        this.camera.attachControl(true);
        break;
        
      case 'ortho':
        // TODO: Implement orthographic projection
        this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        const aspect = this.scene.getEngine().getAspectRatio(this.camera);
        const orthoSize = 20;
        this.camera.orthoLeft = -orthoSize * aspect;
        this.camera.orthoRight = orthoSize * aspect;
        this.camera.orthoBottom = -orthoSize;
        this.camera.orthoTop = orthoSize;
        break;
    }
  }
  
  public cycleMode(): void {
    const modes: EditCameraMode[] = ['orbit', 'free', 'ortho'];
    const currentIndex = modes.indexOf(this.mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.setMode(modes[nextIndex]);
  }
  
  public focusOnSelection(target?: BABYLON.Vector3): void {
    if (target) {
      this.orbitTarget = target.clone();
    }
    
    // Animate to target
    const animation = BABYLON.Animation.CreateAndStartAnimation(
      'focusAnimation',
      this.camera,
      'position',
      30,
      15,
      this.camera.position,
      this.calculateFocusPosition(),
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
  }
  
  private calculateFocusPosition(): BABYLON.Vector3 {
    const x = this.orbitRadius * Math.sin(this.orbitBeta) * Math.cos(this.orbitAlpha);
    const y = this.orbitRadius * Math.cos(this.orbitBeta);
    const z = this.orbitRadius * Math.sin(this.orbitBeta) * Math.sin(this.orbitAlpha);
    
    return new BABYLON.Vector3(
      this.orbitTarget.x + x,
      this.orbitTarget.y + y,
      this.orbitTarget.z + z
    );
  }
  
  public setOrbitTarget(target: BABYLON.Vector3): void {
    this.orbitTarget = target.clone();
    if (this.mode === 'orbit') {
      this.updateCameraFromOrbit();
    }
  }
  
  public getCamera(): BABYLON.Camera {
    return this.camera;
  }
  
  public getPosition(): BABYLON.Vector3 {
    return this.camera.position.clone();
  }
  
  public getTarget(): BABYLON.Vector3 {
    return this.orbitTarget.clone();
  }
  
  public setPosition(position: BABYLON.Vector3): void {
    this.camera.position = position.clone();
  }
  
  public dispose(): void {
    // Remove event listeners
    this.mount.removeEventListener('pointerdown', this.handlePointerDown);
    this.mount.removeEventListener('pointermove', this.handlePointerMove);
    this.mount.removeEventListener('pointerup', this.handlePointerUp);
    this.mount.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    
    // Dispose camera
    this.camera.dispose();
  }
}
