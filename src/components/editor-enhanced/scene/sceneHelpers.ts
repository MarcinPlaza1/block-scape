import * as BABYLON from '@babylonjs/core';
import type { Block } from './types';
import { getBlockDimensions } from '@/components/editor-enhanced/scene/physics/blockDimensions';

/**
 * Get the height of a block based on its type
 */
export const getBlockHeight = (type: Block['type']): number => {
  switch(type) {
    case 'door': return 2;
    case 'plate': 
    case 'start':
    case 'checkpoint':
    case 'finish':
    case 'hazard': return 0.2;
    case 'sphere': return 1;
    case 'cylinder':
    case 'cone':
    case 'pyramid': return 1;
    case 'window': return 1;
    case 'fence': return 1;
    case 'torus': return 0.4;
    case 'wedge': return 0.5;
    case 'ramp': return 1;
    default: return 1; // cube and variants
  }
};

/**
 * Check if a block would collide with existing blocks
 */
export const checkBlockCollision = (
  position: BABYLON.Vector3,
  type: Block['type'],
  existingBlocks: Block[],
  rotationYDeg: number = 0,
  scale: number = 1
): boolean => {
  const buffer = 0.001;
  const dimsA = getBlockDimensions(type as any, scale);
  const halfA = new BABYLON.Vector3(dimsA.x / 2, dimsA.y / 2, dimsA.z / 2);
  const rotA = rotationYDeg * Math.PI / 180;

  // Build oriented AABB for A via rotation matrix (Y-rotation only)
  const rotMatA = BABYLON.Matrix.RotationY(rotA);

  return existingBlocks.some(block => {
    if (!block.position) return false;

    const dimsB = getBlockDimensions(block.type as any, block.scale ?? 1);
    const halfB = new BABYLON.Vector3(dimsB.x / 2, dimsB.y / 2, dimsB.z / 2);
    const rotB = (block.rotationY || 0) * Math.PI / 180;
    const rotMatB = BABYLON.Matrix.RotationY(rotB);

    // Convert to OBBs and do SAT on Y-rotated boxes (approximation: axes are rotated world X/Z plus Y)
    // Fast pre-check: world-space AABB from OBB projection (cheap approximation)
    const worldHalfA = new BABYLON.Vector3(
      Math.abs(halfA.x * Math.cos(rotA)) + Math.abs(halfA.z * Math.sin(rotA)),
      halfA.y,
      Math.abs(halfA.x * Math.sin(rotA)) + Math.abs(halfA.z * Math.cos(rotA))
    );
    const worldHalfB = new BABYLON.Vector3(
      Math.abs(halfB.x * Math.cos(rotB)) + Math.abs(halfB.z * Math.sin(rotB)),
      halfB.y,
      Math.abs(halfB.x * Math.sin(rotB)) + Math.abs(halfB.z * Math.cos(rotB))
    );

    const dx = Math.abs(position.x - block.position.x);
    const dy = Math.abs(position.y - block.position.y);
    const dz = Math.abs(position.z - block.position.z);

    const overlapX = dx <= (worldHalfA.x + worldHalfB.x - buffer);
    const overlapY = dy <= (worldHalfA.y + worldHalfB.y - buffer);
    const overlapZ = dz <= (worldHalfA.z + worldHalfB.z - buffer);

    return overlapX && overlapY && overlapZ;
  });
};

/**
 * Calculate block position based on pick result and what was hit
 */
export const calculateBlockPosition = (
  pickInfo: BABYLON.PickingInfo,
  blockType: Block['type'],
  groundMesh: BABYLON.Mesh | null,
  existingBlocks: Block[],
  snapEnabled: boolean,
  snapSize: number
): BABYLON.Vector3 => {
  if (!pickInfo.pickedPoint) {
    return new BABYLON.Vector3(0, 0, 0);
  }
  
  const position = pickInfo.pickedPoint.clone();
  const blockHeight = getBlockHeight(blockType);
  
  if (pickInfo.pickedMesh === groundMesh) {
    // Placing on ground: base on actual picked Y (supports uneven terrain)
    position.y = pickInfo.pickedPoint.y + blockHeight / 2;
  } else {
    // Placing on another block
    const hitBlock = existingBlocks.find(b => b.mesh === pickInfo.pickedMesh);
    if (hitBlock) {
      const hitBlockHeight = getBlockHeight(hitBlock.type);
      position.y = hitBlock.position.y + hitBlockHeight / 2 + blockHeight / 2;
    } else {
      position.y = pickInfo.pickedPoint.y + blockHeight / 2;
    }
  }

  if (snapEnabled) {
    const s = snapSize || 1;
    position.x = Math.round(position.x / s) * s;
    position.z = Math.round(position.z / s) * s;
  }

  return position;
};

/**
 * Align a position to the grid
 */
export const alignToGrid = (position: { x: number; y: number; z: number }, snapSize: number) => {
  const s = snapSize || 1;
  return {
    x: Math.round(position.x / s) * s,
    y: position.y,
    z: Math.round(position.z / s) * s
  };
};

/**
 * Ground a position (set Y to ground level)
 */
export const groundPosition = (position: { x: number; y: number; z: number }) => {
  return { x: position.x, y: 0.5, z: position.z };
};