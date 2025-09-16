import React, { useCallback, useEffect, useRef, useState } from 'react';
import PageTransition from '@/components/ui/PageTransition';
import { m } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useCollabClient } from '@/hooks/useCollabClient';
import { useAuthStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import type { BlockType, Block, ProjectData } from '@/types/project';

// Import new architecture components
import { SceneManager } from '../scene/systems/SceneManager';
import { useEditState } from '../scene/systems/edit/EditState';
import { usePlayState } from '../scene/systems/play/PlayState';

// Import our editor components
import MinecraftHotbar from './MinecraftHotbar';
import CrosshairOverlay from './CrosshairOverlay';
import SimsBuildPanel from './SimsBuildPanel';
import ModeSwitcher from './ModeSwitcher';
import BlockTooltip from './BlockTooltip';
import ObjectRotationControls from './ObjectRotationControls';
import { TerrainPanel } from '../terrain/TerrainPanel';
import { useEditorSettingsStore } from '@/features/projects/stores/editor-settings.store';
import { useProjectStore } from '@/features/projects/stores';
import type { EditorMode } from '@/types/editor';

interface GameLikeEditorProps {
  projectSlug?: string;
}

const GameLikeEditor: React.FC<GameLikeEditorProps> = ({ projectSlug }) => {
  // Mode state from store (unified EditorMode)
  const { editorMode: mode, setEditorMode, isPlayMode } = useProjectStore();
  
  // Quality (persisted)
  const [quality, setQuality] = React.useState<'low' | 'medium' | 'high'>(() => {
    try { return (localStorage.getItem('scene-quality') as any) || 'medium'; } catch { return 'medium'; }
  });
  useEffect(() => {
    try { localStorage.setItem('scene-quality', quality); } catch {}
  }, [quality]);

  const handleQualityChange = useCallback((q: 'low' | 'medium' | 'high') => {
    setQuality(q);
  }, []);

  // UI State
  const [buildPanelOpen, setBuildPanelOpen] = useState(false);
  const [terrainPanelOpen, setTerrainPanelOpen] = useState(false);
  const [tooltipState, setTooltipState] = useState<{
    visible: boolean;
    blockType?: BlockType;
    position: { x: number; y: number };
  }>({ visible: false, position: { x: 0, y: 0 } });
  const [rotationControlsState, setRotationControlsState] = useState<{
    visible: boolean;
    blockId?: string | null;
    position: { x: number; y: number };
  }>({ visible: false, position: { x: 0, y: 0 } });

  // Collaboration state
  const [isCollabMode, setIsCollabMode] = useState<boolean>(false);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [collabSettingsOpen, setCollabSettingsOpen] = useState<boolean>(false);
  const [maxParticipants, setMaxParticipants] = useState<number>(5);
  const [isSessionOwner, setIsSessionOwner] = useState<boolean>(false);

  const { toast } = useToast();
  const { user } = useAuthStore();
  const tooltipTimeoutRef = useRef<NodeJS.Timeout>();
  
  // New architecture stores
  const editState = useEditState();
  const playState = usePlayState();

  // New project store for save/load
  const { saveProject, loadCurrentProject } = useProjectStore();

  // Terrain editor state from store
  const {
    terrainBrushMode,
    terrainBrushSize,
    terrainBrushStrength,
    terrainBrushColor,
    setTerrainBrushMode,
    setTerrainBrushSize,
    setTerrainBrushStrength,
    setTerrainBrushColor,
  } = useEditorSettingsStore();

  // Sync mode with play state
  const togglePlay = () => setEditorMode(mode === 'build' ? 'play' : 'build');

  // Collaborative editing client
  const collabClient = isCollabMode && currentGameId ? useCollabClient({
    gameId: currentGameId,
    sessionType: 'build',
    onBlockOperation: (operation) => {
      console.log('Remote block operation:', operation);
    },
    onGameStateUpdate: (gameState) => {
      if (gameState.blocks) {
        const collaborativeBlocks = Object.values(gameState.blocks) as Block[];
        editState.loadBlocks(collaborativeBlocks);
      }
    },
    onParticipantUpdate: (participants) => {
      console.log('Participants updated:', participants);
    },
    onChatMessage: (message) => {
      console.log('Chat message:', message);
    }
  }) : null;

  // Determine if current user is the session owner and load current maxParticipants
  useEffect(() => {
    const load = async () => {
      try {
        if (!collabClient?.sessionId || !user?.id) return;
        // Heuristic via participants
        const ownerViaParticipants = (collabClient as any).participants?.some?.((p: any) => p.userId === user.id && p.role === 'OWNER');
        let ownerId: string | null = null;
        // Fetch session details for authoritative data
        const res = await apiFetch<{ session: { id: string; maxParticipants: number; game: { ownerId: string } } }>(`/realtime/sessions/${collabClient.sessionId}`);
        setMaxParticipants(res.session.maxParticipants || 5);
        ownerId = res.session.game?.ownerId || null;
        setIsSessionOwner(Boolean(ownerViaParticipants || (ownerId && ownerId === user.id)));
      } catch {
        // ignore
      }
    };
    load();
  }, [collabClient?.sessionId, (collabClient as any)?.participants, user?.id]);

  const saveMaxParticipants = useCallback(async () => {
    try {
      if (!collabClient?.sessionId) return;
      await apiFetch(`/realtime/sessions/${collabClient.sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ maxParticipants: Number(maxParticipants) })
      });
      toast({ title: 'Zaktualizowano', description: 'Maksymalna liczba uczestników została zapisana.' });
    } catch (e: any) {
      toast({ title: 'Błąd', description: e?.message || 'Nie udało się zapisać limitu.', variant: 'destructive' });
    }
  }, [collabClient?.sessionId, maxParticipants, toast]);

  // Event handlers
  const handleBlockSelect = useCallback((block: Block | null) => {
    if (block && editState.currentTool === 'select') {
      // Handle selection
    }
  }, [editState.currentTool]);
  
  const handleBlockHover = useCallback((block: Block | null) => {
    // Handle hover
  }, []);
  
  const handleGameFinish = useCallback(() => {
    toast({
      title: "Game Finished!",
      description: `Completed in ${Math.floor(playState.gameStats.elapsedTime / 1000)}s`,
    });
    setEditorMode('build');
  }, [playState.gameStats.elapsedTime, toast, setEditorMode]);
  
  const handleCheckpoint = useCallback((checkpoint: number) => {
    toast({
      title: "Checkpoint Reached!",
      description: `Checkpoint ${checkpoint} reached`,
    });
  }, [toast]);

  const handleSave = useCallback(async () => {
    if (editState.blocks.length === 0) {
      toast({
        title: "Nothing to Save",
        description: "Add some blocks to your scene before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await saveProject();
      editState.setDirty(false);
      toast({
        title: "Project Saved Successfully!",
        description: `"${result.project.name}" saved with ${result.project.blocks.length} objects to ${result.savedTo}.`,
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Could not save the project.",
        variant: "destructive",
      });
    }
  }, [editState, toast, saveProject]);

  const handleLoad = useCallback(() => {
    try {
      const success = loadCurrentProject();
      if (success) {
        toast({
          title: "Project Loaded!",
          description: `Project loaded successfully from local storage.`,
        });
      } else {
        throw new Error("No project found");
      }
    } catch (error) {
      toast({
        title: "Load Failed",
        description: "No project found to load.",
        variant: "destructive",
      });
    }
  }, [toast, loadCurrentProject]);

  // Tooltip management
  const showTooltip = useCallback((blockType: BlockType, event: MouseEvent) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }

    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltipState({
        visible: true,
        blockType,
        position: { x: event.clientX + 10, y: event.clientY + 10 }
      });
    }, 500);
  }, []);

  const hideTooltip = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setTooltipState(prev => ({ ...prev, visible: false }));
  }, []);

  // Object controls management
  const showObjectControls = useCallback((blockId: string, event: MouseEvent) => {
    setRotationControlsState({
      visible: true,
      blockId,
      position: { x: event.clientX, y: event.clientY - 20 }
    });
  }, []);

  const hideObjectControls = useCallback(() => {
    setRotationControlsState(prev => ({ ...prev, visible: false }));
  }, []);

  // Handle terrain panel visibility based on selectedTool
  useEffect(() => {
    if (editState.currentTool === 'paint' && !isPlayMode) {
      setTerrainPanelOpen(true);
    } else {
      setTerrainPanelOpen(false);
    }
  }, [editState.currentTool, isPlayMode]);

  // Handle object selection for rotation controls
  useEffect(() => {
    if (editState.selectedBlockId && editState.currentTool === 'select') {
      // Show rotation controls when a block is selected
      const handleClick = (e: MouseEvent) => {
        // Only show if clicking on the scene area
        const target = e.target as HTMLElement;
        if (target.closest('[data-scene-container]')) {
          showObjectControls(editState.selectedBlockId, e);
        }
      };

      // Delay to avoid immediate trigger
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClick, { once: true });
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClick);
      };
    } else {
      hideObjectControls();
    }
  }, [editState.selectedBlockId, editState.currentTool, showObjectControls, hideObjectControls]);

  // Global keyboard shortcuts
  useEffect(() => {
    // Mark body as editor-mode to control global background layers
    try { document.body.classList.add('editor-mode'); } catch {}
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'b':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setBuildPanelOpen(prev => !prev);
          }
          break;
        case 'escape':
          setBuildPanelOpen(false);
          hideObjectControls();
          // Only cancel placement and return to select tool; stay in build mode
          try { editState.setCurrentTool('select'); } catch {}
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleSave();
          }
          break;
        case 'p':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            togglePlay();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      try { document.body.classList.remove('editor-mode'); } catch {}
    };
  }, [handleSave, togglePlay, hideObjectControls]);

  return (
    <PageTransition>
      <div className="h-screen w-full flex bg-gradient-bg overflow-hidden relative">
        {/* Main 3D Scene - Full Screen */}
        <main className="flex-1 relative" data-scene-container>
          <m.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ duration: 0.25 }} 
            className="h-full"
          >
            <SceneManager
              mode={mode as EditorMode}
              projectId={editState.projectId || undefined}
              onModeChange={setEditorMode}
              onBlockSelect={handleBlockSelect}
              onBlockHover={handleBlockHover}
              onGameFinish={handleGameFinish}
              onCheckpoint={handleCheckpoint}
              quality={quality}
            />
          </m.div>

          {/* Game-like UI Overlays */}
          
          {/* Mode Switcher - Top Left */}
          <ModeSwitcher
            onOpenBuildPanel={() => setBuildPanelOpen(true)}
            onSave={handleSave}
            onLoad={handleLoad}
            quality={quality}
            onQualityChange={handleQualityChange}
          />

          {/* Collaboration settings (owner only) */}
          {isCollabMode && collabClient?.sessionId && isSessionOwner && (
            <div className="absolute top-20 right-4 z-30 pointer-events-auto bg-card/90 border border-border rounded-xl px-3 py-2 shadow-lg">
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold">Sesja</div>
                <Button size="sm" variant="outline" onClick={() => setCollabSettingsOpen(v => !v)}>Ustawienia</Button>
              </div>
              {collabSettingsOpen && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Max uczestników</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                    className="w-16 text-xs bg-background border border-border rounded px-2 py-1"
                  />
                  <Button size="sm" onClick={saveMaxParticipants}>Zapisz</Button>
                </div>
              )}
            </div>
          )}

          {/* Crosshair - Center */}
          <CrosshairOverlay />

          {/* Minecraft Hotbar - Bottom Center */}
          {!isPlayMode && <MinecraftHotbar />}

          {/* Sims Build Panel - Right Side */}
          <SimsBuildPanel
            isVisible={buildPanelOpen && !isPlayMode}
            onClose={() => setBuildPanelOpen(false)}
          />

          {/* Terrain Panel - Right Side */}
          <TerrainPanel
            isVisible={terrainPanelOpen && !isPlayMode}
            onClose={() => setTerrainPanelOpen(false)}
            terrainBrushMode={terrainBrushMode}
            terrainBrushSize={terrainBrushSize}
            terrainBrushStrength={terrainBrushStrength}
            terrainBrushColor={terrainBrushColor}
            onBrushModeChange={setTerrainBrushMode}
            onBrushSizeChange={setTerrainBrushSize}
            onBrushStrengthChange={setTerrainBrushStrength}
            onBrushColorChange={setTerrainBrushColor}
          />

          {/* Block Tooltip */}
          <BlockTooltip
            blockType={tooltipState.blockType}
            position={tooltipState.position}
            visible={tooltipState.visible}
          />

          {/* Object Rotation Controls */}
          <ObjectRotationControls
            selectedBlockId={rotationControlsState.blockId}
            visible={rotationControlsState.visible}
            position={rotationControlsState.position}
            onClose={hideObjectControls}
          />

          {/* Play Mode Overlay */}
          {isPlayMode && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                {/* Game-style crosshair for play mode */}
                <div className="w-6 h-6 border-2 border-white/60 rounded-full flex items-center justify-center">
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                </div>
              </div>
              
              {/* Play mode instructions */}
              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
                <div className="bg-black/80 text-white text-sm px-4 py-2 rounded-lg border border-white/20">
                  <div className="flex items-center gap-4 text-xs">
                    <span>WASD - Move</span>
                    <span>•</span>
                    <span>Mouse - Look around</span>
                    <span>•</span>
                    <span>Space - Jump</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Build Instructions */}
          {!isPlayMode && editState.currentTool === 'place' && (
            <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 pointer-events-none">
              <div className="bg-black/90 text-white text-sm px-6 py-3 rounded-lg border border-green-500/50 shadow-2xl">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                    <span className="font-medium">Placing {editState.currentBlockType.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-white/70">
                    <span>Left Click - Place block</span>
                    <span>•</span>
                    <span>Right Click - Cancel</span>
                    <span>•</span>
                    <span>ESC - Exit build mode</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Global Shortcuts Help */}
          {!isPlayMode && (
            <div className="absolute bottom-4 right-4 text-xs text-white/60 bg-black/40 px-3 py-2 rounded-lg">
              <div className="space-y-1">
                <div>Ctrl+B - Toggle Build Panel</div>
                <div>Ctrl+S - Save • Ctrl+P - Play Mode</div>
                <div>1-9 - Select Hotbar • ESC - Cancel</div>
              </div>
            </div>
          )}
        </main>
      </div>
    </PageTransition>
  );
};

export default GameLikeEditor;
