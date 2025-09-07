import { useState, useCallback, useEffect } from 'react';
import Scene3D from '@/components/Scene3D';
import Sidebar from '@/components/Sidebar';
import InspectorPanel from '@/components/InspectorPanel';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ToastAction } from '@/components/ui/toast';
import { Eye, Monitor, Zap, Camera, Square, MousePointer, Move, Box, Circle, Grid as GridIcon, Magnet, Undo2, Redo2, HelpCircle, PanelRightOpen, PanelRightClose, Brush, RotateCcw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { useProjectStore } from '@/lib/projectStore';
import type { Block } from '@/types/project';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

// Types centralized in '@/types/project'

const SandboxEditor = () => {
  const blocks = useProjectStore(s => s.blocks) as Block[];
  const droppedBlock = useProjectStore(s => s.droppedBlock);
  const projectName = useProjectStore(s => s.projectName);
  const hasUnsavedChanges = useProjectStore(s => s.hasUnsavedChanges);
  const loadedBlocks = useProjectStore(s => s.loadedBlocks) as Block[];
  const isPlayMode = useProjectStore(s => s.isPlayMode);
  const selectedTool = useProjectStore(s => s.selectedTool);
  const setDroppedBlock = useProjectStore(s => s.setDroppedBlock);
  const addBlockToStore = useProjectStore(s => s.addBlock);
  const setBlocksInStore = useProjectStore(s => s.setBlocks);
  const clearSceneInStore = useProjectStore(s => s.clearScene);
  const togglePlay = useProjectStore(s => s.togglePlay);
  const setSelectedTool = useProjectStore(s => s.setSelectedTool);
  const undo = useProjectStore(s => (s as any).undo);
  const redo = useProjectStore(s => (s as any).redo);
  const canUndo = useProjectStore(s => ((s as any).historyPast?.length || 0) > 0);
  const canRedo = useProjectStore(s => ((s as any).historyFuture?.length || 0) > 0);
  const gridVisible = useProjectStore(s => (s as any).gridVisible);
  const setGridVisible = useProjectStore(s => (s as any).setGridVisible);
  const snapEnabled = useProjectStore(s => (s as any).snapEnabled);
  const setSnapEnabled = useProjectStore(s => (s as any).setSnapEnabled);
  const placeMultiple = useProjectStore(s => (s as any).placeMultiple);
  const setPlaceMultiple = useProjectStore(s => (s as any).setPlaceMultiple);
  const loadCurrentProject = useProjectStore(s => s.loadCurrentProject);
  const loadProject = useProjectStore(s => s.loadProject);
  const renameProject = useProjectStore(s => s.renameProject);
  const newProject = useProjectStore(s => s.newProject);
  const saveProject = useProjectStore(s => s.saveProject);
  const publishProject = useProjectStore(s => (s as any).publishProject) as (p: boolean) => Promise<boolean>;
  const restoreAutoSaveIfPresent = useProjectStore(s => s.restoreAutoSaveIfPresent);
  const builderModeEnabled = useProjectStore(s => (s as any).builderModeEnabled);
  const builderCurrentType = useProjectStore(s => (s as any).builderCurrentType);
  const setBuilderCurrentType = useProjectStore(s => (s as any).setBuilderCurrentType);
  const builderCurrentColor = useProjectStore(s => (s as any).builderCurrentColor);
  const setBuilderCurrentColor = useProjectStore(s => (s as any).setBuilderCurrentColor);
  const noUiModeEnabled = useProjectStore(s => (s as any).noUiModeEnabled);
  const setNoUiModeEnabled = useProjectStore(s => (s as any).setNoUiModeEnabled);
  const [userName, setUserName] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { projectName: projectSlug } = useParams();

  const handleBlockAdd = useCallback((block: Block) => {
    addBlockToStore(block);
    // Clear any pending drop selection after a successful placement
    setDroppedBlock(null);
  }, [addBlockToStore, setDroppedBlock]);

  const handleSceneStateChange = useCallback((updatedBlocks: Block[]) => {
    setBlocksInStore(updatedBlocks);
  }, [setBlocksInStore]);

  const handleBlockDrop = useCallback((type: 'cube' | 'cube_bouncy' | 'cube_ice' | 'cube_conveyor' | 'cube_boost' | 'cube_slow' | 'cube_sticky' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'plate' | 'ramp' | 'torus' | 'wedge' | 'door' | 'window' | 'fence') => {
    // Arm the scene to place on next click; do not auto-clear prematurely
    setDroppedBlock({ type });
  }, [setDroppedBlock]);

  const handleSave = useCallback(async () => {
    const result = await saveProject();
    if (result.savedTo === 'cloud') {
      toast({
        title: 'Project Saved Successfully!',
        description: `"${result.project.name}" saved with ${result.project.blocks.length} objects.`,
        action: (
          <ToastAction altText="Open projects" onClick={() => navigate('/games') }>
            Otwórz projekty
          </ToastAction>
        ),
      });
    } else {
      toast({
        title: 'Project Saved Locally',
        description: `"${result.project.name}" saved with ${result.project.blocks.length} objects.`,
        variant: 'default',
      });
    }
  }, [saveProject, toast, navigate]);

  const handlePublishToggle = useCallback(async () => {
    const current = (useProjectStore.getState().currentProject as any)?.published ? true : false;
    const ok = await publishProject(!current);
    if (ok) {
      toast({ title: !current ? 'Opublikowano' : 'Cofnięto publikację' });
    } else {
      toast({ title: 'Nie udało się zmienić statusu publikacji', variant: 'destructive' });
    }
  }, [publishProject, toast]);

  const handlePlay = useCallback(() => {
    if (blocks.length === 0) {
      toast({
        title: "No Objects to Play With",
        description: "Add some blocks to your scene first!",
        variant: "destructive",
      });
      return;
    }
    togglePlay();
    toast({
      title: !isPlayMode ? "Play Mode Activated!" : "Edit Mode Activated!",
      description: !isPlayMode 
        ? "Explore your 3D world! Use camera controls to navigate." 
        : "You can now edit and modify your 3D world.",
    });
  }, [blocks.length, isPlayMode, toast, togglePlay]);

  const handleLoadProject = useCallback((name: string) => {
    const ok = loadProject(name);
    if (ok) {
      const project = useProjectStore.getState().currentProject;
      toast({ title: 'Project Loaded!', description: `"${project?.name}" loaded with ${project?.blocks.length || 0} objects.` });
    } else {
      toast({ title: 'Project Not Found', description: `Could not find project "${name}".`, variant: 'destructive' });
    }
  }, [loadProject, toast]);

  const handleLoad = useCallback(() => {
    const ok = loadCurrentProject();
    if (ok) {
      const project = useProjectStore.getState().currentProject;
      toast({ title: 'Project Loaded!', description: `"${project?.name}" loaded with ${project?.blocks.length || 0} objects.` });
    } else {
      toast({ title: 'No Saved Project', description: 'No project found to load.', variant: 'destructive' });
    }
  }, [loadCurrentProject, toast]);

  const handleClear = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).scene3D) {
      (window as any).scene3D.clearScene();
    }
    clearSceneInStore();
    toast({ title: 'Scene Cleared', description: 'All objects have been removed from the scene.' });
  }, [clearSceneInStore, toast]);

  const handleNewProject = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmNew = window.confirm(
        "You have unsaved changes. Are you sure you want to create a new project?"
      );
      if (!confirmNew) return;
    }
    handleClear();
    newProject();
    toast({ title: 'New Project Created', description: 'Started a fresh 3D sandbox project.' });
  }, [hasUnsavedChanges, handleClear, newProject, toast]);

  const handleRenameProject = useCallback(() => {
    const current = projectName;
    const name = window.prompt('Enter new project name:', current) || '';
    const ok = renameProject(name);
    if (ok) toast({ title: 'Project renamed', description: `New name: ${name.trim()}` });
  }, [projectName, renameProject, toast]);

  // Session bootstrap (sync with /games login)
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const logout = useAuthStore(s => s.logout);
  useEffect(() => {
    const email = user?.email || localStorage.getItem('auth-email');
    setUserName(email || null);
  }, [user?.email]);

  // Redirect unauthenticated users to login (after fetchMe bootstrap handled in App)
  useEffect(() => {
    if (!token) navigate('/login');
  }, [token, navigate]);

  const handleLogout = useCallback(() => {
    logout();
    setUserName(null);
  }, [logout]);

  // Tool changes are handled inside Sidebar via store

  // Auto-save is now handled inside the store

  // Load auto-save on mount
  useEffect(() => {
    const shouldRestore = useProjectStore.getState().restoreAutoSaveIfPresent();
    if (shouldRestore) {
      toast({ title: 'Auto-save restored', description: 'Recovered the last autosaved project.' });
    }
  }, [toast]);

  // Handle route-driven project bootstrap
  useEffect(() => {
    const slug = (projectSlug || '').toString().toLowerCase();
    if (slug === 'nowy-projekt') {
      try {
        localStorage.removeItem('sandbox-current-project');
      } catch {}
      clearSceneInStore();
      newProject();
      renameProject('Nowy projekt');
      return;
    }
    // If navigating with an existing project slug, try loading the current project from storage
    useProjectStore.getState().loadCurrentProject();
  }, [projectSlug, clearSceneInStore, newProject, renameProject]);

  // Starter picker on first load when there's no current project or blocks
  const [showStarter, setShowStarter] = useState<boolean>(() => {
    try {
      const hasCurrent = !!localStorage.getItem('sandbox-current-project');
      return !hasCurrent;
    } catch {
      return true;
    }
  });

  const applyStarter = useCallback((type: 'flat' | 'island' | 'corridor') => {
    // Clear current scene
    if (typeof window !== 'undefined' && (window as any).scene3D) {
      (window as any).scene3D.clearScene();
    }
    clearSceneInStore();
    // Build simple block layouts
    const blocksToAdd: Block[] = [] as any;
    const push = (x: number, y: number, z: number, t: 'cube' | 'sphere' = 'cube') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      blocksToAdd.push({ id, type: t, position: { x, y, z } });
    };
    if (type === 'flat') {
      for (let x = -5; x <= 5; x += 1) for (let z = -5; z <= 5; z += 1) push(x, 0.5, z, 'cube');
    } else if (type === 'island') {
      const radius = 6;
      for (let x = -radius; x <= radius; x++) {
        for (let z = -radius; z <= radius; z++) {
          const d = Math.hypot(x, z);
          if (d <= radius && Math.random() > 0.1) push(x, 0.5 + Math.sin((x * z) * 0.2) * 0.2, z, 'cube');
        }
      }
    } else if (type === 'corridor') {
      for (let i = -10; i <= 10; i++) push(i, 0.5, 0, 'cube');
      for (let i = -10; i <= 10; i++) push(i, 1.5, -2, 'cube');
      for (let i = -10; i <= 10; i++) push(i, 1.5, 2, 'cube');
    }
    // Apply to scene via exposed API
    try {
      (window as any).scene3D?.loadScene?.(blocksToAdd);
      setBlocksInStore(blocksToAdd);
    } catch {}
    setShowStarter(false);
  }, [clearSceneInStore, setBlocksInStore]);

  // Cancel placing with Escape
  useEffect(() => {
    if (!droppedBlock) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDroppedBlock(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [droppedBlock, setDroppedBlock]);

  const [cameraMode, setCameraMode] = useState<'orbit' | 'first' | 'ortho'>('orbit');
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(false);
  
  // Keyboard shortcuts to toggle UI (U) and Inspector (I)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'u') {
        e.preventDefault();
        setNoUiModeEnabled(!noUiModeEnabled);
      } else if (key === 'i') {
        e.preventDefault();
        setInspectorOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [noUiModeEnabled, setNoUiModeEnabled]);

  return (
    <div className="h-screen w-full overflow-hidden bg-gradient-bg">
      <ResizablePanelGroup direction="horizontal" className="h-full" onLayout={() => window.dispatchEvent(new Event('resize'))}>
        <ResizablePanel defaultSize={22} minSize={16}>
          <Sidebar
            onBlockDrop={handleBlockDrop}
            onSave={handleSave}
            onPlay={handlePlay}
            onLoad={handleLoad}
            onClear={handleClear}
            onNewProject={handleNewProject}
            onLoadProject={handleLoadProject}
            onRenameProject={handleRenameProject}
            onToggleInspector={() => setInspectorOpen(true)}
            userName={userName || undefined}
            blockCount={blocks.length}
            projectName={projectName}
            hasUnsavedChanges={hasUnsavedChanges}
            onTogglePublish={handlePublishToggle}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={56} minSize={40}>
          {/* Main 3D Scene */}
          <main className={`relative w-full h-full ${noUiModeEnabled ? 'pointer-events-auto' : ''}`}>
            <Scene3D
              onBlockAdd={handleBlockAdd}
              droppedBlock={droppedBlock}
              onSceneStateChange={handleSceneStateChange}
              loadedBlocks={loadedBlocks}
              selectedTool={selectedTool}
              isPlayMode={isPlayMode}
              cameraMode={cameraMode}
            />
            
            {/* Top overlay removed; camera + inspector toggle moved to bottom toolbar */}

        {/* Unified Bottom Dock */}
        {!noUiModeEnabled && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto max-w-[calc(100vw-2rem)]">
            <TooltipProvider delayDuration={100}>
              <div className="flex items-center gap-1 bg-card/95 border border-border rounded-xl px-2 py-2 shadow-lg overflow-x-auto snap-x snap-mandatory">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant={selectedTool === 'select' ? 'default' : 'outline'} onClick={() => setSelectedTool('select')} aria-label="Select" className="snap-start">
                      <MousePointer className="h-4 w-4" />
                      <span className="sr-only">Select</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Select (Q)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant={selectedTool === 'move' ? 'default' : 'outline'} onClick={() => setSelectedTool('move')} aria-label="Move" className="snap-start">
                      <Move className="h-4 w-4" />
                      <span className="sr-only">Move</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Move (W)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant={selectedTool === 'paint' ? 'default' : 'outline'} onClick={() => setSelectedTool('paint')} aria-label="Paint" className="snap-start">
                      <Brush className="h-4 w-4" />
                      <span className="sr-only">Paint</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Paint (B)</TooltipContent>
                </Tooltip>

                <div className="w-px h-6 bg-border mx-1" />

                {/* Transform gizmo modes (only when Move tool is active) */}
                {selectedTool === 'move' && (
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="outline" onClick={() => (window as any).scene3D?.setTransformMode?.('translate')} aria-label="Translate" className="snap-start">
                          <Move className="h-4 w-4" />
                          <span className="sr-only">Translate</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Translate</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="outline" onClick={() => (window as any).scene3D?.setTransformMode?.('rotate')} aria-label="Rotate" className="snap-start">
                          <RotateCcw className="h-4 w-4" />
                          <span className="sr-only">Rotate</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Rotate</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="outline" onClick={() => (window as any).scene3D?.setTransformMode?.('scale')} aria-label="Scale" className="snap-start">
                          <Square className="h-4 w-4" />
                          <span className="sr-only">Scale</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Scale</TooltipContent>
                    </Tooltip>
                  </div>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="outline" onClick={() => setDroppedBlock({ type: 'cube' })} aria-label="Place cube" className="snap-start">
                      <Box className="h-4 w-4" />
                      <span className="sr-only">Cube</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Place cube (1)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="outline" onClick={() => setDroppedBlock({ type: 'cube_bouncy' })} aria-label="Place bouncy" className="snap-start">
                      <Zap className="h-4 w-4" />
                      <span className="sr-only">Bouncy</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Place bouncy cube</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="outline" onClick={() => setDroppedBlock({ type: 'sphere' })} aria-label="Place sphere" className="snap-start">
                      <Circle className="h-4 w-4" />
                      <span className="sr-only">Sphere</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Place sphere (2)</TooltipContent>
                </Tooltip>

                <div className="w-px h-6 bg-border mx-1" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant={gridVisible ? 'default' : 'outline'} onClick={() => setGridVisible(!gridVisible)} aria-label="Toggle grid" className="snap-start">
                      <GridIcon className="h-4 w-4" />
                      <span className="sr-only">Grid</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Grid (G)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant={snapEnabled ? 'default' : 'outline'} onClick={() => setSnapEnabled(!snapEnabled)} aria-label="Toggle snapping" className="snap-start">
                      <Magnet className="h-4 w-4" />
                      <span className="sr-only">Snap</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Snap (X)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant={placeMultiple ? 'default' : 'outline'} onClick={() => setPlaceMultiple(!placeMultiple)} aria-label="Place multiple" className="snap-start">
                      <Box className="h-4 w-4" />
                      <span className="sr-only">Place multiple</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Place multiple</TooltipContent>
                </Tooltip>

                <div className="w-px h-6 bg-border mx-1" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="outline" onClick={() => undo()} disabled={!canUndo} aria-label="Undo" className="snap-start">
                      <Undo2 className="h-4 w-4" />
                      <span className="sr-only">Undo</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="outline" onClick={() => redo()} disabled={!canRedo} aria-label="Redo" className="snap-start">
                      <Redo2 className="h-4 w-4" />
                      <span className="sr-only">Redo</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
                </Tooltip>

                <div className="w-px h-6 bg-border mx-1" />

                {/* Camera modes */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant={cameraMode==='orbit'?'default':'outline'} onClick={() => setCameraMode('orbit')} aria-label="Orbit camera" className="snap-start">
                      <Monitor className="h-4 w-4" />
                      <span className="sr-only">Orbit</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Orbit camera</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant={cameraMode==='first'?'default':'outline'} onClick={() => setCameraMode('first')} aria-label="First person" className="snap-start">
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">First person</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>First-person camera</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant={cameraMode==='ortho'?'default':'outline'} onClick={() => setCameraMode('ortho')} aria-label="Orthographic" className="snap-start">
                      <Square className="h-4 w-4" />
                      <span className="sr-only">Orthographic</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Orthographic camera</TooltipContent>
                </Tooltip>

                <div className="w-px h-6 bg-border mx-1" />

                {/* Inspector toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="outline" onClick={() => setInspectorOpen(v => !v)} aria-label="Toggle inspector" className="snap-start">
                      {inspectorOpen ? (<PanelRightClose className="h-4 w-4" />) : (<PanelRightOpen className="h-4 w-4" />)}
                      <span className="sr-only">Toggle inspector</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle inspector panel</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant={showHelp ? 'default' : 'outline'} onClick={() => setShowHelp(v => !v)} aria-label="Help" className="snap-start">
                      <HelpCircle className="h-4 w-4" />
                      <span className="sr-only">Help</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Help</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        )}

        {noUiModeEnabled && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
            <Button size="sm" variant="default" onClick={() => setNoUiModeEnabled(false)}>
              Pokaż UI
            </Button>
          </div>
        )}

        {/* Help Overlay */}
        {!noUiModeEnabled && showHelp && (
          <div className="absolute bottom-24 left-6 z-20 pointer-events-auto">
            <Card className="bg-card/95 backdrop-blur-sm border border-border shadow-lg p-4 max-w-xs">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Sterowanie</h3>
                <Button size="sm" variant="ghost" onClick={() => setShowHelp(false)}>Zamknij</Button>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• LPM: postaw blok (tryb budowy)</li>
                <li>• PPM: usuń blok (tryb budowy)</li>
                <li>• MMB: pipeta bloku (kopiuje typ i kolor)</li>
                <li>• Przeciągnij: obracaj kamerę • Scroll: zoom</li>
                <li>• <strong>WSAD:</strong> swobodne poruszanie kamery • Spacja/C: góra/dół</li>
                <li>• Shift+WSAD: szybsze poruszanie</li>
                <li>• Q/W: narzędzia (Zaznacz/Przesuń)</li>
                <li>• Strzałki: przesuwaj • PgUp/PgDn: góra/dół • Shift: x5</li>
                <li>• [ i ]: obrót Y (15°/45°) • Alt+X/Z: obrót X/Z</li>
                <li>• +/-: skalowanie (Shift: większy krok)</li>
                <li>• G: siatka • X: przyciąganie • 1/2: wybór bloku</li>
                <li>• Ctrl+Z / Shift+Ctrl+Z: Cofnij / Ponów</li>
                <li>• F: wycentruj zaznaczony • Delete: usuń</li>
              </ul>
            </Card>
          </div>
        )}
        {/* Builder: integrate into dock when enabled */}
        {!noUiModeEnabled && builderModeEnabled && (
          <div className="absolute bottom-[76px] left-1/2 -translate-x-1/2 z-10 pointer-events-none max-w-[calc(100vw-2rem)]">
            <div className="flex items-center gap-2 pointer-events-auto bg-card/95 border border-border rounded-xl px-3 py-2 shadow-lg overflow-x-auto">
              <Button size="sm" variant={builderCurrentType==='cube'?'default':'outline'} onClick={() => setBuilderCurrentType('cube')}>1: Cube</Button>
              <Button size="sm" variant={builderCurrentType==='sphere'?'default':'outline'} onClick={() => setBuilderCurrentType('sphere')}>2: Sphere</Button>
              <div className="flex items-center gap-1 ml-2">
                {[0xEF4444, 0xF59E0B, 0x10B981, 0x3B82F6, 0x8B5CF6, 0x6B7280].map((c) => (
                  <button key={c} className={`h-6 w-6 rounded-full border ${builderCurrentColor === c ? 'ring-2 ring-primary' : 'border-border'}`} style={{ backgroundColor: `#${c.toString(16).padStart(6, '0')}` }} onClick={() => setBuilderCurrentColor(c)} />
                ))}
              </div>
              <Button size="sm" variant={noUiModeEnabled ? 'default' : 'outline'} onClick={() => setNoUiModeEnabled(!noUiModeEnabled)}>No UI</Button>
            </div>
          </div>
        )}

        {/* Paint palette when Paint tool is active */}
        {!noUiModeEnabled && selectedTool === 'paint' && (
          <div className="absolute bottom-[76px] left-1/2 -translate-x-1/2 z-10 pointer-events-none max-w-[calc(100vw-2rem)]">
            <div className="flex items-center gap-2 pointer-events-auto bg-card/95 border border-border rounded-xl px-3 py-2 shadow-lg overflow-x-auto">
              <div className="text-xs text-muted-foreground mr-2">Brush color</div>
              {[0xEF4444, 0xF59E0B, 0x10B981, 0x3B82F6, 0x8B5CF6, 0x6B7280].map((c) => (
                <button key={c} className={`h-6 w-6 rounded-full border ${builderCurrentColor === c ? 'ring-2 ring-primary' : 'border-border'}`} style={{ backgroundColor: `#${c.toString(16).padStart(6, '0')}` }} onClick={() => setBuilderCurrentColor(c)} />
              ))}
            </div>
          </div>
        )}

        {/* Starter Picker */}
        {showStarter && !noUiModeEnabled && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur">
            <div className="bg-card border border-border rounded-xl p-6 shadow-xl max-w-md w-full">
              <h3 className="text-lg font-semibold mb-3">Choose a Starter</h3>
              <p className="text-sm text-muted-foreground mb-4">Pick a template to start building quickly.</p>
              <div className="grid grid-cols-1 gap-2">
                <Button variant="outline" onClick={() => applyStarter('flat')}>Flat Meadow</Button>
                <Button variant="outline" onClick={() => applyStarter('island')}>Small Island</Button>
                <Button variant="outline" onClick={() => applyStarter('corridor')}>Corridor</Button>
              </div>
              <div className="mt-4 text-right">
                <Button variant="ghost" onClick={() => setShowStarter(false)}>Skip</Button>
              </div>
            </div>
          </div>
        )}

        {/* Drop Zone Indicator */}
        {droppedBlock && (
          <div className="absolute inset-0 bg-primary/10 border-4 border-dashed border-primary/30 z-20 flex items-center justify-center pointer-events-none">
            <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg p-4 shadow-lg">
              <p className="text-foreground font-medium">
                Click anywhere on the terrain to place your {droppedBlock.type}
              </p>
              <p className="text-xs text-muted-foreground mt-1 text-center">ESC to cancel</p>
            </div>
          </div>
        )}

          </main>
        </ResizablePanel>
        {inspectorOpen && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={22} minSize={16}>
              <InspectorPanel />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
};

export default SandboxEditor;