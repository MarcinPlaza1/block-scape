export type BlockType =
  | 'cube'
  | 'cube_bouncy'
  | 'cube_ice'
  | 'cube_conveyor'
  | 'cube_boost'
  | 'cube_slow'
  | 'cube_sticky'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'pyramid'
  | 'plate'
  | 'ramp'
  | 'torus'
  | 'wedge'
  | 'door'
  | 'window'
  | 'fence'
  | 'start'
  | 'checkpoint'
  | 'finish'
  | 'hazard';

export type Dimensions = { x: number; y: number; z: number };

const dims: Record<BlockType, Dimensions> = {
  cube: { x: 1, y: 1, z: 1 },
  cube_bouncy: { x: 1, y: 1, z: 1 },
  cube_ice: { x: 1, y: 1, z: 1 },
  cube_conveyor: { x: 1, y: 1, z: 1 },
  cube_boost: { x: 1, y: 1, z: 1 },
  cube_slow: { x: 1, y: 1, z: 1 },
  cube_sticky: { x: 1, y: 1, z: 1 },
  sphere: { x: 1, y: 1, z: 1 }, // diameter 1
  cylinder: { x: 1, y: 1, z: 1 }, // approx bbox
  cone: { x: 1, y: 1, z: 1 }, // approx bbox
  pyramid: { x: 1, y: 1, z: 1 }, // approx bbox
  plate: { x: 1, y: 0.2, z: 1 },
  ramp: { x: 1, y: 1, z: 1 },
  torus: { x: 1.2, y: 0.4, z: 1.2 }, // approx bbox
  wedge: { x: 1, y: 0.5, z: 1 },
  door: { x: 1, y: 2, z: 0.12 },
  window: { x: 1.2, y: 1, z: 0.08 },
  fence: { x: 1.4, y: 1, z: 0.06 },
  start: { x: 1.6, y: 0.2, z: 1.6 }, // pad diameter 1.6
  checkpoint: { x: 1.6, y: 0.2, z: 1.6 },
  finish: { x: 1.6, y: 0.2, z: 1.6 },
  hazard: { x: 1, y: 0.2, z: 1 },
};

export function getBlockDimensions(type: BlockType, scale = 1): Dimensions {
  const d = dims[type];
  return { x: d.x * scale, y: d.y * scale, z: d.z * scale };
}


