import { useEffect, useMemo, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import type { Block } from '@/types/project';
import { globalPreviewQueue } from '@/lib/previewQueue';

type MiniPreviewProps = {
  blocks?: Block[];
  className?: string;
};

// Lightweight, static renderer for small previews
const MiniPreview = ({ blocks = [], className }: MiniPreviewProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const cameraRef = useRef<BABYLON.Camera | null>(null);
  const shadowGenRef = useRef<BABYLON.ShadowGenerator | null>(null);

  const safeBlocks = useMemo(() => {
    return Array.isArray(blocks) ? blocks : [];
  }, [blocks]);

  // Initialize Babylon.js scene (queued to limit concurrent WebGL contexts)
  useEffect(() => {
    if (!mountRef.current) return;

    // Limit Babylon.js logs: keep only warnings and errors (hide info banners)
    try {
      BABYLON.Logger.LogLevels = BABYLON.Logger.WarningLogLevel | BABYLON.Logger.ErrorLogLevel;
    } catch {}

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    mountRef.current.appendChild(canvas);
    let destroyed = false;

    globalPreviewQueue.enqueue(async () => {
      if (destroyed) return;
      const engine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: false,
        stencil: false,
        antialias: true,
        alpha: true,
        premultipliedAlpha: true
      });
      engineRef.current = engine;

      const scene = new BABYLON.Scene(engine);
      scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
      scene.autoClear = true;
      scene.ambientColor = new BABYLON.Color3(0.3, 0.3, 0.3);
      sceneRef.current = scene;

      const camera = new BABYLON.ArcRotateCamera(
        'camera',
        Math.PI / 4,
        Math.PI / 3,
        8,
        BABYLON.Vector3.Zero(),
        scene
      );
      camera.lowerRadiusLimit = 4;
      camera.upperRadiusLimit = 20;
      cameraRef.current = camera;

      const light1 = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), scene);
      light1.intensity = 0.7;
      const light2 = new BABYLON.DirectionalLight('light2', new BABYLON.Vector3(-1, -2, -1), scene);
      light2.intensity = 0.3;

      let frames = 0;
      engine.runRenderLoop(() => {
        scene.render();
        frames++;
        if (frames > 30) {
          try { engine.stopRenderLoop(); } catch {}
        }
      });

      const handleResize = () => {
        engine.resize();
      };
      window.addEventListener('resize', handleResize);

      const cleanup = () => {
        window.removeEventListener('resize', handleResize);
        try { engine.stopRenderLoop(); } catch {}
        try { scene.dispose(); } catch {}
        try { engine.dispose(); } catch {}
        if (canvas.parentElement) {
          try { canvas.parentElement.removeChild(canvas); } catch {}
        }
      };

      (engine as any).__miniPreviewCleanup__ = cleanup;
    });

    return () => {
      destroyed = true;
      const eng = engineRef.current as any;
      if (eng && eng.__miniPreviewCleanup__) {
        eng.__miniPreviewCleanup__();
      }
    };
  }, []);

  // Update blocks
  useEffect(() => {
    if (!sceneRef.current || !cameraRef.current) return;

    const scene = sceneRef.current;

    // Precompute bounds for ground sizing and camera
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    safeBlocks.forEach((block) => {
      const p = (block as any).position || { x: 0, y: 0, z: 0 };
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      minZ = Math.min(minZ, p.z);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      maxZ = Math.max(maxZ, p.z);
    });
    
    // Clear existing meshes
    const meshesToRemove = scene.meshes.filter(mesh => mesh.name.startsWith('block_'));
    meshesToRemove.forEach(mesh => mesh.dispose());
    const oldGround = scene.getMeshByName('ground');
    if (oldGround) oldGround.dispose();

    if (safeBlocks.length === 0) return;

    // Create ground sized to content
    const margin = 2;
    const width = Math.max(6, (maxX - minX) + margin * 2);
    const depth = Math.max(6, (maxZ - minZ) + margin * 2);
    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width, height: depth, subdivisions: 1 }, scene);
    ground.position = new BABYLON.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.12, 0.14, 0.16);
    groundMat.specularColor = new BABYLON.Color3(0, 0, 0);
    ground.material = groundMat;
    ground.receiveShadows = true;

    // Setup shadows once
    const dirLight = scene.getLightByName('light2') as BABYLON.DirectionalLight | null;
    if (dirLight && !shadowGenRef.current) {
      const sg = new BABYLON.ShadowGenerator(1024, dirLight);
      sg.useBlurExponentialShadowMap = true;
      sg.blurKernel = 8;
      shadowGenRef.current = sg;
    }

    // Calculate bounds for camera positioning
    // (already computed)

    // Create block meshes
    safeBlocks.forEach((block, index) => {
      const pos = block.position || { x: 0, y: 0, z: 0 };

      let mesh: BABYLON.Mesh;

      // Create geometry based on block type
      const type = (block as any).type || 'cube';
      const scale = (block as any).scale || 1;

      switch (type) {
        case 'sphere':
          mesh = BABYLON.MeshBuilder.CreateSphere(`block_${index}`, { diameter: scale }, scene);
          break;
        case 'cylinder':
          mesh = BABYLON.MeshBuilder.CreateCylinder(`block_${index}`, { 
            diameter: scale, 
            height: scale 
          }, scene);
          break;
        case 'cone':
          mesh = BABYLON.MeshBuilder.CreateCylinder(`block_${index}`, { 
            diameterTop: 0, 
            diameterBottom: scale, 
            height: scale 
          }, scene);
          break;
        case 'plate':
          mesh = BABYLON.MeshBuilder.CreateBox(`block_${index}`, { 
            width: scale, 
            height: scale * 0.2, 
            depth: scale 
          }, scene);
          break;
        case 'torus':
          mesh = BABYLON.MeshBuilder.CreateTorus(`block_${index}`, { 
            diameter: scale * 1.2, 
            thickness: scale * 0.4 
          }, scene);
          break;
        default: // cube and variants
          mesh = BABYLON.MeshBuilder.CreateBox(`block_${index}`, { size: scale }, scene);
      }

      // Position
      mesh.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);

      // Rotation
      if ((block as any).rotationY !== undefined || 
          (block as any).rotationX !== undefined || 
          (block as any).rotationZ !== undefined) {
        mesh.rotation = new BABYLON.Vector3(
          ((block as any).rotationX || 0) * Math.PI / 180,
          ((block as any).rotationY || 0) * Math.PI / 180,
          ((block as any).rotationZ || 0) * Math.PI / 180
        );
      }

      // Material
      const material = new BABYLON.StandardMaterial(`mat_${index}`, scene);
      
      // Set color based on block type
      const getMaterialColor = () => {
        if (type === 'cube_boost') return new BABYLON.Color3(0.66, 0.33, 0.97); // #a855f7
        if (type === 'cube_slow') return new BABYLON.Color3(0.92, 0.70, 0.03); // #eab308
        if (type === 'cube_sticky') return new BABYLON.Color3(0.52, 0.80, 0.09); // #84cc16
        if (type === 'cube_bouncy') return new BABYLON.Color3(0.13, 0.77, 0.37); // #22c55e
        if (type === 'start') return new BABYLON.Color3(0, 1, 0.53); // #00ff88
        if (type === 'checkpoint') return new BABYLON.Color3(1, 0.8, 0); // #ffcc00
        if (type === 'finish') return new BABYLON.Color3(0, 0.8, 1); // #00ccff
        if (type === 'hazard') return new BABYLON.Color3(1, 0.2, 0.27); // #ff3344
        
        // Default color or from block
        const colorFromBlock = (block as any).color as string | number | undefined;
        if (colorFromBlock !== undefined) {
          const hex = typeof colorFromBlock === 'string' 
            ? parseInt(colorFromBlock.replace('#', ''), 16) 
            : colorFromBlock;
          return BABYLON.Color3.FromHexString('#' + hex.toString(16).padStart(6, '0'));
        }
        
        return new BABYLON.Color3(0.5, 0.5, 0.5);
      };

      material.diffuseColor = getMaterialColor();
      material.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
      
      // Special materials
      if (type === 'cube_ice' || type === 'window') {
        material.alpha = type === 'cube_ice' ? 0.95 : 0.5;
      }

      mesh.material = material;

      if (shadowGenRef.current) {
        shadowGenRef.current.addShadowCaster(mesh);
      }
    });

    // Center camera on blocks
    if (safeBlocks.length > 0) {
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;
      const center = new BABYLON.Vector3(centerX, centerY, centerZ);
      
      const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
      const distance = Math.max(8, size * 2);

      if (cameraRef.current instanceof BABYLON.ArcRotateCamera) {
        cameraRef.current.setTarget(center);
        cameraRef.current.radius = distance;
      }
    }
  }, [safeBlocks]);

  return (
    <div 
      ref={mountRef} 
      className={className}
      style={{ 
        width: '100%', 
        height: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
    />
  );
};

export default MiniPreview;
