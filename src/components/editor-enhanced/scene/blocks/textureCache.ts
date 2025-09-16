import * as BABYLON from '@babylonjs/core';

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Texture cache to prevent recreation of textures
class TextureCache {
  private static instance: TextureCache;
  private textures = new Map<string, BABYLON.Texture>();
  private scene: BABYLON.Scene | null = null;
  private quality = {
    anisotropy: 4,
    sampling: BABYLON.Texture.TRILINEAR_SAMPLINGMODE as number
  };

  static getInstance(): TextureCache {
    if (!TextureCache.instance) {
      TextureCache.instance = new TextureCache();
    }
    return TextureCache.instance;
  }

  private getScene(): BABYLON.Scene {
    if (!this.scene) {
      this.scene = BABYLON.Engine.LastCreatedScene!;
    }
    return this.scene;
  }

  private createConveyorTexture(): BABYLON.Texture {
    const canvas = createCanvas(64, 64);
    const ctx = canvas.getContext('2d')!;
    // background
    ctx.fillStyle = '#2f2f2f';
    ctx.fillRect(0, 0, 64, 64);
    // diagonal stripes
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 6;
    for (let i = -64; i < 64; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 64);
      ctx.lineTo(i + 64, 0);
      ctx.stroke();
    }
    
    const tex = new BABYLON.DynamicTexture('conveyorTexture', canvas, this.getScene());
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.updateSamplingMode(this.quality.sampling);
    tex.anisotropicFilteringLevel = this.quality.anisotropy;
    tex.hasAlpha = false;
    tex.update();
    return tex;
  }

  private createBouncyTexture(): BABYLON.Texture {
    const canvas = createCanvas(64, 64);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, 0, 64, 64);
    // polka dots
    ctx.fillStyle = '#22c55e';
    for (let y = 8; y < 64; y += 16) {
      for (let x = 8; x < 64; x += 16) {
        ctx.beginPath();
        ctx.arc(x + ((y / 16) % 2 ? 4 : 0), y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    const tex = new BABYLON.DynamicTexture('bouncyTexture', canvas, this.getScene());
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.updateSamplingMode(this.quality.sampling);
    tex.anisotropicFilteringLevel = this.quality.anisotropy;
    tex.hasAlpha = false;
    tex.update();
    return tex;
  }

  private createIceTexture(): BABYLON.Texture {
    const canvas = createCanvas(64, 64);
    const ctx = canvas.getContext('2d')!;
    // gradient bluish
    const grad = ctx.createLinearGradient(0, 0, 64, 64);
    grad.addColorStop(0, '#e0fbff');
    grad.addColorStop(1, '#67e8f9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    // subtle cracks/noise
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 64, Math.random() * 64);
      for (let j = 0; j < 4; j++) {
        ctx.lineTo(Math.random() * 64, Math.random() * 64);
      }
      ctx.stroke();
    }
    
    const tex = new BABYLON.DynamicTexture('iceTexture', canvas, this.getScene());
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.updateSamplingMode(this.quality.sampling);
    tex.anisotropicFilteringLevel = this.quality.anisotropy;
    tex.hasAlpha = true;
    tex.update();
    return tex;
  }

  getTexture(type: 'conveyor' | 'bouncy' | 'ice'): BABYLON.Texture {
    if (!this.textures.has(type)) {
      let texture: BABYLON.Texture;
      switch (type) {
        case 'conveyor':
          texture = this.createConveyorTexture();
          break;
        case 'bouncy':
          texture = this.createBouncyTexture();
          break;
        case 'ice':
          texture = this.createIceTexture();
          break;
        default:
          throw new Error(`Unknown texture type: ${type}`);
      }
      this.textures.set(type, texture);
    }
    return this.textures.get(type)!;
  }

  // Set the scene to use for texture creation
  setScene(scene: BABYLON.Scene): void {
    this.scene = scene;
  }

  // Quality settings for sampling and anisotropy
  setQuality(settings: { anisotropy?: number; sampling?: number }): void {
    if (typeof settings.anisotropy === 'number') {
      this.quality.anisotropy = Math.max(1, Math.floor(settings.anisotropy));
    }
    if (typeof settings.sampling === 'number') {
      this.quality.sampling = settings.sampling;
    }
    // Apply to cached textures
    for (const texture of this.textures.values()) {
      try {
        texture.updateSamplingMode(this.quality.sampling);
        texture.anisotropicFilteringLevel = this.quality.anisotropy;
      } catch {}
    }
  }

  // Procedural bump textures to add subtle surface detail
  private createBumpTexture(type: 'conveyor' | 'bouncy' | 'ice'): BABYLON.Texture {
    const canvas = createCanvas(64, 64);
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 64);

    if (type === 'conveyor') {
      // Shallow ramped stripes as height map
      const grad = ctx.createLinearGradient(0, 0, 64, 64);
      grad.addColorStop(0, '#808080');
      grad.addColorStop(1, '#909090');
      ctx.fillStyle = '#888888';
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = '#a0a0a0';
      ctx.lineWidth = 2;
      for (let i = -64; i < 64; i += 8) {
        ctx.beginPath();
        ctx.moveTo(i, 64);
        ctx.lineTo(i + 64, 0);
        ctx.stroke();
      }
    } else if (type === 'bouncy') {
      // Dots as height bumps
      ctx.fillStyle = '#7f7f7f';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#9a9a9a';
      for (let y = 8; y < 64; y += 16) {
        for (let x = 8; x < 64; x += 16) {
          ctx.beginPath();
          ctx.arc(x + ((y / 16) % 2 ? 4 : 0), y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // Ice: subtle noise
      const imgData = ctx.createImageData(64, 64);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const v = 120 + Math.floor(Math.random() * 16);
        imgData.data[i] = v;
        imgData.data[i + 1] = v;
        imgData.data[i + 2] = v;
        imgData.data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const tex = new BABYLON.DynamicTexture(`bump_${type}`, canvas, this.getScene());
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.updateSamplingMode(this.quality.sampling);
    tex.anisotropicFilteringLevel = this.quality.anisotropy;
    tex.hasAlpha = false;
    tex.update();
    return tex;
  }

  getBumpTexture(type: 'conveyor' | 'bouncy' | 'ice'): BABYLON.Texture {
    const key = `bump_${type}`;
    if (!this.textures.has(key)) {
      const t = this.createBumpTexture(type);
      this.textures.set(key, t);
    }
    return this.textures.get(key)!;
  }

  // Load and cache URL-based textures with current quality settings
  getUrlTexture(
    url: string,
    options: {
      hasAlpha?: boolean;
      invertY?: boolean;
      wrapU?: number;
      wrapV?: number;
      sampling?: number;
      anisotropy?: number;
      noMipmap?: boolean;
    } = {}
  ): BABYLON.Texture {
    const key = `url:${url}`;
    if (!this.textures.has(key)) {
      const sampling = options.sampling ?? this.quality.sampling;
      const tex = new BABYLON.Texture(
        url,
        this.getScene(),
        !!options.noMipmap,
        options.invertY ?? false,
        sampling
      );
      tex.wrapU = options.wrapU ?? BABYLON.Texture.WRAP_ADDRESSMODE;
      tex.wrapV = options.wrapV ?? BABYLON.Texture.WRAP_ADDRESSMODE;
      if (typeof options.hasAlpha === 'boolean') tex.hasAlpha = options.hasAlpha;
      tex.anisotropicFilteringLevel = options.anisotropy ?? this.quality.anisotropy;
      this.textures.set(key, tex);
    }
    return this.textures.get(key)!;
  }

  // Dispose all cached textures
  disposeAll(): void {
    for (const texture of this.textures.values()) {
      texture.dispose();
    }
    this.textures.clear();
  }

  // Get texture count for debugging
  getCachedTextureCount(): number {
    return this.textures.size;
  }
}

export default TextureCache;