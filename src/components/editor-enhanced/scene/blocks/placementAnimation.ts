import * as BABYLON from '@babylonjs/core';

export interface PlacementAnimation {
  mesh: BABYLON.Mesh;
  targetScale: BABYLON.Vector3;
  startTime: number;
  duration: number;
  popEffect?: boolean;
  glowEffect?: BABYLON.HighlightLayer;
}

export class PlacementAnimationManager {
  private static instance: PlacementAnimationManager;
  private scene: BABYLON.Scene | null = null;
  private animations = new Map<string, PlacementAnimation>();
  private glowLayer: BABYLON.HighlightLayer | null = null;
  
  static getInstance(): PlacementAnimationManager {
    if (!PlacementAnimationManager.instance) {
      PlacementAnimationManager.instance = new PlacementAnimationManager();
    }
    return PlacementAnimationManager.instance;
  }
  
  setScene(scene: BABYLON.Scene) {
    this.scene = scene;
    // Create glow layer for placement effects
    this.glowLayer = new BABYLON.HighlightLayer('placementGlow', scene);
    this.glowLayer.innerGlow = false;
    this.glowLayer.outerGlow = true;
    this.glowLayer.blurHorizontalSize = 1;
    this.glowLayer.blurVerticalSize = 1;
  }
  
  // Minecraft-style pop animation
  animatePlacement(mesh: BABYLON.Mesh, blockId: string, type: 'pop' | 'slide' | 'fade' = 'pop') {
    if (!this.scene || !mesh) return;
    
    const targetScale = mesh.scaling.clone();
    
    switch (type) {
      case 'pop':
        // Start small and pop to normal size with bounce
        mesh.scaling.setAll(0);
        
        // Create scaling animation
        const scaleAnimation = BABYLON.Animation.CreateAndStartAnimation(
          'placementScale',
          mesh,
          'scaling',
          60,
          15, // 0.25 seconds
          mesh.scaling,
          targetScale.scale(1.15), // Overshoot
          BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
          new BABYLON.ElasticEase(),
          () => {
            // Settle to final size
            BABYLON.Animation.CreateAndStartAnimation(
              'placementSettle',
              mesh,
              'scaling',
              60,
              10,
              mesh.scaling,
              targetScale,
              BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
              new BABYLON.BackEase(0.3)
            );
          }
        );
        
        // Add temporary glow effect
        if (this.glowLayer) {
          this.glowLayer.addMesh(mesh, new BABYLON.Color3(0.5, 1, 0.5));
          setTimeout(() => {
            this.glowLayer?.removeMesh(mesh);
          }, 500);
        }
        
        // Particle burst effect
        this.createPlacementParticles(mesh.position);
        
        // Sound effect trigger
        this.playPlacementSound('pop');
        break;
        
      case 'slide':
        // Slide up from below
        const startY = mesh.position.y;
        mesh.position.y = startY - 1;
        
        BABYLON.Animation.CreateAndStartAnimation(
          'placementSlide',
          mesh,
          'position.y',
          60,
          20,
          mesh.position.y,
          startY,
          BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
          new BABYLON.BounceEase(3, 2)
        );
        
        this.playPlacementSound('slide');
        break;
        
      case 'fade':
        // Fade in with scale
        const material = mesh.material as BABYLON.PBRMaterial;
        if (material) {
          const originalAlpha = material.alpha;
          material.alpha = 0;
          mesh.scaling.setAll(0.8);
          
          // Fade animation
          BABYLON.Animation.CreateAndStartAnimation(
            'placementFade',
            material,
            'alpha',
            60,
            30,
            0,
            originalAlpha,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
            new BABYLON.QuadraticEase()
          );
          
          // Scale animation
          BABYLON.Animation.CreateAndStartAnimation(
            'placementFadeScale',
            mesh,
            'scaling',
            60,
            30,
            mesh.scaling,
            targetScale,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
            new BABYLON.QuadraticEase()
          );
        }
        
        this.playPlacementSound('fade');
        break;
    }
    
    this.animations.set(blockId, {
      mesh,
      targetScale,
      startTime: Date.now(),
      duration: 500,
      popEffect: type === 'pop',
      glowEffect: this.glowLayer || undefined
    });
  }
  
  // Sims-style placement particles
  private createPlacementParticles(position: BABYLON.Vector3) {
    if (!this.scene) return;
    
    const particleSystem = new BABYLON.ParticleSystem('placementParticles', 30, this.scene);
    
    // Create a simple emitter mesh
    const emitter = BABYLON.MeshBuilder.CreateBox('emitter', { size: 0.1 }, this.scene);
    emitter.position = position;
    emitter.isVisible = false;
    
    particleSystem.emitter = emitter;
    particleSystem.particleTexture = new BABYLON.Texture('https://playground.babylonjs.com/textures/flare.png', this.scene);
    
    // Particle settings
    particleSystem.color1 = new BABYLON.Color4(0.5, 1, 0.5, 1);
    particleSystem.color2 = new BABYLON.Color4(0.2, 0.8, 0.2, 0);
    particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);
    
    particleSystem.minSize = 0.05;
    particleSystem.maxSize = 0.15;
    
    particleSystem.minLifeTime = 0.3;
    particleSystem.maxLifeTime = 0.8;
    
    particleSystem.emitRate = 100;
    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
    
    particleSystem.gravity = new BABYLON.Vector3(0, -2, 0);
    
    particleSystem.direction1 = new BABYLON.Vector3(-1, 2, -1);
    particleSystem.direction2 = new BABYLON.Vector3(1, 3, 1);
    
    particleSystem.minEmitPower = 1;
    particleSystem.maxEmitPower = 3;
    
    // Start and auto-dispose
    particleSystem.start();
    
    setTimeout(() => {
      particleSystem.stop();
      setTimeout(() => {
        particleSystem.dispose();
        emitter.dispose();
      }, 1000);
    }, 100);
  }
  
  // Sound feedback
  private playPlacementSound(type: 'pop' | 'slide' | 'fade') {
    // This would trigger actual sound in production
    // For now, just log the intent
    console.log(`[Sound] Block placement: ${type}`);
  }
  
  // Update ongoing animations
  update() {
    const now = Date.now();
    const completed: string[] = [];
    
    for (const [id, animation] of this.animations) {
      const elapsed = now - animation.startTime;
      
      if (elapsed >= animation.duration) {
        completed.push(id);
      }
    }
    
    // Clean up completed animations
    for (const id of completed) {
      this.animations.delete(id);
    }
  }
  
  dispose() {
    this.glowLayer?.dispose();
    this.animations.clear();
  }
}
