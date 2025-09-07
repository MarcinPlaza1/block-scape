import { useEffect, useRef, useState, memo } from 'react';
import { useProjectStore } from '@/lib/projectStore';
import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { Block, Scene3DProps } from './scene/types';
import { usePhysicsWorld } from './scene/usePhysicsWorld';
import { usePlayerController } from './scene/usePlayerController';
import { useGridSnapping } from './scene/useGridSnapping';
import { useGhostPreview } from './scene/useGhostPreview';
import { useSelectionAndDragging } from './scene/useSelectionAndDragging';
import { createBlock } from './scene/blocks/createBlock';
import { disposeBlock as disposeRuntimeBlock } from './scene/blocks/disposeBlock';
import { startEngineLoop } from './scene/engine/loop';
import { attachCameraController } from './scene/camera/controller';
import { attachEditorInput } from './scene/input/editorInput';
import { createSceneEngine } from './scene/engine/SceneEngine';

const Scene3D = ({ onBlockAdd, droppedBlock, onSceneStateChange, loadedBlocks, selectedTool = 'select', isPlayMode = false, terrainMode = 'flat', cameraMode = 'orbit', onGameStart, onGameCheckpoint, onGameFinish, onGameHazard }: Scene3DProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>(null!);
  const rendererRef = useRef<THREE.WebGLRenderer>(null!);
  const cameraRef = useRef<THREE.Camera>(null!);
  const raycasterRef = useRef<THREE.Raycaster>(null!);
  const mouseRef = useRef<THREE.Vector2>(null!);
  const blocksRef = useRef<Block[]>([]);
  const groundRef = useRef<THREE.Mesh>(null!);
  const { worldRef, groundBodyRef, groundMaterialRef, dynamicMaterialRef, createGround, raycastClosest, emitCollisionEvents, addCollisionListener } = usePhysicsWorld(terrainMode);
  const snapEnabledRef = useRef<boolean>(true);
  const snapSizeRef = useRef<number>(1);
  const { selectedBlockRef, isDraggingRef, selectBlock, deselectBlock, startDragging, dragTo, stopDragging } = useSelectionAndDragging({
    sceneRef,
    cameraRef: cameraRef as any,
    raycasterRef: raycasterRef as any,
    snapEnabledRef,
    snapSizeRef,
    setSelectedBlockId: useProjectStore((s: any) => s.setSelectedBlockId),
  });
  const builderColorRef = useRef<number>(0xffffff);
  const { ghostRef, createGhost, removeGhost, updateGhostColor } = useGhostPreview({ sceneRef, colorRef: builderColorRef });
  const droppedBlockRef = useRef<{ type: 'cube' | 'cube_bouncy' | 'cube_ice' | 'cube_conveyor' | 'cube_boost' | 'cube_slow' | 'cube_sticky' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'plate' | 'ramp' | 'torus' | 'wedge' | 'door' | 'window' | 'fence' | 'start' | 'checkpoint' | 'finish' | 'hazard' } | null>(null);
  const ghostRotationYRef = useRef<number>(0);
  const { gridHelperRef, snapRingRef, rebuildGridHelper, removeGridHelper, ensureSnapRing } = useGridSnapping({ sceneRef, gridVisible: useProjectStore((s: any) => s.gridVisible), snapSize: useProjectStore((s: any) => s.snapSize) });
  const cameraModeRef = useRef<'orbit' | 'first' | 'ortho'>(cameraMode);
  const transformRef = useRef<any>(null);
  const isGizmoDraggingRef = useRef<boolean>(false);
  const transformModeRef = useRef<'translate' | 'rotate' | 'scale'>('translate');
  const paintingRef = useRef<boolean>(false);
  const paintedIdsRef = useRef<Set<string>>(new Set());
  // Gameplay state
  const spawnRef = useRef<THREE.Vector3 | null>(null);
  const checkpointRef = useRef<THREE.Vector3 | null>(null);
  const lastFinishAtRef = useRef<number>(0);
  
  // temp objects to reduce allocations
  const tempNdc = useRef<THREE.Vector2>(new THREE.Vector2());
  const tempVec3 = useRef<THREE.Vector3>(new THREE.Vector3());
  const tempSpherical = useRef<THREE.Spherical>(new THREE.Spherical());
  const dragDistanceRef = useRef<number>(0);
  const cameraDragActiveRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);
  // Group dragging state
  const groupSelectedIdsRef = useRef<string[] | null>(null);
  const groupInitialPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const groupPrimaryStartRef = useRef<THREE.Vector3 | null>(null);

  const cameraDistanceRef = useRef<number>(12);

  const [isLoading, setIsLoading] = useState(true);
  // Default colors for mechanic block types
  const getTypeDefaultColor = (t: any): number | undefined => {
    if (t === 'cube_bouncy') return 0x22c55e;
    if (t === 'cube_ice') return 0x67e8f9;
    if (t === 'cube_conveyor') return 0xf59e0b;
    if (t === 'cube_boost') return 0xa855f7;
    if (t === 'cube_slow') return 0xeab308;
    if (t === 'cube_sticky') return 0x84cc16;
    return undefined;
  };

  // Grid & snapping settings from store
  const gridVisible = useProjectStore((s: any) => s.gridVisible);
  const snapEnabled = useProjectStore((s: any) => s.snapEnabled);
  const snapSize = useProjectStore((s: any) => s.snapSize);
  const setGridVisible = useProjectStore((s: any) => s.setGridVisible);
  const setSnapEnabled = useProjectStore((s: any) => s.setSnapEnabled);
  const placeMultiple = useProjectStore((s: any) => (s as any).placeMultiple) as boolean;
  const selectedBlockId = useProjectStore((s: any) => s.selectedBlockId);
  const selectedBlockIds = useProjectStore((s: any) => s.selectedBlockIds);
  const removeBlockFromStore = useProjectStore((s: any) => s.removeBlock);
  const duplicateBlock = useProjectStore((s: any) => s.duplicateBlock);
  const setBlockPosition = useProjectStore((s: any) => s.setBlockPosition);
  const setBlockRotationY = useProjectStore((s: any) => (s as any).setBlockRotationY) as (id: string, rotationY: number) => void;
  const setBlockRotationX = useProjectStore((s: any) => (s as any).setBlockRotationX) as (id: string, rotationX: number) => void;
  const setBlockRotationZ = useProjectStore((s: any) => (s as any).setBlockRotationZ) as (id: string, rotationZ: number) => void;
  const setBlockScale = useProjectStore((s: any) => (s as any).setBlockScale) as (id: string, scale: number) => void;
  const paintBlocks = useProjectStore((s: any) => (s as any).paintBlocks) as (ids: string[], color: number) => void;
  // Builder additions
  const builderModeEnabled = useProjectStore((s: any) => s.builderModeEnabled);
  const builderCurrentType = useProjectStore((s: any) => s.builderCurrentType);
  const builderCurrentColor = useProjectStore((s: any) => s.builderCurrentColor);
  const setBuilderCurrentType = useProjectStore((s: any) => s.setBuilderCurrentType);
  const setBuilderCurrentColor = useProjectStore((s: any) => s.setBuilderCurrentColor);

  // Keep latest builder state in refs to avoid stale closures
  const builderModeRef = useRef<boolean>(builderModeEnabled);
  const builderTypeRef = useRef<'cube' | 'cube_bouncy' | 'cube_ice' | 'cube_conveyor' | 'cube_boost' | 'cube_slow' | 'cube_sticky' | 'sphere'>(builderCurrentType as any);
  useEffect(() => { builderModeRef.current = !!builderModeEnabled; }, [builderModeEnabled]);
  useEffect(() => { builderTypeRef.current = builderCurrentType; }, [builderCurrentType]);
  useEffect(() => {
    builderColorRef.current = builderCurrentColor;
    try {
      const armedType = droppedBlockRef.current?.type;
      const mech = armedType ? getTypeDefaultColor(armedType) : undefined;
      if (ghostRef.current && typeof mech === 'number') {
        const mat: any = ghostRef.current.material;
        mat?.color?.setHex?.(mech);
        return;
      }
    } catch {}
    updateGhostColor();
  }, [builderCurrentColor]);

  useEffect(() => { snapEnabledRef.current = !!snapEnabled; }, [snapEnabled]);
  useEffect(() => { snapSizeRef.current = Number(snapSize) || 1; }, [snapSize]);
  useEffect(() => { cameraModeRef.current = cameraMode; }, [cameraMode]);

  // grid helper and snap ring handled via useGridSnapping

  // Player controller
  const { playerRef, update: updatePlayer } = usePlayerController({ isPlayMode: cameraMode === 'first' && isPlayMode, mountRef, worldRef: worldRef as any, sceneRef: sceneRef as any, cameraRef: cameraRef as any, dynamicMaterialRef: dynamicMaterialRef as any });

  // Global editor shortcuts (Undo/Redo) when NOT in play mode
  useEffect(() => {
    const handleEditorShortcuts = (event: KeyboardEvent) => {
      if (isPlayMode) return;
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrMeta = isMac ? event.metaKey : event.ctrlKey;
      if (!ctrlOrMeta) return;
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          useProjectStore.getState().redo();
        } else {
          useProjectStore.getState().undo();
        }
      }
    };
    window.addEventListener('keydown', handleEditorShortcuts);
    return () => window.removeEventListener('keydown', handleEditorShortcuts);
  }, [isPlayMode]);

  // Ghost color updates handled in builderColor effect above

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene engine (scene, camera, renderer, default lights)
    const engine = createSceneEngine({ mount: mountRef.current, cameraMode });
    sceneRef.current = engine.scene;
    cameraRef.current = engine.camera as any;
    rendererRef.current = engine.renderer;

    // Raycaster for mouse interactions
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    raycasterRef.current = raycaster;
    mouseRef.current = mouse;

    // Lighting is provided by the engine

    // Ground/Terrain and physics ground via hook
    const { ground } = createGround(sceneRef.current!);
    groundRef.current = ground;

    // Grid helper overlay
    rebuildGridHelper();
    // Add some initial blocks
    createInitialBlocks();

    const lastMoveRef = { time: 0 };
    const throttleMs = 16; // ~60fps

    // Attach camera controller (orbit/ortho pan/zoom)
    const detachCamera = attachCameraController({
      mount: mountRef.current,
      cameraRef: cameraRef as any,
      cameraModeRef: cameraModeRef as any,
      isPlayMode,
      cameraDistanceRef,
      tempSpherical,
      isBlockDraggingRef: isDraggingRef as any,
      onDragActiveChange: (active) => { cameraDragActiveRef.current = active; if (!active) dragDistanceRef.current = 0; },
    });

    // Transform controls gizmo
    const tr = new TransformControls(cameraRef.current as any, rendererRef.current!.domElement);
    try { (tr as any).setSize?.(1.0); } catch {}
    tr.enabled = true;
    tr.visible = false;
    tr.addEventListener('dragging-changed', (e: any) => {
      isGizmoDraggingRef.current = !!e?.value;
      cameraDragActiveRef.current = !!e?.value;
    });
    tr.addEventListener('mouseUp', () => {
      try {
        const obj = tr.object as THREE.Object3D | null;
        const sel = selectedBlockRef.current;
        if (!obj || !sel) return;
        // Commit runtime transforms to store in one go
        const current = (useProjectStore.getState().blocks || []) as any[];
        const next = current.map((b) => {
          if (b.id !== sel.id) return b;
          const euler = new THREE.Euler();
          euler.copy((obj as any).rotation);
          const ry = THREE.MathUtils.radToDeg(euler.y || 0);
          const rx = THREE.MathUtils.radToDeg(euler.x || 0);
          const rz = THREE.MathUtils.radToDeg(euler.z || 0);
          const s = (obj as any).scale?.x ?? (b.scale || 1);
          return { ...b, position: { x: (obj as any).position.x, y: (obj as any).position.y, z: (obj as any).position.z }, rotationY: ry, rotationX: rx, rotationZ: rz, scale: s };
        });
        try { useProjectStore.getState().setBlocks(next as any); } catch {}
      } catch {}
    });
    tr.addEventListener('objectChange', () => {
      // Realtime apply to runtime block and physics; store commit is on mouseUp
      try {
        const obj = tr.object as any;
        const sel = selectedBlockRef.current;
        if (!obj || !sel) return;
        if (sel.body) {
          (sel.body as any).position.set(obj.position.x, obj.position.y, obj.position.z);
          try { (sel.body as any).quaternion?.setFromEuler?.(obj.rotation.x, obj.rotation.y, obj.rotation.z); } catch {}
        }
        if (sel.mesh) {
          sel.mesh.position.copy(obj.position);
          sel.mesh.rotation.copy(obj.rotation as any);
          const s = obj.scale?.x ?? 1;
          sel.mesh.scale.set(s, s, s);
        }
      } catch {}
    });
    sceneRef.current!.add(tr as any);
    transformRef.current = tr;

    const handleMouseMove = (event: MouseEvent) => {
      const now = performance.now();
      if (now - lastMoveRef.time < throttleMs) return;
      lastMoveRef.time = now;
      if (isPlayMode || document.pointerLockElement === mountRef.current) return; // Disable editor controls when playing with pointer lock

      if (isDraggingRef.current) {
        if (mountRef.current && cameraRef.current) {
          const rect = mountRef.current.getBoundingClientRect();
          const mouse = tempNdc.current.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
          );
          dragTo(mouse);
          // Apply group delta to other selected blocks
          try {
            const primary = selectedBlockRef.current;
            const ids = groupSelectedIdsRef.current || [];
            if (primary && primary.body && ids.length > 1) {
              const start = groupPrimaryStartRef.current;
              if (start) {
                const p = primary.body.position as any;
                const dx = p.x - start.x;
                const dy = p.y - start.y;
                const dz = p.z - start.z;
                ids.forEach(id => {
                  if (id === primary.id) return;
                  const initial = groupInitialPositionsRef.current.get(id);
                  const runtime = blocksRef.current.find(x => x.id === id);
                  if (!initial || !runtime || runtime.locked) return;
                  let nx = initial.x + dx;
                  let ny = initial.y + dy;
                  let nz = initial.z + dz;
                  if (snapEnabledRef.current) {
                    const s = snapSizeRef.current || 1;
                    nx = Math.round(nx / s) * s;
                    nz = Math.round(nz / s) * s;
                  }
                  try {
                    if (runtime.body) (runtime.body as any).position.set(nx, ny, nz);
                    if (runtime.mesh) runtime.mesh.position.set(nx, ny, nz);
                  } catch {}
                });
              }
            }
          } catch {}
        }
      }

      // Painting while mouse is down
      if (paintingRef.current && selectedTool === 'paint') {
        try {
          if (!raycasterRef.current || !cameraRef.current || !mountRef.current) return;
          const rect = mountRef.current.getBoundingClientRect();
          const mouse = tempNdc.current.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
          );
          raycasterRef.current.setFromCamera(mouse, cameraRef.current);
          const blockMeshes = blocksRef.current.filter(b => !b.hidden).map(b => b.mesh).filter(Boolean) as THREE.Object3D[];
          const hits = raycasterRef.current.intersectObjects(blockMeshes);
          if (hits.length > 0) {
            const clickedMesh = hits[0].object;
            const clickedBlock = blocksRef.current.find(block => block.mesh === clickedMesh);
            if (clickedBlock) {
              // Skip painting for textured mechanic cubes
              if (['cube_bouncy','cube_ice','cube_conveyor'].includes((clickedBlock as any).type)) {
                return;
              }
              const id = clickedBlock.id;
              if (!paintedIdsRef.current.has(id)) {
                paintedIdsRef.current.add(id);
                // Update runtime material color immediately
                try {
                  const mat: any = (clickedBlock.mesh as any).material;
                  if (mat && typeof builderColorRef.current === 'number') {
                    mat.color?.setHex?.(builderColorRef.current);
                  }
                } catch {}
              }
            }
          }
        } catch {}
      }

      // Update mouse for raycasting
      if (mountRef.current) {
        const rect = mountRef.current.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      }

      // Update ghost position if active
      if (groundRef.current && cameraRef.current && raycasterRef.current && mountRef.current) {
        const rect = mountRef.current.getBoundingClientRect();
        const cursor = tempNdc.current.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycasterRef.current.setFromCamera(cursor, cameraRef.current);
        const intersects = raycasterRef.current.intersectObject(groundRef.current);
        if (intersects.length > 0) {
          const p = intersects[0].point;
          const lift = droppedBlockRef.current?.type === 'sphere' ? 0.5 : 0.5;
          let gx = p.x;
          let gz = p.z;
          if (snapEnabledRef.current) {
            const s = snapSizeRef.current || 1;
            gx = Math.round(gx / s) * s;
            gz = Math.round(gz / s) * s;
          }
          if (ghostRef.current) {
            ghostRef.current.position.set(gx, p.y + lift, gz);
            // simple pulse animation
            const t = performance.now() * 0.003;
            const scale = 1.05 + Math.sin(t) * 0.03;
            ghostRef.current.scale.set(scale, scale, scale);
          }
          // snap ring
          ensureSnapRing(snapSizeRef.current);
          if (snapRingRef.current) {
            snapRingRef.current.position.set(gx, 0.002, gz);
          }
        }
      }

      // camera orbit state handled by camera controller
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        stopDragging();
        // Commit drag to store so blocks persist position
        try {
          const ids = (groupSelectedIdsRef.current && groupSelectedIdsRef.current.length > 0)
            ? groupSelectedIdsRef.current
            : (selectedBlockRef.current ? [selectedBlockRef.current.id] : []);
          if (ids.length > 0) {
            const current = (useProjectStore.getState().blocks || []) as any[];
            const idSet = new Set(ids);
            const next = current.map(b => {
              if (!idSet.has(b.id)) return b;
              const runtime = blocksRef.current.find(x => x.id === b.id);
              const p = (runtime?.body?.position || runtime?.mesh?.position) as any;
              return { ...b, position: { x: p.x, y: p.y, z: p.z } };
            });
            try { useProjectStore.getState().setBlocks(next as any); } catch {}
          }
        } catch {}
      }
      // Cleanup group state
      groupSelectedIdsRef.current = null;
      groupInitialPositionsRef.current.clear();
      groupPrimaryStartRef.current = null;

      // Finish painting commit
      if (paintingRef.current && paintedIdsRef.current.size > 0) {
        try {
          paintBlocks(Array.from(paintedIdsRef.current), builderColorRef.current);
        } catch {}
      }
      paintingRef.current = false;
      paintedIdsRef.current.clear();
    };

    // wheel handled in camera controller

    const handleClick = (event: MouseEvent) => {
      if (isPlayMode) return; // Disable editor interactions in play mode
      if (cameraDragActiveRef.current) return; // suppress click after drag

      // Painting single-click
      if (selectedTool === 'paint' && raycasterRef.current && cameraRef.current && sceneRef.current) {
        try {
          if (mountRef.current) {
            const rect = mountRef.current.getBoundingClientRect();
            const mouse = tempNdc.current.set(
              ((event.clientX - rect.left) / rect.width) * 2 - 1,
              -((event.clientY - rect.top) / rect.height) * 2 + 1
            );
            raycasterRef.current.setFromCamera(mouse, cameraRef.current);
          }
          const blockMeshes = blocksRef.current.filter(b => !b.hidden).map(b => b.mesh).filter(Boolean) as THREE.Object3D[];
          const hits = raycasterRef.current.intersectObjects(blockMeshes);
          if (hits.length > 0) {
            const clickedMesh = hits[0].object;
            const clickedBlock = blocksRef.current.find(block => block.mesh === clickedMesh);
            if (clickedBlock) {
              // Skip painting for textured mechanic cubes
              if (['cube_bouncy','cube_ice','cube_conveyor'].includes((clickedBlock as any).type)) {
                return;
              }
              // Immediate visual
              try { (clickedBlock.mesh as any)?.material?.color?.setHex?.(builderColorRef.current); } catch {}
              try { useProjectStore.getState().setBlockColor(clickedBlock.id, builderColorRef.current); } catch {}
            }
          }
        } catch {}
        return;
      }

      if (droppedBlockRef.current && raycasterRef.current && cameraRef.current && sceneRef.current) {
        // Cast ray to find nearest intersection with ground or existing blocks
        try {
          // compute from actual click position to avoid stale mouse
          if (mountRef.current) {
            const rect = mountRef.current.getBoundingClientRect();
            const mouse = tempNdc.current.set(
              ((event.clientX - rect.left) / rect.width) * 2 - 1,
              -((event.clientY - rect.top) / rect.height) * 2 + 1
            );
            raycasterRef.current.setFromCamera(mouse, cameraRef.current);
          } else {
            raycasterRef.current.setFromCamera(mouseRef.current!, cameraRef.current);
          }
          const blockMeshes = blocksRef.current
            .filter(b => !b.hidden)
            .map(b => b.mesh)
            .filter(Boolean) as THREE.Object3D[];
          const targets = [groundRef.current!, ...blockMeshes];
          const hits = raycasterRef.current.intersectObjects(targets, false);

          if (hits.length > 0) {
            const hit = hits[0];
            const position = hit.point.clone();

            if (hit.object === groundRef.current) {
              position.y += 0.5; // center above ground
            } else {
              // Offset along the hit face normal so the new block sits outside the surface
              const faceNormal = hit.face?.normal?.clone();
              if (faceNormal) {
                const normalMatrix = new THREE.Matrix3().getNormalMatrix((hit.object as any).matrixWorld);
                faceNormal.applyMatrix3(normalMatrix).normalize();
                position.add(faceNormal.multiplyScalar(0.51));
              } else {
                position.y += 0.5;
              }
            }

            // Apply snapping on x/z if enabled
            if (snapEnabledRef.current) {
              const s = snapSizeRef.current || 1;
              position.x = Math.round(position.x / s) * s;
              position.z = Math.round(position.z / s) * s;
            }

            addBlock(
              droppedBlockRef.current.type,
              position,
              undefined,
              ghostRotationYRef.current,
              undefined,
              undefined,
              undefined,
              (['cube_bouncy','cube_ice','cube_conveyor'].includes(droppedBlockRef.current.type as any) ? undefined : (getTypeDefaultColor(droppedBlockRef.current.type) ?? builderColorRef.current))
            );
            if (!placeMultiple) {
              removeGhost();
              // Clear armed placement locally to avoid accidental double placement
              droppedBlockRef.current = null;
            }
          }
        } catch (e) {
          console.log('Raycaster ground error:', e);
        }
      } else if (builderModeRef.current && raycasterRef.current && cameraRef.current && sceneRef.current) {
        // Builder mode: left-click to place current type on ground or attach to a block face
        try {
          if (mountRef.current) {
            const rect = mountRef.current.getBoundingClientRect();
            const mouse = tempNdc.current.set(
              ((event.clientX - rect.left) / rect.width) * 2 - 1,
              -((event.clientY - rect.top) / rect.height) * 2 + 1
            );
            raycasterRef.current.setFromCamera(mouse, cameraRef.current);
          }
          const blockMeshes = blocksRef.current
            .filter(b => !b.hidden)
            .map(b => b.mesh)
            .filter(Boolean) as THREE.Object3D[];
          const targets = [groundRef.current!, ...blockMeshes];
          const hits = raycasterRef.current.intersectObjects(targets, false);
          if (hits.length > 0) {
            const hit = hits[0];
            const position = hit.point.clone();

            if (hit.object === groundRef.current) {
              position.y += 0.5;
            } else {
              const faceNormal = hit.face?.normal?.clone();
              if (faceNormal) {
                const normalMatrix = new THREE.Matrix3().getNormalMatrix((hit.object as any).matrixWorld);
                faceNormal.applyMatrix3(normalMatrix).normalize();
                position.add(faceNormal.multiplyScalar(0.51));
              } else {
                position.y += 0.5;
              }
            }

            if (snapEnabledRef.current) {
              const s = snapSizeRef.current || 1;
              position.x = Math.round(position.x / s) * s;
              position.z = Math.round(position.z / s) * s;
            }
            addBlock(
              builderTypeRef.current,
              position,
              undefined,
              ghostRotationYRef.current,
              undefined,
              undefined,
              undefined,
              (getTypeDefaultColor(builderTypeRef.current) ?? builderColorRef.current)
            );
          }
        } catch (e) {
          console.log('Builder place error:', e);
        }
      } else if (selectedTool && raycasterRef.current && cameraRef.current && sceneRef.current) {
        // Handle tool interactions
        try {
          raycasterRef.current.setFromCamera(mouseRef.current!, cameraRef.current);
          
          // Only intersect with blocks, not ground
          const blockMeshes = blocksRef.current.filter(b => !b.hidden).map(block => block.mesh).filter(Boolean);
          const intersects = raycasterRef.current.intersectObjects(blockMeshes as THREE.Object3D[]);
          
          if (intersects.length > 0) {
            const clickedMesh = intersects[0].object;
            const clickedBlock = blocksRef.current.find(block => block.mesh === clickedMesh);
            
            if (clickedBlock) {
              if (selectedTool === 'select') {
                selectBlock(clickedBlock);
              } else if (selectedTool === 'move') {
                if (!clickedBlock.locked) {
                  // Prepare group drag context using current multi-selection
                  const idsSet = new Set<string>([clickedBlock.id, ...((selectedBlockIds || []) as string[])]);
                  const ids = Array.from(idsSet);
                  groupSelectedIdsRef.current = ids;
                  groupInitialPositionsRef.current.clear();
                  ids.forEach(id => {
                    const b = blocksRef.current.find(x => x.id === id);
                    if (b) groupInitialPositionsRef.current.set(id, new THREE.Vector3(b.position.x, b.position.y, b.position.z));
                  });
                  groupPrimaryStartRef.current = new THREE.Vector3(clickedBlock.position.x, clickedBlock.position.y, clickedBlock.position.z);
                  startDragging(clickedBlock, intersects[0].point.clone());
                }
              }
            }
          } else {
            // Clicked on empty space, deselect
            if (selectedTool === 'select') {
              deselectBlock();
            }
          }
        } catch (e) {
          console.log('Raycaster blocks error:', e);
        }
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (isPlayMode) return;
      if (selectedTool !== 'paint') return;
      paintingRef.current = true;
      paintedIdsRef.current.clear();
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (!builderModeRef.current || isPlayMode) return;
      event.preventDefault();
      try {
        if (mountRef.current && raycasterRef.current && cameraRef.current) {
          const rect = mountRef.current.getBoundingClientRect();
          const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
          );
          raycasterRef.current.setFromCamera(mouse, cameraRef.current);
          const blockMeshes = blocksRef.current.filter(b => !b.hidden).map(b => b.mesh).filter(Boolean) as THREE.Object3D[];
          const hits = raycasterRef.current.intersectObjects(blockMeshes);
          if (hits.length > 0) {
            const clickedMesh = hits[0].object;
            const clickedBlock = blocksRef.current.find(block => block.mesh === clickedMesh);
            if (clickedBlock) {
              removeBlockFromStore?.(clickedBlock.id);
              deselectBlock();
            }
          }
        }
      } catch {}
    };

    const handleAuxClick = (event: MouseEvent) => {
      if (!builderModeRef.current || isPlayMode) return;
      if (event.button !== 1) return;
      try {
        if (mountRef.current && raycasterRef.current && cameraRef.current) {
          const rect = mountRef.current.getBoundingClientRect();
          const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
          );
          raycasterRef.current.setFromCamera(mouse, cameraRef.current);
          const blockMeshes = blocksRef.current.filter(b => !b.hidden).map(b => b.mesh).filter(Boolean) as THREE.Object3D[];
          const hits = raycasterRef.current.intersectObjects(blockMeshes);
          if (hits.length > 0) {
            const clickedMesh = hits[0].object;
            const clickedBlock = blocksRef.current.find(block => block.mesh === clickedMesh);
            if (clickedBlock) {
              setBuilderCurrentType?.(clickedBlock.type);
              try { if (typeof clickedBlock.color === 'number') setBuilderCurrentColor?.(clickedBlock.color); } catch {}
            }
          }
        }
      } catch {}
    };

    // Event listeners - conditionally add based on play mode
    let detachEditorInput: (() => void) | null = null;
    if (!isPlayMode) {
      mountRef.current.addEventListener('mousemove', handleMouseMove);
      mountRef.current.addEventListener('mouseup', handleMouseUp);
      mountRef.current.addEventListener('mousedown', handleMouseDown);
      mountRef.current.addEventListener('click', handleClick);
      mountRef.current.addEventListener('contextmenu', handleContextMenu);
      mountRef.current.addEventListener('auxclick', handleAuxClick);

      // Attach minimal editor input (selection/move click + ghost/snap ring updates)
      detachEditorInput = attachEditorInput({
        mount: mountRef.current,
        isPlayMode,
        cameraRef: cameraRef as any,
        raycasterRef: raycasterRef as any,
        sceneRef: sceneRef as any,
        isDraggingRef,
        selectedTool: (selectedTool === 'paint' ? 'select' : selectedTool) as 'select' | 'move',
        selectedBlockIdsRef: groupSelectedIdsRef as any,
        blocksRef: blocksRef as any,
        groundRef: groundRef as any,
        tempNdc,
        snapEnabledRef,
        snapSizeRef,
        ensureSnapRing,
        snapRingRef,
        selectedBlockRef,
        startDragging,
        dragTo,
        stopDragging,
        selectBlock,
        deselectBlock,
      });
    } else {
      // Only add click for play mode if needed (currently disabled)
      mountRef.current.addEventListener('click', handleClick);
    }

    const loop = startEngineLoop({
      worldRef: worldRef as any,
      emitCollisionEvents,
      isPlayMode,
      cameraModeRef: cameraModeRef as any,
      updatePlayer,
      blocksRef: blocksRef as any,
      cameraRef: cameraRef as any,
      renderer: rendererRef.current!,
      scene: sceneRef.current!,
    });

    setIsLoading(false);

    // Gameplay collisions (only in play mode)
    let detachCollision: (() => void) | null = null;
    if (isPlayMode) {
      try {
        detachCollision = addCollisionListener((a: any, b: any, phase: 'begin' | 'end' | 'stay') => {
          if (phase !== 'begin') return;
          const player = playerRef.current?.body;
          if (!player) return;
          const other = a === player ? b : (b === player ? a : null);
          if (!other) return;
          const bt = (other as any).userData?.blockType as string | undefined;
          if (!bt) return;
          const pos = player.position as any;
          if (bt === 'start') {
            checkpointRef.current = new THREE.Vector3(pos.x, pos.y, pos.z);
            try { (Scene3D as any).props?.onGameStart?.({ x: pos.x, y: pos.y, z: pos.z }); } catch {}
          } else if (bt === 'checkpoint') {
            checkpointRef.current = new THREE.Vector3(pos.x, pos.y, pos.z);
            try { (Scene3D as any).props?.onGameCheckpoint?.({ x: pos.x, y: pos.y, z: pos.z }); } catch {}
          } else if (bt === 'finish') {
            const now = performance.now();
            if (now - lastFinishAtRef.current > 1000) {
              lastFinishAtRef.current = now;
              try { (Scene3D as any).props?.onGameFinish?.({ x: pos.x, y: pos.y, z: pos.z }); } catch {}
            }
          } else if (bt === 'hazard') {
            const resp = (checkpointRef.current || spawnRef.current);
            if (resp && playerRef.current) {
              try {
                playerRef.current.body.velocity.set(0, 0, 0);
                playerRef.current.body.angularVelocity.set(0, 0, 0);
                playerRef.current.body.position.set(resp.x, resp.y, resp.z);
                playerRef.current.mesh.position.set(resp.x, resp.y, resp.z);
              } catch {}
            }
            try { (Scene3D as any).props?.onGameHazard?.(resp ? { x: resp.x, y: resp.y, z: resp.z } : { x: pos.x, y: pos.y, z: pos.z }); } catch {}
          } else if (bt === 'cube_bouncy') {
            try {
              player.velocity.y = Math.max(player.velocity.y, 12);
            } catch {}
          } else if (bt === 'cube_ice') {
            try { player.linearDamping = 0.01; } catch {}
          } else if (bt === 'cube_slow') {
            try { player.linearDamping = 0.9; } catch {}
          } else if (bt === 'cube_sticky') {
            try { player.velocity.scale(0.3, player.velocity); } catch {}
          } else if (bt === 'cube_boost' || bt === 'cube_conveyor') {
            try {
              const forward = new THREE.Vector3();
              try { (cameraRef.current as any)?.getWorldDirection?.(forward); } catch {}
              if (!forward.lengthSq()) forward.set(0, 0, -1);
              forward.y = 0; forward.normalize();
              const strength = bt === 'cube_boost' ? 150 : 80;
              player.velocity.x += forward.x * (strength * 0.02);
              player.velocity.z += forward.z * (strength * 0.02);
            } catch {}
          }
        });
      } catch {}
    }

    // Cleanup
    return () => {
      if (rafIdRef.current) {
        try { cancelAnimationFrame(rafIdRef.current); } catch {}
        rafIdRef.current = null;
      }
      if (mountRef.current) {
        mountRef.current.removeEventListener('mousemove', handleMouseMove);
        mountRef.current.removeEventListener('mouseup', handleMouseUp);
        mountRef.current.removeEventListener('mousedown', handleMouseDown);
        mountRef.current.removeEventListener('click', handleClick);
        mountRef.current.removeEventListener('contextmenu', handleContextMenu);
        mountRef.current.removeEventListener('auxclick', handleAuxClick);
        
      }
      try { if (transformRef.current && sceneRef.current) { sceneRef.current.remove(transformRef.current); transformRef.current?.dispose?.(); transformRef.current = null; } } catch {}
      try { detachCamera(); } catch {}
      try { detachEditorInput?.(); } catch {}
      try { detachCollision?.(); } catch {}
      try { loop.stop(); } catch {}
      removeGhost();
      removeGridHelper();
      // ensure snap ring is cleaned
      try { if (snapRingRef.current && sceneRef.current) { sceneRef.current.remove(snapRingRef.current); } } catch {}
      try { engine.dispose(); } catch {}
    };
  }, [isPlayMode]);
  // Simple keyboard toggles for physics helpers (editor only)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPlayMode) return;
      if (e.key.toLowerCase() === 'r') {
        // quick ray test from camera forward
        try {
          const cam = cameraRef.current as THREE.PerspectiveCamera;
          if (!cam || !raycastClosest) return;
          const from = cam.position.clone();
          const dir = new THREE.Vector3();
          cam.getWorldDirection(dir);
          const to = from.clone().add(dir.multiplyScalar(50));
          const hit = raycastClosest(from, to);
          if (hit.hasHit) {
            // eslint-disable-next-line no-console
            console.log('Ray hit at', hit.point, 'normal', hit.normal, 'body', hit.body);
          }
        } catch {}
      } else if (e.key.toLowerCase() === 'p') {
        // pause/unpause physics by toggling time scale
        try {
          // store on window to persist between rebuilds
          const curr = (window as any).__scene_timeScale ?? 1;
          const next = curr === 0 ? 1 : 0;
          (window as any).__scene_timeScale = next;
        } catch {}
      } else if (e.key.toLowerCase() === 'o') {
        // slow-motion toggle
        try {
          const curr = (window as any).__scene_timeScale ?? 1;
          const next = curr === 0.25 ? 1 : 0.25;
          (window as any).__scene_timeScale = next;
        } catch {}
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlayMode, raycastClosest]);


  // Swap camera type without rebuilding scene
  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const currentPos = cameraRef.current?.position?.clone?.() || new THREE.Vector3(10, 10, 10);
    if (cameraMode === 'ortho') {
      const aspect = width / height;
      const frustumSize = 30;
      const ortho = new THREE.OrthographicCamera(
        (-frustumSize * aspect) / 2,
        (frustumSize * aspect) / 2,
        frustumSize / 2,
        -frustumSize / 2,
        -1000,
        1000
      );
      ortho.position.copy(currentPos);
      ortho.lookAt(0, 0, 0);
      cameraRef.current = ortho as any;
    } else {
      const persp = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      persp.position.copy(currentPos);
      persp.lookAt(0, 0, 0);
      cameraRef.current = persp as any;
    }
  }, [cameraMode]);

  // Handle dropped blocks from sidebar
  useEffect(() => {
    droppedBlockRef.current = droppedBlock as any;
    if (droppedBlock) {
      ghostRotationYRef.current = 0;
      createGhost((droppedBlock as any).type);
      // Set ghost color to mechanic default when applicable
      try {
        const c = getTypeDefaultColor((droppedBlock as any).type);
        if (ghostRef.current && typeof c === 'number') {
          const mat: any = ghostRef.current.material;
          mat?.color?.setHex?.(c);
        }
        try { if (ghostRef.current) ghostRef.current.rotation.y = 0; } catch {}
      } catch {}
    } else {
      removeGhost();
    }
  }, [droppedBlock]);

  // Grid rebuild handled internally by useGridSnapping

  // Keyboard shortcuts for Grid (G), Snap (X), Tools (Q/W), placement, nudge arrows, rotate [ ] , and utility
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPlayMode) return; // editor-only
      if (e.target && (e.target as HTMLElement).tagName && ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      const key = e.key.toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      // Rotate ghost (armed placement) before click
      if ((key === '[' || key === ']') && droppedBlockRef.current && ghostRef.current) {
        e.preventDefault();
        const step = e.shiftKey ? 45 : 15;
        const delta = key === ']' ? step : -step;
        const next = ((ghostRotationYRef.current + delta) % 360 + 360) % 360;
        ghostRotationYRef.current = next;
        try { ghostRef.current.rotation.y = THREE.MathUtils.degToRad(next); } catch {}
        return;
      }
      if (key === '1') { setBuilderCurrentType?.('cube'); return; }
      if (key === '2') { setBuilderCurrentType?.('sphere'); return; }
      if (key === 'q') { try { useProjectStore.getState().setSelectedTool('select'); } catch {} return; }
      if (key === 'w') { try { useProjectStore.getState().setSelectedTool('move'); } catch {} return; }
      if (key === 'b') { try { useProjectStore.getState().setSelectedTool('paint'); } catch {} return; }
      if (key === 'g') {
        e.preventDefault();
        setGridVisible(!gridVisible);
      } else if (key === 'x') {
        e.preventDefault();
        setSnapEnabled(!snapEnabled);
      } else if (ctrlOrMeta && key === 'd') {
        const id = (selectedBlockRef.current?.id || selectedBlockId);
        if (id) {
          e.preventDefault();
          try { duplicateBlock?.(id); } catch {}
        }
      } else if (key === '[' || key === ']') {
        // Rotate selected around Y
        const b = selectedBlockRef.current || (selectedBlockId ? blocksRef.current.find(x => x.id === selectedBlockId) || null : null);
        if (b) {
          e.preventDefault();
          const step = e.shiftKey ? 45 : 15;
          const delta = key === ']' ? step : -step;
          const currentDeg = (b as any).rotationY || 0;
          const nextDeg = ((currentDeg + delta) % 360 + 360) % 360;
          try {
            // apply immediately to physics/mesh for responsiveness
            const rad = THREE.MathUtils.degToRad(nextDeg);
            if (b.mesh) b.mesh.rotation.y = rad;
            if (b.body && (b.body as any).quaternion?.setFromEuler) (b.body as any).quaternion.setFromEuler(0, rad, 0);
          } catch {}
          try { setBlockRotationY?.(b.id, nextDeg); } catch {}
        }
      } else if (key === 'x' && e.altKey) {
        // Rotate around X (Alt+X / Alt+Shift+X for bigger step)
        const b = selectedBlockRef.current || (selectedBlockId ? blocksRef.current.find(x => x.id === selectedBlockId) || null : null);
        if (b) {
          e.preventDefault();
          const step = e.shiftKey ? 45 : 15;
          const current = (b as any).rotationX || 0;
          const next = ((current + step) % 360 + 360) % 360;
          try {
            const rx = THREE.MathUtils.degToRad(next);
            const y = THREE.MathUtils.degToRad((b as any).rotationY || 0);
            const z = THREE.MathUtils.degToRad((b as any).rotationZ || 0);
            if (b.mesh) b.mesh.rotation.set(rx, y, z);
            if (b.body && (b.body as any).quaternion?.setFromEuler) (b.body as any).quaternion.setFromEuler(rx, y, z);
          } catch {}
          try { setBlockRotationX?.(b.id, next); } catch {}
        }
      } else if (key === 'z' && e.altKey) {
        // Rotate around Z (Alt+Z / Alt+Shift+Z)
        const b = selectedBlockRef.current || (selectedBlockId ? blocksRef.current.find(x => x.id === selectedBlockId) || null : null);
        if (b) {
          e.preventDefault();
          const step = e.shiftKey ? 45 : 15;
          const current = (b as any).rotationZ || 0;
          const next = ((current + step) % 360 + 360) % 360;
          try {
            const x = THREE.MathUtils.degToRad((b as any).rotationX || 0);
            const y = THREE.MathUtils.degToRad((b as any).rotationY || 0);
            const rz = THREE.MathUtils.degToRad(next);
            if (b.mesh) b.mesh.rotation.set(x, y, rz);
            if (b.body && (b.body as any).quaternion?.setFromEuler) (b.body as any).quaternion.setFromEuler(x, y, rz);
          } catch {}
          try { setBlockRotationZ?.(b.id, next); } catch {}
        }
      } else if ((key === '+' || key === '=') || key === '-') {
        // Uniform scale +/- (uses Alt to avoid conflict? keep simple here)
        const b = selectedBlockRef.current || (selectedBlockId ? blocksRef.current.find(x => x.id === selectedBlockId) || null : null);
        if (b) {
          e.preventDefault();
          const current = (b as any).scale || 1;
          const step = e.shiftKey ? 0.25 : 0.1;
          const next = Math.max(0.1, Math.min(10, current + ((key === '-') ? -step : step)));
          try {
            if (b.mesh) b.mesh.scale.set(next, next, next);
            // Rebuild physics body shape is expensive; skip immediate physics scale to keep it simple
          } catch {}
          try { setBlockScale?.(b.id, next); } catch {}
        }
      } else if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'pageup', 'pagedown'].includes(e.key.toLowerCase())) {
        // Nudge movement
        const b = selectedBlockRef.current || (selectedBlockId ? blocksRef.current.find(x => x.id === selectedBlockId) || null : null);
        if (b && !b.locked) {
          e.preventDefault();
          const base = snapEnabledRef.current ? (snapSizeRef.current || 1) : 0.25;
          const step = e.shiftKey ? base * 5 : base;
          let dx = 0, dy = 0, dz = 0;
          if (key === 'arrowup') dz = -step;
          if (key === 'arrowdown') dz = step;
          if (key === 'arrowleft') dx = -step;
          if (key === 'arrowright') dx = step;
          if (key === 'pageup') dy = step;
          if (key === 'pagedown') dy = -step;
          try {
            const p = b.body ? (b.body.position as any) : new THREE.Vector3(b.position.x, b.position.y, b.position.z);
            const nx = p.x + dx;
            const ny = p.y + dy;
            const nz = p.z + dz;
            if (b.body) (b.body as any).position.set(nx, ny, nz);
            if (b.mesh) b.mesh.position.set(nx, ny, nz);
            setBlockPosition?.(b.id, { x: nx, y: ny, z: nz });
          } catch {}
        }
      } else if (key === 'f') {
        // Frame selected: move camera to frame the selected block
        const b = selectedBlockRef.current || (selectedBlockId ? blocksRef.current.find(x => x.id === selectedBlockId) || null : null);
        if (b && cameraRef.current) {
          e.preventDefault();
          const target = new THREE.Vector3(b.position.x, b.position.y, b.position.z);
          const r = Math.max(4, cameraDistanceRef.current);
          const offset = new THREE.Vector3(0, r * 0.6, r);
          cameraRef.current.position.copy(target.clone().add(offset));
          cameraRef.current.lookAt(target);
        }
      } else if (key === 'delete' || key === 'backspace') {
        const id = (selectedBlockRef.current?.id || selectedBlockId);
        if (id) {
          e.preventDefault();
          try { removeBlockFromStore?.(id); } catch {}
          // local outline cleanup
          if (selectedBlockRef.current && selectedBlockRef.current.id === id) {
            deselectBlock();
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gridVisible, snapEnabled, setGridVisible, setSnapEnabled, isPlayMode, selectedBlockId, removeBlockFromStore, duplicateBlock, setBuilderCurrentType]);

  // Handle loaded blocks
  useEffect(() => {
    if (loadedBlocks && loadedBlocks.length > 0) {
      loadScene(loadedBlocks);
    }
  }, [loadedBlocks]);

  const createInitialBlocks = () => {
    if (!sceneRef.current) return;

    // Add some sample blocks
    const positions = [
      { x: 0, y: 1, z: 0 },
      { x: 3, y: 1, z: 3 },
      { x: -3, y: 1, z: -3 },
    ];

    positions.forEach((pos, index) => {
      const type = index % 2 === 0 ? 'cube' : 'sphere';
      addBlock(type, new THREE.Vector3(pos.x, pos.y, pos.z));
    });
  };

  const addBlock = (
    type: any,
    position: THREE.Vector3,
    id?: string,
    rotationYDeg?: number,
    rotationXDeg?: number,
    rotationZDeg?: number,
    uniformScale?: number,
    colorOverride?: number,
  ) => {
    if (!sceneRef.current || !worldRef.current) return;
    if (type === 'start') {
      const hasStart = (blocksRef.current || []).some(b => b.type === 'start');
      if (hasStart) {
        try { console.warn('Only one Start block is allowed.'); } catch {}
        return;
      }
    }
    const usesTexture = ['cube_bouncy','cube_ice','cube_conveyor'].includes(type as any);
    const resolvedColor = (typeof colorOverride === 'number') ? colorOverride : (usesTexture ? undefined : builderColorRef.current);
    const block = createBlock(
      { type, position, id, rotationYDeg, rotationXDeg, rotationZDeg, uniformScale, color: resolvedColor },
      { scene: sceneRef.current, world: worldRef.current, dynamicMaterial: dynamicMaterialRef.current }
    ) as Block;
    try {
      const m: any = block.mesh;
      if (m && m.userData) {
        if (typeof m.userData.baseScale !== 'number') m.userData.baseScale = m.scale?.x ?? 1;
      }
    } catch {}
    blocksRef.current.push(block);
    onBlockAdd?.(block);
    onSceneStateChange?.(blocksRef.current);
  };

  const loadScene = (blocks: Block[]) => {
    if (!sceneRef.current) return;

    // Remove existing outline
    deselectBlock();

    // player handled by controller hook

    // Clear existing blocks
    blocksRef.current.forEach(block => {
      try { disposeRuntimeBlock(block, { scene: sceneRef.current!, world: worldRef.current! }); } catch {}
    });
    blocksRef.current = [];

    // Load new blocks
    blocks.forEach(blockData => {
      const position = new THREE.Vector3(
        blockData.position.x,
        blockData.position.y,
        blockData.position.z
      );
      addBlock(
        blockData.type as any,
        position,
        blockData.id,
        (blockData as any).rotationY,
        (blockData as any).rotationX,
        (blockData as any).rotationZ,
        (blockData as any).scale,
        (typeof (blockData as any).color === 'number' ? (blockData as any).color : undefined)
      );
      try {
        if (!spawnRef.current && (blockData as any).type === 'start') {
          spawnRef.current = new THREE.Vector3(position.x, position.y + 1, position.z);
          checkpointRef.current = spawnRef.current.clone();
        }
      } catch {}
    });
  };

  const clearScene = () => {
    if (!sceneRef.current) return;

    // Remove existing outline
    deselectBlock();

    // player handled by controller hook

    blocksRef.current.forEach(block => {
      try { disposeRuntimeBlock(block, { scene: sceneRef.current!, world: worldRef.current! }); } catch {}
    });
    blocksRef.current = [];
    onSceneStateChange?.(blocksRef.current);
  };

  const handleResize = () => {
    if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    if (cameraRef.current instanceof THREE.OrthographicCamera) {
      const aspect = width / height;
      const frustumSize = 30;
      cameraRef.current.left = (-frustumSize * aspect) / 2;
      cameraRef.current.right = (frustumSize * aspect) / 2;
      cameraRef.current.top = frustumSize / 2;
      cameraRef.current.bottom = -frustumSize / 2;
      cameraRef.current.updateProjectionMatrix();
    } else if (cameraRef.current instanceof THREE.PerspectiveCamera) {
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
    }
    rendererRef.current.setSize(width, height);
  };

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Expose methods for external control
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).scene3D = {
        clearScene,
        loadScene,
        getBlocks: () => blocksRef.current,
        getCameraPosition: () => (cameraRef.current ? (cameraRef.current as any).position.clone() : new THREE.Vector3()),
        getCameraType: () => (cameraRef.current instanceof THREE.OrthographicCamera ? 'ortho' : 'perspective'),
        getPlayerPosition: () => {
          try { return playerRef.current ? playerRef.current.body.position.clone() : null; } catch { return null; }
        },
        captureThumbnail: (opts?: { type?: 'image/png' | 'image/jpeg'; quality?: number }) => {
          try {
            if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return null;
            // Ensure a fresh frame
            rendererRef.current.render(sceneRef.current, cameraRef.current as any);
            const canvas = rendererRef.current.domElement as HTMLCanvasElement;
            const type = (opts?.type || 'image/jpeg') as any;
            const quality = typeof opts?.quality === 'number' ? opts.quality : 0.8;
            return canvas.toDataURL(type, quality);
          } catch { return null; }
        },
        // Helpers for editor actions
        alignSelectedToGrid: (size: number = (snapSizeRef.current || 1)) => {
          const b = selectedBlockRef.current;
          if (!b || !b.body) return;
          const s = size || 1;
          const p = b.body.position as any;
          const nx = Math.round(p.x / s) * s;
          const ny = Math.round(p.y / s) * s;
          const nz = Math.round(p.z / s) * s;
          try { b.body.position.set(nx, ny, nz); } catch {}
        },
        groundSelected: () => {
          const b = selectedBlockRef.current;
          if (!b || !b.body) return;
          const p = b.body.position as any;
          try { b.body.position.set(p.x, 0.5, p.z); } catch {}
        },
        setTransformMode: (mode: 'translate' | 'rotate' | 'scale') => {
          try {
            transformModeRef.current = mode;
            if (transformRef.current) {
              transformRef.current.setMode?.(mode);
              if (selectedBlockRef.current?.mesh) {
                transformRef.current.attach(selectedBlockRef.current.mesh);
                transformRef.current.visible = true;
              }
            }
          } catch {}
        },
        getTransformMode: () => transformModeRef.current,
      };
    }
  }, []);

  // Reflect external selection changes with outline
  useEffect(() => {
    if (!selectedBlockId) {
      deselectBlock();
      // Hide gizmo when nothing selected
      try { if (transformRef.current) { transformRef.current.detach(); transformRef.current.visible = false; } } catch {}
      return;
    }
    const found = blocksRef.current.find(b => b.id === selectedBlockId);
    if (found) selectBlock(found);
  }, [selectedBlockId]);

  // Attach/Update TransformControls when tool or selection changes
  useEffect(() => {
    try {
      const tr = transformRef.current as any;
      if (!tr) return;
      // Snapping settings
      if (snapEnabledRef.current) {
        tr.setTranslationSnap?.(snapSizeRef.current || 1);
        tr.setRotationSnap?.(THREE.MathUtils.degToRad(15));
        tr.setScaleSnap?.(0.1);
      } else {
        tr.setTranslationSnap?.(null);
        tr.setRotationSnap?.(null);
        tr.setScaleSnap?.(null);
      }

      if (selectedTool === 'move' && selectedBlockRef.current?.mesh) {
        tr.visible = true;
        tr.setMode?.(transformModeRef.current);
        tr.attach(selectedBlockRef.current.mesh);
      } else {
        tr.detach();
        tr.visible = false;
      }
    } catch {}
  }, [selectedTool, selectedBlockRef.current]);

  // block disposal handled by modules

  return (
    <div className="relative w-full h-full bg-gradient-bg">
      <div 
        ref={mountRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      />
      {/* Subtle CTA overlay when not playing */}
      {!isPlayMode && (
        <div className="pointer-events-none absolute left-4 bottom-4 bg-card/70 backdrop-blur-sm border border-border rounded-lg shadow-md p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-gradient-primary shadow-glow" />
          <div className="text-xs text-muted-foreground">
            <div className="text-foreground font-medium">Tip</div>
            <div>Wciśnij <span className="text-[hsl(var(--brand-play))]">Play</span>, aby przetestować świat.</div>
          </div>
        </div>
      )}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <div className="text-foreground font-medium">Loading 3D Scene...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(Scene3D);