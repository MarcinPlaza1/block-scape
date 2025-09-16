// jsdom environment setup and global stubs for stores
import '@testing-library/jest-dom';

// Only run DOM-specific setup when window exists (node env tests skip this)
if (typeof window !== 'undefined') {
  // Polyfill requestIdleCallback/cancelIdleCallback
  if (!(window as any).requestIdleCallback) {
    (window as any).requestIdleCallback = (cb: any) => window.setTimeout(() => cb(), 1) as any;
  }
  if (!(window as any).cancelIdleCallback) {
    (window as any).cancelIdleCallback = (id: any) => window.clearTimeout(id);
  }

  // Stub scene3D used by stores to avoid errors during tests
  (window as any).scene3D = {
    loadScene: () => void 0,
    captureThumbnail: () => undefined,
    getGround: () => undefined,
  };

  // Basic BABYLON stub used by project store terrain capture
  (window as any).BABYLON = {
    Engine: { LastCreatedScene: { meshes: [] } },
  };

  // Polyfill/override canvas getContext for 2D to avoid jsdom not-implemented errors
  const CanvasProto: any = (window as any).HTMLCanvasElement?.prototype;
  if (CanvasProto) {
    const originalGetContext = CanvasProto.getContext;
    CanvasProto.getContext = function(type: string, ...args: any[]) {
      if (type === '2d') {
        return {
          fillStyle: '#000',
          strokeStyle: '#000',
          lineWidth: 1,
          fillRect: () => void 0,
          strokeRect: () => void 0,
          beginPath: () => void 0,
          moveTo: () => void 0,
          lineTo: () => void 0,
          fill: () => void 0,
          stroke: () => void 0,
          arc: () => void 0,
          clearRect: () => void 0,
          createLinearGradient: () => ({ addColorStop: () => void 0 }),
          createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData: () => void 0,
        } as any;
      }
      try {
        return originalGetContext?.call(this, type, ...args) ?? null;
      } catch {
        return null;
      }
    };
  }
}

// Stable localStorage/sessionStorage for tests (jsdom already provides, but wrap try/catch usages)
// No-op; presence is enough.


