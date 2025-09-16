import * as BABYLON from '@babylonjs/core';

export interface AtlasEntry {
  name: string;
  u: number;
  v: number;
  width: number;
  height: number;
  texture?: BABYLON.Texture;
}

export class TextureAtlasManager {
  private static instance: TextureAtlasManager;
  private atlases = new Map<string, {
    texture: BABYLON.DynamicTexture;
    entries: Map<string, AtlasEntry>;
    nextX: number;
    nextY: number;
    rowHeight: number;
  }>();

  static getInstance(): TextureAtlasManager {
    if (!TextureAtlasManager.instance) {
      TextureAtlasManager.instance = new TextureAtlasManager();
    }
    return TextureAtlasManager.instance;
  }

  createAtlas(
    name: string,
    size: number,
    scene: BABYLON.Scene
  ): BABYLON.DynamicTexture {
    const atlas = new BABYLON.DynamicTexture(name, size, scene, false);
    atlas.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
    atlas.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
    
    this.atlases.set(name, {
      texture: atlas,
      entries: new Map(),
      nextX: 0,
      nextY: 0,
      rowHeight: 0
    });
    
    return atlas;
  }

  addTextureToAtlas(
    atlasName: string,
    textureName: string,
    canvas: HTMLCanvasElement,
    padding: number = 2
  ): AtlasEntry | null {
    const atlas = this.atlases.get(atlasName);
    if (!atlas) return null;

    const atlasSize = atlas.texture.getSize().width;
    const width = canvas.width + padding * 2;
    const height = canvas.height + padding * 2;

    // Check if we need to move to next row
    if (atlas.nextX + width > atlasSize) {
      atlas.nextX = 0;
      atlas.nextY += atlas.rowHeight;
      atlas.rowHeight = 0;
    }

    // Check if texture fits in atlas
    if (atlas.nextY + height > atlasSize) {
      console.warn(`Atlas ${atlasName} is full`);
      return null;
    }

    // Draw texture to atlas
    const ctx = atlas.texture.getContext();
    ctx.drawImage(
      canvas,
      atlas.nextX + padding,
      atlas.nextY + padding
    );

    // Create entry
    const entry: AtlasEntry = {
      name: textureName,
      u: (atlas.nextX + padding) / atlasSize,
      v: (atlas.nextY + padding) / atlasSize,
      width: canvas.width / atlasSize,
      height: canvas.height / atlasSize
    };

    atlas.entries.set(textureName, entry);
    
    // Update position for next texture
    atlas.nextX += width;
    atlas.rowHeight = Math.max(atlas.rowHeight, height);

    // Update the dynamic texture
    atlas.texture.update();

    return entry;
  }

  getAtlasEntry(atlasName: string, textureName: string): AtlasEntry | null {
    const atlas = this.atlases.get(atlasName);
    if (!atlas) return null;
    return atlas.entries.get(textureName) || null;
  }

  applyAtlasToMaterial(
    material: BABYLON.PBRMaterial,
    atlasName: string,
    textureName: string
  ): boolean {
    const atlas = this.atlases.get(atlasName);
    const entry = atlas?.entries.get(textureName);
    
    if (!atlas || !entry) return false;

    // Set the atlas texture
    material.albedoTexture = atlas.texture;
    
    // Apply UV transformation
    if (material.albedoTexture) {
      material.albedoTexture.uScale = entry.width;
      material.albedoTexture.vScale = entry.height;
      material.albedoTexture.uOffset = entry.u;
      material.albedoTexture.vOffset = entry.v;
    }

    return true;
  }

  dispose(): void {
    for (const atlas of this.atlases.values()) {
      atlas.texture.dispose();
    }
    this.atlases.clear();
  }
}
