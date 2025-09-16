import { useEffect, useRef, useState, useMemo, MutableRefObject } from 'react';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import * as BABYLON from '@babylonjs/core';
import { THREE } from './compatibility/three-babylon-compat';
import { createSceneEngine } from './engine/SceneEngine';
import { useGridSnapping } from './useGridSnapping';
import { useSelectionAndDragging } from './useSelectionAndDragging';
import { useGhostPreview } from './useGhostPreview';
import { usePlayerController } from './usePlayerController';
import { useTerrainEditor } from './useTerrainEditor';
import { startEngineLoop } from './engine/loop';
import { createBlock } from './blocks/createBlock';
import { BlockPool } from './blocks/blockPool';
import { createPlacementHandlers } from './blockPlacementHandlers';
import { disposeMesh, disposeScene, disposeRenderer, safeRemoveObject } from './utils';
import { disposeTextureCache } from './blocks/createBlock';
import MemoryDebugPanel from './MemoryDebugPanel';
import { PhysicsProvider, usePhysicsContext } from './PhysicsProvider';
import { CameraController } from './CameraController';
import { InputHandler } from './InputHandler';
import type { Block, Scene3DProps, CameraMode } from './types';
import type { BlockCollisionEvent } from './physics/types';
import type { QualityMode } from './engine/SceneEngine';
import { useProjectStore } from '@/lib/projectStore';
import { ThinInstanceManager } from './blocks/ThinInstanceManager';
import { 
  getBlockHeight, 
  checkBlockCollision, 
  calculateBlockPosition,
  alignToGrid,
  groundPosition 
} from './sceneHelpers';

interface SceneCanvasProps extends Scene3DProps {
  qualityMode?: QualityMode;
}

const SceneCanvasInner = ({
  onBlockAdd,
  droppedBlock,
  onSceneStateChange,
  loadedBlocks,
  selectedTool = 'select',
  isPlayMode = false,
  terrainMode = 'flat',
  cameraMode = 'orbit',
  onGameStart,
  onGameCheckpoint,
  onGameFinish,
  onGameHazard,
  qualityMode = 'balanced'
}: SceneCanvasProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const physics = usePhysicsContext();

  // Project store integration (composite store returns full state)
  const {
    gridVisible,
    snapEnabled,
    snapSize,
    builderCurrentColor,
    terrainBrushMode,
    terrainBrushSize,
    terrainBrushStrength,
    terrainBrushColor,
    setSelectedBlockId,
    setBlockPosition,
    setLastUsedColorForType,
  } = useProjectStore();

  // Group related refs for better organization
  const sceneRefs = useRef({
    scene: null as BABYLON.Scene | null,
    renderer: null as any | null,
    ground: null as BABYLON.Mesh | null
  });

  const cameraRefs = useRef({
    camera: null as BABYLON.Camera | null,
    mode: cameraMode,
    distance: 12,
    tempSpherical: new THREE.Spherical(),
    tempNdc: new THREE.Vector2()
  });

  const interactionRefs = useRef({
    raycaster: new THREE.Raycaster(),
    selectedBlockIds: null as string[] | null,
    isDragActive: false
  });

  // Dedicated refs to satisfy handler prop types
  const selectedBlockIdsRef = useRef<string[] | null>(null);
  const blocksRef = useRef<Block[]>([]);
  const tempNdcRef = useRef(cameraRefs.current.tempNdc);
  const snapEnabledRef = useRef<boolean>(snapEnabled);
  const snapSizeRef = useRef<number>(snapSize);

  const stateRefs = useRef({
    blocks: [] as Block[],
    snapEnabled: snapEnabled,
    snapSize: snapSize,
    color: builderCurrentColor
  });

  // Internal state
  const [isLoading, setIsLoading] = useState(true);
  const [engine, setEngine] = useState<{ scene: BABYLON.Scene; camera: BABYLON.Camera; renderer: any; engine: BABYLON.Engine; dispose: () => void } | null>(null);
  const [terrainVersion, setTerrainVersion] = useState(0);

  // Advanced hooks
  const gridSnapping = useGridSnapping({ 
    sceneRef: { current: sceneRefs.current.scene }, 
    gridVisible: gridVisible && !isPlayMode, 
    snapSize 
  });
  
  const selectionAndDragging = useSelectionAndDragging({ 
    sceneRef: { current: sceneRefs.current.scene }, 
    cameraRef: { current: cameraRefs.current.camera }, 
    raycasterRef: { current: interactionRefs.current.raycaster }, 
    snapEnabledRef: { current: stateRefs.current.snapEnabled }, 
    snapSizeRef: { current: stateRefs.current.snapSize }, 
    setSelectedBlockId 
  });
  
  const ghostPreview = useGhostPreview({ 
    sceneRef: { current: sceneRefs.current.scene }, 
    colorRef: { current: stateRefs.current.color } 
  });
  
  const playerController = usePlayerController({
    isPlayMode,
    mountRef,
    worldRef: physics.worldRef,
    sceneRef: { current: sceneRefs.current.scene },
    cameraRef: { current: cameraRefs.current.camera },
    dynamicMaterialRef: physics.dynamicMaterialRef
  });

  const terrainEditor = useTerrainEditor({
    sceneRef: { current: sceneRefs.current.scene },
    groundRef: { current: sceneRefs.current.ground },
    rebuildGroundBodyFromMesh: physics.rebuildGroundBodyFromMesh
  });

  // Update refs when props change
  useEffect(() => { 
    stateRefs.current.snapEnabled = snapEnabled;
    stateRefs.current.snapSize = snapSize;
    stateRefs.current.color = builderCurrentColor;
    cameraRefs.current.mode = cameraMode;
    // keep simple refs in sync
    snapEnabledRef.current = snapEnabled;
    snapSizeRef.current = snapSize;
    selectedBlockIdsRef.current = interactionRefs.current.selectedBlockIds;
    blocksRef.current = stateRefs.current.blocks;
  }, [snapEnabled, snapSize, builderCurrentColor, cameraMode]);

  // Initialize scene engine and set up initial state
  useEffect(() => {
    if (!mountRef.current) return;

    // Reduce Babylon info logs globally for editor/game scene (keep warn/error)
    try {
      BABYLON.Logger.LogLevels = BABYLON.Logger.WarningLogLevel | BABYLON.Logger.ErrorLogLevel;
    } catch {}

    const sceneEngine = createSceneEngine({
      mount: mountRef.current,
      cameraMode: cameraRefs.current.mode,
      qualityMode: qualityMode,
      autoStartRenderLoop: false
    });

    sceneRefs.current.scene = sceneEngine.scene;
    sceneRefs.current.renderer = sceneEngine.renderer;
    cameraRefs.current.camera = sceneEngine.camera;
    setEngine(sceneEngine);

    // Wire ThinInstanceManager to the scene (for massive instancing use-cases)
    try {
      const tim = ThinInstanceManager.getInstance();
      tim.setScene(sceneEngine.scene);
      // Expose globally for loop to update without import cycles
      (window as any).__thinInstanceManager = tim;
    } catch {}

    // Create ground with physics
    const { ground } = physics.createGround(sceneEngine.scene);
    sceneRefs.current.ground = ground;

    // Add some initial demo blocks if no loaded blocks
    if (!loadedBlocks || loadedBlocks.length === 0) {
      createInitialBlocks();
    }

    setIsLoading(false);

    return () => {
      // Clear all blocks first
      clearScene();
      
      // Dispose scene contents
      if (sceneRefs.current.scene) {
        disposeScene(sceneRefs.current.scene);
      }
      
      // Dispose renderer properly
      if (sceneRefs.current.renderer) {
        disposeRenderer(sceneRefs.current.renderer);
      }
      
      // Dispose texture cache when component unmounts
      disposeTextureCache();

      // Dispose ThinInstanceManager resources
      try { ThinInstanceManager.getInstance().dispose(); } catch {}
      
      // Call original engine dispose
      sceneEngine.dispose();
      
      // Clear refs
      sceneRefs.current.scene = null;
      sceneRefs.current.renderer = null;
      sceneRefs.current.ground = null;
      cameraRefs.current.camera = null;
      
      setEngine(null);
    };
  }, [qualityMode]);

  // Animation loop
  useEffect(() => {
    if (!engine || !physics.worldRef.current) return;

    const loop = startEngineLoop({
      worldRef: physics.worldRef,
      emitCollisionEvents: () => physics.emitCollisionEvents(),
      isPlayMode,
      cameraModeRef: { current: cameraRefs.current.mode },
      updatePlayer: playerController.update,
      blocksRef: { current: stateRefs.current.blocks },
      cameraRef: { current: cameraRefs.current.camera },
      renderer: engine.renderer,
      scene: engine.scene
    });

    return loop.stop;
  }, [engine, isPlayMode]);

  // Handle dropped blocks from sidebar
  useEffect(() => {
    if (!droppedBlock || !sceneRefs.current.scene || !physics.worldRef.current) return;

    ghostPreview.createGhost(droppedBlock.type);
    
    const handlers = createPlacementHandlers({
      mountRef,
      cameraRefs,
      interactionRefs,
      sceneRefs,
      stateRefs,
      droppedBlock,
      ghostPreview,
      addBlock,
      onSceneStateChange
    });

    mountRef.current?.addEventListener('click', handlers.handleClick);
    mountRef.current?.addEventListener('contextmenu', handlers.handleRightClick);
    mountRef.current?.addEventListener('mousemove', handlers.handleMouseMove);
    window.addEventListener('keydown', handlers.handleKeyDown);

    return () => {
      mountRef.current?.removeEventListener('click', handlers.handleClick);
      mountRef.current?.removeEventListener('contextmenu', handlers.handleRightClick);
      mountRef.current?.removeEventListener('mousemove', handlers.handleMouseMove);
      window.removeEventListener('keydown', handlers.handleKeyDown);
      ghostPreview.removeGhost();
      // Cleanup enhanced placement system
      if (handlers.cleanup) {
        handlers.cleanup();
      }
      // Clear droppedBlock on cleanup
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('blockPlacementCancelled'));
      }
    };
  }, [droppedBlock]);

  // Load blocks when provided
  useEffect(() => {
    if (loadedBlocks && loadedBlocks.length > 0) {
      loadScene(loadedBlocks);
    }
  }, [loadedBlocks]);

  // Collision event handlers for gameplay
  useEffect(() => {
    if (!isPlayMode) return;

    const cleanup = physics.addCollisionListener((event: BlockCollisionEvent) => {
      const { bodyA, bodyB, phase } = event;
      if (phase !== 'begin') return;

      const playerBody = (bodyA as any).userData?.isPlayer ? bodyA : ((bodyB as any).userData?.isPlayer ? bodyB : null);
      const blockBody = playerBody === bodyA ? bodyB : bodyA;

      if (!playerBody || !(blockBody as any).userData?.blockType) return;

      const blockType = (blockBody as any).userData.blockType;
      const position = { x: blockBody.position.x, y: blockBody.position.y, z: blockBody.position.z };

      switch (blockType) {
        case 'start':
          onGameStart?.(position);
          break;
        case 'checkpoint':
          onGameCheckpoint?.(position);
          break;
        case 'finish':
          onGameFinish?.(position);
          break;
        case 'hazard':
          onGameHazard?.(position);
          break;
      }
    });

    return cleanup;
  }, [isPlayMode, onGameStart, onGameCheckpoint, onGameFinish, onGameHazard]);

  // Helper functions
  const createInitialBlocks = () => {
    if (!sceneRefs.current.scene || !physics.worldRef.current) return;

    const positions = [
      { type: 'cube' as const, pos: new THREE.Vector3(0, 1, 0), color: 0x4f46e5 },
      { type: 'cube_bouncy' as const, pos: new THREE.Vector3(3, 1, 3) },
      { type: 'sphere' as const, pos: new THREE.Vector3(-3, 1, -3), color: 0xe11d48 },
    ];

    positions.forEach(({ type, pos, color }) => {
      const block = createBlock(
        {
          type,
          position: pos,
          color,
        },
        {
          scene: sceneRefs.current.scene!,
          world: physics.worldRef.current,
          dynamicMaterial: physics.dynamicMaterialRef.current
        }
      );
      stateRefs.current.blocks.push(block);
    });

    onSceneStateChange?.(stateRefs.current.blocks);
  };

  const addBlock = (type: Block['type'], position: BABYLON.Vector3, options: { id?: string; color?: number; rotationY?: number; rotationX?: number; rotationZ?: number; scale?: number } = {}) => {
    if (!sceneRefs.current.scene || !physics.worldRef.current) return;

    const pool = BlockPool.getInstance();
    const pooled = pool.acquire(type as any, { scene: sceneRefs.current.scene, world: physics.worldRef.current }, () => {
      const created = createBlock(
        {
          type,
          position,
          id: options.id,
          color: options.color ?? builderCurrentColor,
          rotationYDeg: options.rotationY,
          rotationXDeg: options.rotationX,
          rotationZDeg: options.rotationZ,
          uniformScale: options.scale
        },
        {
          scene: sceneRefs.current.scene!,
          world: physics.worldRef.current!,
          dynamicMaterial: physics.dynamicMaterialRef.current
        }
      );
      return { mesh: created.mesh!, body: created.body! };
    });

    if (pooled.mesh && pooled.body) {
      pooled.mesh.position.copyFrom(position);
      pooled.mesh.rotation = new BABYLON.Vector3(
        THREE.MathUtils.degToRad(options.rotationX ?? 0),
        THREE.MathUtils.degToRad(options.rotationY ?? 0),
        THREE.MathUtils.degToRad(options.rotationZ ?? 0)
      );
      const s = typeof options.scale === 'number' ? options.scale : 1;
      pooled.mesh.scaling.setAll(s);
      try { pooled.body.position.set(position.x, position.y, position.z); } catch {}
    }

    const existingId = (pooled.mesh.metadata as any)?.blockId;
    const block = existingId ? 
      (stateRefs.current.blocks.find(b => b.id === existingId) ?? 
       createBlock({ type, position }, { scene: sceneRefs.current.scene!, world: physics.worldRef.current!, dynamicMaterial: physics.dynamicMaterialRef.current })) : 
      createBlock({ type, position }, { scene: sceneRefs.current.scene!, world: physics.worldRef.current!, dynamicMaterial: physics.dynamicMaterialRef.current });

    stateRefs.current.blocks.push(block);
    blocksRef.current = stateRefs.current.blocks;

    // Persist last-used color for this block type when placing interactively
    const usedColor = typeof (options.color ?? builderCurrentColor) === 'number' ? (options.color ?? builderCurrentColor) : undefined;
    if (droppedBlock && typeof usedColor === 'number') {
      try {
        setLastUsedColorForType(type as any, usedColor);
      } catch {}
    }
    
    onBlockAdd?.(block);
    onSceneStateChange?.(stateRefs.current.blocks);
  };

  const loadScene = (blocks: Block[]) => {
    if (!sceneRefs.current.scene || !physics.worldRef.current) return;

    clearScene();

    blocks.forEach(blockData => {
      addBlock(blockData.type, new THREE.Vector3(blockData.position.x, blockData.position.y, blockData.position.z), {
        id: blockData.id,
        color: blockData.color,
        rotationY: blockData.rotationY,
        rotationX: blockData.rotationX,
        rotationZ: blockData.rotationZ,
        scale: blockData.scale
      });
    });
  };

  const clearScene = () => {
    if (!sceneRefs.current.scene) return;

    stateRefs.current.blocks.forEach(block => {
      try {
        const pool = BlockPool.getInstance();
        if (block.mesh && block.body) {
          pool.release(block.type as any, { mesh: block.mesh, body: block.body }, { scene: sceneRefs.current.scene!, world: physics.worldRef.current });
        } else if (block.mesh) {
          disposeMesh(block.mesh, sceneRefs.current.scene!);
        }
      } catch (error) {
        console.warn('Error releasing block to pool:', error);
      }
    });

    stateRefs.current.blocks = [];
    blocksRef.current = stateRefs.current.blocks;
    onSceneStateChange?.(stateRefs.current.blocks);
  };

  // Terrain methods
  const captureThumbnail = (options: { type?: string; quality?: number } = {}) => {
    if (!sceneRefs.current.renderer || !sceneRefs.current.scene || !cameraRefs.current.camera) return '';
    
    try {
      const originalSize = sceneRefs.current.renderer.getSize(new THREE.Vector2());
      const thumbnailSize = 256;
      
      sceneRefs.current.renderer.setSize(thumbnailSize, thumbnailSize, false);
      sceneRefs.current.renderer.render(sceneRefs.current.scene, cameraRefs.current.camera);
      
      const canvas = sceneRefs.current.renderer.domElement;
      const dataURL = canvas.toDataURL(options.type || 'image/jpeg', options.quality || 0.8);
      
      sceneRefs.current.renderer.setSize(originalSize.x, originalSize.y, false);
      
      return dataURL;
    } catch {
      return '';
    }
  };

  const alignSelectedToGrid = () => {
    const selected = selectionAndDragging.selectedBlockRef.current;
    if (!selected || !selected.body) return;

    const aligned = alignToGrid(selected.body.position, stateRefs.current.snapSize);
    selected.body.position.set(aligned.x, aligned.y, aligned.z);
    setBlockPosition(selected.id, aligned);
  };

  const groundSelected = () => {
    const selected = selectionAndDragging.selectedBlockRef.current;
    if (!selected || !selected.body) return;

    const grounded = groundPosition(selected.body.position);
    selected.body.position.set(grounded.x, grounded.y, grounded.z);
    setBlockPosition(selected.id, grounded);
  };

  // Expose methods for external control
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).scene3D = {
        clearScene,
        loadScene: (blocks: Block[]) => loadScene(blocks),
        getBlocks: () => stateRefs.current.blocks,
        getGround: () => sceneRefs.current.ground,
        getScene: () => sceneRefs.current.scene,
        rebuildGroundPhysics: () => physics.rebuildGroundBodyFromMesh(sceneRefs.current.ground),
        setGround: (ground: BABYLON.Mesh) => { sceneRefs.current.ground = ground; setTerrainVersion(v => v + 1); },
        getCameraPosition: () => cameraRefs.current.camera ? { 
          x: cameraRefs.current.camera.position.x, 
          y: cameraRefs.current.camera.position.y, 
          z: cameraRefs.current.camera.position.z 
        } : { x: 0, y: 0, z: 0 },
        captureThumbnail,
        alignSelectedToGrid,
        groundSelected
      };
    }
  }, []);

  return (
    <>
      <div 
        ref={mountRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing"
        data-scene-container
        style={{ touchAction: 'none' }}
      />
      
      {/* Camera Controller */}
      <CameraController
        mountRef={mountRef}
        camera={cameraRefs.current.camera}
        cameraMode={cameraRefs.current.mode}
        isPlayMode={isPlayMode}
        cameraDistance={cameraRefs.current.distance}
        onDragActiveChange={(active) => { interactionRefs.current.isDragActive = active; }}
        isBlockDraggingRef={selectionAndDragging.isDraggingRef}
      />

      {/* Input Handler */}
      <InputHandler
        mountRef={mountRef}
        isPlayMode={isPlayMode}
        camera={cameraRefs.current.camera}
        scene={sceneRefs.current.scene}
        ground={sceneRefs.current.ground}
        selectedTool={selectedTool}
        terrainBrushMode={terrainBrushMode}
        terrainBrushSize={terrainBrushSize}
        terrainBrushStrength={terrainBrushStrength}
        terrainBrushColor={terrainBrushColor}
        
        raycaster={interactionRefs.current.raycaster}
        isDraggingRef={selectionAndDragging.isDraggingRef}
        selectedBlockIdsRef={selectedBlockIdsRef}
        blocksRef={blocksRef}
        tempNdc={tempNdcRef.current}
        snapEnabledRef={snapEnabledRef}
        snapSizeRef={snapSizeRef}
        
        selectedBlockRef={selectionAndDragging.selectedBlockRef}
        startDragging={selectionAndDragging.startDragging}
        dragTo={selectionAndDragging.dragTo}
        stopDragging={selectionAndDragging.stopDragging}
        selectBlock={selectionAndDragging.selectBlock}
        deselectBlock={selectionAndDragging.deselectBlock}
        
        ensureSnapRing={gridSnapping.ensureSnapRing}
        snapRingRef={gridSnapping.snapRingRef}
        updateBrushRing={gridSnapping.updateBrushRing}
        removeBrushRing={gridSnapping.removeBrushRing}
        
        applyTerrainBrush={(point) => {
          terrainEditor.tryApplyBrushThrottled(
            point,
            terrainBrushMode,
            terrainBrushSize,
            terrainBrushStrength,
            terrainBrushColor
          );
        }}
      />
      
      {isLoading && (
        <LoadingOverlay message="Inicjalizacja silnika 3D..." />
      )}

      {/* Memory Debug Panel (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 right-4 z-10">
          <MemoryDebugPanel visible={true} />
        </div>
      )}
    </>
  );
};

// Main wrapper component with PhysicsProvider
export const SceneCanvas = (props: SceneCanvasProps) => {
  return (
    <PhysicsProvider terrainMode={props.terrainMode}>
      <SceneCanvasInner {...props} />
    </PhysicsProvider>
  );
};
