import * as BABYLON from '@babylonjs/core';

// Three.js to Babylon.js compatibility layer

// Vector3 compatibility
export class Vector3Compat extends BABYLON.Vector3 {
  isVector3 = true;

  constructor(x?: number, y?: number, z?: number) {
    super(x || 0, y || 0, z || 0);
  }

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  distanceTo(v: BABYLON.Vector3): number {
    return BABYLON.Vector3.Distance(this, v);
  }

  lengthSq(): number {
    return this.lengthSquared();
  }

  setFromMatrixPosition(m: BABYLON.Matrix): this {
    const position = m.getTranslation();
    this.x = position.x;
    this.y = position.y;
    this.z = position.z;
    return this;
  }

  applyMatrix4(m: BABYLON.Matrix): this {
    const transformed = BABYLON.Vector3.TransformCoordinates(this, m);
    this.x = transformed.x;
    this.y = transformed.y;
    this.z = transformed.z;
    return this;
  }

  project(camera: BABYLON.Camera): this {
    const viewport = camera.viewport;
    const viewProjection = camera.getViewMatrix().multiply(camera.getProjectionMatrix());
    const coordinates = BABYLON.Vector3.Project(
      this,
      BABYLON.Matrix.Identity(),
      viewProjection,
      viewport
    );
    this.x = coordinates.x;
    this.y = coordinates.y;
    this.z = coordinates.z;
    return this;
  }

  unproject(camera: BABYLON.Camera): this {
    const engine = camera.getEngine();
    const coordinates = BABYLON.Vector3.Unproject(
      this,
      engine.getRenderWidth(),
      engine.getRenderHeight(),
      BABYLON.Matrix.Identity(),
      camera.getViewMatrix(),
      camera.getProjectionMatrix()
    );
    this.x = coordinates.x;
    this.y = coordinates.y;
    this.z = coordinates.z;
    return this;
  }

  multiplyScalar(scalar: number): this {
    this.scaleInPlace(scalar);
    return this;
  }

  divideScalar(scalar: number): this {
    this.scaleInPlace(1 / scalar);
    return this;
  }

  addScalar(scalar: number): this {
    this.x += scalar;
    this.y += scalar;
    this.z += scalar;
    return this;
  }

  subScalar(scalar: number): this {
    this.x -= scalar;
    this.y -= scalar;
    this.z -= scalar;
    return this;
  }

  lerp(v: BABYLON.Vector3, alpha: number): this {
    this.x = BABYLON.Scalar.Lerp(this.x, v.x, alpha);
    this.y = BABYLON.Scalar.Lerp(this.y, v.y, alpha);
    this.z = BABYLON.Scalar.Lerp(this.z, v.z, alpha);
    return this;
  }

  setLength(length: number): this {
    this.normalize();
    this.scaleInPlace(length);
    return this;
  }
}

// Vector2 compatibility
export class Vector2Compat extends BABYLON.Vector2 {
  width: number;
  height: number;

  constructor(x?: number, y?: number) {
    super(x || 0, y || 0);
    this.width = x || 0;
    this.height = y || 0;
  }

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    this.width = x;
    this.height = y;
    return this;
  }

  setX(x: number): this {
    this.x = x;
    this.width = x;
    return this;
  }

  setY(y: number): this {
    this.y = y;
    this.height = y;
    return this;
  }
}

// Raycaster compatibility
export class RaycasterCompat {
  ray: BABYLON.Ray;
  near: number = 0;
  far: number = Infinity;
  camera: BABYLON.Camera | null = null;
  layers = { mask: 1 };
  params: any = {};
  
  constructor() {
    this.ray = new BABYLON.Ray(BABYLON.Vector3.Zero(), BABYLON.Vector3.Forward());
  }

  set(origin: BABYLON.Vector3, direction: BABYLON.Vector3): void {
    this.ray.origin = origin;
    this.ray.direction = direction;
  }

  setFromCamera(coords: { x: number; y: number }, camera: BABYLON.Camera): void {
    const scene = camera.getScene();
    const width = scene.getEngine().getRenderWidth();
    const height = scene.getEngine().getRenderHeight();
    
    // Convert from NDC (-1 to 1) to screen coordinates
    const x = (coords.x + 1) * 0.5 * width;
    const y = (1 - coords.y) * 0.5 * height;
    
    const ray = scene.createPickingRay(x, y, BABYLON.Matrix.Identity(), camera);
    if (ray) {
      this.ray = ray;
      this.camera = camera;
    }
  }

  intersectObject(mesh: BABYLON.AbstractMesh, recursive?: boolean): Array<{
    object: BABYLON.AbstractMesh;
    distance: number;
    point: BABYLON.Vector3;
  }> {
    return this.intersectObjects([mesh], recursive);
  }

  intersectObjects(meshes: BABYLON.AbstractMesh[], recursive?: boolean): Array<{
    object: BABYLON.AbstractMesh;
    distance: number;
    point: BABYLON.Vector3;
  }> {
    const results: Array<{
      object: BABYLON.AbstractMesh;
      distance: number;
      point: BABYLON.Vector3;
    }> = [];

    for (const mesh of meshes) {
      if (!mesh.isEnabled() || !mesh.isVisible) continue;
      
      const hit = this.ray.intersectsMesh(mesh);
      if (hit.hit && hit.distance >= this.near && hit.distance <= this.far) {
        results.push({
          object: mesh,
          distance: hit.distance,
          point: hit.pickedPoint || BABYLON.Vector3.Zero()
        });
      }
      
      // Handle children if recursive
      if (recursive && mesh.getChildMeshes) {
        const children = mesh.getChildMeshes();
        const childResults = this.intersectObjects(children, recursive);
        results.push(...childResults);
      }
    }

    return results.sort((a, b) => a.distance - b.distance);
  }
}

// Spherical compatibility
export class SphericalCompat {
  radius: number;
  theta: number;
  phi: number;

  constructor(radius = 1, theta = 0, phi = 0) {
    this.radius = radius;
    this.theta = theta;
    this.phi = phi;
  }

  set(radius: number, phi: number, theta: number): this {
    this.radius = radius;
    this.phi = phi;
    this.theta = theta;
    return this;
  }

  clone(): SphericalCompat {
    return new SphericalCompat(this.radius, this.theta, this.phi);
  }

  copy(other: SphericalCompat): this {
    this.radius = other.radius;
    this.theta = other.theta;
    this.phi = other.phi;
    return this;
  }

  makeSafe(): this {
    const EPS = 0.000001;
    this.phi = Math.max(EPS, Math.min(Math.PI - EPS, this.phi));
    return this;
  }

  setFromVector3(v: BABYLON.Vector3): this {
    return this.setFromCartesianCoords(v.x, v.y, v.z);
  }

  setFromCartesianCoords(x: number, y: number, z: number): this {
    this.radius = Math.sqrt(x * x + y * y + z * z);
    if (this.radius === 0) {
      this.theta = 0;
      this.phi = 0;
    } else {
      this.theta = Math.atan2(x, z);
      this.phi = Math.acos(Math.max(-1, Math.min(1, y / this.radius)));
    }
    return this;
  }
}

// Color compatibility
export class ColorCompat extends BABYLON.Color3 {
  constructor(r?: number | string, g?: number, b?: number) {
    if (typeof r === 'string') {
      const hex = r.replace('#', '');
      const bigint = parseInt(hex, 16);
      super(
        ((bigint >> 16) & 255) / 255,
        ((bigint >> 8) & 255) / 255,
        (bigint & 255) / 255
      );
    } else if (typeof r === 'number' && r > 1) {
      // Assume it's a hex number like 0xFFFFFF
      super(
        ((r >> 16) & 255) / 255,
        ((r >> 8) & 255) / 255,
        (r & 255) / 255
      );
    } else {
      super(r || 0, g || 0, b || 0);
    }
  }

  getHex(): number {
    return (Math.round(this.r * 255) << 16) + (Math.round(this.g * 255) << 8) + Math.round(this.b * 255);
  }
}

// Material compatibility
export class MeshBasicMaterialCompat extends BABYLON.StandardMaterial {
  constructor(options?: { color?: number | string; transparent?: boolean; opacity?: number }) {
    const scene = BABYLON.Engine.LastCreatedScene;
    if (!scene) throw new Error('No active Babylon scene');
    
    super('material', scene);
    
    if (options?.color !== undefined) {
      const color = new ColorCompat(options.color);
      this.diffuseColor = color;
      this.emissiveColor = color;
      this.specularColor = new BABYLON.Color3(0, 0, 0);
    }
    
    if (options?.transparent) {
      this.alpha = options.opacity !== undefined ? options.opacity : 1;
    }

    // Disable lighting for basic material behavior
    this.disableLighting = true;
  }
}

export class MeshStandardMaterialCompat extends BABYLON.StandardMaterial {
  constructor(options?: { color?: number | string; roughness?: number; metalness?: number }) {
    const scene = BABYLON.Engine.LastCreatedScene;
    if (!scene) throw new Error('No active Babylon scene');
    
    super('material', scene);
    
    if (options?.color !== undefined) {
      const color = new ColorCompat(options.color);
      this.diffuseColor = color;
    }
    
    if (options?.roughness !== undefined) {
      this.specularPower = 64 * (1 - options.roughness);
    }
    
    if (options?.metalness !== undefined) {
      this.specularColor = options.metalness > 0.5 
        ? new BABYLON.Color3(1, 1, 1) 
        : new BABYLON.Color3(0.1, 0.1, 0.1);
    }
  }
}

// Box geometry compatibility
export class BoxGeometryCompat {
  width: number;
  height: number;
  depth: number;

  constructor(width = 1, height = 1, depth = 1) {
    this.width = width;
    this.height = height;
    this.depth = depth;
  }

  toBabylonMesh(name: string, scene: BABYLON.Scene): BABYLON.Mesh {
    const box = BABYLON.MeshBuilder.CreateBox(name, {
      width: this.width,
      height: this.height,
      depth: this.depth
    }, scene);
    return box;
  }
}

// Mesh compatibility wrapper
export class MeshCompat extends BABYLON.Mesh {
  userData: any = {};
  
  constructor(geometry?: BoxGeometryCompat, material?: BABYLON.Material, scene?: BABYLON.Scene) {
    const activeScene = scene || BABYLON.Engine.LastCreatedScene;
    if (!activeScene) throw new Error('No active Babylon scene');
    const sourceMesh = geometry instanceof BoxGeometryCompat
      ? geometry.toBabylonMesh('mesh', activeScene)
      : null;
    super(sourceMesh ? sourceMesh.name : 'mesh', activeScene, null, sourceMesh || undefined);
    if (sourceMesh) {
      sourceMesh.dispose(false, true);
    }
    
    if (material) {
      this.material = material;
    }
  }
}

// MathUtils compatibility
export const MathUtils = {
  clamp: (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
  },
  lerp: (x: number, y: number, t: number): number => {
    return BABYLON.Scalar.Lerp(x, y, t);
  },
  degToRad: (degrees: number): number => {
    return degrees * (Math.PI / 180);
  },
  radToDeg: (radians: number): number => {
    return radians * (180 / Math.PI);
  },
  isPowerOfTwo: (value: number): boolean => {
    return (value & (value - 1)) === 0 && value !== 0;
  },
  nearestPowerOfTwo: (value: number): number => {
    return Math.pow(2, Math.round(Math.log(value) / Math.LN2));
  },
  nextPowerOfTwo: (value: number): number => {
    value--;
    value |= value >> 1;
    value |= value >> 2;
    value |= value >> 4;
    value |= value >> 8;
    value |= value >> 16;
    value++;
    return value;
  }
};

// THREE namespace compatibility
export const THREE = {
  Vector3: Vector3Compat,
  Vector2: Vector2Compat,
  Color: ColorCompat,
  BoxGeometry: BoxGeometryCompat,
  MeshBasicMaterial: MeshBasicMaterialCompat,
  MeshStandardMaterial: MeshStandardMaterialCompat,
  Mesh: MeshCompat,
  Raycaster: RaycasterCompat,
  Spherical: SphericalCompat,
  Scene: BABYLON.Scene,
  PerspectiveCamera: BABYLON.UniversalCamera,
  OrthographicCamera: BABYLON.UniversalCamera,
  WebGLRenderer: BABYLON.Engine,
  Group: BABYLON.TransformNode,
  Object3D: BABYLON.TransformNode,
  Camera: BABYLON.Camera,
  Light: BABYLON.Light,
  AmbientLight: BABYLON.HemisphericLight,
  DirectionalLight: BABYLON.DirectionalLight,
  MathUtils: MathUtils,
  // Constants
  PCFSoftShadowMap: 'PCF'
};
