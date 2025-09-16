// Project management business logic service
// Handles complex project operations, validation, and coordination between stores

import type { Block, ProjectData, TerrainData } from '@/types/project';
import { ProjectService } from './api.service';

export interface ProjectSaveOptions {
  includeMetadata?: boolean;
  generateThumbnail?: boolean;
  compressionLevel?: 'none' | 'low' | 'medium' | 'high';
}

export interface ProjectValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ProjectManagerService {
  // Validation methods
  static validateProject(projectData: Partial<ProjectData>): ProjectValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!projectData.name?.trim()) {
      errors.push('Project name is required');
    } else if (projectData.name.trim().length < 3) {
      warnings.push('Project name is quite short');
    } else if (projectData.name.trim().length > 50) {
      errors.push('Project name is too long (max 50 characters)');
    }

    // Blocks validation
    if (!projectData.blocks || !Array.isArray(projectData.blocks)) {
      warnings.push('Project has no blocks');
    } else {
      // Check for block integrity
      const blockIds = new Set<string>();
      for (const block of projectData.blocks) {
        if (!block.id) {
          errors.push('Block missing ID');
        } else if (blockIds.has(block.id)) {
          errors.push(`Duplicate block ID: ${block.id}`);
        } else {
          blockIds.add(block.id);
        }

        if (!block.type) {
          errors.push(`Block ${block.id} missing type`);
        }

        if (!block.position || typeof block.position.x !== 'number' || 
            typeof block.position.y !== 'number' || typeof block.position.z !== 'number') {
          errors.push(`Block ${block.id} has invalid position`);
        }
      }

      // Check for reasonable block count
      if (projectData.blocks.length > 10000) {
        warnings.push('Project has a very large number of blocks (performance may be affected)');
      }
    }

    // Terrain validation
    if (projectData.terrain) {
      if (!projectData.terrain.positions) {
        warnings.push('Terrain data appears incomplete');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateBlockData(block: Partial<Block>): ProjectValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!block.id?.trim()) {
      errors.push('Block ID is required');
    }

    if (!block.type?.trim()) {
      errors.push('Block type is required');
    }

    if (!block.position) {
      errors.push('Block position is required');
    } else {
      const { x, y, z } = block.position;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        errors.push('Block position must contain valid numbers');
      }

      // Reasonable position bounds check
      if (Math.abs(x) > 1000 || Math.abs(y) > 1000 || Math.abs(z) > 1000) {
        warnings.push('Block is positioned very far from origin');
      }
    }

    // Scale validation
    const scale = (block as any).scale;
    if (scale !== undefined) {
      if (!Number.isFinite(scale) || scale <= 0) {
        errors.push('Block scale must be a positive number');
      } else if (scale > 10) {
        warnings.push('Block scale is very large');
      } else if (scale < 0.1) {
        warnings.push('Block scale is very small');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Project operations
  static async saveProjectToCloud(
    projectData: ProjectData,
    options: ProjectSaveOptions = {}
  ): Promise<{ success: boolean; project?: ProjectData; error?: string }> {
    try {
      // Validate project before saving
      const validation = this.validateProject(projectData);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
        };
      }

      // Generate thumbnail if requested
      let thumbnail: string | undefined;
      if (options.generateThumbnail) {
        try {
          thumbnail = (window as any).scene3D?.captureThumbnail?.({
            type: 'image/jpeg',
            quality: 0.8,
          });
        } catch (thumbnailError) {
          console.warn('Failed to generate thumbnail:', thumbnailError);
        }
      }

      // Prepare data for API
      const saveData = {
        name: projectData.name,
        blocks: projectData.blocks.map(this.sanitizeBlockForSave),
        terrain: projectData.terrain,
        ...(thumbnail && { thumbnail }),
      };

      // Save via API
      let result;
      if (projectData.id) {
        result = await ProjectService.updateProject(projectData.id, saveData);
      } else {
        result = await ProjectService.createProject(saveData);
      }

      const updatedProject: ProjectData = {
        id: result.game.id,
        name: result.game.name,
        blocks: projectData.blocks,
        timestamp: new Date().toISOString(),
        version: '1.2.0',
        terrain: projectData.terrain,
      };

      return {
        success: true,
        project: updatedProject,
      };
    } catch (error) {
      console.error('Failed to save project to cloud:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  static sanitizeBlockForSave(block: Block): any {
    return {
      id: block.id,
      type: block.type,
      position: { ...block.position },
      name: (block as any).name,
      hidden: (block as any).hidden || false,
      locked: (block as any).locked || false,
      color: (block as any).color,
      group: (block as any).group,
      rotationY: (block as any).rotationY || 0,
      rotationX: (block as any).rotationX || 0,
      rotationZ: (block as any).rotationZ || 0,
      scale: (block as any).scale || 1,
      mechanic: (block as any).mechanic,
      mechanicPower: (block as any).mechanicPower,
    };
  }

  // Local storage operations
  static saveProjectToLocal(projectData: ProjectData): boolean {
    try {
      const validation = this.validateProject(projectData);
      if (!validation.isValid) {
        console.warn('Project validation failed:', validation.errors);
        return false;
      }

      const projects = this.getSavedProjects();
      projects[projectData.name] = {
        ...projectData,
        timestamp: new Date().toISOString(),
      };

      localStorage.setItem('sandbox-projects', JSON.stringify(projects));
      return true;
    } catch (error) {
      console.error('Failed to save project locally:', error);
      return false;
    }
  }

  static getSavedProjects(): Record<string, ProjectData> {
    try {
      return JSON.parse(localStorage.getItem('sandbox-projects') || '{}');
    } catch {
      return {};
    }
  }

  static deleteLocalProject(projectName: string): boolean {
    try {
      const projects = this.getSavedProjects();
      delete projects[projectName];
      localStorage.setItem('sandbox-projects', JSON.stringify(projects));
      return true;
    } catch {
      return false;
    }
  }

  // Project templates and examples
  static createEmptyProject(name: string = 'Untitled Project'): ProjectData {
    return {
      id: undefined,
      name,
      blocks: [],
      timestamp: new Date().toISOString(),
      version: '1.2.0',
    };
  }

  static createBasicTemplate(name: string = 'Basic Template'): ProjectData {
    return {
      id: undefined,
      name,
      blocks: [
        {
          id: 'ground-1',
          type: 'cube',
          position: { x: 0, y: -1, z: 0 },
          name: 'Ground Block',
          color: 0x8b7355,
          scale: 5,
        } as Block,
        {
          id: 'start-1',
          type: 'start',
          position: { x: -3, y: 0, z: 0 },
          name: 'Start Point',
        } as Block,
        {
          id: 'finish-1',
          type: 'finish',
          position: { x: 3, y: 0, z: 0 },
          name: 'Finish Point',
        } as Block,
      ],
      timestamp: new Date().toISOString(),
      version: '1.2.0',
    };
  }

  // Utility methods
  static generateProjectId(): string {
    return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static calculateProjectSize(projectData: ProjectData): {
    blockCount: number;
    estimatedMemoryMB: number;
    hasComplexTerrain: boolean;
  } {
    const blockCount = projectData.blocks?.length || 0;
    const estimatedMemoryMB = Math.max(1, Math.ceil(blockCount * 0.001)); // Rough estimate
    const hasComplexTerrain = !!(projectData.terrain?.positions);

    return {
      blockCount,
      estimatedMemoryMB,
      hasComplexTerrain,
    };
  }
}
