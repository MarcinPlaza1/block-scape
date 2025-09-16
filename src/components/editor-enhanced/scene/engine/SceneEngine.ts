import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Helpers/sceneHelpers';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import '@babylonjs/core/Rendering/edgesRenderer';
import TextureCache from '../blocks/textureCache';

export type CameraMode = 'orbit' | 'play' | 'ortho';
export type QualityMode = 'performance' | 'balanced' | 'quality';

export function createSceneEngine(params: {
  mount: HTMLDivElement;
  cameraMode: CameraMode;
  qualityMode?: QualityMode;
  autoStartRenderLoop?: boolean; // if false, the caller controls the render loop
}) {
  // Create canvas element
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  params.mount.appendChild(canvas);

  // Create engine
  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
    adaptToDeviceRatio: params.qualityMode === 'quality' // Only use device pixel ratio in quality mode
  });
  
  // Set hardware scaling level based on quality mode
  if (params.qualityMode === 'performance') {
    engine.setHardwareScalingLevel(1.5); // Render at lower resolution
  } else if (params.qualityMode === 'balanced') {
    engine.setHardwareScalingLevel(1.0); // Render at native resolution
  } else {
    engine.setHardwareScalingLevel(0.8); // Moderate supersampling for higher quality without steep cost
  }

  // Create scene
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.529, 0.808, 0.922, 1); // Sky blue (0x87CEEB)

  // Initialize shared texture cache with scene and quality-based sampling
  try {
    const cache = TextureCache.getInstance();
    cache.setScene(scene);
    const q = params.qualityMode || 'balanced';
    const sampling = q === 'performance' ? BABYLON.Texture.BILINEAR_SAMPLINGMODE : BABYLON.Texture.TRILINEAR_SAMPLINGMODE;
    const anisotropy = q === 'quality' ? 16 : (q === 'balanced' ? 8 : 2);
    cache.setQuality({ sampling, anisotropy });
    
    // Store quality mode on scene for other systems to access
    (scene as any).__qualityMode = q;
  } catch {}

  // Create camera based on mode
  let camera: BABYLON.Camera;
  const width = params.mount.clientWidth;
  const height = params.mount.clientHeight;

  if (params.cameraMode === 'ortho') {
    const frustumSize = 30;
    const aspect = width / height;
    camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(10, 10, 10), scene);
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    camera.orthoLeft = (-frustumSize * aspect) / 2;
    camera.orthoRight = (frustumSize * aspect) / 2;
    camera.orthoTop = frustumSize / 2;
    camera.orthoBottom = -frustumSize / 2;
    camera.minZ = -1000;
    camera.maxZ = 1000;
    (camera as BABYLON.TargetCamera).setTarget(BABYLON.Vector3.Zero());
  } else {
    if (params.cameraMode === 'orbit') {
      // ArcRotateCamera for orbit mode
      camera = new BABYLON.ArcRotateCamera(
        'camera',
        Math.PI / 4,
        Math.PI / 3,
        15,
        BABYLON.Vector3.Zero(),
        scene
      );
      (camera as BABYLON.ArcRotateCamera).minZ = 0.1;
      (camera as BABYLON.ArcRotateCamera).maxZ = 1000;
    } else {
      // UniversalCamera for play mode
      camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(10, 10, 10), scene);
      (camera as BABYLON.TargetCamera).setTarget(BABYLON.Vector3.Zero());
      camera.fov = 75 * Math.PI / 180; // Convert degrees to radians
      camera.minZ = 0.1;
      camera.maxZ = 1000;
    }
  }

  // Attach camera to canvas
  camera.attachControl(canvas, true);

  // Create lights
  const ambientLight = new BABYLON.HemisphericLight('ambientLight', new BABYLON.Vector3(0, 1, 0), scene);
  ambientLight.intensity = 0.6;
  ambientLight.diffuse = new BABYLON.Color3(0.251, 0.251, 0.251); // 0x404040

  const directionalLight = new BABYLON.DirectionalLight('directionalLight', new BABYLON.Vector3(-1, -1, -0.5), scene);
  directionalLight.position = new BABYLON.Vector3(10, 10, 5);
  directionalLight.intensity = 1;

  // Enable shadows (quality-based)
  const qualityMode = params.qualityMode || 'balanced';
  const mapSize = qualityMode === 'quality' ? 4096 : (qualityMode === 'balanced' ? 2048 : 1024);
  let shadowGenerator: BABYLON.ShadowGenerator;
  try {
    if (qualityMode === 'quality') {
      // Cascaded shadows for large scenes and stable contact-hardening
      shadowGenerator = new (BABYLON as any).CascadedShadowGenerator(mapSize, directionalLight);
      try { (shadowGenerator as any).numCascades = 4; } catch {}
      try { (shadowGenerator as any).stabilizeCascades = true; } catch {}
      try { (shadowGenerator as any).autoCalcDepthBounds = true; } catch {}
      try { (shadowGenerator as any).frustumEdgeFalloff = 0.2; } catch {}
      try { (shadowGenerator as any).lambda = 0.92; } catch {}
    } else {
      // Standard shadow map
      shadowGenerator = new BABYLON.ShadowGenerator(mapSize, directionalLight);
    }
  } catch {
    // Fallback to standard generator if CSM creation fails
    shadowGenerator = new BABYLON.ShadowGenerator(mapSize, directionalLight);
  }

  // Common shadow tuning
  try { shadowGenerator.bias = 0.0005; } catch {}
  try { (shadowGenerator as any).normalBias = 0.5; } catch {}
  try {
    if (qualityMode === 'performance') {
      shadowGenerator.useExponentialShadowMap = true as any;
      shadowGenerator.useBlurExponentialShadowMap = true;
      shadowGenerator.blurKernel = 2 as any;
    } else {
      shadowGenerator.usePercentageCloserFiltering = true;
      // Enable contact-hardening for higher quality if available
      if ((shadowGenerator as any).useContactHardeningShadow !== undefined) {
        (shadowGenerator as any).useContactHardeningShadow = qualityMode === 'quality';
      }
      if ((BABYLON.ShadowGenerator as any).QUALITY_HIGH !== undefined) {
        shadowGenerator.filteringQuality = qualityMode === 'quality'
          ? (BABYLON.ShadowGenerator as any).QUALITY_HIGH
          : (BABYLON.ShadowGenerator as any).QUALITY_MEDIUM;
      }
    }
  } catch {}

  // Allow transparent objects like glass/ice to cast soft shadows in quality mode
  try { (shadowGenerator as any).transparencyShadow = qualityMode === 'quality'; } catch {}
  // Reduce shadow refresh cost in High by updating every 2 frames
  try {
    if (qualityMode === 'quality') {
      const sm = (shadowGenerator as any).getShadowMap?.();
      if (sm) { sm.refreshRate = 2 as any; }
    }
  } catch {}

  // Expose shadow generator for block registration
  try { (scene as any).__shadowGenerator = shadowGenerator; } catch {}

  // Create HDR environment
  const hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
    "https://assets.babylonjs.com/environments/environmentSpecular.env",
    scene
  );
  scene.environmentTexture = hdrTexture;
  scene.createDefaultSkybox(hdrTexture, true, 1000, 0.3);
  
  // Configure environment intensity based on quality
  if (qualityMode === 'quality') {
    scene.environmentIntensity = 1.0;
  } else if (qualityMode === 'balanced') {
    scene.environmentIntensity = 0.7;
  } else {
    scene.environmentIntensity = 0.5;
  }

  // Create rendering pipeline based on quality mode
  let pipeline: BABYLON.DefaultRenderingPipeline | null = null;
  let adaptiveControllerIntervalId: number | null = null;
  
  if (qualityMode !== 'performance') {
    pipeline = new BABYLON.DefaultRenderingPipeline(
      'defaultPipeline',
      true, // HDR
      scene,
      [camera]
    );

    // Configure based on quality mode
    if (qualityMode === 'quality') {
      // High quality settings
      pipeline.samples = 4; // Lighter MSAA for better perf
      pipeline.fxaaEnabled = true;
      pipeline.bloomEnabled = true;
      pipeline.bloomThreshold = 0.85;
      pipeline.bloomWeight = 0.2;
      pipeline.bloomKernel = 48;
      pipeline.bloomScale = 0.5;
      
      // Image processing
      pipeline.imageProcessing.toneMappingEnabled = true;
      pipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
      pipeline.imageProcessing.exposure = 1.2;
      pipeline.imageProcessing.contrast = 1.15;
      
      // Depth of field (disabled by default)
      pipeline.depthOfFieldEnabled = false;
      pipeline.depthOfFieldBlurLevel = BABYLON.DepthOfFieldEffectBlurLevel.Medium;
      
      // Cleaner image: disable filmic artifacts by default
      pipeline.chromaticAberrationEnabled = false;
      
      pipeline.grainEnabled = false;
    } else {
      // Balanced quality
      pipeline.samples = 2;
      pipeline.fxaaEnabled = true;
      pipeline.bloomEnabled = true;
      pipeline.bloomThreshold = 0.9;
      pipeline.bloomWeight = 0.2;
      pipeline.bloomKernel = 32;
      
      pipeline.imageProcessing.toneMappingEnabled = true;
      pipeline.imageProcessing.exposure = 1.2;
      pipeline.imageProcessing.contrast = 1.1;
      
      pipeline.chromaticAberrationEnabled = false;
      pipeline.grainEnabled = false;
    }

    // Always enable sharpen for crisp blocks
    pipeline.sharpenEnabled = true;
    pipeline.sharpen.edgeAmount = 0.35;
    pipeline.sharpen.colorAmount = 0.5;
  }

  // Adaptive performance controller for High quality
  if (qualityMode === 'quality') {
    const minHardwareScale = 0.6; // Allow more supersampling when FPS is high
    const maxHardwareScale = 1.0; // Native resolution upper bound
    let currentHardwareScale = engine.getHardwareScalingLevel();
    const lowFpsThreshold = 55;
    const highFpsThreshold = 65;

    const tuneAntialiasAndBloom = (fps: number) => {
      if (!pipeline) return;
      if (fps < lowFpsThreshold) {
        if (pipeline.samples > 2) pipeline.samples = 2;
        pipeline.fxaaEnabled = true;
        // Reduce bloom cost
        pipeline.bloomEnabled = true;
        pipeline.bloomKernel = Math.max(24, Math.min(32, pipeline.bloomKernel));
        pipeline.bloomThreshold = Math.min(0.9, Math.max(0.8, pipeline.bloomThreshold));
      } else if (fps > highFpsThreshold) {
        // Restore higher quality gradually
        if (pipeline.samples < 4) pipeline.samples = 4;
        pipeline.fxaaEnabled = true;
        pipeline.bloomEnabled = true;
        pipeline.bloomKernel = Math.min(48, Math.max(32, pipeline.bloomKernel));
        pipeline.bloomThreshold = Math.min(0.9, Math.max(0.85, pipeline.bloomThreshold));
      }
    };

    const tuneResolution = (fps: number) => {
      if (fps < lowFpsThreshold) {
        currentHardwareScale = Math.min(maxHardwareScale, currentHardwareScale + 0.05);
      } else if (fps > highFpsThreshold) {
        currentHardwareScale = Math.max(minHardwareScale, currentHardwareScale - 0.05);
      }
      engine.setHardwareScalingLevel(currentHardwareScale);
    };

    adaptiveControllerIntervalId = window.setInterval(() => {
      const fps = engine.getFps();
      tuneResolution(fps);
      tuneAntialiasAndBloom(fps);
    }, 2000);
  }

  // Scene optimizer for automatic quality adjustment
  const optimizerOptions = new BABYLON.SceneOptimizerOptions(60, 2000);
  optimizerOptions.addOptimization(new BABYLON.HardwareScalingOptimization(0, 1));
  optimizerOptions.addOptimization(new BABYLON.ShadowsOptimization(0));
  optimizerOptions.addOptimization(new BABYLON.PostProcessesOptimization(1));
  optimizerOptions.addOptimization(new BABYLON.TextureOptimization(2, 1024));
  
  // Apply optimizer in balanced/performance modes
  if (qualityMode !== 'quality') {
    // Only optimize when FPS drops
    let optimizerApplied = false;
    scene.registerBeforeRender(() => {
      if (!optimizerApplied && engine.getFps() < 50) {
        BABYLON.SceneOptimizer.OptimizeAsync(scene, optimizerOptions);
        optimizerApplied = true;
      }
    });
  }

  // Handle window resize
  const handleResize = () => {
    engine.resize();
  };
  window.addEventListener('resize', handleResize);

  // Start render loop (can be disabled by caller)
  const renderLoopFn = () => {
    scene.render();
  };
  if (params.autoStartRenderLoop !== false) {
    engine.runRenderLoop(renderLoopFn);
  }

  const dispose = () => {
    try {
      // Stop render loop
      try {
        engine.stopRenderLoop(renderLoopFn);
      } catch {}

      // Remove resize listener
      window.removeEventListener('resize', handleResize);

      // Dispose pipeline
      if (pipeline) {
        pipeline.dispose();
      }

      // Dispose shadows
      if (shadowGenerator) {
        shadowGenerator.dispose();
      }

      // Dispose lights
      ambientLight.dispose();
      directionalLight.dispose();

      // Dispose camera
      camera.dispose();

      // Dispose environment texture
      if (scene.environmentTexture) {
        scene.environmentTexture.dispose();
      }

      // Dispose scene
      scene.dispose();

      // Dispose engine
      engine.dispose();

      // Remove canvas from DOM
      if (canvas && canvas.parentNode === params.mount) {
        params.mount.removeChild(canvas);
      }
    } catch (error) {
      console.warn('Error during SceneEngine dispose:', error);
    }
  };

  // Store engine and canvas references for external access
  const renderer = {
    domElement: canvas,
    setSize: (width: number, height: number) => {
      engine.setSize(width, height);
    },
    render: (scene: BABYLON.Scene) => {
      scene.render();
    },
    dispose: () => {
      engine.dispose();
    },
    shadowMap: {
      enabled: true,
      type: qualityMode === 'quality' ? 'PCSS' : (qualityMode === 'performance' ? 'ESM' : 'PCF') // Compatibility layer
    },
    getContext: () => engine.getRenderingCanvas()?.getContext('webgl2') || engine.getRenderingCanvas()?.getContext('webgl')
  };

  return { 
    scene, 
    camera, 
    renderer: renderer as any, // Type compatibility layer for Three.js interface
    engine, // Also expose Babylon engine
    shadowGenerator,
    pipeline,
    dispose 
  } as const;
}