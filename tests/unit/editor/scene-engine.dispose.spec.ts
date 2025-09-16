import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSceneEngine } from '@/components/editor-enhanced/scene/engine/SceneEngine';
import * as BABYLON from '@babylonjs/core';

describe('SceneEngine dispose', () => {
  beforeEach(() => {
    // Use NullEngine by temporarily replacing global constructor through module property override where possible
    const NullCtor = (BABYLON as any).NullEngine;
    const makeNull = (canvas: any) => new NullCtor({ customCanvasElement: canvas });
    // Some bundlers mark properties as non-configurable; instead, stub runRenderLoop/stopRenderLoop on NullEngine
    vi.spyOn(NullCtor.prototype as any, 'runRenderLoop').mockImplementation(() => {});
    vi.spyOn(NullCtor.prototype as any, 'stopRenderLoop').mockImplementation(() => {});
    // Stub environment texture creation to avoid network
    const stubTex = { dispose: () => {} } as any;
    vi.spyOn(BABYLON.CubeTexture as any, 'CreateFromPrefilteredData').mockReturnValue(stubTex);
    // No-op skybox creation to avoid material/shader work
    (BABYLON.Scene as any).prototype.createDefaultSkybox = () => null;
  });
  it('disposes scene, engine, and removes canvas from DOM', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const { dispose } = createSceneEngine({ mount, cameraMode: 'orbit', qualityMode: 'performance', autoStartRenderLoop: false });
    expect(mount.querySelector('canvas')).toBeTruthy();
    dispose();
    // After dispose, canvas should be removed
    expect(mount.querySelector('canvas')).toBeFalsy();
    document.body.removeChild(mount);
  });
});


