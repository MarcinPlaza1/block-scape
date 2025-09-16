import * as BABYLON from '@babylonjs/core';
import { Block } from '../types';
import { PlacementAnimationManager } from './placementAnimation';
import { getBlockMetadata } from './blockCategories';

export interface PlacementMode {
  type: 'single' | 'line' | 'fill' | 'wall' | 'circle' | 'copy';
  settings: {
    spacing?: number;
    fillHeight?: number;
    radius?: number;
    count?: number;
  };
}

export interface PlacementState {
  // Current block being placed
  blockType: Block['type'];
  rotation: BABYLON.Vector3;
  scale: number;
  color?: number;
  
  // Placement mode
  mode: PlacementMode;
  
  // Multi-placement tracking
  startPoint?: BABYLON.Vector3;
  endPoint?: BABYLON.Vector3;
  previewBlocks: BABYLON.Mesh[];
  
  // Advanced features
  rotationStep: number; // Degrees per rotation step
  scaleStep: number; // Scale increment
  alignToSurface: boolean;
  randomRotation: boolean;
  randomScale: { enabled: boolean; min: number; max: number };
}

export class EnhancedPlacementSystem {
  private scene: BABYLON.Scene;
  private state: PlacementState;
  private previewMaterial: BABYLON.StandardMaterial;
  private gridHelper: BABYLON.Mesh | null = null;
  private rotationGizmo: BABYLON.RotationGizmo | null = null;
  private animationManager: PlacementAnimationManager;
  
  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.animationManager = PlacementAnimationManager.getInstance();
    this.animationManager.setScene(scene);
    
    // Initialize state
    this.state = {
      blockType: 'cube',
      rotation: BABYLON.Vector3.Zero(),
      scale: 1,
      mode: { type: 'single', settings: {} },
      previewBlocks: [],
      rotationStep: 15, // 15 degree increments like Minecraft
      scaleStep: 0.1,
      alignToSurface: false,
      randomRotation: false,
      randomScale: { enabled: false, min: 0.8, max: 1.2 }
    };
    
    // Create preview material
    this.previewMaterial = new BABYLON.StandardMaterial('previewMat', scene);
    this.previewMaterial.diffuseColor = new BABYLON.Color3(0.5, 1, 0.5);
    this.previewMaterial.alpha = 0.5;
    this.previewMaterial.backFaceCulling = false;
    
    // Setup keyboard controls
    this.setupKeyboardControls();
  }
  
  // Minecraft-style rotation controls
  private setupKeyboardControls() {
    window.addEventListener('keydown', (e) => {
      if (!this.state.blockType) return;
      
      switch (e.key.toLowerCase()) {
        // Rotation controls
        case 'r':
          if (e.shiftKey) {
            // Rotate on X axis
            this.state.rotation.x += this.state.rotationStep * Math.PI / 180;
          } else if (e.ctrlKey) {
            // Rotate on Z axis
            this.state.rotation.z += this.state.rotationStep * Math.PI / 180;
          } else {
            // Rotate on Y axis (default)
            this.state.rotation.y += this.state.rotationStep * Math.PI / 180;
          }
          this.updatePreview();
          break;
          
        // Scale controls
        case '[':
          this.state.scale = Math.max(0.1, this.state.scale - this.state.scaleStep);
          this.updatePreview();
          break;
        case ']':
          this.state.scale = Math.min(5, this.state.scale + this.state.scaleStep);
          this.updatePreview();
          break;
          
        // Reset transforms
        case '0':
          this.state.rotation = BABYLON.Vector3.Zero();
          this.state.scale = 1;
          this.updatePreview();
          break;
          
        // Toggle features
        case 'g':
          this.toggleGridHelper();
          break;
        case 'n':
          this.state.alignToSurface = !this.state.alignToSurface;
          break;
          
        // Placement modes (Kogama-style)
        case '1':
          this.setPlacementMode({ type: 'single', settings: {} });
          break;
        case '2':
          this.setPlacementMode({ type: 'line', settings: { spacing: 1 } });
          break;
        case '3':
          this.setPlacementMode({ type: 'fill', settings: { fillHeight: 1 } });
          break;
        case '4':
          this.setPlacementMode({ type: 'wall', settings: { fillHeight: 3 } });
          break;
        case '5':
          this.setPlacementMode({ type: 'circle', settings: { radius: 3, count: 8 } });
          break;
      }
    });
    
    // Mouse wheel for quick rotation (Sims-style)
    window.addEventListener('wheel', (e) => {
      if (e.shiftKey && this.state.previewBlocks.length > 0) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 1 : -1;
        this.state.rotation.y += delta * this.state.rotationStep * Math.PI / 180;
        this.updatePreview();
      }
    });
  }
  
  setBlockType(type: Block['type']) {
    this.state.blockType = type;
    this.clearPreview();
    this.createPreview();
  }
  
  setPlacementMode(mode: PlacementMode) {
    this.state.mode = mode;
    this.clearPreview();
    
    // Show mode indicator
    console.log(`Placement mode: ${mode.type}`);
  }
  
  // Create preview blocks based on mode
  createPreview() {
    const metadata = getBlockMetadata(this.state.blockType);
    if (!metadata) return;
    
    switch (this.state.mode.type) {
      case 'single':
        this.createSinglePreview();
        break;
      case 'line':
      case 'fill':
      case 'wall':
        // These require start/end points
        break;
      case 'circle':
        this.createCirclePreview();
        break;
    }
  }
  
  private createSinglePreview() {
    const preview = this.createPreviewMesh(this.state.blockType);
    if (preview) {
      this.state.previewBlocks = [preview];
    }
  }
  
  private createCirclePreview() {
    const { radius = 3, count = 8 } = this.state.mode.settings;
    const angleStep = (Math.PI * 2) / count;
    
    for (let i = 0; i < count; i++) {
      const angle = i * angleStep;
      const preview = this.createPreviewMesh(this.state.blockType);
      if (preview) {
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        preview.position.set(x, 0, z);
        this.state.previewBlocks.push(preview);
      }
    }
  }
  
  private createPreviewMesh(type: Block['type']): BABYLON.Mesh | null {
    let mesh: BABYLON.Mesh;
    
    // Create mesh based on type (simplified)
    switch (type) {
      case 'sphere':
        mesh = BABYLON.MeshBuilder.CreateSphere('preview', { diameter: 1 }, this.scene);
        break;
      case 'cylinder':
        mesh = BABYLON.MeshBuilder.CreateCylinder('preview', { diameter: 1, height: 1 }, this.scene);
        break;
      default:
        mesh = BABYLON.MeshBuilder.CreateBox('preview', { size: 1 }, this.scene);
    }
    
    mesh.material = this.previewMaterial;
    mesh.isPickable = false;
    mesh.renderingGroupId = 1; // Render on top
    
    // Apply transforms
    mesh.rotation = this.state.rotation.clone();
    mesh.scaling.setAll(this.state.scale);
    
    return mesh;
  }
  
  // Update preview position based on cursor
  updatePreviewPosition(pickPoint: BABYLON.Vector3, normal?: BABYLON.Vector3) {
    if (this.state.previewBlocks.length === 0) return;
    
    // Apply grid snapping
    const snappedPoint = this.snapToGrid(pickPoint);
    
    switch (this.state.mode.type) {
      case 'single':
        if (this.state.previewBlocks[0]) {
          this.state.previewBlocks[0].position.copyFrom(snappedPoint);
          
          // Align to surface normal if enabled
          if (this.state.alignToSurface && normal) {
            this.alignToNormal(this.state.previewBlocks[0], normal);
          }
        }
        break;
        
      case 'line':
        if (!this.state.startPoint) {
          // First click sets start point
          this.state.startPoint = snappedPoint.clone();
        } else {
          // Update line preview
          this.updateLinePreview(this.state.startPoint, snappedPoint);
        }
        break;
        
      case 'fill':
      case 'wall':
        if (!this.state.startPoint) {
          this.state.startPoint = snappedPoint.clone();
        } else {
          this.updateAreaPreview(this.state.startPoint, snappedPoint);
        }
        break;
        
      case 'circle':
        // Update circle center
        for (const preview of this.state.previewBlocks) {
          const offset = preview.position.subtract(BABYLON.Vector3.Zero());
          preview.position = snappedPoint.add(offset);
        }
        break;
    }
  }
  
  private updateLinePreview(start: BABYLON.Vector3, end: BABYLON.Vector3) {
    this.clearPreview();
    
    const direction = end.subtract(start);
    const distance = direction.length();
    const spacing = this.state.mode.settings.spacing || 1;
    const steps = Math.floor(distance / spacing);
    
    for (let i = 0; i <= steps; i++) {
      const t = steps > 0 ? i / steps : 0;
      const position = BABYLON.Vector3.Lerp(start, end, t);
      
      const preview = this.createPreviewMesh(this.state.blockType);
      if (preview) {
        preview.position.copyFrom(position);
        this.state.previewBlocks.push(preview);
      }
    }
  }
  
  private updateAreaPreview(start: BABYLON.Vector3, end: BABYLON.Vector3) {
    this.clearPreview();
    
    const min = BABYLON.Vector3.Minimize(start, end);
    const max = BABYLON.Vector3.Maximize(start, end);
    const fillHeight = this.state.mode.settings.fillHeight || 1;
    
    // Calculate grid positions
    const spacing = 1; // Block spacing
    const xSteps = Math.floor((max.x - min.x) / spacing) + 1;
    const zSteps = Math.floor((max.z - min.z) / spacing) + 1;
    const ySteps = this.state.mode.type === 'wall' ? fillHeight : 1;
    
    for (let y = 0; y < ySteps; y++) {
      for (let x = 0; x < xSteps; x++) {
        for (let z = 0; z < zSteps; z++) {
          const position = new BABYLON.Vector3(
            min.x + x * spacing,
            min.y + y * spacing,
            min.z + z * spacing
          );
          
          const preview = this.createPreviewMesh(this.state.blockType);
          if (preview) {
            preview.position.copyFrom(position);
            this.state.previewBlocks.push(preview);
          }
        }
      }
    }
  }
  
  // Place blocks with animations
  placeBlocks(onPlace: (type: Block['type'], position: BABYLON.Vector3) => void) {
    const metadata = getBlockMetadata(this.state.blockType);
    const animationType = this.getAnimationType(metadata);
    
    // Place each preview block
    this.state.previewBlocks.forEach((preview, index) => {
      // Apply random variations if enabled
      let position = preview.position.clone();
      let rotation = this.state.rotation.clone();
      let scale = this.state.scale;
      
      if (this.state.randomRotation) {
        rotation.y += (Math.random() - 0.5) * Math.PI;
      }
      
      if (this.state.randomScale.enabled) {
        scale *= this.state.randomScale.min + 
                 Math.random() * (this.state.randomScale.max - this.state.randomScale.min);
      }
      
      // Stagger placement for multi-block modes
      setTimeout(() => {
        onPlace(this.state.blockType, position);
        
        // The actual block mesh will be created by the placement handler
        // We'll need to hook into it to add animation
      }, index * 50); // 50ms delay between blocks
    });
    
    // Clear preview after placement
    if (this.state.mode.type === 'single') {
      // Keep preview for continuous placement (Minecraft-style)
      this.updatePreview();
    } else {
      // Clear for multi-block modes
      this.clearPreview();
      this.state.startPoint = undefined;
      this.state.endPoint = undefined;
    }
  }
  
  private getAnimationType(metadata?: any): 'pop' | 'slide' | 'fade' {
    if (!metadata) return 'pop';
    
    // Choose animation based on block properties
    if (metadata.placementSound === 'glass') return 'fade';
    if (metadata.category === 'mechanical') return 'slide';
    return 'pop';
  }
  
  private snapToGrid(position: BABYLON.Vector3): BABYLON.Vector3 {
    const gridSize = 1; // Can be made configurable
    return new BABYLON.Vector3(
      Math.round(position.x / gridSize) * gridSize,
      Math.round(position.y / gridSize) * gridSize,
      Math.round(position.z / gridSize) * gridSize
    );
  }
  
  private alignToNormal(mesh: BABYLON.Mesh, normal: BABYLON.Vector3) {
    // Calculate rotation to align Y-axis with normal
    const up = BABYLON.Vector3.Up();
    const angle = Math.acos(BABYLON.Vector3.Dot(up, normal));
    const axis = BABYLON.Vector3.Cross(up, normal);
    
    if (axis.length() > 0.001) {
      const quaternion = BABYLON.Quaternion.RotationAxis(axis.normalize(), angle);
      mesh.rotationQuaternion = quaternion;
    }
  }
  
  private toggleGridHelper() {
    if (this.gridHelper) {
      this.gridHelper.dispose();
      this.gridHelper = null;
    } else {
      // Create grid helper
      const ground = BABYLON.MeshBuilder.CreateGround('gridHelper', {
        width: 50,
        height: 50,
        subdivisions: 50
      }, this.scene);
      
      const material = new BABYLON.StandardMaterial('gridMat', this.scene);
      material.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
      material.wireframe = true;
      material.alpha = 0.3;
      ground.material = material;
      ground.isPickable = false;
      
      this.gridHelper = ground;
    }
  }
  
  updatePreview() {
    // Update all preview blocks with current transforms
    for (const preview of this.state.previewBlocks) {
      preview.rotation = this.state.rotation.clone();
      preview.scaling.setAll(this.state.scale);
    }
  }
  
  clearPreview() {
    for (const preview of this.state.previewBlocks) {
      preview.dispose();
    }
    this.state.previewBlocks = [];
  }
  
  dispose() {
    this.clearPreview();
    if (this.gridHelper) {
      this.gridHelper.dispose();
    }
    if (this.rotationGizmo) {
      this.rotationGizmo.dispose();
    }
    this.previewMaterial.dispose();
  }
}
