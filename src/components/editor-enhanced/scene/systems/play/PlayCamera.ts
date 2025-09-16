import * as BABYLON from '@babylonjs/core';

export type PlayCameraMode = 'third-person' | 'first-person' | 'free';

export class PlayCamera {
  private camera: BABYLON.UniversalCamera;
  private scene: BABYLON.Scene;
  private mount: HTMLElement;
  private mode: PlayCameraMode = 'third-person';
  private followTarget: BABYLON.Mesh | null = null;
  private controlsActive = false;
  
  // Third-person camera settings
  private cameraOffset = new BABYLON.Vector3(0, 5, -10);
  private cameraLookOffset = new BABYLON.Vector3(0, 2, 0);
  private smoothing = 0.1;
  private currentOffset = new BABYLON.Vector3();
  
  // First-person settings
  private firstPersonOffset = new BABYLON.Vector3(0, 1.6, 0.2);
  
  // Mouse look
  private isPointerLocked = false;
  private yaw = 0;
  private pitch = 0;
  private mouseSensitivity = 0.002;
  
  // Camera shake
  private shakeAmount = 0;
  private shakeDecay = 0.95;
  
  constructor(scene: BABYLON.Scene, mount: HTMLElement) {
    this.scene = scene;
    this.mount = mount;
    
    // Create universal camera
    this.camera = new BABYLON.UniversalCamera(
      'playCamera',
      new BABYLON.Vector3(0, 5, -10),
      scene
    );
    
    this.camera.setTarget(BABYLON.Vector3.Zero());
    this.camera.attachControl(false);
    
    // Set as active camera
    scene.activeCamera = this.camera;
    
    // Initialize offset
    this.currentOffset.copyFrom(this.cameraOffset);
    
    // Controls are activated by PlayEngine.start() and deactivated on stop
  }
  
  private setupControls(): void {
    if (this.controlsActive) return;
    // Pointer lock for mouse look
    this.mount.addEventListener('click', this.requestPointerLock);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('mousemove', this.handleMouseMove);
    
    // Mode switching
    window.addEventListener('keydown', this.handleKeyDown);
    this.controlsActive = true;
  }

  public activate(): void {
    this.setupControls();
  }

  public deactivate(): void {
    if (!this.controlsActive) return;
    try {
      this.mount.removeEventListener('click', this.requestPointerLock);
      document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
      document.removeEventListener('mousemove', this.handleMouseMove);
      window.removeEventListener('keydown', this.handleKeyDown);
      if (document.pointerLockElement === this.mount) {
        document.exitPointerLock();
        this.isPointerLocked = false;
      }
    } catch {}
    this.controlsActive = false;
  }
  
  private requestPointerLock = (): void => {
    if (this.mode !== 'free') {
      this.mount.requestPointerLock();
    }
  };
  
  private handlePointerLockChange = (): void => {
    this.isPointerLocked = document.pointerLockElement === this.mount;
  };
  
  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.isPointerLocked) return;
    
    const deltaX = e.movementX;
    const deltaY = e.movementY;
    
    // Update yaw and pitch
    this.yaw -= deltaX * this.mouseSensitivity;
    this.pitch -= deltaY * this.mouseSensitivity;
    
    // Clamp pitch
    this.pitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.pitch));
  };
  
  private handleKeyDown = (e: KeyboardEvent): void => {
    // Camera mode switching
    if (e.code === 'KeyC') {
      this.cycleMode();
    }
  };
  
  public setFollowTarget(target: BABYLON.Mesh): void {
    this.followTarget = target;
  }
  
  public setMode(mode: PlayCameraMode): void {
    this.mode = mode;
    
    // Reset camera for mode change
    switch (mode) {
      case 'third-person':
        this.camera.detachControl();
        break;
        
      case 'first-person':
        this.camera.detachControl();
        break;
        
      case 'free':
        this.camera.attachControl(true);
        if (document.pointerLockElement === this.mount) {
          document.exitPointerLock();
        }
        break;
    }
  }
  
  public cycleMode(): void {
    const modes: PlayCameraMode[] = ['third-person', 'first-person', 'free'];
    const currentIndex = modes.indexOf(this.mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.setMode(modes[nextIndex]);
  }
  
  public update(deltaTime: number): void {
    if (!this.followTarget || this.mode === 'free') return;
    
    const targetPos = this.followTarget.position;
    
    switch (this.mode) {
      case 'third-person':
        this.updateThirdPerson(targetPos, deltaTime);
        break;
        
      case 'first-person':
        this.updateFirstPerson(targetPos, deltaTime);
        break;
    }
    
    // Apply camera shake
    if (this.shakeAmount > 0.01) {
      const shakeX = (Math.random() - 0.5) * this.shakeAmount;
      const shakeY = (Math.random() - 0.5) * this.shakeAmount;
      this.camera.position.x += shakeX;
      this.camera.position.y += shakeY;
      this.shakeAmount *= this.shakeDecay;
    }
  }
  
  private updateThirdPerson(targetPos: BABYLON.Vector3, deltaTime: number): void {
    // Calculate desired camera position based on yaw
    const desiredOffset = new BABYLON.Vector3(
      Math.sin(this.yaw) * this.cameraOffset.z,
      this.cameraOffset.y + Math.sin(this.pitch) * 5,
      Math.cos(this.yaw) * this.cameraOffset.z
    );
    
    // Smooth camera offset
    this.currentOffset = BABYLON.Vector3.Lerp(
      this.currentOffset,
      desiredOffset,
      this.smoothing
    );
    
    // Set camera position
    const cameraPos = targetPos.add(this.currentOffset);
    this.camera.position = BABYLON.Vector3.Lerp(
      this.camera.position,
      cameraPos,
      this.smoothing * 2
    );
    
    // Look at target with offset
    const lookTarget = targetPos.add(this.cameraLookOffset);
    this.camera.setTarget(lookTarget);
    
    // Collision detection for camera
    this.checkCameraCollision(targetPos);
  }
  
  private updateFirstPerson(targetPos: BABYLON.Vector3, deltaTime: number): void {
    // Position camera at player's head level
    const cameraPos = targetPos.add(this.firstPersonOffset);
    this.camera.position = cameraPos;
    
    // Apply mouse look
    const forward = new BABYLON.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    
    const lookTarget = cameraPos.add(forward.scale(10));
    this.camera.setTarget(lookTarget);
  }
  
  private checkCameraCollision(targetPos: BABYLON.Vector3): void {
    // Cast ray from target to camera
    const ray = new BABYLON.Ray(
      targetPos.add(this.cameraLookOffset),
      this.currentOffset.normalize(),
      this.currentOffset.length()
    );
    
    const hit = this.scene.pickWithRay(ray, (mesh) => {
      return mesh.isPickable && mesh !== this.followTarget;
    });
    
    if (hit && hit.hit && hit.distance > 0) {
      // Move camera closer to avoid collision
      const safeDistance = Math.max(1, hit.distance - 0.5);
      const safeOffset = this.currentOffset.normalize().scale(safeDistance);
      this.camera.position = targetPos.add(safeOffset);
    }
  }
  
  public shake(amount: number = 0.5): void {
    this.shakeAmount = Math.min(amount, 2);
  }
  
  public getCamera(): BABYLON.Camera {
    return this.camera;
  }
  
  public getPosition(): BABYLON.Vector3 {
    return this.camera.position.clone();
  }
  
  public getForwardVector(): BABYLON.Vector3 {
    return this.camera.getForwardRay().direction;
  }
  
  public getRightVector(): BABYLON.Vector3 {
    const forward = this.getForwardVector();
    const up = BABYLON.Vector3.Up();
    return BABYLON.Vector3.Cross(forward, up).normalize();
  }
  
  public getYaw(): number {
    return this.yaw;
  }
  
  public getPitch(): number {
    return this.pitch;
  }
  
  public setMouseSensitivity(sensitivity: number): void {
    this.mouseSensitivity = Math.max(0.0001, Math.min(0.01, sensitivity));
  }
  
  public setCameraOffset(offset: BABYLON.Vector3): void {
    this.cameraOffset = offset.clone();
  }
  
  public dispose(): void {
    // Remove event listeners and exit pointer lock
    this.deactivate();
    
    // Dispose camera
    this.camera.dispose();
  }
}
