import * as BABYLON from '@babylonjs/core';

export interface LODConfig {
  distances: number[];
  reductions: number[]; // decimation percentages: 0 = full quality, 0.5 = 50% reduction
}

const DEFAULT_LOD_CONFIG: Record<string, LODConfig> = {
  // Complex shapes get more aggressive LOD
  sphere: {
    distances: [10, 20, 30],
    reductions: [0.3, 0.6, 0.8]
  },
  cylinder: {
    distances: [10, 20, 30],
    reductions: [0.3, 0.6, 0.8]
  },
  cone: {
    distances: [10, 20, 30],
    reductions: [0.3, 0.6, 0.8]
  },
  torus: {
    distances: [10, 20, 30],
    reductions: [0.4, 0.7, 0.85]
  },
  // Simple shapes get less aggressive LOD
  cube: {
    distances: [15, 30],
    reductions: [0.0, 0.5] // Cubes are already simple
  },
  plate: {
    distances: [15, 30],
    reductions: [0.0, 0.5]
  },
  // Default for others
  default: {
    distances: [12, 25, 35],
    reductions: [0.2, 0.5, 0.75]
  }
};

export function setupMeshLOD(
  mesh: BABYLON.Mesh,
  blockType: string,
  qualityMode: 'performance' | 'balanced' | 'quality' = 'balanced'
): void {
  const config = DEFAULT_LOD_CONFIG[blockType] || DEFAULT_LOD_CONFIG.default;
  
  // Adjust distances based on quality mode
  const distanceMultiplier = qualityMode === 'quality' ? 1.5 : (qualityMode === 'performance' ? 0.7 : 1.0);
  const adjustedDistances = config.distances.map(d => d * distanceMultiplier);
  
  // Skip LOD for performance mode on simple shapes
  if (qualityMode === 'performance' && (blockType === 'cube' || blockType === 'plate')) {
    return;
  }

  try {
    // Add LOD levels
    for (let i = 0; i < config.reductions.length; i++) {
      const reduction = config.reductions[i];
      const distance = adjustedDistances[i];
      
      if (reduction === 0) {
        // Use original mesh at this distance
        mesh.addLODLevel(distance, mesh);
      } else {
        // Create simplified mesh
        const lodMesh = createSimplifiedMesh(mesh, reduction);
        if (lodMesh) {
          mesh.addLODLevel(distance, lodMesh);
        }
      }
    }
    
    // Add null LOD for very far distances
    const maxDistance = adjustedDistances[adjustedDistances.length - 1] * 1.5;
    mesh.addLODLevel(maxDistance, null);
  } catch (error) {
    console.warn('Failed to setup LOD for mesh:', error);
  }
}

function createSimplifiedMesh(originalMesh: BABYLON.Mesh, reductionPercent: number): BABYLON.Mesh | null {
  try {
    // Clone the mesh for LOD
    const lodMesh = originalMesh.clone(originalMesh.name + '_lod' + Math.floor(reductionPercent * 100));
    
    // For basic shapes, we can use simpler geometry
    const simplifications: Record<string, () => BABYLON.Mesh | null> = {
      sphere: () => {
        const segments = Math.max(8, Math.floor(16 * (1 - reductionPercent)));
        return BABYLON.MeshBuilder.CreateSphere(lodMesh.name, { 
          diameter: 1, 
          segments 
        }, originalMesh.getScene());
      },
      cylinder: () => {
        const tessellation = Math.max(8, Math.floor(16 * (1 - reductionPercent)));
        return BABYLON.MeshBuilder.CreateCylinder(lodMesh.name, { 
          diameter: 1, 
          height: 1, 
          tessellation 
        }, originalMesh.getScene());
      },
      cone: () => {
        const tessellation = Math.max(6, Math.floor(16 * (1 - reductionPercent)));
        return BABYLON.MeshBuilder.CreateCylinder(lodMesh.name, { 
          diameterTop: 0, 
          diameterBottom: 1, 
          height: 1, 
          tessellation 
        }, originalMesh.getScene());
      },
      torus: () => {
        const tessellation = Math.max(8, Math.floor(24 * (1 - reductionPercent)));
        return BABYLON.MeshBuilder.CreateTorus(lodMesh.name, { 
          diameter: 1.2, 
          thickness: 0.4, 
          tessellation 
        }, originalMesh.getScene());
      }
    };
    
    // Check if we have a specific simplification
    const blockType = (originalMesh.metadata as any)?.blockType;
    if (blockType && simplifications[blockType]) {
      const simplifiedMesh = simplifications[blockType]();
      if (simplifiedMesh) {
        // Copy material and other properties
        simplifiedMesh.material = originalMesh.material;
        simplifiedMesh.position = originalMesh.position.clone();
        simplifiedMesh.rotation = originalMesh.rotation.clone();
        simplifiedMesh.scaling = originalMesh.scaling.clone();
        simplifiedMesh.isVisible = false; // LOD meshes start hidden
        return simplifiedMesh;
      }
    }
    
    // For other meshes, just return the clone (could implement decimation here)
    lodMesh.isVisible = false;
    return lodMesh;
  } catch {
    return null;
  }
}

export function optimizeMeshForRendering(mesh: BABYLON.Mesh): void {
  try {
    // Freeze world matrix if the mesh won't move
    if (!(mesh.metadata as any)?.isDynamic) {
      mesh.freezeWorldMatrix();
    }
    
    // Enable automatic optimization
    mesh.doNotSyncBoundingInfo = true;
    
    // Optimize indices if available
    if (mesh.geometry && typeof (mesh.geometry as any).optimize === 'function') {
      (mesh.geometry as any).optimize();
    }
    
    // Convert to flat shaded for better performance on low-poly meshes
    const blockType = (mesh.metadata as any)?.blockType;
    if (blockType && ['pyramid', 'wedge', 'ramp'].includes(blockType)) {
      mesh.convertToFlatShadedMesh();
    }
  } catch (error) {
    console.warn('Failed to optimize mesh:', error);
  }
}
