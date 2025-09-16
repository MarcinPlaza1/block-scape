import { useEffect, useRef, MutableRefObject } from 'react';
import { attachCameraController } from './camera/controller';
import { THREE } from './compatibility/three-babylon-compat';
import * as BABYLON from '@babylonjs/core';
import type { CameraMode } from './types';

interface CameraControllerProps {
  mountRef: MutableRefObject<HTMLDivElement | null>;
  camera: BABYLON.Camera | null;
  cameraMode: CameraMode;
  isPlayMode: boolean;
  cameraDistance: number;
  onDragActiveChange?: (active: boolean) => void;
  isBlockDraggingRef?: MutableRefObject<boolean>;
}

export const CameraController = ({
  mountRef,
  camera,
  cameraMode,
  isPlayMode,
  cameraDistance,
  onDragActiveChange,
  isBlockDraggingRef
}: CameraControllerProps) => {
  const tempSphericalRef = useRef(new THREE.Spherical());
  const cameraDistanceRef = useRef(cameraDistance);
  const cameraModeRef = useRef(cameraMode);

  // Update refs when props change
  useEffect(() => {
    cameraDistanceRef.current = cameraDistance;
    cameraModeRef.current = cameraMode;
  }, [cameraDistance, cameraMode]);

  // Set up camera controller
  useEffect(() => {
    if (!mountRef.current || !camera) return;

    const cleanup = attachCameraController({
      mount: mountRef.current,
      cameraRef: { current: camera },
      cameraModeRef: { current: cameraModeRef.current },
      isPlayMode,
      cameraDistanceRef: { current: cameraDistanceRef.current },
      tempSpherical: { current: tempSphericalRef.current },
      onDragActiveChange,
      isBlockDraggingRef
    });

    return cleanup;
  }, [camera, isPlayMode, onDragActiveChange, isBlockDraggingRef]);

  // Handle window resize
  useEffect(() => {
    if (!mountRef.current || !camera) return;

    const handleResize = () => {
      if (!mountRef.current || !camera) return;
      
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      
      if (camera instanceof BABYLON.UniversalCamera || 
          camera instanceof BABYLON.ArcRotateCamera) {
        if (camera.mode === BABYLON.Camera.PERSPECTIVE_CAMERA) {
          // Keep vertical FOV constant; Babylon handles aspect internally
          camera.fov = camera.fov;
        } else if (camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
          const frustumSize = 30;
          const aspect = width / height;
          camera.orthoLeft = (-frustumSize * aspect) / 2;
          camera.orthoRight = (frustumSize * aspect) / 2;
          camera.orthoTop = frustumSize / 2;
          camera.orthoBottom = -frustumSize / 2;
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [camera]);

  return null; // This is a controller component with no visual output
};
