import { describe, it } from 'vitest';
import { createSceneEngine } from '@/components/editor-enhanced/scene/engine/SceneEngine';

// jsdom lacks WebGL; keep as placeholder to ensure import is valid
describe.skip('SceneEngine smoke', () => {
  it('creates and disposes without throwing', () => {
    const mount = document.createElement('div');
    const { dispose } = createSceneEngine({ mount, cameraMode: 'orbit', qualityMode: 'performance', autoStartRenderLoop: false });
    dispose();
  });
});


