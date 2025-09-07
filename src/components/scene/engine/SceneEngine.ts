import * as THREE from 'three';

export type CameraMode = 'orbit' | 'first' | 'ortho';

export function createSceneEngine(params: {
  mount: HTMLDivElement;
  cameraMode: CameraMode;
}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);

  let camera: THREE.Camera;
  const width = params.mount.clientWidth;
  const height = params.mount.clientHeight;

  if (params.cameraMode === 'ortho') {
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
    ortho.position.set(10, 10, 10);
    ortho.lookAt(0, 0, 0);
    camera = ortho;
  } else {
    const persp = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    persp.position.set(10, 10, 10);
    persp.lookAt(0, 0, 0);
    camera = persp;
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  params.mount.appendChild(renderer.domElement);

  // default lights
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(10, 10, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  const dispose = () => {
    try {
      params.mount.removeChild(renderer.domElement);
    } catch {}
    try { renderer.dispose(); } catch {}
  };

  return { scene, camera, renderer, dispose } as const;
}


