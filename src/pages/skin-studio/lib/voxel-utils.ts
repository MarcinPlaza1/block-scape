import type * as BABYLON from '@babylonjs/core';

export type Bounds = { x: number; y: number; z: number };
export type VoxelKey = string;
export type VoxelColor = 'primary' | 'secondary' | number;

export const makeKey = (x: number, y: number, z: number): VoxelKey => `${x},${y},${z}`;
export const parseKey = (k: VoxelKey): { x: number; y: number; z: number } => {
	const [xs, ys, zs] = k.split(',');
	return { x: parseInt(xs, 10), y: parseInt(ys, 10), z: parseInt(zs, 10) };
};

export const createClampToBounds = (bounds: Bounds) => (x: number, y: number, z: number) => ({
	x: Math.max(-Math.floor(bounds.x / 2), Math.min(Math.floor(bounds.x / 2), x)),
	y: Math.max(0, Math.min(bounds.y - 1, y)),
	z: Math.max(-Math.floor(bounds.z / 2), Math.min(Math.floor(bounds.z / 2), z)),
});

export const createWorldToGrid = (voxelSize: number, bounds: Bounds) => {
	const clamp = createClampToBounds(bounds);
	return (p: BABYLON.Vector3) => {
		const inv = 1 / voxelSize;
		return clamp(Math.round(p.x * inv), Math.round(p.y * inv), Math.round(p.z * inv));
	};
};

export const createGridToWorld = (voxelSize: number) => (x: number, y: number, z: number) => ({ x: x * voxelSize, y: y * voxelSize, z: z * voxelSize });

export type ActiveLayer = 'all' | 'legs' | 'torso' | 'head';

export const getLayerRange = (layer: ActiveLayer, yHint: number | undefined, bounds: Bounds): { min: number; max: number } => {
	if (layer === 'legs') return { min: 0, max: 7 };
	if (layer === 'torso') return { min: 8, max: 15 };
	if (layer === 'head') return { min: 16, max: 23 };
	const y = Math.max(0, Math.min(bounds.y - 1, yHint ?? 0));
	if (y <= 7) return { min: 0, max: 7 };
	if (y <= 15) return { min: 8, max: 15 };
	return { min: 16, max: 23 };
};

export const getLayerMid = (r: { min: number; max: number }) => Math.floor((r.min + r.max) / 2);

export const isInActiveLayer = (x: number, y: number, _z: number, activeLayer: ActiveLayer): boolean => {
	if (activeLayer === 'all') return true;
	if (activeLayer === 'legs') return y >= 0 && y <= 7;
	if (activeLayer === 'torso') return y >= 8 && y <= 15;
	if (activeLayer === 'head') return y >= 16 && y <= 23;
	return true;
};

export const applyVoxelBatchGeneric = (
	prev: Record<VoxelKey, VoxelColor>,
	positions: Array<{ x: number; y: number; z: number }>,
	action: 'set' | 'remove',
	color: VoxelColor,
	opts: { activeLayer: ActiveLayer; mirrorX: boolean; bounds: Bounds }
): Record<VoxelKey, VoxelColor> => {
	if (positions.length === 0) return prev;
	const next = { ...prev } as Record<VoxelKey, VoxelColor>;
	const clamp = createClampToBounds(opts.bounds);
	for (const p of positions) {
		const c = clamp(p.x, p.y, p.z);
		if (!isInActiveLayer(c.x, c.y, c.z, opts.activeLayer)) continue;
		const key = makeKey(c.x, c.y, c.z);
		if (action === 'set') next[key] = color; else delete next[key];
		if (opts.mirrorX && c.x !== -c.x) {
			const mKey = makeKey(-c.x, c.y, c.z);
			if (action === 'set') next[mKey] = color; else delete next[mKey];
		}
	}
	return next;
};

export const chooseAxisFromNormal = (n: { x: number; y: number; z: number } | null | undefined): 'x' | 'y' | 'z' => {
	if (!n) return 'y';
	const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
	if (ax >= ay && ax >= az) return 'x';
	if (ay >= ax && ay >= az) return 'y';
	return 'z';
};

export const rectPositionsOnPlane = (
	start: { x: number; y: number; z: number },
	end: { x: number; y: number; z: number },
	planeNormalAxis: 'x' | 'y' | 'z'
) => {
	const pts: Array<{ x: number; y: number; z: number }> = [];
	const min = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), z: Math.min(start.z, end.z) };
	const max = { x: Math.max(start.x, end.x), y: Math.max(start.y, end.y), z: Math.max(start.z, end.z) };
	if (planeNormalAxis === 'x') {
		for (let y = min.y; y <= max.y; y++) for (let z = min.z; z <= max.z; z++) pts.push({ x: start.x, y, z });
	} else if (planeNormalAxis === 'y') {
		for (let x = min.x; x <= max.x; x++) for (let z = min.z; z <= max.z; z++) pts.push({ x, y: start.y, z });
	} else {
		for (let x = min.x; x <= max.x; x++) for (let y = min.y; y <= max.y; y++) pts.push({ x, y, z: start.z });
	}
	return pts;
};

export const linePositionsAxisAligned = (
	start: { x: number; y: number; z: number },
	end: { x: number; y: number; z: number },
	axis: 'x' | 'y' | 'z'
) => {
	const pts: Array<{ x: number; y: number; z: number }> = [];
	if (axis === 'x') {
		const a = Math.min(start.x, end.x), b = Math.max(start.x, end.x);
		for (let x = a; x <= b; x++) pts.push({ x, y: start.y, z: start.z });
	} else if (axis === 'y') {
		const a = Math.min(start.y, end.y), b = Math.max(start.y, end.y);
		for (let y = a; y <= b; y++) pts.push({ x: start.x, y, z: start.z });
	} else {
		const a = Math.min(start.z, end.z), b = Math.max(start.z, end.z);
		for (let z = a; z <= b; z++) pts.push({ x: start.x, y: start.y, z });
	}
	return pts;
};

export const spherePositions = (center: { x: number; y: number; z: number }, radius: number) => {
	const pts: Array<{ x: number; y: number; z: number }> = [];
	const r2 = radius * radius;
	for (let x = center.x - radius; x <= center.x + radius; x++) {
		for (let y = center.y - radius; y <= center.y + radius; y++) {
			for (let z = center.z - radius; z <= center.z + radius; z++) {
				const dx = x - center.x, dy = y - center.y, dz = z - center.z;
				if (dx * dx + dy * dy + dz * dz <= r2) pts.push({ x, y, z });
			}
		}
	}
	return pts;
};


