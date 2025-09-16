import * as THREE from 'three';

export function attachEditorInput(params: {
  mount: HTMLElement;
  isPlayMode: boolean;
  cameraRef: React.MutableRefObject<THREE.Camera | null>;
  raycasterRef: React.MutableRefObject<THREE.Raycaster | null>;
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  isDraggingRef: React.MutableRefObject<boolean>;
  selectedTool: 'select' | 'move' | (() => 'select' | 'move');
  selectedBlockIdsRef: React.MutableRefObject<string[] | null>;
  blocksRef: React.MutableRefObject<Array<any>>;
  groundRef: React.MutableRefObject<THREE.Mesh | null>;
  tempNdc: React.MutableRefObject<THREE.Vector2>;
  snapEnabledRef: React.MutableRefObject<boolean>;
  snapSizeRef: React.MutableRefObject<number>;
  ensureSnapRing: (snap?: number) => void;
  snapRingRef: React.MutableRefObject<THREE.Mesh | null>;
  selectedBlockRef: React.MutableRefObject<any>;
  startDragging: (block: any, clickPoint: THREE.Vector3) => void;
  dragTo: (mouseNdc: THREE.Vector2) => void;
  stopDragging: () => void;
  selectBlock: (block: any) => void;
  deselectBlock: () => void;
}) {
  const lastMoveRef = { time: 0 };
  const throttleMs = 16;\r\n\r\n  const getSelectedTool = () => (typeof params.selectedTool === 'function' ? params.selectedTool() : params.selectedTool);

  const onMouseMove = (event: MouseEvent) => {
    const now = performance.now();
    if (now - lastMoveRef.time < throttleMs) return;
    lastMoveRef.time = now;
    if (params.isPlayMode) return;

    if (params.isDraggingRef.current && params.mount && params.cameraRef.current) {
      const rect = params.mount.getBoundingClientRect();
      const mouse = params.tempNdc.current.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      params.dragTo(mouse);
    }

    if (params.groundRef.current && params.cameraRef.current && params.raycasterRef.current) {
      const rect = params.mount.getBoundingClientRect();
      const cursor = params.tempNdc.current.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      params.raycasterRef.current.setFromCamera(cursor, params.cameraRef.current);
      const intersects = params.raycasterRef.current.intersectObject(params.groundRef.current);
      if (intersects.length > 0) {
        const p = intersects[0].point;
        let gx = p.x;
        let gz = p.z;
        if (params.snapEnabledRef.current) {
          const s = params.snapSizeRef.current || 1;
          gx = Math.round(gx / s) * s;
          gz = Math.round(gz / s) * s;
        }
        params.ensureSnapRing(params.snapSizeRef.current);
        if (params.snapRingRef.current) {
          params.snapRingRef.current.position.set(gx, 0.002, gz);
        }
      }
    }
  };

  const onMouseUp = () => {
    if (!params.isDraggingRef.current) return;
    params.stopDragging();
  };

  const onClick = (event: MouseEvent) => {
    if (params.isPlayMode) return;
    if (!params.raycasterRef.current || !params.cameraRef.current || !params.sceneRef.current) return;\r\n    const tool = getSelectedTool();
    params.raycasterRef.current.setFromCamera((params.tempNdc.current as any), params.cameraRef.current);
    const blockMeshes = params.blocksRef.current.filter(b => !b.hidden).map(b => b.mesh).filter(Boolean) as THREE.Object3D[];
    const intersects = params.raycasterRef.current.intersectObjects(blockMeshes);
    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const clickedBlock = params.blocksRef.current.find(b => b.mesh === clickedMesh);
      if (!clickedBlock) return;
      if (tool === 'select') {
        params.selectBlock(clickedBlock);
      } else if (tool === 'move') {
        if (!clickedBlock.locked) {
          params.startDragging(clickedBlock, intersects[0].point.clone());
        }
      }
    } else {
      if (tool === 'select') params.deselectBlock();
    }
  };

  params.mount.addEventListener('mousemove', onMouseMove);
  params.mount.addEventListener('mouseup', onMouseUp);
  params.mount.addEventListener('click', onClick);

  return () => {
    params.mount.removeEventListener('mousemove', onMouseMove);
    params.mount.removeEventListener('mouseup', onMouseUp);
    params.mount.removeEventListener('click', onClick);
  };
}

