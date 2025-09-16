import { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import type { IGizmo } from '@babylonjs/core/Gizmos/gizmo';
import '@babylonjs/core/Gizmos/gizmoManager';
import '@babylonjs/core/Gizmos/positionGizmo';
import '@babylonjs/core/Gizmos/rotationGizmo';
import '@babylonjs/core/Gizmos/scaleGizmo';
import '@babylonjs/core/Gizmos/boundingBoxGizmo';
import '@babylonjs/core/Rendering/utilityLayerRenderer';

export type GizmoType = 'position' | 'rotation' | 'scale' | 'boundingBox' | 'none';

interface UseGizmosParams {
  scene: BABYLON.Scene | null;
  selectedMesh: BABYLON.Mesh | null;
  isEnabled: boolean;
  gizmoType: GizmoType;
  onTransformChange?: (mesh: BABYLON.Mesh) => void;
}

export function useGizmos({
  scene,
  selectedMesh,
  isEnabled,
  gizmoType,
  onTransformChange
}: UseGizmosParams) {
  const gizmoManagerRef = useRef<BABYLON.GizmoManager | null>(null);
  const currentGizmoRef = useRef<IGizmo | null>(null);

  useEffect(() => {
    if (!scene || !isEnabled) {
      // Cleanup if disabled
      if (gizmoManagerRef.current) {
        gizmoManagerRef.current.dispose();
        gizmoManagerRef.current = null;
      }
      if (currentGizmoRef.current) {
        currentGizmoRef.current.dispose();
        currentGizmoRef.current = null;
      }
      return;
    }

    // Create gizmo manager if not exists
    if (!gizmoManagerRef.current) {
      const gizmoManager = new BABYLON.GizmoManager(scene);
      gizmoManager.usePointerToAttachGizmos = false; // We'll control attachment manually
      gizmoManager.enableAutoPicking = false;
      
      // Customize gizmo appearance
      gizmoManager.gizmos.positionGizmo!.scaleRatio = 1.5;
      gizmoManager.gizmos.rotationGizmo!.scaleRatio = 1.5;
      gizmoManager.gizmos.scaleGizmo!.scaleRatio = 1.5;
      
      // Set gizmo colors
      if (gizmoManager.gizmos.positionGizmo) {
        gizmoManager.gizmos.positionGizmo.xGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0);
        gizmoManager.gizmos.positionGizmo.yGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0);
        gizmoManager.gizmos.positionGizmo.zGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(0, 0, 1);
      }
      
      gizmoManagerRef.current = gizmoManager;
    }

    const gizmoManager = gizmoManagerRef.current;

    // Clear all gizmos first
    gizmoManager.positionGizmoEnabled = false;
    gizmoManager.rotationGizmoEnabled = false;
    gizmoManager.scaleGizmoEnabled = false;
    gizmoManager.boundingBoxGizmoEnabled = false;

    // Dispose current gizmo if any
    if (currentGizmoRef.current) {
      currentGizmoRef.current.dispose();
      currentGizmoRef.current = null;
    }

    // If no mesh selected or gizmo type is none, return
    if (!selectedMesh || gizmoType === 'none') {
      gizmoManager.attachToMesh(null);
      return;
    }

    // Attach to selected mesh
    gizmoManager.attachToMesh(selectedMesh);

    // Enable the appropriate gizmo
    switch (gizmoType) {
      case 'position':
        gizmoManager.positionGizmoEnabled = true;
        currentGizmoRef.current = gizmoManager.gizmos.positionGizmo!;
        
        // Add drag behavior
        if (gizmoManager.gizmos.positionGizmo) {
          const posGizmo = gizmoManager.gizmos.positionGizmo;
          posGizmo.onDragEndObservable.add(() => {
            onTransformChange?.(selectedMesh);
          });
        }
        break;
        
      case 'rotation':
        gizmoManager.rotationGizmoEnabled = true;
        currentGizmoRef.current = gizmoManager.gizmos.rotationGizmo!;
        
        // Add rotation behavior
        if (gizmoManager.gizmos.rotationGizmo) {
          const rotGizmo = gizmoManager.gizmos.rotationGizmo;
          rotGizmo.onDragEndObservable.add(() => {
            onTransformChange?.(selectedMesh);
          });
        }
        break;
        
      case 'scale':
        gizmoManager.scaleGizmoEnabled = true;
        currentGizmoRef.current = gizmoManager.gizmos.scaleGizmo!;
        
        // Add scale behavior
        if (gizmoManager.gizmos.scaleGizmo) {
          const scaleGizmo = gizmoManager.gizmos.scaleGizmo;
          scaleGizmo.sensitivity = 3;
          scaleGizmo.onDragEndObservable.add(() => {
            onTransformChange?.(selectedMesh);
          });
        }
        break;
        
      case 'boundingBox':
        gizmoManager.boundingBoxGizmoEnabled = true;
        currentGizmoRef.current = gizmoManager.gizmos.boundingBoxGizmo!;
        
        // Configure bounding box gizmo
        if (gizmoManager.gizmos.boundingBoxGizmo) {
          const bbGizmo = gizmoManager.gizmos.boundingBoxGizmo;
          bbGizmo.rotationSphereSize = 0.2;
          bbGizmo.scaleBoxSize = 0.1;
          bbGizmo.fixedDragMeshScreenSize = true;
          bbGizmo.onRotationSphereDragEndObservable.add(() => {
            onTransformChange?.(selectedMesh);
          });
          bbGizmo.onScaleBoxDragEndObservable.add(() => {
            onTransformChange?.(selectedMesh);
          });
        }
        break;
    }

    return () => {
      // Cleanup on unmount
      if (gizmoManagerRef.current) {
        gizmoManagerRef.current.dispose();
        gizmoManagerRef.current = null;
      }
      if (currentGizmoRef.current) {
        currentGizmoRef.current.dispose();
        currentGizmoRef.current = null;
      }
    };
  }, [scene, selectedMesh, isEnabled, gizmoType, onTransformChange]);

  const setGizmoType = (type: GizmoType) => {
    if (!gizmoManagerRef.current) return;
    
    const gizmoManager = gizmoManagerRef.current;
    
    // Clear all gizmos
    gizmoManager.positionGizmoEnabled = false;
    gizmoManager.rotationGizmoEnabled = false;
    gizmoManager.scaleGizmoEnabled = false;
    gizmoManager.boundingBoxGizmoEnabled = false;
    
    // Enable the selected type
    switch (type) {
      case 'position':
        gizmoManager.positionGizmoEnabled = true;
        break;
      case 'rotation':
        gizmoManager.rotationGizmoEnabled = true;
        break;
      case 'scale':
        gizmoManager.scaleGizmoEnabled = true;
        break;
      case 'boundingBox':
        gizmoManager.boundingBoxGizmoEnabled = true;
        break;
    }
  };

  return {
    setGizmoType,
    gizmoManager: gizmoManagerRef.current
  };
}
