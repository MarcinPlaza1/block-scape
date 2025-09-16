import { makeKey } from './voxel-utils';

export type Bounds = { x: number; y: number; z: number };
export type VoxelKey = string;
export type VoxelColor = 'primary' | 'secondary' | number;

export type RLERun = [number, number];

export type RLEPayload = {
	version: number;
	voxelSize: number;
	bounds: Bounds;
	palette: string[];
	layers: { legs: [number, number]; torso: [number, number]; head: [number, number] };
	order: 'y-z-x';
	voxelsRLE: RLERun[];
};

export const buildLinearScanOrder = (bounds: Bounds) => {
	const xMin = -Math.floor(bounds.x / 2), xMax = Math.floor(bounds.x / 2);
	const zMin = -Math.floor(bounds.z / 2), zMax = Math.floor(bounds.z / 2);
	const yMin = 0, yMax = bounds.y - 1;
	return { xMin, xMax, yMin, yMax, zMin, zMax };
};

export const encodeVoxelsRLE = (voxels: Record<VoxelKey, VoxelColor>, bounds: Bounds): RLERun[] => {
	const { xMin, xMax, yMin, yMax, zMin, zMax } = buildLinearScanOrder(bounds);
	const valueAt = (x: number, y: number, z: number): number => {
		const c = voxels[makeKey(x, y, z)];
		if (typeof c === 'number') return c + 1; // 0=empty, 1..=palette index+1
		if (c === 'primary') return 1; if (c === 'secondary') return 2; return 0;
	};
	const runs: Array<[number, number]> = [];
	let current = -1; let count = 0;
	for (let y = yMin; y <= yMax; y++) {
		for (let z = zMin; z <= zMax; z++) {
			for (let x = xMin; x <= xMax; x++) {
				const v = valueAt(x, y, z);
				if (current === -1) { current = v; count = 1; }
				else if (v === current) { count++; }
				else { runs.push([current, count]); current = v; count = 1; }
			}
		}
	}
	if (current !== -1) runs.push([current, count]);
	return runs;
};

export const decodeVoxelsRLE = (runs: RLERun[], bounds: Bounds): Record<VoxelKey, number> => {
	const { xMin, xMax, yMin, yMax, zMin, zMax } = buildLinearScanOrder(bounds);
	const total = (xMax - xMin + 1) * (yMax - yMin + 1) * (zMax - zMin + 1);
	let idx = 0; const result: Record<VoxelKey, number> = {};
	const pushCell = (linearIndex: number, value: number) => {
		const ySpan = (xMax - xMin + 1) * (zMax - zMin + 1);
		const y = Math.floor(linearIndex / ySpan) + yMin;
		const rem = linearIndex % ySpan;
		const z = Math.floor(rem / (xMax - xMin + 1)) + zMin;
		const x = (rem % (xMax - xMin + 1)) + xMin;
		if (value > 0) result[makeKey(x, y, z)] = (value - 1) as number;
	};
	for (const [val, count] of runs) {
		for (let c = 0; c < count; c++) { if (idx >= total) break; pushCell(idx, val); idx++; }
	}
	return result;
};

export const createRLEPayload = (
	voxelSize: number,
	bounds: Bounds,
	palette: string[],
	voxels: Record<VoxelKey, VoxelColor>,
): RLEPayload => {
	return {
		version: 1,
		voxelSize,
		bounds,
		palette,
		layers: { legs: [0, 7], torso: [8, 15], head: [16, 23] },
		order: 'y-z-x',
		voxelsRLE: encodeVoxelsRLE(voxels, bounds),
	};
};


