import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Block } from '@/types/project';

type MiniPreviewProps = {
  blocks?: Block[];
  className?: string;
};

// Lightweight, static renderer for small previews
const MiniPreview = ({ blocks = [], className }: MiniPreviewProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);

  const safeBlocks = useMemo(() => {
    return Array.isArray(blocks) ? blocks : [];
  }, [blocks]);

  // Local lightweight textures for preview of special cubes
  const createCanvas = (w: number, h: number) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h; return c;
  };

  const getPreviewMaterial = (b: Block) => {
    if (['cube_bouncy','cube_ice','cube_conveyor'].includes((b as any).type)) {
      const canvas = createCanvas(64, 64);
      const ctx = canvas.getContext('2d')!;
      if ((b as any).type === 'cube_conveyor') {
        ctx.fillStyle = '#2f2f2f'; ctx.fillRect(0, 0, 64, 64);
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 6;
        for (let i = -64; i < 64; i += 16) { ctx.beginPath(); ctx.moveTo(i, 64); ctx.lineTo(i + 64, 0); ctx.stroke(); }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
        return new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff });
      }
      if ((b as any).type === 'cube_bouncy') {
        ctx.fillStyle = '#14532d'; ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#22c55e';
        for (let y = 8; y < 64; y += 16) {
          for (let x = 8; x < 64; x += 16) {
            ctx.beginPath(); ctx.arc(x + ((y / 16) % 2 ? 4 : 0), y, 5, 0, Math.PI * 2); ctx.fill();
          }
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
        return new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff });
      }
      // ice
      const grad = ctx.createLinearGradient(0, 0, 64, 64);
      grad.addColorStop(0, '#e0fbff'); grad.addColorStop(1, '#67e8f9');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(Math.random() * 64, Math.random() * 64); for (let j = 0; j < 4; j++) { ctx.lineTo(Math.random() * 64, Math.random() * 64); } ctx.stroke(); }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
      return new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0.95 });
    }
    const color = (typeof (b as any).color === 'number') ? (b as any).color : 0x6b7280;
    return new THREE.MeshStandardMaterial({ color });
  };

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x121212);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 6);
    scene.add(dir);

    // Ground (simple grid vibe)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x1f1f1f })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    // Container for blocks
    const group = new THREE.Group();
    groupRef.current = group;
    scene.add(group);

    const resize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      rendererRef.current.setSize(width, height, false);
      cameraRef.current.aspect = width / (height || 1);
      cameraRef.current.updateProjectionMatrix();
      renderOnce();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(mountRef.current);

    const renderOnce = () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    // Initial size
    resize();

    return () => {
      ro.disconnect();
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (mountRef.current && renderer.domElement && mountRef.current.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
      // Dispose group contents
      if (groupRef.current) {
        groupRef.current.children.forEach(obj => {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          const mat = (mesh as any).material;
          if (Array.isArray(mat)) mat.forEach(m => m?.dispose()); else mat?.dispose?.();
        });
      }
      // Clear refs
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      groupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current || !groupRef.current || !cameraRef.current) return;

    // Clear previous
    while (groupRef.current.children.length) {
      const obj = groupRef.current.children.pop()!;
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as any).material;
      if (Array.isArray(mat)) mat.forEach(m => m?.dispose()); else mat?.dispose?.();
    }

    if (safeBlocks.length === 0) {
      // Add a subtle placeholder cube when empty
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial({ color: 0x6b7280 });
      const cube = new THREE.Mesh(geo, mat);
      cube.position.set(0, 0.5, 0);
      groupRef.current.add(cube);
    } else {
      // Build meshes from blocks
      safeBlocks.forEach((b) => {
        const isCube = b.type === 'cube' || (b.type as string).startsWith('cube');
        const geo = isCube ? new THREE.BoxGeometry(1, 1, 1) : new THREE.SphereGeometry(0.5, 12, 12);
        const mat = getPreviewMaterial(b);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(b.position.x, b.position.y, b.position.z);
        groupRef.current!.add(mesh);
      });
    }

    // Frame camera to group
    const box = new THREE.Box3().setFromObject(groupRef.current);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x || 1, size.y || 1, size.z || 1);
    const fitHeightDistance = maxDim / (2 * Math.tan((cameraRef.current.fov * Math.PI) / 360));
    const fitWidthDistance = fitHeightDistance / cameraRef.current.aspect;
    const distance = 1.2 * Math.max(fitHeightDistance, fitWidthDistance); // padding

    cameraRef.current.position.set(center.x + distance, center.y + distance * 0.8, center.z + distance);
    cameraRef.current.lookAt(center);
    cameraRef.current.near = 0.1;
    cameraRef.current.far = distance * 10 + 100;
    cameraRef.current.updateProjectionMatrix();

    if (rendererRef.current && sceneRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [safeBlocks]);

  return (
    <div ref={mountRef} className={className || 'w-full h-full'} />
  );
};

export default MiniPreview;


