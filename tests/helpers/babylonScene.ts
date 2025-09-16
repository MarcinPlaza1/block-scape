import * as BABYLON from '@babylonjs/core';

export function createTestEngineAndScene() {
	// Create a headless engine using OffscreenCanvas or stubbed canvas
	const canvas = global.document?.createElement?.('canvas') as HTMLCanvasElement | undefined;
	const engine = new BABYLON.NullEngine({
		customCanvasElement: canvas as any,
		renderer: 'webgl'
	} as any);
	const scene = new BABYLON.Scene(engine);
	// Minimal light for materials that expect shadows
	try {
		const light = new BABYLON.DirectionalLight('directionalLight', new BABYLON.Vector3(-1, -2, -1), scene);
		(light as any).getShadowGenerator = () => new BABYLON.ShadowGenerator(1024, light);
		(scene as any).__shadowGenerator = (light as any).getShadowGenerator();
	} catch {}
	return { engine, scene };
}

export function disposeEngine(engine: BABYLON.Engine) {
	try { engine.dispose(); } catch {}
}


