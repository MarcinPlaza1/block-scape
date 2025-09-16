import * as BABYLON from '@babylonjs/core';
import type { Block } from '../../../../types';
import TextureCache from '../../blocks/textureCache';
import { ThinInstanceManager } from '../../blocks/ThinInstanceManager';

export interface SceneCoreConfig {
  canvas: HTMLCanvasElement;
  antialias?: boolean;
  preserveDrawingBuffer?: boolean;
  stencil?: boolean;
  powerPreference?: 'high-performance' | 'low-power' | 'default';
}

export class SceneCore {
  public engine: BABYLON.Engine;
  public scene: BABYLON.Scene;
  private renderPipeline: BABYLON.DefaultRenderingPipeline | null = null;
  
  constructor(config: SceneCoreConfig) {
    // Create Babylon engine
    this.engine = new BABYLON.Engine(
      config.canvas,
      config.antialias ?? true,
      {
        preserveDrawingBuffer: config.preserveDrawingBuffer ?? false,
        stencil: config.stencil ?? true,
        powerPreference: config.powerPreference ?? 'high-performance',
        audioEngine: false,
      }
    );
    
    // Create scene
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.autoClear = true;
    this.scene.autoClearDepthAndStencil = true;
    
    // Setup basic scene properties
    this.setupScene();

    // Wire global systems used across Edit/Play pipelines
    try {
      // Thin instances manager works on a single scene reference
      const tim = ThinInstanceManager.getInstance();
      tim.setScene(this.scene);
    } catch {}

    try {
      // Initialize shared texture cache with scene
      const cache = TextureCache.getInstance();
      cache.setScene(this.scene);
    } catch {}
  }
  
  private setupScene(): void {
    // Set ambient light
    this.scene.ambientColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    
    // Create hemispheric light
    const light = new BABYLON.HemisphericLight(
      'light',
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    light.intensity = 0.7;
    
    // Create directional light for shadows
    const dirLight = new BABYLON.DirectionalLight(
      'dirLight',
      new BABYLON.Vector3(-1, -2, -1),
      this.scene
    );
    dirLight.position = new BABYLON.Vector3(20, 40, 20);
    dirLight.intensity = 0.5;
    
    // Setup fog
    this.scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
    this.scene.fogColor = new BABYLON.Color3(0.9, 0.9, 0.95);
    this.scene.fogStart = 100;
    this.scene.fogEnd = 300;
    
    // Optimization settings
    this.scene.blockMaterialDirtyMechanism = true;
    
    // Initialize rendering pipeline
    this.initializeRenderingPipeline();
  }
  
  private initializeRenderingPipeline(): void {
    this.renderPipeline = new BABYLON.DefaultRenderingPipeline(
      'defaultPipeline',
      true,
      this.scene,
      this.scene.cameras
    );
    
    // Set quality to medium by default
    this.setRenderingQuality('medium');
  }
  
  public setRenderingQuality(quality: 'performance' | 'balanced' | 'quality' | 'low' | 'medium' | 'high'): void {
    if (!this.renderPipeline) return;
    
    // Backward compatibility mapping
    const q = (quality === 'low') ? 'performance'
      : (quality === 'medium') ? 'balanced'
      : (quality === 'high') ? 'quality'
      : quality;
    
    switch (q) {
      case 'performance':
        this.renderPipeline.samples = 1;
        this.renderPipeline.fxaaEnabled = false;
        this.renderPipeline.imageProcessingEnabled = false;
        this.renderPipeline.bloomEnabled = false;
        this.renderPipeline.chromaticAberrationEnabled = false;
        this.renderPipeline.grainEnabled = false;
        this.renderPipeline.sharpenEnabled = false;
        // Render at lower resolution for performance
        try { this.engine.setHardwareScalingLevel(1.5); } catch {}
        try { TextureCache.getInstance().setQuality({ sampling: BABYLON.Texture.BILINEAR_SAMPLINGMODE, anisotropy: 2 }); } catch {}
        break;
        
      case 'balanced':
        this.renderPipeline.samples = 2;
        this.renderPipeline.fxaaEnabled = true;
        this.renderPipeline.imageProcessingEnabled = true;
        this.renderPipeline.imageProcessing.toneMappingEnabled = true;
        this.renderPipeline.imageProcessing.exposure = 1.2;
        this.renderPipeline.imageProcessing.contrast = 1.1;
        this.renderPipeline.bloomEnabled = true;
        this.renderPipeline.bloomThreshold = 0.9 as any;
        this.renderPipeline.bloomWeight = 0.2;
        this.renderPipeline.bloomKernel = 32 as any;
        this.renderPipeline.chromaticAberrationEnabled = false;
        this.renderPipeline.grainEnabled = false;
        this.renderPipeline.sharpenEnabled = true;
        this.renderPipeline.sharpen.edgeAmount = 0.35;
        this.renderPipeline.sharpen.colorAmount = 0.5;
        try { this.engine.setHardwareScalingLevel(1.0); } catch {}
        try { TextureCache.getInstance().setQuality({ sampling: BABYLON.Texture.TRILINEAR_SAMPLINGMODE, anisotropy: 8 }); } catch {}
        break;
        
      case 'quality':
        this.renderPipeline.samples = 8 as any;
        this.renderPipeline.fxaaEnabled = true;
        this.renderPipeline.imageProcessingEnabled = true;
        this.renderPipeline.imageProcessing.toneMappingEnabled = true;
        try { (this.renderPipeline.imageProcessing as any).toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES; } catch {}
        this.renderPipeline.imageProcessing.exposure = 1.2;
        this.renderPipeline.imageProcessing.contrast = 1.15;
        this.renderPipeline.bloomEnabled = true;
        this.renderPipeline.bloomThreshold = 0.85 as any;
        this.renderPipeline.bloomWeight = 0.2;
        this.renderPipeline.bloomKernel = 64 as any;
        try { (this.renderPipeline as any).bloomScale = 0.5; } catch {}
        this.renderPipeline.chromaticAberrationEnabled = false;
        this.renderPipeline.grainEnabled = false;
        this.renderPipeline.depthOfFieldEnabled = false;
        this.renderPipeline.sharpenEnabled = true;
        this.renderPipeline.sharpen.edgeAmount = 0.35;
        this.renderPipeline.sharpen.colorAmount = 0.5;
        // Slight supersampling for visual quality
        try { this.engine.setHardwareScalingLevel(0.65); } catch {}
        try { TextureCache.getInstance().setQuality({ sampling: BABYLON.Texture.TRILINEAR_SAMPLINGMODE, anisotropy: 16 }); } catch {}
        break;
    }
  }
  
  public resize(): void {
    this.engine.resize();
  }
  
  public dispose(): void {
    this.renderPipeline?.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
  
  public setFogDistance(start: number, end: number): void {
    this.scene.fogStart = start;
    this.scene.fogEnd = end;
  }
  
  public enableShadows(shadowGenerator: BABYLON.ShadowGenerator | null): void {
    if (shadowGenerator) {
      shadowGenerator.useBlurExponentialShadowMap = true;
      shadowGenerator.blurScale = 2;
      shadowGenerator.setDarkness(0.3);
    }
  }
}
