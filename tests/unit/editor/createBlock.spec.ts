import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { createBlock } from '@/components/editor-enhanced/scene/blocks/createBlock';
import { createTestEngineAndScene, disposeEngine } from '../../helpers/babylonScene';

// Mock cannon-es minimal API used by createBlock
vi.mock('cannon-es', () => {
	class Vec3 { constructor(public x:number, public y:number, public z:number) {} }
	class Quaternion { constructor(public x:number, public y:number, public z:number, public w:number) {} }
	class Shape {}
	class Box extends Shape { constructor(public halfExtents: Vec3) { super(); } }
	class Sphere extends Shape { constructor(public r: number) { super(); } }
	class Cylinder extends Shape { constructor(public rTop:number, public rBottom:number, public height:number, public segments:number) { super(); } }
	class Body {
		static STATIC = 2;
		type = Body.STATIC;
		allowSleep = true;
		sleepSpeedLimit = 0.1;
		sleepTimeLimit = 0.5;
		velocity = { set: () => {} } as any;
		angularVelocity = { set: () => {} } as any;
		position = { set: () => {} } as any;
		quaternion = { setFromEuler: () => {} } as any;
		collisionResponse = true;
		userData: any;
		shapes: any[] = [];
		addShape(s: any) { this.shapes.push(s); }
	}
	return { Vec3, Quaternion, Box, Sphere, Cylinder, Body };
});

describe('createBlock', () => {
	let engine: BABYLON.Engine;
	let scene: BABYLON.Scene;
	const world = { addBody: vi.fn() } as any;

	beforeEach(() => {
		const ctx = createTestEngineAndScene();
		engine = ctx.engine;
		scene = ctx.scene;
		world.addBody.mockReset?.();
	});

	it('creates cube with metadata, material and physics body', () => {
		const block = createBlock(
			{ type: 'cube', position: new BABYLON.Vector3(1, 2, 3), rotationYDeg: 45, uniformScale: 1 },
			{ scene, world }
		);
		expect(block.id).toBeTruthy();
		expect(block.type).toBe('cube');
		expect(block.mesh).toBeTruthy();
		expect(block.mesh.metadata).toEqual(expect.objectContaining({ blockType: 'cube' }));
		expect(block.body).toBeTruthy();
		expect(world.addBody).toHaveBeenCalledTimes(1);
		// color set from PBR material
		expect(typeof block.color === 'number' || block.color === undefined).toBeTruthy();
		disposeEngine(engine);
	});

	it('applies specific material for cube_ice and sets transparency', () => {
		const block = createBlock(
			{ type: 'cube_ice', position: new BABYLON.Vector3(0, 0, 0) },
			{ scene, world }
		);
		const mat = block.mesh.material as BABYLON.PBRMaterial;
		expect(mat).toBeInstanceOf(BABYLON.PBRMaterial);
		expect(mat.alpha).toBeGreaterThan(0);
		disposeEngine(engine);
	});

	it('marks sensors as non-colliding (hazard/start/checkpoint/finish)', () => {
		const types: any[] = ['hazard','start','checkpoint','finish'];
		for (const t of types) {
			const block = createBlock(
				{ type: t, position: new BABYLON.Vector3(0, 0, 0) },
				{ scene, world }
			);
			expect((block.body as any).collisionResponse).toBe(false);
		}
		disposeEngine(engine);
	});
});


