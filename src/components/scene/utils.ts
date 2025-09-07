import * as THREE from 'three';

export function disposeMaterial(material: THREE.Material | THREE.Material[] | undefined | null) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach((m) => m && m.dispose());
  } else {
    material.dispose();
  }
}

export function disposeMesh(mesh: THREE.Mesh | null | undefined, scene?: THREE.Scene) {
  if (!mesh) return;
  try {
    if (scene) scene.remove(mesh);
    mesh.geometry?.dispose?.();
    disposeMaterial((mesh as any).material);
  } catch {}
}

export function safeRemoveObject(object: THREE.Object3D | null | undefined, scene?: THREE.Scene) {
  if (!object) return;
  try {
    if (scene) scene.remove(object);
    const asMesh = object as THREE.Mesh;
    asMesh.geometry?.dispose?.();
    disposeMaterial((asMesh as any).material);
  } catch {}
}

export function setMeshShadowDefaults(mesh: THREE.Mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}


