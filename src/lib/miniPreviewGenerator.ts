import * as BABYLON from '@babylonjs/core';

type GenerateOptions = {
  width?: number;
  height?: number;
  jpegQuality?: number; // 0..1
  usePipeline?: boolean; // enable FXAA/MSAA
  msaaSamples?: number; // default 2
  hardwareScale?: number; // e.g., 2 for 0.5 DPR
};

type BlockLike = {
  type?: string;
  position?: { x: number; y: number; z: number };
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  scale?: number;
  color?: string | number;
};

export async function generateMiniPreviewDataUrl(
  blocks: BlockLike[],
  options: GenerateOptions = {}
): Promise<string> {
  const width = options.width ?? 640;
  const height = options.height ?? 360;
  const quality = options.jpegQuality ?? 0.6;
  const hardwareScale = options.hardwareScale ?? 2; // ~0.5 DPR
  const usePipeline = !!options.usePipeline;
  const msaaSamples = options.msaaSamples ?? 2;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: false,
    antialias: true,
    alpha: true,
    premultipliedAlpha: true,
  });
  try {
    // Lower internal resolution for speed
    try { engine.setHardwareScalingLevel(hardwareScale); } catch {}

    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
    scene.ambientColor = new BABYLON.Color3(0.3, 0.3, 0.3);

    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      Math.PI / 4,
      Math.PI / 3,
      8,
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.lowerRadiusLimit = 4;
    camera.upperRadiusLimit = 30;

    // Simple lighting
    new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.8;
    const dir = new BABYLON.DirectionalLight('light2', new BABYLON.Vector3(-1, -2, -1), scene);
    dir.intensity = 0.4;

    const list = Array.isArray(blocks) ? blocks : [];
    if (list.length > 0) {
      // Compute bounds
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (const b of list) {
        const p = b.position || { x: 0, y: 0, z: 0 };
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      }

      // Ground sized to content
      const margin = 2;
      const groundW = Math.max(6, (maxX - minX) + margin * 2);
      const groundD = Math.max(6, (maxZ - minZ) + margin * 2);
      const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: groundW, height: groundD }, scene);
      ground.position = new BABYLON.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
      const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
      groundMat.diffuseColor = new BABYLON.Color3(0.12, 0.14, 0.16);
      groundMat.specularColor = new BABYLON.Color3(0, 0, 0);
      ground.material = groundMat;
      ground.receiveShadows = false;

      // Group blocks by (type, scale) and create thin instances
      const groups = new Map<string, { type: string; scale: number; items: BlockLike[] }>();
      for (const b of list) {
        const t = b.type || 'cube';
        const s = typeof b.scale === 'number' ? b.scale : 1;
        const key = `${t}|${s}`;
        const g = groups.get(key) || { type: t, scale: s, items: [] };
        g.items.push(b);
        groups.set(key, g);
      }

      const toColor3 = (b: BlockLike) => {
        const type = b.type || 'cube';
        if (type === 'cube_boost') return new BABYLON.Color3(0.66, 0.33, 0.97);
        if (type === 'cube_slow') return new BABYLON.Color3(0.92, 0.70, 0.03);
        if (type === 'cube_sticky') return new BABYLON.Color3(0.52, 0.80, 0.09);
        if (type === 'cube_bouncy') return new BABYLON.Color3(0.13, 0.77, 0.37);
        if (type === 'start') return new BABYLON.Color3(0, 1, 0.53);
        if (type === 'checkpoint') return new BABYLON.Color3(1, 0.8, 0);
        if (type === 'finish') return new BABYLON.Color3(0, 0.8, 1);
        if (type === 'hazard') return new BABYLON.Color3(1, 0.2, 0.27);
        if (b.color !== undefined) {
          const hex = typeof b.color === 'string' ? parseInt(b.color.replace('#', ''), 16) : b.color;
          return BABYLON.Color3.FromHexString('#' + (hex as number).toString(16).padStart(6, '0'));
        }
        return new BABYLON.Color3(0.5, 0.5, 0.5);
      };

      for (const { type, scale, items } of groups.values()) {
        let base: BABYLON.Mesh;
        switch (type) {
          case 'sphere':
            base = BABYLON.MeshBuilder.CreateSphere('base_sphere', { diameter: scale }, scene) as BABYLON.Mesh;
            break;
          case 'cylinder':
            base = BABYLON.MeshBuilder.CreateCylinder('base_cylinder', { diameter: scale, height: scale }, scene) as BABYLON.Mesh;
            break;
          case 'cone':
            base = BABYLON.MeshBuilder.CreateCylinder('base_cone', { diameterTop: 0, diameterBottom: scale, height: scale }, scene) as BABYLON.Mesh;
            break;
          case 'plate':
            base = BABYLON.MeshBuilder.CreateBox('base_plate', { width: scale, height: scale * 0.2, depth: scale }, scene) as BABYLON.Mesh;
            break;
          case 'torus':
            base = BABYLON.MeshBuilder.CreateTorus('base_torus', { diameter: scale * 1.2, thickness: scale * 0.4 }, scene) as BABYLON.Mesh;
            break;
          default:
            base = BABYLON.MeshBuilder.CreateBox('base_cube', { size: scale }, scene) as BABYLON.Mesh;
        }
        const mat = new BABYLON.StandardMaterial(`mat_${type}_${scale}`, scene);
        mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        mat.diffuseColor = toColor3(items[0]);
        base.material = mat;

        // Matrices buffer for thin instances
        const matrices = new Float32Array(items.length * 16);
        const tmp = new BABYLON.Matrix();
        for (let i = 0; i < items.length; i++) {
          const b = items[i];
          const pos = b.position || { x: 0, y: 0, z: 0 };
          const rotX = (b.rotationX || 0) * Math.PI / 180;
          const rotY = (b.rotationY || 0) * Math.PI / 180;
          const rotZ = (b.rotationZ || 0) * Math.PI / 180;
          const scaling = new BABYLON.Vector3(1, 1, 1);
          const rotation = BABYLON.Quaternion.FromEulerAngles(rotX, rotY, rotZ);
          const position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
          BABYLON.Matrix.ComposeToRef(scaling, rotation, position, tmp);
          tmp.copyToArray(matrices, i * 16);
        }
        base.thinInstanceSetBuffer('matrix', matrices, 16, true);
        base.freezeWorldMatrix();
      }

      // Position camera to center
      const center = new BABYLON.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
      const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
      const distance = Math.max(8, size * 2);
      camera.setTarget(center);
      camera.radius = distance;
    }

    if (usePipeline) {
      try {
        const pipeline = new BABYLON.DefaultRenderingPipeline('dp', true, scene, [camera]);
        pipeline.fxaaEnabled = true;
        pipeline.samples = msaaSamples;
      } catch {}
    }

    // Freeze for perf
    try { scene.freezeActiveMeshes(); } catch {}

    // Render single frame and capture
    scene.render();

    // Downscale to exact output size if needed
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return dataUrl;
  } finally {
    try { engine.stopRenderLoop(); } catch {}
    try { engine.dispose(); } catch {}
    // canvas will be GC'd
  }
}


