import { useRef } from 'react';
import * as THREE from 'three';
import type { Block } from './types';

export function useSelectionAndDragging(params: { sceneRef: React.MutableRefObject<THREE.Scene | null>; cameraRef: React.MutableRefObject<THREE.Camera | null>; raycasterRef: React.MutableRefObject<THREE.Raycaster | null>; snapEnabledRef: React.MutableRefObject<boolean>; snapSizeRef: React.MutableRefObject<number>; setSelectedBlockId?: (id: string | null) => void; }) {
  const selectedBlockRef = useRef<Block | null>(null);
  const outlineRef = useRef<THREE.LineSegments | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane());
  const dragOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3());

  const selectBlock = (block: Block) => {
    if (outlineRef.current && params.sceneRef.current) {
      params.sceneRef.current.remove(outlineRef.current);
      outlineRef.current.geometry.dispose();
      (outlineRef.current.material as THREE.Material).dispose();
    }
    selectedBlockRef.current = block;
    params.setSelectedBlockId?.(block.id);
    if (block.mesh) {
      const edges = new THREE.EdgesGeometry(block.mesh.geometry);
      const outlineMaterial = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 });
      const outline = new THREE.LineSegments(edges, outlineMaterial);
      outline.position.copy(block.mesh.position);
      outline.rotation.copy(block.mesh.rotation);
      outline.scale.copy(block.mesh.scale);
      params.sceneRef.current?.add(outline);
      outlineRef.current = outline;
    }
  };

  const deselectBlock = () => {
    if (outlineRef.current && params.sceneRef.current) {
      params.sceneRef.current.remove(outlineRef.current);
      outlineRef.current.geometry.dispose();
      (outlineRef.current.material as THREE.Material).dispose();
      outlineRef.current = null;
    }
    selectedBlockRef.current = null;
    params.setSelectedBlockId?.(null);
  };

  const startDragging = (block: Block, clickPoint: THREE.Vector3) => {
    selectedBlockRef.current = block;
    isDraggingRef.current = true;
    if (params.cameraRef.current) {
      const cameraDirection = new THREE.Vector3();
      params.cameraRef.current.getWorldDirection(cameraDirection);
      dragPlaneRef.current.setFromNormalAndCoplanarPoint(cameraDirection, clickPoint);
      dragOffsetRef.current.copy(block.mesh!.position.clone().sub(clickPoint));
    }
  };

  const dragTo = (mouseNdc: THREE.Vector2) => {
    if (!isDraggingRef.current || !selectedBlockRef.current || !params.cameraRef.current || !params.raycasterRef.current) return;
    params.raycasterRef.current.setFromCamera(mouseNdc, params.cameraRef.current);
    const intersection = new THREE.Vector3();
    params.raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersection);
    if (selectedBlockRef.current.body) {
      const newPosition = intersection.clone().add(dragOffsetRef.current);
      if (params.snapEnabledRef.current) {
        const s = params.snapSizeRef.current || 1;
        newPosition.x = Math.round(newPosition.x / s) * s;
        newPosition.z = Math.round(newPosition.z / s) * s;
      }
      selectedBlockRef.current.body.position.set(newPosition.x, newPosition.y, newPosition.z);
    }
  };

  const stopDragging = () => { isDraggingRef.current = false; };

  return { selectedBlockRef, outlineRef, isDraggingRef, selectBlock, deselectBlock, startDragging, dragTo, stopDragging } as const;
}


