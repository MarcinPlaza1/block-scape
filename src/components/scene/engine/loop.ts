import * as THREE from 'three';

type CameraMode = 'orbit' | 'first' | 'ortho';

export function startEngineLoop(params: {
  worldRef: { current: any };
  emitCollisionEvents?: () => void;
  isPlayMode: boolean;
  cameraModeRef: { current: CameraMode };
  updatePlayer: () => void;
  blocksRef: { current: Array<{ mesh?: any; body?: any }> };
  cameraRef: { current: any };
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
}) {
  const clock = new THREE.Clock();
  const fixedTimeStep = 1 / 60;
  let rafId: number | null = null;

  const handleVisibilityChange = () => {
    clock.getDelta();
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const animate = () => {
    rafId = requestAnimationFrame(animate);

    if (params.worldRef.current) {
      try {
        const delta = clock.getDelta();
        const ts = (window as any).__scene_timeScale ?? 1;
        const dt = document.hidden ? 0 : delta * ts;
        params.worldRef.current.step(fixedTimeStep, dt, 3);
      } catch {
        // no-op
      }
    }

    try { params.emitCollisionEvents?.(); } catch {}

    if (params.cameraModeRef.current === 'first' && params.isPlayMode && !document.hidden) {
      try { params.updatePlayer(); } catch {}
    }

    try {
      params.blocksRef.current.forEach((block) => {
        if (block.mesh && block.body) {
          block.mesh.position.copy(block.body.position as any);
          block.mesh.quaternion.copy(block.body.quaternion as any);
        }
      });
    } catch {}

    params.renderer.render(params.scene, params.cameraRef.current as any);
  };

  animate();

  const stop = () => {
    if (rafId !== null) {
      try { cancelAnimationFrame(rafId); } catch {}
      rafId = null;
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };

  return { stop } as const;
}


