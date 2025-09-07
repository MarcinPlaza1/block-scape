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

export type MechanicType =
  | 'none'
  | 'bouncy'
  | 'ice'
  | 'conveyor'
  | 'boost'
  | 'slow'
  | 'sticky'
  | 'checkpoint'
  | 'finish'
  | 'hazard';

export type Block = {
  id: string;
  type: BlockType;
  position: { x: number; y: number; z: number };
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  color?: number;
  group?: string;
  rotationY?: number;
  rotationX?: number;
  rotationZ?: number;
  scale?: number;
  mechanic?: MechanicType;
  mechanicPower?: number; // generic strength for mechanic (e.g., conveyor/boost strength)
};

export type ProjectData = {
  id?: string;
  name: string;
  blocks: Block[];
  timestamp: string;
  version: string;
  published?: boolean;
  thumbnailUrl?: string;
};


