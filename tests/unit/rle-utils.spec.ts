import { describe, it, expect } from 'vitest';
import { createRLEPayload, decodeVoxelsRLE } from '@/pages/skin-studio/lib/rle';
import { makeKey, createClampToBounds, rectPositionsOnPlane, linePositionsAxisAligned, spherePositions } from '@/pages/skin-studio/lib/voxel-utils';

const bounds = { x: 4, y: 4, z: 4 };

describe('RLE utils', () => {
	it('encodes and decodes voxel map correctly', () => {
		const voxels: Record<string, number> = {};
		voxels[makeKey(-1, 0, 0)] = 0;
		voxels[makeKey(0, 0, 0)] = 1;
		voxels[makeKey(1, 0, 0)] = 2;
		const payload = createRLEPayload(0.1, bounds, ['#000000', '#111111'], voxels);
		const decoded = decodeVoxelsRLE(payload.voxelsRLE, bounds);
		expect(decoded[makeKey(-1, 0, 0)]).toBe(0);
		expect(decoded[makeKey(0, 0, 0)]).toBe(1);
		expect(decoded[makeKey(1, 0, 0)]).toBe(2);
	});
});

describe('voxel geometry helpers', () => {
	it('clamps coordinates to bounds', () => {
		const clamp = createClampToBounds(bounds);
		const c = clamp(-999, 9, 999);
		expect(c.x).toBe(-Math.floor(bounds.x / 2));
		expect(c.y).toBe(bounds.y - 1);
		expect(c.z).toBe(Math.floor(bounds.z / 2));
	});
	it('rect positions on plane returns contiguous area', () => {
		const pts = rectPositionsOnPlane({ x: 0, y: 1, z: 0 }, { x: 2, y: 2, z: 2 }, 'y');
		expect(pts.length).toBe((2 - 0 + 1) * (2 - 0 + 1));
	});
	it('line positions axis aligned returns correct count', () => {
		const pts = linePositionsAxisAligned({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, 'x');
		expect(pts.length).toBe(4);
	});
	it('sphere positions roughly scales with radius^3', () => {
		const r1 = spherePositions({ x: 0, y: 0, z: 0 }, 1).length;
		const r2 = spherePositions({ x: 0, y: 0, z: 0 }, 2).length;
		expect(r2).toBeGreaterThan(r1);
	});
});
