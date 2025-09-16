import * as BABYLON from '@babylonjs/core';

export type Quality = 'low' | 'medium' | 'high';

export const applyQualitySettings = (
	engine: BABYLON.Engine,
	scene: BABYLON.Scene,
	shadowGen: BABYLON.ShadowGenerator | null,
	pipeline: BABYLON.DefaultRenderingPipeline | null,
	quality: Quality,
) => {
	try {
		if (quality === 'high') {
			try { engine.setHardwareScalingLevel(1); } catch {}
			if (pipeline) {
				try { pipeline.fxaaEnabled = true; } catch {}
				try { pipeline.samples = 1; } catch {}
				try { pipeline.bloomEnabled = false; } catch {}
			}
			if (shadowGen) {
				try { shadowGen.useBlurExponentialShadowMap = true; } catch {}
				try { shadowGen.blurKernel = 16; } catch {}
				try { shadowGen.getShadowMap()?.resize(2048); } catch {}
			}
			try { (scene as any).skipPointerMovePicking = false; } catch {}
		} else if (quality === 'medium') {
			try { engine.setHardwareScalingLevel(1.25); } catch {}
			if (pipeline) {
				try { pipeline.fxaaEnabled = true; } catch {}
				try { pipeline.samples = 1; } catch {}
				try { pipeline.bloomEnabled = false; } catch {}
			}
			if (shadowGen) {
				try { shadowGen.useBlurExponentialShadowMap = true; } catch {}
				try { shadowGen.blurKernel = 8; } catch {}
				try { shadowGen.getShadowMap()?.resize(1024); } catch {}
			}
			try { (scene as any).skipPointerMovePicking = true; } catch {}
		} else {
			try { engine.setHardwareScalingLevel(1.75); } catch {}
			if (pipeline) {
				try { pipeline.fxaaEnabled = false; } catch {}
				try { pipeline.samples = 1; } catch {}
				try { pipeline.bloomEnabled = false; } catch {}
			}
			if (shadowGen) {
				try { shadowGen.useBlurExponentialShadowMap = false; } catch {}
				try { shadowGen.blurKernel = 1; } catch {}
				try { shadowGen.getShadowMap()?.resize(512); } catch {}
			}
			try { (scene as any).skipPointerMovePicking = true; } catch {}
		}
	} catch {}
};


