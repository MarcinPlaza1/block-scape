import type { World, Body, Vec3, Material, ContactMaterial, Shape } from 'cannon-es';

// Basic types to avoid 'any'
export type CannonWorld = World;
export type CannonBody = Body;
export type CannonVec3 = Vec3;
export type CannonMaterial = Material;
export type CannonContactMaterial = ContactMaterial;
export type CannonShape = Shape;

/**
 * Block-specific physics behavior types.
 * Custom engine properties can be defined here.
 */
export interface BlockPhysicsMaterial extends CannonMaterial {
  blockType?: string; // e.g., 'ice', 'bouncy'
  frictionMultiplier?: number;
}

/**
 * Structure for physics-related properties of a block.
 */
export interface BlockPhysicsData {
  body: CannonBody;
  material?: BlockPhysicsMaterial;
  isSensor?: boolean; // e.g., for checkpoints
}

/**
 * Collision event structure for custom callbacks.
 */
export interface BlockCollisionEvent {
  bodyA: CannonBody;
  bodyB: CannonBody;
  contact: any; // CANNON.ContactEquation is not exported from cannon-es
  phase: 'begin' | 'end' | 'stay';
}
