import * as BABYLON from '@babylonjs/core';
import { SceneCore } from '../shared/SceneCore';
import { Renderer, RenderableBlock } from '../shared/Renderer';
import { EditPhysics } from './EditPhysics';
import { EditCamera } from './EditCamera';
import { getBlockDimensions } from '@/components/editor-enhanced/scene/physics/blockDimensions';
import type { Block } from '@/types';
import { useProjectStore } from '@/features/projects/stores';
import { useEditState } from './EditState';

export interface EditEngineConfig {
  canvas: HTMLCanvasElement;
  mount: HTMLElement;
  onBlockSelect?: (block: Block | null) => void;
  onBlockHover?: (block: Block | null) => void;
  getEditorState: () => ReturnType<typeof useProjectStore>;
  actions: {
    addBlock: (block: Block) => void;
  };
}

export class EditEngine {
  private sceneCore: SceneCore;
  private renderer: Renderer;
  private physics: EditPhysics;
  private camera: EditCamera;
  private blocks: RenderableBlock[] = [];
  private isRunning = false;
  private animationFrameId: number | null = null;
  
  // Edit mode specific features
  private gridHelper: BABYLON.Mesh | null = null;
  private terrainGround: BABYLON.Mesh | null = null;
  private gizmoManager: BABYLON.GizmoManager | null = null;
  private highlightLayer: BABYLON.HighlightLayer | null = null;
  private selectedBlock: RenderableBlock | null = null;
  private selectedBlocks: Set<RenderableBlock> = new Set();
  private selectionRoot: BABYLON.TransformNode | null = null;
  private lastRootPosition: BABYLON.Vector3 | null = null;
  private lastRootRotation: BABYLON.Quaternion | null = null;
  private lastRootScaling: BABYLON.Vector3 | null = null;
  private hoveredBlock: RenderableBlock | null = null;
  
  constructor(private config: EditEngineConfig) {
    // Initialize core scene
    this.sceneCore = new SceneCore({
      canvas: config.canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      stencil: true,
    });
    
    // Initialize renderer with edit-optimized settings
    this.renderer = new Renderer(this.sceneCore, {
      maxDistance: 500, // Longer view distance for building
      targetFps: 60,
      enableCulling: true,
      enableLOD: true,
    });
    
    // Initialize edit-specific physics (simplified)
    this.physics = new EditPhysics();
    
    // Initialize camera controller
    this.camera = new EditCamera(this.sceneCore.scene, config.mount);
    
    // Setup edit mode features
    this.setupEditFeatures();
    
    // Handle window resize
    window.addEventListener('resize', this.handleResize);
  }
  
  private setupEditFeatures(): void {
    // Create terrain ground first
    this.createTerrainGround();
    // Create grid helper
    this.createGridHelper();
    
    // Setup gizmo manager for object manipulation
    this.gizmoManager = new BABYLON.GizmoManager(this.sceneCore.scene);
    this.gizmoManager.positionGizmoEnabled = false;
    this.gizmoManager.rotationGizmoEnabled = false;
    this.gizmoManager.scaleGizmoEnabled = false;
    this.gizmoManager.boundingBoxGizmoEnabled = false;
    this.setupGizmoEvents();
    this.updateGizmoSnapping();
    
    // Setup highlight layer for selection/hover
    this.highlightLayer = new BABYLON.HighlightLayer(
      'highlightLayer',
      this.sceneCore.scene
    );
    this.highlightLayer.innerGlow = false;
    this.highlightLayer.outerGlow = true;
    
    // Setup picking
    this.setupPicking();
  }

  private createTerrainGround(): void {
    // Create an updatable ground mesh for terrain editing and placement
    const ground = BABYLON.MeshBuilder.CreateGround(
      'ground',
      { width: 200, height: 200, subdivisions: 200, updatable: true },
      this.sceneCore.scene
    );

    const groundMaterial = new BABYLON.PBRMaterial('groundMaterial', this.sceneCore.scene);
    groundMaterial.albedoColor = new BABYLON.Color3(0.29, 0.62, 0.29);
    groundMaterial.metallic = 0.0;
    groundMaterial.roughness = 0.9;
    groundMaterial.environmentIntensity = 0.7;
    groundMaterial.enableSpecularAntiAliasing = true;
    ;(groundMaterial as any).useVertexColors = true;
    ground.material = groundMaterial;
    ground.receiveShadows = true;
    ground.isPickable = true;
    ground.position.y = 0;

    this.terrainGround = ground;
  }
  
  private createGridHelper(): void {
    // Parameters
    const size = 200;
    const cellSize = 1; // 1m cells
    const majorEvery = 5; // thicker line every 5 cells

    // Create a simple plane for the grid overlay
    const grid = BABYLON.MeshBuilder.CreateGround(
      'grid',
      { width: size, height: size, subdivisions: 1 },
      this.sceneCore.scene
    );

    // Build a dynamic texture TILE (covers majorEvery x majorEvery cells) to be repeated across the plane
    const tileTexSize = 512;
    const dt = new BABYLON.DynamicTexture('gridTexture', { width: tileTexSize, height: tileTexSize }, this.sceneCore.scene, false, BABYLON.Texture.NEAREST_SAMPLINGMODE);
    dt.hasAlpha = true;
    const ctx = dt.getContext();
    if (ctx) {
      ctx.clearRect(0, 0, tileTexSize, tileTexSize);
      // Background remains transparent
      const cellsAcross = majorEvery; // draw a tile of majorEvery cells
      const step = tileTexSize / cellsAcross;
      const drawLine = (x: number, y: number, isMajor: boolean, vertical: boolean) => {
        ctx.beginPath();
        ctx.strokeStyle = isMajor ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)';
        ctx.lineWidth = isMajor ? 2 : 1;
        if (vertical) {
          ctx.moveTo(x + 0.5, 0);
          ctx.lineTo(x + 0.5, tileTexSize);
        } else {
          ctx.moveTo(0, y + 0.5);
          ctx.lineTo(tileTexSize, y + 0.5);
        }
        ctx.stroke();
      };
      // Vertical lines for the tile (including outer border)
      for (let i = 0; i <= cellsAcross; i++) {
        const x = Math.round(i * step);
        const isMajor = i % majorEvery === 0;
        drawLine(x, 0, isMajor, true);
      }
      // Horizontal lines for the tile (including outer border)
      for (let j = 0; j <= cellsAcross; j++) {
        const y = Math.round(j * step);
        const isMajor = j % majorEvery === 0;
        drawLine(0, y, isMajor, false);
      }
      dt.update(false);
    }

    const gridMaterial = new BABYLON.StandardMaterial('gridMaterial', this.sceneCore.scene);
    // Use emissiveTexture to avoid any lighting blur and keep lines crisp
    gridMaterial.emissiveTexture = dt;
    gridMaterial.opacityTexture = dt; // honor per-pixel alpha
    gridMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
    gridMaterial.disableLighting = true;
    gridMaterial.backFaceCulling = true;
    gridMaterial.specularColor = new BABYLON.Color3(0, 0, 0);

    // Repeat tile across the grid to minimize minification blur
    dt.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    dt.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    const tilesAcross = size / (cellSize * majorEvery);
    if (gridMaterial.emissiveTexture) {
      (gridMaterial.emissiveTexture as BABYLON.Texture).uScale = tilesAcross;
      (gridMaterial.emissiveTexture as BABYLON.Texture).vScale = tilesAcross;
    }

    grid.material = gridMaterial;
    grid.position.y = 0.01; // slightly above terrain to avoid z-fighting
    grid.isPickable = false; // do not block placement/picking
    grid.renderingGroupId = 2; // render on top

    this.gridHelper = grid;
  }
  
  private setupPicking(): void {
    this.sceneCore.scene.onPointerObservable.add((pointerInfo) => {
      switch (pointerInfo.type) {
        case BABYLON.PointerEventTypes.POINTERMOVE:
          this.handlePointerMove(pointerInfo);
          break;
        case BABYLON.PointerEventTypes.POINTERDOWN:
          // Only left button places blocks
          if ((pointerInfo.event as PointerEvent)?.button === 0) {
            this.handlePointerTap(pointerInfo);
          }
          break;
      }
    });
  }
  
  private handlePointerMove(pointerInfo: BABYLON.PointerInfo): void {
    const pickResult = pointerInfo.pickInfo;
    if (!pickResult || !pickResult.hit) {
      this.setHoveredBlock(null);
      return;
    }
    
    const mesh = pickResult.pickedMesh;
    if (!mesh) {
      this.setHoveredBlock(null);
      return;
    }
    
    // Find the block associated with this mesh
    const block = this.blocks.find(b => b.mesh === mesh);
    this.setHoveredBlock(block || null);
  }
  
  private handlePointerTap(pointerInfo: BABYLON.PointerInfo): void {
    const pickResult = pointerInfo.pickInfo;
    if (!pickResult || !pickResult.hit) {
      this.setSelectedBlock(null);
      this.clearMultiSelection();
      return;
    }

    const editorState = this.config.getEditorState();
    const uiState = useEditState.getState();

    // If we are in block placing mode (support both legacy and new tool states)
    const isPlaceMode = (uiState.currentTool === 'place') || (editorState.selectedTool === 'place');
    if (isPlaceMode && pickResult.pickedPoint) {
      const type = (uiState.currentBlockType || (editorState as any).builderCurrentType) as any;
      const dims = getBlockDimensions(type, 1);

      // Base position from pick
      const pos = pickResult.pickedPoint.clone();

      // If hit ground, place sitting on ground height. If hit a block, place adjacent using face normal
      if (this.terrainGround && pickResult.pickedMesh === this.terrainGround) {
        pos.y = pickResult.pickedPoint.y + dims.y / 2;
      } else {
        const hitRenderable = this.blocks.find(b => b.mesh === pickResult.pickedMesh);
        if (hitRenderable) {
          const hitScale = (hitRenderable.block.scale && typeof hitRenderable.block.scale === 'object')
            ? hitRenderable.block.scale
            : { x: Number(hitRenderable.block.scale || 1), y: Number(hitRenderable.block.scale || 1), z: Number(hitRenderable.block.scale || 1) };
          const hitDims = getBlockDimensions(hitRenderable.block.type as any, (hitScale as any).x || 1);

          // Try to get the face normal to determine which side was clicked
          let n: BABYLON.Vector3 | null = null;
          try { n = (pickResult as any).getNormal?.(true, true) || null; } catch {}
          if (n) {
            const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
            let axis: 'x' | 'y' | 'z' = 'y';
            if (ax >= ay && ax >= az) axis = 'x'; else if (az >= ax && az >= ay) axis = 'z';
            const sign = axis === 'x' ? Math.sign(n.x) : axis === 'y' ? Math.sign(n.y) : Math.sign(n.z);
            const offset = axis === 'x' ? (hitDims.x / 2 + dims.x / 2)
              : axis === 'y' ? (hitDims.y / 2 + dims.y / 2)
              : (hitDims.z / 2 + dims.z / 2);

            // Start from the center of the hit block and move along the major normal axis
            pos.copyFrom(new BABYLON.Vector3(
              hitRenderable.block.position.x,
              hitRenderable.block.position.y,
              hitRenderable.block.position.z
            ));
            if (axis === 'x') pos.x += offset * sign;
            if (axis === 'y') pos.y += offset * sign;
            if (axis === 'z') pos.z += offset * sign;

            // Keep lateral placements at the same height as the hit block center
            if (axis === 'x' || axis === 'z') {
              pos.y = hitRenderable.block.position.y;
            }
          } else {
            // Fallback: stack on top
            pos.y = hitRenderable.block.position.y + (hitDims.y / 2) + (dims.y / 2);
          }
        } else {
          pos.y = pickResult.pickedPoint.y + dims.y / 2;
        }
      }

      // Always snap to a 1-unit grid (no half tiles)
      pos.x = Math.round(pos.x);
      pos.y = Math.round(pos.y * 2) / 2; // allow 0.5 steps vertically so stacked heights remain correct
      pos.z = Math.round(pos.z);

      // Validate against existing block bodies to prevent overlap
      const canPlace = this.physics.checkPlacementCollision(
        { x: pos.x, y: pos.y, z: pos.z },
        { x: dims.x, y: dims.y, z: dims.z }
      );
      if (!canPlace) {
        try { console.warn('Cannot place block due to collision'); } catch {}
        return;
      }

      const newBlock: Block = {
        id: BABYLON.Tools.RandomId(),
        type: type,
        position: { x: pos.x, y: pos.y, z: pos.z },
        color: (editorState as any).builderCurrentColor ?? (uiState as any).currentBlockColor,
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      };

      // Update composite store (for saving, etc.)
      this.config.actions.addBlock(newBlock);
      // Update edit state so SceneManager sees the new block immediately
      try {
        const editStore = useEditState.getState();
        editStore.addBlock(newBlock);
      } catch {}
      return;
    }

    const mesh = pickResult.pickedMesh;
    if (!mesh) {
      this.setSelectedBlock(null);
      this.clearMultiSelection();
      return;
    }
    
    // Find the block associated with this mesh
    const block = this.blocks.find(b => b.mesh === mesh);
    const ev = (pointerInfo.event as PointerEvent | undefined);
    const isMultiKey = !!(ev && (ev.ctrlKey || ev.metaKey || ev.shiftKey));

    if (!block) {
      this.setSelectedBlock(null);
      this.clearMultiSelection();
      return;
    }

    if (isMultiKey) {
      // Toggle selection membership
      if (this.selectedBlocks.has(block)) {
        this.selectedBlocks.delete(block);
      } else {
        this.selectedBlocks.add(block);
      }
      // If after toggle there is exactly 1, also set selectedBlock for consistency
      if (this.selectedBlocks.size === 1) {
        const only = Array.from(this.selectedBlocks)[0];
        this.setSelectedBlock(only);
      } else {
        this.setSelectedBlock(null);
      }
      this.refreshHighlights();
      this.attachGizmoToSelection();
      // Update store multi-select ids
      try {
        const ids = Array.from(this.selectedBlocks).map(b => b.block.id);
        this.config.getEditorState().setSelectedBlockIds?.(ids);
      } catch {}
    } else {
      // Single selection
      this.clearMultiSelection();
      this.setSelectedBlock(block);
      try { this.config.getEditorState().setSelectedBlockId?.(block.block.id); } catch {}
    }
  }
  
  private setHoveredBlock(block: RenderableBlock | null): void {
    if (this.hoveredBlock === block) return;
    
    // Remove previous hover highlight
    if (this.hoveredBlock?.mesh && this.highlightLayer) {
      this.highlightLayer.removeMesh(this.hoveredBlock.mesh);
    }
    
    this.hoveredBlock = block;
    
    // Add hover highlight
    if (block?.mesh && this.highlightLayer) {
      this.highlightLayer.addMesh(block.mesh, new BABYLON.Color3(0.8, 0.8, 0.8));
    }
    
    // Callback
    this.config.onBlockHover?.(block?.block || null);
  }
  
  private setSelectedBlock(block: RenderableBlock | null): void {
    if (this.selectedBlock === block) return;
    
    // Remove previous selection
    if (this.selectedBlock?.mesh && this.highlightLayer) {
      this.highlightLayer.removeMesh(this.selectedBlock.mesh);
    }
    
    this.selectedBlock = block;
    
    // Add selection highlight
    if (block?.mesh && this.highlightLayer) {
      this.highlightLayer.addMesh(block.mesh, new BABYLON.Color3(1, 0.5, 0));
    }
    
    // Update gizmo for single selection
    if (this.gizmoManager && this.selectedBlocks.size === 0) {
      this.gizmoManager.attachToMesh(block?.mesh || null);
      this.updateGizmoSnapping();
    }
    
    // Callback
    this.config.onBlockSelect?.(block?.block || null);
  }
  
  public enableGizmo(type: 'position' | 'rotation' | 'scale' | 'bounding'): void {
    if (!this.gizmoManager) return;
    
    // Disable all gizmos first
    this.gizmoManager.positionGizmoEnabled = false;
    this.gizmoManager.rotationGizmoEnabled = false;
    this.gizmoManager.scaleGizmoEnabled = false;
    this.gizmoManager.boundingBoxGizmoEnabled = false;
    
    // Enable selected gizmo
    switch (type) {
      case 'position':
        this.gizmoManager.positionGizmoEnabled = true;
        break;
      case 'rotation':
        this.gizmoManager.rotationGizmoEnabled = true;
        break;
      case 'scale':
        this.gizmoManager.scaleGizmoEnabled = true;
        break;
      case 'bounding':
        this.gizmoManager.boundingBoxGizmoEnabled = true;
        break;
    }
    this.updateGizmoSnapping();
  }
  
  public disableAllGizmos(): void {
    if (!this.gizmoManager) return;
    this.gizmoManager.positionGizmoEnabled = false;
    this.gizmoManager.rotationGizmoEnabled = false;
    this.gizmoManager.scaleGizmoEnabled = false;
    this.gizmoManager.boundingBoxGizmoEnabled = false;
  }
  
  public toggleGrid(show: boolean): void {
    if (this.gridHelper) {
      this.gridHelper.setEnabled(show);
    }
  }
  
  public addBlock(block: RenderableBlock): void {
    this.blocks.push(block);
    this.renderer.addBlock(block);
    
    // Add physics body for placement validation
    if (block.body) {
      this.physics.addBody(block.body);
    }
  }
  
  public removeBlock(block: RenderableBlock): void {
    const index = this.blocks.indexOf(block);
    if (index > -1) {
      this.blocks.splice(index, 1);
      this.renderer.removeBlock(block);
      
      // Remove physics body
      if (block.body) {
        this.physics.removeBody(block.body);
      }
      
      // Clear selection if this block was selected
      if (this.selectedBlock === block) {
        this.setSelectedBlock(null);
      }
    }
  }
  
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Start renderer
    this.renderer.start();
    
    // Start edit loop
    this.startEditLoop();
    
    // In edit mode we do NOT freeze active meshes globally, but we can freeze materials of static helpers
    try {
      if (this.gridHelper && this.gridHelper.material && 'freeze' in this.gridHelper.material) {
        (this.gridHelper.material as any).freeze();
      }
    } catch {}
  }
  
  private startEditLoop(): void {
    const loop = () => {
      if (!this.isRunning) return;
      
      // Update physics (simplified, no continuous simulation)
      this.physics.update();
      
      // Update camera
      this.camera.update();
      
      // Periodically ensure gizmo snapping matches store settings
      try { this.updateGizmoSnapping(); } catch {}
      
      // Request next frame
      this.animationFrameId = requestAnimationFrame(loop);
    };
    
    loop();
  }
  
  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    
    // Stop renderer
    this.renderer.stop();
    
    // Cancel animation frame
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  private handleResize = (): void => {
    this.sceneCore.resize();
  };
  
  public dispose(): void {
    this.stop();
    
    // Clean up event listeners
    window.removeEventListener('resize', this.handleResize);
    
    // Dispose edit features
    this.gridHelper?.dispose();
    this.gizmoManager?.dispose();
    this.highlightLayer?.dispose();
    if (this.selectionRoot) {
      try { this.selectionRoot.dispose(); } catch {}
      this.selectionRoot = null;
    }
    
    // Dispose subsystems
    this.camera.dispose();
    this.physics.dispose();
    this.renderer.stop();
    
    // Dispose core
    this.sceneCore.dispose();
  }
  
  public getCamera(): EditCamera {
    return this.camera;
  }
  
  public getScene(): BABYLON.Scene {
    return this.sceneCore.scene;
  }
  
  public setRenderingQuality(quality: 'low' | 'medium' | 'high'): void {
    this.sceneCore.setRenderingQuality(quality);
  }

  // --- Multi-select helpers ---
  private clearMultiSelection(): void {
    if (this.selectedBlocks.size === 0) return;
    // Remove highlights
    if (this.highlightLayer) {
      for (const b of this.selectedBlocks) {
        if (b.mesh) this.highlightLayer.removeMesh(b.mesh);
      }
    }
    this.selectedBlocks.clear();
    // Detach selection root
    if (this.selectionRoot) {
      try { this.selectionRoot.dispose(); } catch {}
      this.selectionRoot = null;
    }
    // Update store
    try { this.config.getEditorState().setSelectedBlockIds?.([]); } catch {}
  }

  private refreshHighlights(): void {
    if (!this.highlightLayer) return;
    // Clear all highlights first
    try {
      // No direct clear API; remove individually
      for (const b of this.blocks) {
        if (b.mesh) this.highlightLayer.removeMesh(b.mesh);
      }
    } catch {}
    // Add highlights for selection
    for (const b of this.selectedBlocks) {
      if (b.mesh) this.highlightLayer.addMesh(b.mesh, new BABYLON.Color3(1, 0.5, 0));
    }
  }

  private attachGizmoToSelection(): void {
    if (!this.gizmoManager) return;
    if (this.selectedBlocks.size <= 1) {
      // Single selection will be handled elsewhere
      if (this.selectionRoot) {
        try { this.selectionRoot.dispose(); } catch {}
        this.selectionRoot = null;
      }
      return;
    }
    const scene = this.sceneCore.scene;
    // Compute center of selection
    let center = new BABYLON.Vector3(0, 0, 0);
    let count = 0;
    for (const b of this.selectedBlocks) {
      if (b.mesh) { center.addInPlace(b.mesh.getAbsolutePosition()); count++; }
    }
    if (count > 0) center.scaleInPlace(1 / count);

    // Create/position selection root
    if (!this.selectionRoot) {
      this.selectionRoot = new BABYLON.TransformNode('selectionRoot', scene);
    }
    this.selectionRoot.position.copyFrom(center);
    this.selectionRoot.rotationQuaternion = this.selectionRoot.rotationQuaternion || BABYLON.Quaternion.Identity();
    this.selectionRoot.scaling.copyFromFloats(1, 1, 1);

    // Attach gizmo to root
    this.gizmoManager.attachToMesh(this.selectionRoot as unknown as BABYLON.Mesh);
    this.updateGizmoSnapping();
  }

  private setupGizmoEvents(): void {
    if (!this.gizmoManager) return;
    const gm = this.gizmoManager;
    const onDragStart = () => {
      if (!gm.attachedMesh) return;
      const node = gm.attachedMesh as any;
      this.lastRootPosition = node.getAbsolutePosition ? node.getAbsolutePosition() : node.position.clone();
      this.lastRootRotation = node.rotationQuaternion ? node.rotationQuaternion.clone() : BABYLON.Quaternion.FromEulerVector(node.rotation || BABYLON.Vector3.Zero());
      this.lastRootScaling = node.scaling ? node.scaling.clone() : new BABYLON.Vector3(1, 1, 1);
    };
    const onDrag = () => {
      if (!gm.attachedMesh) return;
      if (!this.selectionRoot || this.selectedBlocks.size <= 1) return; // only group
      const root = gm.attachedMesh as any;
      const currentPos = root.getAbsolutePosition ? root.getAbsolutePosition() : root.position.clone();
      const currentRot = root.rotationQuaternion ? root.rotationQuaternion.clone() : BABYLON.Quaternion.FromEulerVector(root.rotation || BABYLON.Vector3.Zero());
      const currentScl = root.scaling ? root.scaling.clone() : new BABYLON.Vector3(1, 1, 1);
      if (!this.lastRootPosition || !this.lastRootRotation || !this.lastRootScaling) return;

      // Position delta
      const deltaPos = currentPos.subtract(this.lastRootPosition);
      // Rotation delta
      const invPrev = this.lastRootRotation.clone(); invPrev.invert();
      const deltaRot = currentRot.multiply(invPrev);
      // Scale ratio
      const scaleRatio = new BABYLON.Vector3(
        currentScl.x / (this.lastRootScaling.x || 1),
        currentScl.y / (this.lastRootScaling.y || 1),
        currentScl.z / (this.lastRootScaling.z || 1),
      );

      // Apply to each selected mesh
      for (const sel of this.selectedBlocks) {
        if (!sel.mesh) continue;
        // translate
        sel.mesh.position.addInPlace(deltaPos);
        // rotate around root center
        const offset = sel.mesh.position.subtract(currentPos);
        const rotated = offset.clone();
        rotated.rotateByQuaternionToRef(deltaRot, rotated);
        sel.mesh.position = currentPos.add(rotated);
        // scale relative to root
        const rel = sel.mesh.position.subtract(currentPos);
        rel.x *= scaleRatio.x; rel.y *= scaleRatio.y; rel.z *= scaleRatio.z;
        sel.mesh.position = currentPos.add(rel);
        // update mesh scaling (uniform average)
        sel.mesh.scaling.multiplyInPlace(new BABYLON.Vector3(
          (scaleRatio.x + scaleRatio.y + scaleRatio.z) / 3,
          (scaleRatio.x + scaleRatio.y + scaleRatio.z) / 3,
          (scaleRatio.x + scaleRatio.y + scaleRatio.z) / 3,
        ));
      }

      // Update last reference for incremental application
      this.lastRootPosition = currentPos;
      this.lastRootRotation = currentRot;
      this.lastRootScaling = currentScl;
    };
    const onDragEnd = () => {
      // Commit transforms to store
      const store = this.config.getEditorState();
      if (this.selectedBlocks.size > 1) {
        for (const sel of this.selectedBlocks) {
          if (!sel.mesh) continue;
          try {
            store.setBlockPosition?.(sel.block.id, { x: sel.mesh.position.x, y: sel.mesh.position.y, z: sel.mesh.position.z });
          } catch {}
          try {
            const rot = sel.mesh.rotationQuaternion ? sel.mesh.rotationQuaternion.toEulerAngles() : sel.mesh.rotation;
            store.setBlockRotationX?.(sel.block.id, rot.x);
            store.setBlockRotationY?.(sel.block.id, rot.y);
            store.setBlockRotationZ?.(sel.block.id, rot.z);
          } catch {}
          try {
            // Use X as uniform for simplicity
            store.setBlockScale?.(sel.block.id, sel.mesh.scaling.x);
          } catch {}
        }
      } else if (this.selectedBlock?.mesh) {
        const m = this.selectedBlock.mesh;
        try {
          store.setBlockPosition?.(this.selectedBlock.block.id, { x: m.position.x, y: m.position.y, z: m.position.z });
        } catch {}
        try {
          const rot = m.rotationQuaternion ? m.rotationQuaternion.toEulerAngles() : m.rotation;
          store.setBlockRotationX?.(this.selectedBlock.block.id, rot.x);
          store.setBlockRotationY?.(this.selectedBlock.block.id, rot.y);
          store.setBlockRotationZ?.(this.selectedBlock.block.id, rot.z);
        } catch {}
        try {
          store.setBlockScale?.(this.selectedBlock.block.id, m.scaling.x);
        } catch {}
      }
    };

    // Attach to all gizmos present
    try { gm.gizmos.positionGizmo?.onDragStartObservable.add(onDragStart); } catch {}
    try { gm.gizmos.rotationGizmo?.onDragStartObservable.add(onDragStart); } catch {}
    try { gm.gizmos.scaleGizmo?.onDragStartObservable.add(onDragStart); } catch {}

    try { gm.gizmos.positionGizmo?.onDragObservable.add(onDrag); } catch {}
    try { gm.gizmos.rotationGizmo?.onDragObservable.add(onDrag); } catch {}
    try { gm.gizmos.scaleGizmo?.onDragObservable.add(onDrag); } catch {}

    try { gm.gizmos.positionGizmo?.onDragEndObservable.add(onDragEnd); } catch {}
    try { gm.gizmos.rotationGizmo?.onDragEndObservable.add(onDragEnd); } catch {}
    try { gm.gizmos.scaleGizmo?.onDragEndObservable.add(onDragEnd); } catch {}
  }

  private updateGizmoSnapping(): void {
    if (!this.gizmoManager) return;
    const state = this.config.getEditorState();
    const enabled = !!state.snapEnabled;
    const step = Math.max(0.001, Number(state.snapSize || 1));
    const angleStep = Math.PI / 12; // 15 degrees
    try {
      if (this.gizmoManager.gizmos.positionGizmo) {
        this.gizmoManager.gizmos.positionGizmo.snapDistance = enabled ? step : 0;
      }
    } catch {}
    try {
      if (this.gizmoManager.gizmos.rotationGizmo) {
        this.gizmoManager.gizmos.rotationGizmo.snapDistance = enabled ? angleStep : 0;
      }
    } catch {}
    try {
      if (this.gizmoManager.gizmos.scaleGizmo) {
        this.gizmoManager.gizmos.scaleGizmo.snapDistance = enabled ? step : 0;
      }
    } catch {}
  }
}
