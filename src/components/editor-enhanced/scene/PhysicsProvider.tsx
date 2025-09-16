import { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { usePhysicsWorld } from './usePhysicsWorld';
import type { BlockCollisionEvent } from './physics/types';
import * as BABYLON from '@babylonjs/core';

type TerrainMode = 'flat' | 'hilly';

interface PhysicsContextValue {
  worldRef: React.MutableRefObject<any>;
  dynamicMaterialRef: React.MutableRefObject<any>;
  createGround: (scene: BABYLON.Scene) => { ground: BABYLON.Mesh };
  rebuildGroundBodyFromMesh: (ground: BABYLON.Mesh) => void;
  emitCollisionEvents: () => void;
  addCollisionListener: (callback: (event: BlockCollisionEvent) => void) => () => void;
  applyTerrainPreset: (scene: BABYLON.Scene, presetType: 'flat' | 'hilly' | 'mountains') => BABYLON.Mesh;
}

const PhysicsContext = createContext<PhysicsContextValue | null>(null);

export const usePhysicsContext = () => {
  const context = useContext(PhysicsContext);
  if (!context) {
    throw new Error('usePhysicsContext must be used within a PhysicsProvider');
  }
  return context;
};

interface PhysicsProviderProps {
  children: ReactNode;
  terrainMode?: TerrainMode;
}

export const PhysicsProvider = ({ 
  children, 
  terrainMode = 'flat' 
}: PhysicsProviderProps) => {
  const physics = usePhysicsWorld(terrainMode);
  
  const value: PhysicsContextValue = {
    worldRef: physics.worldRef,
    dynamicMaterialRef: physics.dynamicMaterialRef,
    createGround: physics.createGround,
    rebuildGroundBodyFromMesh: physics.rebuildGroundBodyFromMesh,
    emitCollisionEvents: physics.emitCollisionEvents,
    addCollisionListener: physics.addCollisionListener,
    applyTerrainPreset: (scene, presetType) => physics.applyTerrainPreset(scene, presetType)
  };

  return (
    <PhysicsContext.Provider value={value}>
      {children}
    </PhysicsContext.Provider>
  );
};
