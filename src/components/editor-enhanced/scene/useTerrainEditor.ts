import { useRef } from 'react';
import * as BABYLON from '@babylonjs/core';

type BrushMode = 'raise' | 'lower' | 'smooth' | 'paint';

export function useTerrainEditor(params: {
  sceneRef: React.MutableRefObject<BABYLON.Scene | null>;
  groundRef: React.MutableRefObject<BABYLON.Mesh | null>;
  rebuildGroundBodyFromMesh: (ground: BABYLON.Mesh | null) => void;
}) {
  const lastEditTimeRef = useRef<number>(0);
  const throttleMs = 16;

  const applyBrush = (worldPoint: BABYLON.Vector3, mode: BrushMode, size: number, strength: number, color?: number) => {
    const scene = params.sceneRef.current;
    const ground = params.groundRef.current;
    if (!scene || !ground) return;

    try {
      const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      const colors = ground.getVerticesData(BABYLON.VertexBuffer.ColorKind);
      const indices = ground.getIndices();
      if (!positions || !indices) return;

      const radius = Math.max(0.05, size);
      const radiusSq = radius * radius;

      for (let i = 0; i < positions.length; i += 3) {
        const vx = positions[i];
        const vy = positions[i + 1];
        const vz = positions[i + 2];
        const dx = vx - worldPoint.x;
        const dz = vz - worldPoint.z;
        const distSq = dx * dx + dz * dz;
        if (distSq > radiusSq) continue;

        const falloff = 1 - Math.sqrt(distSq) / radius;
        const delta = strength * falloff;

        if (mode === 'raise') {
          positions[i + 1] = vy + delta;
        } else if (mode === 'lower') {
          positions[i + 1] = vy - delta;
        } else if (mode === 'smooth') {
          positions[i + 1] = vy * (1 - 0.3 * falloff) + worldPoint.y * (0.3 * falloff);
        } else if (mode === 'paint') {
          if (typeof color === 'number') {
            if (!colors || colors.length !== (positions.length / 3) * 4) {
              const vcount = positions.length / 3;
              const newColors = new Array(vcount * 4).fill(1);
              ground.setVerticesData(BABYLON.VertexBuffer.ColorKind, newColors, true);
            }
            const effective = ground.getVerticesData(BABYLON.VertexBuffer.ColorKind);
            if (effective) {
              const r = ((color >> 16) & 255) / 255;
              const g = ((color >> 8) & 255) / 255;
              const b = (color & 255) / 255;
              const a = 1;
              const idx = (i / 3) * 4;
              effective[idx + 0] = effective[idx + 0] * (1 - falloff) + r * falloff;
              effective[idx + 1] = effective[idx + 1] * (1 - falloff) + g * falloff;
              effective[idx + 2] = effective[idx + 2] * (1 - falloff) + b * falloff;
              effective[idx + 3] = a;
              ground.updateVerticesData(BABYLON.VertexBuffer.ColorKind, effective);
            }
          }
        }
      }

      ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
      ground.createNormals(true);

      params.rebuildGroundBodyFromMesh(ground);

    } catch {}
  };

  const tryApplyBrushThrottled = (point: BABYLON.Vector3, mode: BrushMode, size: number, strength: number, color?: number) => {
    const now = performance.now();
    if (now - lastEditTimeRef.current < throttleMs) return;
    lastEditTimeRef.current = now;
    applyBrush(point, mode, size, strength, color);
  };

  return { applyBrush, tryApplyBrushThrottled } as const;
}


