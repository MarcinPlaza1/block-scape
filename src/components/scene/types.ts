import type * as THREE from 'three';

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

export interface Block {
  id: string;
  type: BlockType;
  position: { x: number; y: number; z: number };
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  color?: number;
  rotationY?: number;
  rotationX?: number;
  rotationZ?: number;
  scale?: number;
  mechanic?: MechanicType;
  mechanicPower?: number;
  mesh?: THREE.Mesh;
  // Using any for physics body to avoid coupling to cannon-es typings
  body?: any;
}

export interface Scene3DProps {
  onBlockAdd?: (block: Block) => void;
  droppedBlock?: { type: BlockType } | null;
  onSceneStateChange?: (blocks: Block[]) => void;
  loadedBlocks?: Block[];
  selectedTool?: 'select' | 'move' | 'paint';
  isPlayMode?: boolean;
  terrainMode?: 'flat' | 'hilly';
  cameraMode?: 'orbit' | 'first' | 'ortho';
  // Gameplay event hooks (play mode)
  onGameStart?: (pos: { x: number; y: number; z: number }) => void;
  onGameCheckpoint?: (pos: { x: number; y: number; z: number }) => void;
  onGameFinish?: (pos: { x: number; y: number; z: number }) => void;
  onGameHazard?: (pos: { x: number; y: number; z: number }) => void;
}


