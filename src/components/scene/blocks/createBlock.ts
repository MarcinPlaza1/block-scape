import * as THREE from 'three';
// @ts-ignore
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';
import type { Block } from '../types';

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function createConveyorTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(64, 64);
  const ctx = canvas.getContext('2d')!;
  // background
  ctx.fillStyle = '#2f2f2f';
  ctx.fillRect(0, 0, 64, 64);
  // diagonal stripes
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 6;
  for (let i = -64; i < 64; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 64);
    ctx.lineTo(i + 64, 0);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function createBouncyTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(64, 64);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#14532d';
  ctx.fillRect(0, 0, 64, 64);
  // polka dots
  ctx.fillStyle = '#22c55e';
  for (let y = 8; y < 64; y += 16) {
    for (let x = 8; x < 64; x += 16) {
      ctx.beginPath();
      ctx.arc(x + ((y / 16) % 2 ? 4 : 0), y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function createIceTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(64, 64);
  const ctx = canvas.getContext('2d')!;
  // gradient bluish
  const grad = ctx.createLinearGradient(0, 0, 64, 64);
  grad.addColorStop(0, '#e0fbff');
  grad.addColorStop(1, '#67e8f9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  // subtle cracks/noise
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 64, Math.random() * 64);
    for (let j = 0; j < 4; j++) {
      ctx.lineTo(Math.random() * 64, Math.random() * 64);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export type CreateBlockParams = {
  type: 'cube' | 'cube_bouncy' | 'cube_ice' | 'cube_conveyor' | 'cube_boost' | 'cube_slow' | 'cube_sticky' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'plate' | 'ramp' | 'torus' | 'wedge' | 'door' | 'window' | 'fence' | 'start' | 'checkpoint' | 'finish' | 'hazard';
  position: THREE.Vector3;
  id?: string;
  rotationYDeg?: number;
  rotationXDeg?: number;
  rotationZDeg?: number;
  uniformScale?: number;
  color?: number;
};

export function createBlock(
  params: CreateBlockParams,
  deps: { scene: THREE.Scene; world: any; dynamicMaterial?: any }
): Block {
  const { type, position, id, rotationYDeg, rotationXDeg, rotationZDeg, uniformScale, color } = params;
  const { scene, world, dynamicMaterial } = deps;

  let geometry: THREE.BufferGeometry;
  let material: THREE.Material;
  let shape: any;

  const scale = typeof uniformScale === 'number' && isFinite(uniformScale) ? Math.max(0.1, Math.min(10, uniformScale)) : 1;

  if (type === 'cube' || type === 'cube_bouncy' || type === 'cube_ice' || type === 'cube_conveyor' || type === 'cube_boost' || type === 'cube_slow' || type === 'cube_sticky') {
    geometry = new THREE.BoxGeometry(1, 1, 1);
    if (type === 'cube_conveyor') {
      const tex = createConveyorTexture();
      (tex as any).anisotropy = 4;
      material = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff });
    } else if (type === 'cube_bouncy') {
      const tex = createBouncyTexture();
      (tex as any).anisotropy = 4;
      material = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff });
    } else if (type === 'cube_ice') {
      const tex = createIceTexture();
      (tex as any).anisotropy = 4;
      material = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0.95 });
    } else {
      const mechColor = (() => {
        if (type === 'cube_boost') return 0xa855f7;
        if (type === 'cube_slow') return 0xeab308;
        if (type === 'cube_sticky') return 0x84cc16;
        return undefined;
      })();
      material = new THREE.MeshLambertMaterial({ color: mechColor ?? (color ?? Math.random() * 0xffffff) });
    }
    shape = new (CANNON as any).Box(new (CANNON as any).Vec3(0.5 * scale, 0.5 * scale, 0.5 * scale));
  } else if (type === 'sphere') {
    geometry = new THREE.SphereGeometry(0.5, 16, 16);
    material = new THREE.MeshLambertMaterial({ color: color ?? Math.random() * 0xffffff });
    shape = new (CANNON as any).Sphere(0.5 * scale);
  } else if (type === 'cylinder') {
    geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
    material = new THREE.MeshLambertMaterial({ color: color ?? Math.random() * 0xffffff });
    shape = new (CANNON as any).Cylinder(0.5 * scale, 0.5 * scale, 1 * scale, 16);
  } else if (type === 'cone') {
    geometry = new THREE.ConeGeometry(0.5, 1, 16);
    material = new THREE.MeshLambertMaterial({ color: color ?? Math.random() * 0xffffff });
    shape = new (CANNON as any).Sphere(0.6 * scale);
  } else if (type === 'pyramid') {
    geometry = new THREE.ConeGeometry(0.6, 1, 4);
    material = new THREE.MeshLambertMaterial({ color: color ?? Math.random() * 0xffffff });
    shape = new (CANNON as any).Sphere(0.65 * scale);
  } else if (type === 'plate') {
    geometry = new THREE.BoxGeometry(1, 0.2, 1);
    material = new THREE.MeshLambertMaterial({ color: color ?? Math.random() * 0xffffff });
    shape = new (CANNON as any).Box(new (CANNON as any).Vec3(0.5 * scale, 0.1 * scale, 0.5 * scale));
  } else if (type === 'ramp') {
    geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1, true);
    material = new THREE.MeshLambertMaterial({ color: color ?? Math.random() * 0xffffff });
    shape = new (CANNON as any).Box(new (CANNON as any).Vec3(0.6 * scale, 0.5 * scale, 0.6 * scale));
  } else if (type === 'torus') {
    geometry = new THREE.TorusGeometry(0.6, 0.2, 12, 24);
    material = new THREE.MeshLambertMaterial({ color: color ?? Math.random() * 0xffffff });
    shape = new (CANNON as any).Sphere(0.8 * scale);
  } else if (type === 'wedge') {
    // Triangular wedge using a pyramid-like geometry sliced in half
    const base = 1 * scale;
    const height = 0.5 * scale;
    const geom = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // bottom square (two triangles)
      -base/2, 0, -base/2,
       base/2, 0, -base/2,
       base/2, 0,  base/2,
      -base/2, 0, -base/2,
       base/2, 0,  base/2,
      -base/2, 0,  base/2,
      // sloped side (triangle)
      -base/2, 0,  base/2,
       base/2, 0,  base/2,
       0,      height, 0,
      // side 2
       base/2, 0,  base/2,
       base/2, 0, -base/2,
       0,      height, 0,
      // side 3
       base/2, 0, -base/2,
      -base/2, 0, -base/2,
       0,      height, 0,
      // side 4
      -base/2, 0, -base/2,
      -base/2, 0,  base/2,
       0,      height, 0,
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.computeVertexNormals();
    geometry = geom;
    material = new THREE.MeshLambertMaterial({ color: color ?? Math.random() * 0xffffff });
    // Physics: approximate with a box for stability
    shape = new (CANNON as any).Box(new (CANNON as any).Vec3(0.5 * scale, 0.25 * scale, 0.5 * scale));
  } else if (type === 'door') {
    // Door panel with slight frame bevel
    geometry = new THREE.BoxGeometry(1, 2, 0.12, 1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: 0x6b4f2a });
    material = mat;
    shape = new (CANNON as any).Box(new (CANNON as any).Vec3(0.5 * scale, 1 * scale, 0.06 * scale));
  } else if (type === 'window') {
    // Window pane with transparency
    geometry = new THREE.BoxGeometry(1.2, 1, 0.08);
    material = new THREE.MeshLambertMaterial({ color: 0x88c0ff, transparent: true, opacity: 0.5 });
    shape = new (CANNON as any).Box(new (CANNON as any).Vec3(0.6 * scale, 0.5 * scale, 0.04 * scale));
  } else if (type === 'start') {
    // Start pad (sensor)
    geometry = new THREE.CylinderGeometry(0.8, 0.8, 0.2, 24);
    material = new THREE.MeshLambertMaterial({ color: 0x00ff88, emissive: 0x003311 });
    shape = new (CANNON as any).Cylinder(0.8 * scale, 0.8 * scale, 0.2 * scale, 16);
  } else if (type === 'checkpoint') {
    // Checkpoint pad (sensor)
    geometry = new THREE.CylinderGeometry(0.8, 0.8, 0.2, 24);
    material = new THREE.MeshLambertMaterial({ color: 0xffcc00, emissive: 0x332200 });
    shape = new (CANNON as any).Cylinder(0.8 * scale, 0.8 * scale, 0.2 * scale, 16);
  } else if (type === 'finish') {
    // Finish pad (sensor)
    geometry = new THREE.CylinderGeometry(0.8, 0.8, 0.2, 24);
    material = new THREE.MeshLambertMaterial({ color: 0x00ccff, emissive: 0x002233 });
    shape = new (CANNON as any).Cylinder(0.8 * scale, 0.8 * scale, 0.2 * scale, 16);
  } else if (type === 'hazard') {
    // Hazard block (sensor), thin box
    geometry = new THREE.BoxGeometry(1, 0.2, 1);
    material = new THREE.MeshLambertMaterial({ color: 0xff3344, emissive: 0x330000 });
    shape = new (CANNON as any).Box(new (CANNON as any).Vec3(0.5 * scale, 0.1 * scale, 0.5 * scale));
  } else {
    // Fence: thin, wider panel
    geometry = new THREE.BoxGeometry(1.4, 1, 0.06);
    material = new THREE.MeshLambertMaterial({ color: 0x9ca3af });
    shape = new (CANNON as any).Box(new (CANNON as any).Vec3(0.7 * scale, 0.5 * scale, 0.03 * scale));
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.scale.set(scale, scale, scale);
  const rx = THREE.MathUtils.degToRad(rotationXDeg || 0);
  const ry = THREE.MathUtils.degToRad(rotationYDeg || 0);
  const rz = THREE.MathUtils.degToRad(rotationZDeg || 0);
  mesh.rotation.set(rx, ry, rz);
  const newId = id || Date.now().toString();
  mesh.userData = { blockId: newId, blockType: type };

  scene.add(mesh);

  const body = new (CANNON as any).Body({ mass: 0, material: dynamicMaterial || undefined });
  try { (body as any).type = (CANNON as any).Body.STATIC; } catch {}
  body.allowSleep = true;
  body.sleepSpeedLimit = 0.1;
  body.sleepTimeLimit = 0.5;
  body.addShape(shape);
  body.position.set(position.x, position.y, position.z);
  try { (body as any).quaternion?.setFromEuler?.(rx, ry, rz); } catch {}
  try { body.velocity.set(0, 0, 0); body.angularVelocity.set(0, 0, 0); } catch {}
  // Mark sensors to not physically respond
  if (type === 'start' || type === 'checkpoint' || type === 'finish' || type === 'hazard') {
    try { body.collisionResponse = false; } catch {}
  }
  ;(body as any).userData = { blockId: newId, blockType: type };
  world.addBody(body);

  const block: Block = {
    id: newId,
    type,
    position: { x: position.x, y: position.y, z: position.z },
    color: (material as any).color?.getHex?.() ?? undefined,
    rotationY: typeof rotationYDeg === 'number' ? rotationYDeg : 0,
    rotationX: typeof rotationXDeg === 'number' ? rotationXDeg : 0,
    rotationZ: typeof rotationZDeg === 'number' ? rotationZDeg : 0,
    scale: scale,
    mesh,
    body,
  };

  return block;
}


