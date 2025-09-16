import * as BABYLON from '@babylonjs/core';
import type { Block } from '../types';
import { BabylonMemoryManager } from '../utils';
import SceneMemoryManager from '../memoryManager';

const memoryManager = SceneMemoryManager.getInstance();

export function disposeBlock(block: Block, deps: { scene: BABYLON.Scene; world: any }) {
  try {
    // Use memory manager for disposal with reference counting
    if (block.mesh) {
      memoryManager.disposeMesh(block.mesh);
      BabylonMemoryManager.markDisposed(block.mesh);
      
      // In Babylon.js, dispose removes from scene automatically
      block.mesh.dispose(false, true); // Don't dispose materials (handled by memory manager), but dispose mesh
      
      (block as any).mesh = null; // Clear reference
    }
    
    // Remove physics body
    if (block.body && deps.world) {
      try { 
        deps.world.removeBody(block.body);
        BabylonMemoryManager.markDisposed(block.body);
        (block as any).body = null; // Clear reference
      } catch (error) {
        console.warn('Error removing physics body:', error);
      }
    }
    
  } catch (error) {
    console.warn('Error disposing block:', error);
  }
}