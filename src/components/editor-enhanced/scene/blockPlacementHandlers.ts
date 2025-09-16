import * as BABYLON from '@babylonjs/core';
import type { Block } from './types';
import { calculateBlockPosition, checkBlockCollision } from './sceneHelpers';
import { Vector2Compat, RaycasterCompat } from './compatibility/three-babylon-compat';
import { PlacementAnimationManager } from './blocks/placementAnimation';
import { EnhancedPlacementSystem } from './blocks/enhancedPlacement';
import { getBlockMetadata } from './blocks/blockCategories';

interface PlacementHandlers {
  handleClick: (event: MouseEvent) => void;
  handleMouseMove: (event: MouseEvent) => void;
  handleKeyDown: (event: KeyboardEvent) => void;
  handleRightClick: (event: MouseEvent) => void;
  cleanup?: () => void;
}

export interface CreatePlacementHandlersParams {
  mountRef: React.RefObject<HTMLDivElement>;
  cameraRefs: React.MutableRefObject<{
    camera: BABYLON.Camera | null;
    tempNdc: Vector2Compat;
  }>;
  interactionRefs: React.MutableRefObject<{
    raycaster: RaycasterCompat;
  }>;
  sceneRefs: React.MutableRefObject<{
    ground: BABYLON.Mesh | null;
    scene?: BABYLON.Scene | null;
  }>;
  stateRefs: React.MutableRefObject<{
    blocks: Block[];
    snapEnabled: boolean;
    snapSize: number;
    color: number;
  }>;
  droppedBlock: { type: Block['type'] };
  ghostPreview: {
    createGhost: (type: Block['type']) => void;
    removeGhost: () => void;
    ghostRef: React.MutableRefObject<BABYLON.Mesh | null>;
  };
  addBlock: (type: Block['type'], position: BABYLON.Vector3) => void;
  onSceneStateChange?: (blocks: Block[]) => void;
}

export const createPlacementHandlers = (params: CreatePlacementHandlersParams): PlacementHandlers => {
  let isPlacementActive = true;
  const animationManager = PlacementAnimationManager.getInstance();
  
  // Initialize enhanced placement only if scene is available
  let enhancedPlacement: EnhancedPlacementSystem | null = null;
  const scene = params.cameraRefs.current.camera?.getScene();
  if (scene) {
    animationManager.setScene(scene);
    enhancedPlacement = new EnhancedPlacementSystem(scene);
    enhancedPlacement.setBlockType(params.droppedBlock.type);
  }

  const handleClick = (event: MouseEvent) => {
    if (!isPlacementActive) return;
    if (!params.mountRef.current || !params.cameraRefs.current.camera) return;

    const rect = params.mountRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const scene = params.cameraRefs.current.camera.getScene();
    const pickResult = scene.pick(
      (event.clientX - rect.left),
      (event.clientY - rect.top),
      (mesh) => {
        // Include ground and block meshes
        if (mesh === params.sceneRefs.current.ground) return true;
        return params.stateRefs.current.blocks.some(block => block.mesh === mesh);
      }
    );
    
    if (pickResult && pickResult.hit && pickResult.pickedPoint) {
      const position = calculateBlockPosition(
        pickResult,
        params.droppedBlock.type,
        params.sceneRefs.current.ground,
        params.stateRefs.current.blocks,
        params.stateRefs.current.snapEnabled,
        params.stateRefs.current.snapSize
      );

      // Check for collision before placing
      if (!checkBlockCollision(position, params.droppedBlock.type, params.stateRefs.current.blocks)) {
        if (enhancedPlacement) {
          // Place block with enhanced system
          enhancedPlacement.placeBlocks((type, pos) => {
            params.addBlock(type, pos);
            
            // Find the newly added block and animate it
            setTimeout(() => {
              const newBlock = params.stateRefs.current.blocks[params.stateRefs.current.blocks.length - 1];
              if (newBlock && newBlock.mesh) {
                const metadata = getBlockMetadata(type);
                const animType = metadata?.placementSound === 'glass' ? 'fade' : 
                               metadata?.category === 'mechanical' ? 'slide' : 'pop';
                animationManager.animatePlacement(newBlock.mesh as BABYLON.Mesh, newBlock.id, animType);
              }
            }, 50);
          });
        } else {
          // Fallback to simple placement
          params.addBlock(params.droppedBlock.type, position);
        }
        
        // Always keep placement mode active (Minecraft-style)
        // Re-create ghost for next placement
        params.ghostPreview.createGhost(params.droppedBlock.type);
        
        params.onSceneStateChange?.(params.stateRefs.current.blocks);
      }
    }
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!params.mountRef.current || !params.cameraRefs.current.camera || !params.ghostPreview.ghostRef.current) return;

    const rect = params.mountRef.current.getBoundingClientRect();
    const scene = params.cameraRefs.current.camera.getScene();
    
    const pickResult = scene.pick(
      (event.clientX - rect.left),
      (event.clientY - rect.top),
      (mesh) => {
        // Include ground and block meshes
        if (mesh === params.sceneRefs.current.ground) return true;
        return params.stateRefs.current.blocks.some(block => block.mesh === mesh);
      }
    );

    if (pickResult && pickResult.hit && pickResult.pickedPoint) {
      const position = calculateBlockPosition(
        pickResult,
        params.droppedBlock.type,
        params.sceneRefs.current.ground,
        params.stateRefs.current.blocks,
        params.stateRefs.current.snapEnabled,
        params.stateRefs.current.snapSize
      );

      // Update enhanced placement preview if available
      if (enhancedPlacement) {
        enhancedPlacement.updatePreviewPosition(position, pickResult.getNormal());
      }
      
      params.ghostPreview.ghostRef.current.position.copyFrom(position);
      params.ghostPreview.ghostRef.current.setEnabled(true);
      
      // Check for collision and update ghost color
      const hasCollision = checkBlockCollision(position, params.droppedBlock.type, params.stateRefs.current.blocks);
      const material = params.ghostPreview.ghostRef.current.material as BABYLON.StandardMaterial;
      if (material) {
        material.diffuseColor = hasCollision 
          ? new BABYLON.Color3(1, 0.267, 0.267) // 0xff4444
          : new BABYLON.Color3(0.267, 1, 0.267); // 0x44ff44
        material.alpha = hasCollision ? 0.3 : 0.5;
      }
    } else {
      params.ghostPreview.ghostRef.current.setEnabled(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isPlacementActive) {
      // Cancel placement mode
      isPlacementActive = false;
      params.ghostPreview.removeGhost();
      if (enhancedPlacement) {
        enhancedPlacement.clearPreview();
      }
      // Request parent to clear droppedBlock
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('blockPlacementCancelled'));
      }
    }
    // Other key handling is done by EnhancedPlacementSystem
  };
  
  const handleRightClick = (event: MouseEvent) => {
    if (isPlacementActive) {
      event.preventDefault(); // Prevent context menu
      // Exit placement mode on right-click
      isPlacementActive = false;
      params.ghostPreview.removeGhost();
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('blockPlaced'));
      }
    }
  };

  // Cleanup function
  const cleanup = () => {
    if (enhancedPlacement) {
      enhancedPlacement.dispose();
    }
  };
  
  return {
    handleClick,
    handleMouseMove,
    handleKeyDown,
    handleRightClick,
    cleanup
  };
};