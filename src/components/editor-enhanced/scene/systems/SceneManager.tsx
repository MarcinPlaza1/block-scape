import React, { useEffect, useRef, useState } from 'react';
import { EditEngine } from './edit/EditEngine';
import { PlayEngine } from './play/PlayEngine';
import { useEditState } from './edit/EditState';
import { usePlayState } from './play/PlayState';
import { useProjectStore } from '@/features/projects/stores';
import { usePlayerSettingsStore } from '@/features/player/store';
import type { Block } from '@/types';
import type { RenderableBlock } from './shared/Renderer';
import { createBlock, disposeBlock } from './shared/BlockFactory';

export interface SceneManagerProps {
  mode: 'build' | 'play' | 'preview';
  projectId?: string;
  onModeChange?: (mode: 'build' | 'play' | 'preview') => void;
  onBlockSelect?: (block: Block | null) => void;
  onBlockHover?: (block: Block | null) => void;
  onGameFinish?: () => void;
  onCheckpoint?: (checkpoint: number) => void;
  onHazard?: () => void;
  blocks?: Block[]; // external blocks source (e.g., Play page)
  quality?: 'low' | 'medium' | 'high';
}

export const SceneManager: React.FC<SceneManagerProps> = ({
  mode,
  projectId,
  onModeChange,
  onBlockSelect,
  onBlockHover,
  onGameFinish,
  onCheckpoint,
  onHazard,
  blocks,
  quality,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const editEngineRef = useRef<EditEngine | null>(null);
  const playEngineRef = useRef<PlayEngine | null>(null);
  const currentModeRef = useRef<'build' | 'play' | 'preview'>(mode);
  const blocksMapRef = useRef<Map<string, RenderableBlock>>(new Map());
  
  // States
  const editState = useEditState();
  const playState = usePlayState();
  const projectStore = useProjectStore();
  const skinId = usePlayerSettingsStore(s => s.skinId);
  const skinColors = usePlayerSettingsStore(s => s.colors);
  const skinConfig = usePlayerSettingsStore(s => (s as any).config);
  
  // Initialize engines
  useEffect(() => {
    if (!canvasRef.current || !mountRef.current) return;
    
    // Create edit engine
    const editEngine = new EditEngine({
      canvas: canvasRef.current,
      mount: mountRef.current,
      getEditorState: () => projectStore,
      actions: {
        addBlock: projectStore.addBlock,
      },
      onBlockSelect: (block) => {
        editState.selectBlock(block?.id || null);
        onBlockSelect?.(block);
      },
      onBlockHover: (block) => {
        editState.hoverBlock(block?.id || null);
        onBlockHover?.(block);
      },
    });
    
    // Create play engine
    const playEngine = new PlayEngine({
      canvas: canvasRef.current,
      mount: mountRef.current,
      onFinish: () => {
        playState.finishGame();
        onGameFinish?.();
      },
      onCheckpoint: (checkpoint) => {
        playState.reachCheckpoint(checkpoint);
        onCheckpoint?.(checkpoint);
      },
      onHazard: () => {
        onHazard?.();
      },
      gameMode: (projectStore as any).gameMode || 'PARKOUR',
      gameModeConfig: (projectStore as any).gameModeConfig || null,
      skinId,
      skinColors,
      skinConfig,
    });
    
    editEngineRef.current = editEngine;
    playEngineRef.current = playEngine;
    
    // Start the appropriate engine
    if (mode === 'build') {
      editEngine.start();
    } else {
      playEngine.start();
    }
    
    return () => {
      editEngine.dispose();
      playEngine.dispose();
      blocksMapRef.current.clear();
    };
  }, []);
  
  // Handle mode switching
  useEffect(() => {
    if (currentModeRef.current === mode) return;
    
    const prevMode = currentModeRef.current;
    currentModeRef.current = mode;
    
    // Stop previous engine
    if (prevMode === 'build') {
      editEngineRef.current?.stop();
    } else {
      playEngineRef.current?.stop();
    }
    
    // Transfer blocks between engines
    transferBlocks(prevMode, mode);
    
    // Start new engine
    if (mode === 'build') {
      editEngineRef.current?.start();
      
      // Restore edit state
      editEngineRef.current?.toggleGrid(editState.gridVisible);
      if (editState.gizmoType) {
        editEngineRef.current?.enableGizmo(editState.gizmoType);
      }
    } else if (mode === 'play') {
      // Initialize play mode (with player and pointer-lock controls)
      playState.resetGame();
      playState.loadBlocks(editState.blocks);
      try { playEngineRef.current?.setSpectatorMode(false); } catch {}
      playEngineRef.current?.start();
      
      // Find start position
      const startBlock = editState.blocks.find(b => b.type === 'start');
      if (startBlock) {
        playState.setStartPosition(startBlock.position);
      }
      
      // Initialize checkpoints
      editState.blocks
        .filter(b => b.type === 'checkpoint')
        .forEach(block => {
          playState.addCheckpoint({
            id: (block as any).metadata?.checkpointId || 0,
            position: block.position,
          });
        });
      
      playState.startGame();
    } else if (mode === 'preview') {
      // Initialize preview mode (no player, free camera, no pointer lock)
      playState.resetGame();
      playState.loadBlocks(editState.blocks);
      try { playEngineRef.current?.setSpectatorMode(true); } catch {}
      playEngineRef.current?.start();
    }
  }, [mode]);

  // Apply external blocks when provided (works for both modes)
  useEffect(() => {
    if (!blocks || blocks.length === 0) return;
    const engine = (mode === 'build') ? editEngineRef.current : playEngineRef.current;
    const scene = engine?.getScene();
    if (!engine || !scene) return;

    // Clear existing
    for (const [id, renderableBlock] of blocksMapRef.current) {
      if (mode === 'build') {
        (engine as EditEngine).removeBlock(renderableBlock);
      } else {
        (engine as PlayEngine).removeBlock(renderableBlock);
      }
      disposeBlock(renderableBlock);
    }
    blocksMapRef.current.clear();

    // Add new
    for (const block of blocks) {
      const renderableBlock = createBlock(block, scene, true);
      if (renderableBlock) {
        blocksMapRef.current.set(block.id, renderableBlock);
        if (mode === 'build') {
          (engine as EditEngine).addBlock(renderableBlock);
        } else {
          (engine as PlayEngine).addBlock(renderableBlock);
        }
      }
    }

    // Initialize play state if in play mode
    if (mode === 'play') {
      playState.resetGame();
      playState.loadBlocks(blocks);
      const startBlock = blocks.find(b => b.type === 'start');
      if (startBlock) {
        playState.setStartPosition(startBlock.position);
      }
      blocks
        .filter(b => b.type === 'checkpoint')
        .forEach(block => {
          playState.addCheckpoint({
            id: (block as any).metadata?.checkpointId || 0,
            position: block.position,
          });
        });
      playState.startGame();
    }
  }, [blocks, mode]);

  // Apply quality setting when provided
  useEffect(() => {
    if (!quality) return;
    editEngineRef.current?.setRenderingQuality(quality);
    playEngineRef.current?.setRenderingQuality(quality);
  }, [quality]);

  // When switching to play mode or when blocks change in play, run static optimization post-build
  useEffect(() => {
    if (mode !== 'play') return;
    // delay to ensure meshes are added
    const id = requestAnimationFrame(() => {
      playEngineRef.current?.optimizeStaticScene();
    });
    return () => cancelAnimationFrame(id);
  }, [mode, blocks]);
  
  // Sync blocks with edit state
  useEffect(() => {
    if (mode !== 'build') return;
    
    const editEngine = editEngineRef.current;
    const scene = editEngine?.getScene();
    if (!editEngine || !scene) return;
    
    // Find blocks to add/remove
    const currentIds = new Set(blocksMapRef.current.keys());
    const newIds = new Set(editState.blocks.map(b => b.id));
    
    // Remove deleted blocks
    for (const id of currentIds) {
      if (!newIds.has(id)) {
        const renderableBlock = blocksMapRef.current.get(id);
        if (renderableBlock) {
          editEngine.removeBlock(renderableBlock);
          disposeBlock(renderableBlock);
          blocksMapRef.current.delete(id);
        }
      }
    }
    
    // Add new blocks
    for (const block of editState.blocks) {
      if (!currentIds.has(block.id)) {
        const renderableBlock = createBlock(block, scene, true); // includePhysics = true
        if (renderableBlock) {
          blocksMapRef.current.set(block.id, renderableBlock);
          editEngine.addBlock(renderableBlock);
        }
      }
    }
    
    // Update existing blocks
    for (const block of editState.blocks) {
      const renderableBlock = blocksMapRef.current.get(block.id);
      if (renderableBlock && renderableBlock.mesh) {
        // Update position
        renderableBlock.mesh.position.set(
          block.position.x,
          block.position.y,
          block.position.z
        );
        
        // Update rotation
        if (block.rotation) {
          renderableBlock.mesh.rotation.set(
            block.rotation.x,
            block.rotation.y,
            block.rotation.z
          );
        }
        
        // Update scale
        if (block.scale) {
          renderableBlock.mesh.scaling.set(
            block.scale.x,
            block.scale.y,
            block.scale.z
          );
        }
      }
    }
  }, [editState.blocks, mode]);
  
  // Transfer blocks between engines
  const transferBlocks = (from: 'build' | 'play' | 'preview', to: 'build' | 'play' | 'preview') => {
    const fromEngine = from === 'build' ? editEngineRef.current : playEngineRef.current;
    const toEngine = to === 'build' ? editEngineRef.current : playEngineRef.current;
    
    if (!fromEngine || !toEngine) return;
    
    // Clear blocks from source engine
    for (const [id, renderableBlock] of blocksMapRef.current) {
      if (from === 'build') {
        (fromEngine as EditEngine).removeBlock(renderableBlock);
      } else {
        (fromEngine as PlayEngine).removeBlock(renderableBlock);
      }
      disposeBlock(renderableBlock);
    }
    blocksMapRef.current.clear();
    
    // Add blocks to target engine
    const blocks = from === 'build' ? editState.blocks : playState.blocks;
    const scene = toEngine.getScene();
    
    for (const block of blocks) {
      const renderableBlock = createBlock(block, scene, true);
      if (renderableBlock) {
        blocksMapRef.current.set(block.id, renderableBlock);
        
        if (to === 'build') {
          (toEngine as EditEngine).addBlock(renderableBlock);
        } else {
          (toEngine as PlayEngine).addBlock(renderableBlock);
        }
      }
    }
  };
  
  // Handle UI actions from edit state
  useEffect(() => {
    if (mode !== 'build') return;
    const editEngine = editEngineRef.current;
    if (!editEngine) return;
    
    // Update grid visibility
    editEngine.toggleGrid(editState.gridVisible);
    
    // Update gizmo
    if (editState.gizmoType) {
      editEngine.enableGizmo(editState.gizmoType);
    } else {
      editEngine.disableAllGizmos();
    }
  }, [editState.gridVisible, editState.gizmoType, mode]);
  
  // Handle play state updates
  useEffect(() => {
    if (mode !== 'play') return;
    const playEngine = playEngineRef.current;
    if (!playEngine) return;
    
    // Update render quality
    playEngine.setRenderingQuality(playState.renderQuality);
    
    // Update camera mode
    const camera = playEngine.getCamera();
    if (camera) {
      camera.setMode(playState.cameraMode);
    }
  }, [playState.renderQuality, playState.cameraMode, mode]);

  // Sync player skin with global player settings store (live in play/preview)
  useEffect(() => {
    if (mode === 'build') return;
    const eng = playEngineRef.current;
    if (!eng) return;
    eng.applyPlayerSkin(skinId, skinColors, skinConfig);
  }, [skinId, skinColors, skinConfig, mode]);

  // Dev overlay for tuning surface modifiers (temporary, simple UI)
  useEffect(() => {
    if (mode !== 'play') return;
    const engine = playEngineRef.current;
    if (!engine) return;
    const ctrl = engine.getPlayerController();
    if (!ctrl) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        // cycle ice friction presets
        const presets = [0.99, 0.97, 0.95, 0.9];
        const current = (ctrl as any)._iceFrictionCurrent ?? 0.97;
        const idx = (presets.indexOf(current) + 1) % presets.length;
        (ctrl as any)._iceFrictionCurrent = presets[idx];
        ctrl.setSurfaceTuning({ iceFriction: presets[idx] });
      }
      if (e.key === 'F10') {
        // cycle bouncy bounce boost
        const presets = [0.4, 0.6, 0.8, 1.0];
        const current = (ctrl as any)._bouncyBoostCurrent ?? 0.6;
        const idx = (presets.indexOf(current) + 1) % presets.length;
        (ctrl as any)._bouncyBoostCurrent = presets[idx];
        ctrl.setSurfaceTuning({ bouncyBounceBoost: presets[idx] });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [playState.renderQuality, playState.cameraMode, mode]);
  
  return (
    <div 
      ref={mountRef}
      className="relative w-full h-full bg-gray-900"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full outline-none"
        style={{ touchAction: 'none' }}
      />
      
      {/* Mode indicator */}
      <div className="absolute top-4 left-4 px-3 py-1 bg-black/50 text-white text-sm rounded">
        {mode === 'build' ? 'Build Mode' : mode === 'play' ? 'Play Mode' : 'Preview Mode'}
      </div>
      
      {/* Play mode UI */}
      {mode === 'play' && (
        <div className="absolute top-4 right-4 text-white text-sm space-y-2">
          <div className="bg-black/50 px-3 py-1 rounded">
            Time: {Math.floor(playState.gameStats.elapsedTime / 1000)}s
          </div>
          <div className="bg-black/50 px-3 py-1 rounded">
            Checkpoint: {playState.gameStats.currentCheckpoint}/{playState.gameStats.totalCheckpoints}
          </div>
          {playState.isFinished && (
            <div className="bg-green-600/80 px-3 py-2 rounded font-bold">
              FINISHED!
            </div>
          )}
          {/* Surface tuning mini-panel */}
          <div className="bg-black/55 rounded p-3 space-y-2 w-64">
            <div className="text-xs text-white/70">Surface tuning</div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs">Ice friction</span>
                <span className="text-xs text-white/60">F9</span>
              </div>
              <input
                type="range"
                min={0.9}
                max={0.995}
                step={0.005}
                defaultValue={0.97}
                onChange={(e) => {
                  const ctrl = playEngineRef.current?.getPlayerController();
                  ctrl?.setSurfaceTuning({ iceFriction: parseFloat(e.target.value) });
                }}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs">Bouncy boost</span>
                <span className="text-xs text-white/60">F10</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={1.2}
                step={0.05}
                defaultValue={0.6}
                onChange={(e) => {
                  const ctrl = playEngineRef.current?.getPlayerController();
                  ctrl?.setSurfaceTuning({ bouncyBounceBoost: parseFloat(e.target.value) });
                }}
              />
            </div>
            <div className="pt-2 flex gap-2">
              <button
                className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded"
                onClick={() => {
                  const ctrl = playEngineRef.current?.getPlayerController();
                  ctrl?.setSurfaceTuning({ iceFriction: 0.97, bouncyBounceBoost: 0.6 });
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview hint (minimal UI) */}
      {mode === 'preview' && (
        <div className="absolute bottom-4 right-4 text-white/80 text-xs bg-black/40 px-3 py-2 rounded">
          Preview: right-drag to orbit, wheel to zoom
        </div>
      )}
    </div>
  );
};
