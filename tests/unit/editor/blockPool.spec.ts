import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { BlockPool } from '@/components/editor-enhanced/scene/blocks/blockPool';
import { createTestEngineAndScene, disposeEngine } from '../../helpers/babylonScene';

describe('BlockPool', () => {
	let engine: BABYLON.Engine;
	let scene: BABYLON.Scene;
	const world = { addBody: vi.fn(), removeBody: vi.fn() };

	beforeEach(() => {
		const ctx = createTestEngineAndScene();
		engine = ctx.engine;
		scene = ctx.scene;
		world.addBody.mockReset();
		world.removeBody.mockReset();
	});

	function makePooled() {
		const mesh = BABYLON.MeshBuilder.CreateBox('m', { size: 1 }, scene);
		const body = { id: Math.random() };
		return { mesh, body };
	}

	it('acquire returns factory object when pool empty, then reuses released', () => {
		const pool = BlockPool.getInstance();
		const first = pool.acquire('cube', { scene, world }, makePooled);
		expect(first.mesh).toBeTruthy();
		expect(world.addBody).toHaveBeenCalledTimes(0); // factory created body already in world by creator, not by pool

		const released = pool.release('cube', first, { world });
		expect(released).toBe(true);
		expect(world.removeBody).toHaveBeenCalledTimes(1);
		expect(first.mesh.isEnabled()).toBe(false);

		const reused = pool.acquire('cube', { scene, world }, makePooled);
		expect(reused).toBe(first);
		expect(reused.mesh.isEnabled()).toBe(true);
		expect(world.addBody).toHaveBeenCalledTimes(1);
		disposeEngine(engine);
	});

	it('release disposes when pool full', () => {
		const pool = BlockPool.getInstance();
		pool.setMaxPerType(0);
		const obj = makePooled();
		const accepted = pool.release('cube', obj, { world });
		expect(accepted).toBe(false);
		expect(world.removeBody).toHaveBeenCalledTimes(1);
		// mesh should be disposed
		expect(obj.mesh.isDisposed()).toBe(true);
		disposeEngine(engine);
	});
});


