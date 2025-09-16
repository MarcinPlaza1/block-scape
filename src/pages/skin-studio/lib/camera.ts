import * as BABYLON from '@babylonjs/core';

export const setupSkinStudioCamera = (scene: BABYLON.Scene, canvas?: HTMLCanvasElement | null) => {
	const camera = new BABYLON.ArcRotateCamera('cam', Math.PI / 4, Math.PI / 3, 5, new BABYLON.Vector3(0, 1, 0), scene);
	if (canvas) camera.attachControl(canvas, true);
	camera.lowerRadiusLimit = 2;
	camera.upperRadiusLimit = 12;
	camera.inertia = 0.9;
	camera.panningInertia = 0.85;
	camera.wheelPrecision = 55; // smoother zoom
	try {
		const ptr = (camera.inputs.attached as any)?.pointers;
		if (ptr) {
			ptr.angularSensibilityX = 900;
			ptr.angularSensibilityY = 900;
			ptr.panningSensibility = 40;
			ptr.buttons = [0, 1, 2]; // allow pan with mid/right
		}
	} catch {}
	return camera;
};

export const enhanceCameraControls = (camera: BABYLON.ArcRotateCamera, scene: BABYLON.Scene, _canvas?: HTMLCanvasElement | null) => {
	const keys = new Set<string>();
	const speedBase = 0.02;

	const onKey = (kbInfo: BABYLON.KeyboardInfo) => {
		if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) keys.add((kbInfo.event.key || '').toLowerCase());
		if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYUP) keys.delete((kbInfo.event.key || '').toLowerCase());
	};
	const onBefore = scene.onBeforeRenderObservable.add(() => {
		if (keys.size === 0) return;
		const dt = scene.getEngine().getDeltaTime();
		const speed = speedBase * (dt / 16.6667) * (keys.has('shift') ? 3 : 1);
		// derive planar axes from camera angles
		const alpha = camera.alpha;
		const forward = new BABYLON.Vector3(Math.sin(alpha), 0, Math.cos(alpha)).scale(-1);
		const right = new BABYLON.Vector3(forward.z, 0, -forward.x);
		let move = BABYLON.Vector3.Zero();
		if (keys.has('w') || keys.has('arrowup')) move = move.add(forward);
		if (keys.has('s') || keys.has('arrowdown')) move = move.add(forward.scale(-1));
		if (keys.has('a') || keys.has('arrowleft')) move = move.add(right.scale(-1));
		if (keys.has('d') || keys.has('arrowright')) move = move.add(right);
		if (keys.has('q')) camera.alpha -= 0.01 * (dt / 16.6667);
		if (keys.has('e')) camera.alpha += 0.01 * (dt / 16.6667);
		if (!move.equals(BABYLON.Vector3.Zero())) {
			camera.target.addInPlace(move.scale(speed));
		}
		if (keys.has('r')) camera.beta = Math.max(0.1, camera.beta - 0.01 * (dt / 16.6667));
		if (keys.has('f')) camera.beta = Math.min(Math.PI * 0.9, camera.beta + 0.01 * (dt / 16.6667));
	});
	const onKeyObs = scene.onKeyboardObservable.add(onKey);
	const onDouble = scene.onPointerObservable.add((pi) => {
		if (pi.type !== BABYLON.PointerEventTypes.POINTERDOUBLETAP) return;
		const pick = scene.pick(scene.pointerX, scene.pointerY);
		if (pick && pick.hit && pick.pickedPoint) {
			camera.setTarget(pick.pickedPoint);
		}
	});
	scene.onDisposeObservable.add(() => {
		try { scene.onBeforeRenderObservable.remove(onBefore); } catch {}
		try { scene.onKeyboardObservable.remove(onKeyObs); } catch {}
		try { scene.onPointerObservable.remove(onDouble); } catch {}
		keys.clear();
	});
};


