import { describe, it, expect, beforeEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import TextureCache from '@/components/editor-enhanced/scene/blocks/textureCache';
import { createTestEngineAndScene, disposeEngine } from '../../helpers/babylonScene';

describe('TextureCache', () => {
	let engine: BABYLON.Engine;
	let scene: BABYLON.Scene;

	beforeEach(() => {
		const ctx = createTestEngineAndScene();
		engine = ctx.engine;
		scene = ctx.scene;
	});

	it('returns same instance for same procedural keys', () => {
		const cache = TextureCache.getInstance();
		cache.setScene(scene);
		const t1 = cache.getTexture('conveyor');
		const t2 = cache.getTexture('conveyor');
		expect(t1).toBe(t2);
		const b1 = cache.getBumpTexture('conveyor');
		const b2 = cache.getBumpTexture('conveyor');
		expect(b1).toBe(b2);
		disposeEngine(engine);
	});

	it('applies quality changes to existing textures', () => {
		const cache = TextureCache.getInstance();
		cache.setScene(scene);
		const t = cache.getTexture('bouncy');
		cache.setQuality({ anisotropy: 8, sampling: BABYLON.Texture.NEAREST_SAMPLINGMODE });
		expect(t.anisotropicFilteringLevel).toBe(8);
		expect((t as any)._samplingMode || t.samplingMode).toBe(BABYLON.Texture.NEAREST_SAMPLINGMODE);
		disposeEngine(engine);
	});

	it('disposeAll clears cache and disposes textures', () => {
		const cache = TextureCache.getInstance();
		cache.setScene(scene);
		cache.getTexture('ice');
		expect(cache.getCachedTextureCount()).toBeGreaterThan(0);
		cache.disposeAll();
		expect(cache.getCachedTextureCount()).toBe(0);
		disposeEngine(engine);
	});
});


