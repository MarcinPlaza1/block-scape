import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Box, 
  Circle, 
  Octagon,
  Triangle,
  Square as SquareIcon,
  Save, 
  Play, 
  Settings, 
  Layers,
  MousePointer,
  RotateCcw,
  FolderOpen,
  Trash2,
  Plus,
  FileText,
  Pencil,
  Undo2,
  Redo2,
  ChevronDown,
  ChevronRight,
  User,
  Grid,
  Magnet,
  PanelRightOpen,
  MapPin,
  Flag,
  Skull
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { applyTheme, applyReduceMotion, getSavedTheme, getSavedReduceMotion, type ThemeVariant } from '@/lib/theme';
import { useProjectStore } from '@/lib/projectStore';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
// Hierarchy & Properties moved to right InspectorPanel

interface SidebarProps {
  onBlockDrop: (type: 'cube' | 'cube_bouncy' | 'cube_ice' | 'cube_conveyor' | 'cube_boost' | 'cube_slow' | 'cube_sticky' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'plate' | 'ramp' | 'torus' | 'wedge' | 'door' | 'window' | 'fence' | 'start' | 'checkpoint' | 'finish' | 'hazard') => void;
  onSave: () => void;
  onPlay: () => void;
  onLoad: () => void;
  onClear: () => void;
  onNewProject: () => void;
  onLoadProject?: (projectName: string) => void;
  userName?: string;
  blockCount?: number;
  projectName?: string;
  hasUnsavedChanges?: boolean;
  onRenameProject?: () => void;
  onToggleInspector?: () => void;
  onTogglePublish?: () => void;
}

const Sidebar = ({ 
  onBlockDrop,
  onSave,
  onPlay,
  onLoad,
  onClear,
  onNewProject,
  onLoadProject,
  userName,
  blockCount = 0,
  projectName = "Untitled Project",
  hasUnsavedChanges = false,
  onRenameProject,
  onToggleInspector,
  onTogglePublish
}: SidebarProps) => {
  const selectedTool = useProjectStore(s => s.selectedTool);
  const setSelectedToolStore = useProjectStore(s => s.setSelectedTool);
  const addBlocks = useProjectStore(s => (s as any).addBlocks) as (toAdd: any[]) => void;
  const savedProjects = useProjectStore(s => s.savedProjects as {[key: string]: any});
  const droppedBlock = useProjectStore(s => s.droppedBlock);
  const deleteSavedProject = useProjectStore(s => s.deleteSavedProject);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeVariant>(() => (typeof window !== 'undefined' ? getSavedTheme() : 'default'));
  const [reduceMotion, setReduceMotion] = useState<boolean>(() => (typeof window !== 'undefined' ? getSavedReduceMotion() : false));
  const undo = useProjectStore(s => (s as any).undo);
  const redo = useProjectStore(s => (s as any).redo);
  const canUndo = useProjectStore(s => ((s as any).historyPast?.length || 0) > 0);
  const canRedo = useProjectStore(s => ((s as any).historyFuture?.length || 0) > 0);
  // Editor settings
  const gridVisible = useProjectStore(s => (s as any).gridVisible);
  const snapEnabled = useProjectStore(s => (s as any).snapEnabled);
  const snapSize = useProjectStore(s => (s as any).snapSize);
  const setGridVisible = useProjectStore(s => (s as any).setGridVisible);
  const setSnapEnabled = useProjectStore(s => (s as any).setSnapEnabled);
  const setSnapSize = useProjectStore(s => (s as any).setSnapSize);
  const builderModeEnabled = useProjectStore(s => (s as any).builderModeEnabled);
  const builderCurrentType = useProjectStore(s => (s as any).builderCurrentType);
  const isPlayMode = useProjectStore(s => (s as any).isPlayMode);
  const setBuilderModeEnabled = useProjectStore(s => (s as any).setBuilderModeEnabled);
  const setBuilderCurrentType = useProjectStore(s => (s as any).setBuilderCurrentType);
  const setDroppedBlockStore = useProjectStore(s => (s as any).setDroppedBlock) as (p: { type: any } | null) => void;
  const [savedOpen, setSavedOpen] = useState(true);
  // Scene content moved to Inspector
  const [sceneOpen, setSceneOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [moreShapesOpen, setMoreShapesOpen] = useState(false);
  const [prefabsOpen, setPrefabsOpen] = useState(false);
  const [selectedBlockTile, setSelectedBlockTile] = useState<string | null>(null);
  const navigate = useNavigate();
  const logout = useAuthStore(s => s.logout);
  const currentPublished = !!(useProjectStore.getState().currentProject as any)?.published;
  const [published, setPublished] = useState<boolean>(currentPublished);
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    const unsub = useProjectStore.subscribe((s) => {
      try { setPublished(!!(s.currentProject as any)?.published); } catch {}
    });
    return () => { try { (unsub as any)?.(); } catch {} };
  }, []);
  useEffect(() => {
    try {
      const key = projectName;
      const raw = localStorage.getItem(`sandbox-history-${key}`);
      const list = Array.isArray(raw ? JSON.parse(raw) : []) ? JSON.parse(raw) as string[] : [];
      setHistory(list);
    } catch { setHistory([]); }
  }, [projectName, hasUnsavedChanges]);

  const tools = [
    { id: 'select', name: 'Select', icon: MousePointer },
    { id: 'move', name: 'Move', icon: RotateCcw },
  ];

  const blocks = [
    {
      id: 'cube',
      name: 'Cube',
      icon: Box,
      description: 'Basic cube block',
      color: 'bg-blue-500'
    },
    { id: 'cube_bouncy', name: 'Bouncy Cube', icon: Box, description: 'Sprężysty blok', color: 'bg-emerald-500' },
    { id: 'cube_ice', name: 'Ice Cube', icon: Box, description: 'Śliski blok', color: 'bg-cyan-400' },
    { id: 'cube_conveyor', name: 'Conveyor Cube', icon: Box, description: 'Przenośnik', color: 'bg-amber-500' },
    { id: 'cube_boost', name: 'Boost Cube', icon: Box, description: 'Przyspiesza gracza', color: 'bg-fuchsia-500' },
    { id: 'cube_slow', name: 'Slow Cube', icon: Box, description: 'Spowalnia gracza', color: 'bg-yellow-600' },
    { id: 'cube_sticky', name: 'Sticky Cube', icon: Box, description: 'Lepki blok', color: 'bg-lime-600' },
    {
      id: 'sphere',
      name: 'Sphere',
      icon: Circle,
      description: 'Rounded sphere block',
      color: 'bg-purple-500'
    },
    {
      id: 'cylinder',
      name: 'Cylinder',
      icon: Octagon,
      description: 'Vertical cylinder block',
      color: 'bg-emerald-500'
    },
    {
      id: 'cone',
      name: 'Cone',
      icon: Triangle,
      description: 'Conical block',
      color: 'bg-amber-500'
    },
    {
      id: 'pyramid',
      name: 'Pyramid',
      icon: Triangle,
      description: 'Pyramidal block',
      color: 'bg-rose-500'
    },
    {
      id: 'plate',
      name: 'Plate',
      icon: SquareIcon,
      description: 'Thin plate block',
      color: 'bg-slate-500'
    },
    {
      id: 'ramp',
      name: 'Ramp',
      icon: Triangle,
      description: 'Slope ramp block',
      color: 'bg-teal-500'
    },
    {
      id: 'torus',
      name: 'Torus',
      icon: Octagon,
      description: 'Donut ring',
      color: 'bg-pink-500'
    },
    {
      id: 'wedge',
      name: 'Wedge',
      icon: Triangle,
      description: 'Wedge block',
      color: 'bg-indigo-500'
    },
    {
      id: 'door',
      name: 'Door',
      icon: SquareIcon,
      description: 'Simple door panel',
      color: 'bg-amber-700'
    },
    {
      id: 'window',
      name: 'Window',
      icon: SquareIcon,
      description: 'Glass window',
      color: 'bg-sky-400'
    },
    {
      id: 'fence',
      name: 'Fence',
      icon: SquareIcon,
      description: 'Fence panel',
      color: 'bg-gray-400'
    },
  ];
  // Prefabs local storage helpers
  const readPrefabs = (): { name: string; blocks: any[] }[] => {
    try {
      const raw = localStorage.getItem('sandbox-prefabs');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };
  const writePrefabs = (list: { name: string; blocks: any[] }[]) => {
    try { localStorage.setItem('sandbox-prefabs', JSON.stringify(list)); } catch {}
  };
  const savePrefab = () => {
    const name = prompt('Prefab name?') || '';
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const blocks = (useProjectStore.getState().blocks || []).map(b => ({
        id: `${b.id}-pf-${Date.now()}`,
        type: b.type,
        position: { ...b.position },
        name: (b as any).name,
        hidden: false,
        locked: false,
        color: (b as any).color,
        group: (b as any).group,
        rotationY: (b as any).rotationY,
        rotationX: (b as any).rotationX,
        rotationZ: (b as any).rotationZ,
        scale: (b as any).scale,
      }));
      const list = readPrefabs();
      list.push({ name: trimmed, blocks });
      writePrefabs(list);
      alert('Saved prefab: ' + trimmed);
    } catch {}
  };
  const insertPrefab = (pf: { name: string; blocks: any[] }) => {
    try {
      // Offset prefab around origin a bit for clarity
      const dx = 0;
      const dz = 0;
      const toAdd = (pf.blocks || []).map(b => ({
        ...b,
        id: `${b.id}-ins-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        position: { x: b.position.x + dx, y: b.position.y, z: b.position.z + dz },
      }));
      addBlocks(toAdd as any);
    } catch {}
  };

  const primaryBlocks = blocks.filter(b => ['cube','cube_bouncy','cube_ice','cube_conveyor'].includes(b.id));
  const extraBlocks = blocks.filter(b => !['cube','cube_bouncy','cube_ice','cube_conveyor'].includes(b.id));
  const gameplayBlocks = [
    { id: 'start', name: 'Start', icon: Play, description: 'Spawn pad', color: 'bg-emerald-500' },
    { id: 'checkpoint', name: 'Checkpoint', icon: MapPin, description: 'Save progress', color: 'bg-amber-500' },
    { id: 'finish', name: 'Finish', icon: Flag, description: 'Goal pad', color: 'bg-sky-500' },
    { id: 'hazard', name: 'Hazard', icon: Skull, description: 'Danger zone', color: 'bg-rose-600' },
  ];

  // savedProjects come from store

  // Theme handlers
  const handleThemeChange = (variant: ThemeVariant) => {
    setTheme(variant);
    applyTheme(variant);
  };
  const handleReduceMotionToggle = () => {
    const next = !reduceMotion;
    setReduceMotion(next);
    applyReduceMotion(next);
  };

  const handleDeleteProject = (projectName: string) => {
    deleteSavedProject(projectName);
  };

  const handleDragStart = (e: React.DragEvent, blockType: 'cube' | 'cube_bouncy' | 'cube_ice' | 'cube_conveyor' | 'cube_boost' | 'cube_slow' | 'cube_sticky' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'plate' | 'ramp' | 'torus' | 'wedge' | 'door' | 'window' | 'fence' | 'start' | 'checkpoint' | 'finish' | 'hazard') => {
    setDraggedItem(blockType);
    e.dataTransfer.setData('text/plain', blockType);
    e.dataTransfer.effectAllowed = 'copy';
    
    // Visual feedback
    const dragImage = document.createElement('div');
    dragImage.className = 'px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg';
    dragImage.textContent = blockType;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragEnd = (e: React.DragEvent, blockType: 'cube' | 'cube_bouncy' | 'cube_ice' | 'cube_conveyor' | 'cube_boost' | 'cube_slow' | 'cube_sticky' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'plate' | 'ramp' | 'torus' | 'wedge' | 'door' | 'window' | 'fence' | 'start' | 'checkpoint' | 'finish' | 'hazard') => {
    setDraggedItem(null);
    // Trigger the block drop in the scene
    onBlockDrop(blockType);
  };

  return (
    <aside className="w-80 h-full overflow-y-auto bg-sidebar border-r border-sidebar-border flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-sidebar-border sticky top-0 z-10 bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/60">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold text-sidebar-foreground">
            3D Sandbox Editor
          </h1>
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-xs border-warning text-warning">
              Unsaved
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between text-sm text-sidebar-foreground/70">
          <div className="flex items-center">
            <FileText className="mr-1 h-3 w-3" />
            <span className="font-medium mr-2 truncate max-w-[10rem]" title={projectName}>{projectName}</span>
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={onRenameProject}>
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{blockCount} blocks</Badge>
            {droppedBlock && (
              <Badge variant="default" className="text-[10px]">Placing: {droppedBlock.type}</Badge>
            )}
          </div>
        </div>
        {userName && (
          <div className="mt-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start px-0 h-auto">
                  <Badge variant="secondary" className="text-xs w-full justify-start truncate flex items-center gap-2" title={userName}>
                    <User className="h-3 w-3" />
                    <span className="truncate">{userName}</span>
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[12rem]">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate('/profile')}>Account</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/games')}>My games</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { logout(); navigate('/login'); }}>Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Primary actions: Play and Save (big, obvious) */}
      <div className="p-4 border-b border-sidebar-border space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Button 
            variant={isPlayMode ? 'default' : 'success'}
            size="lg"
            className="w-full"
            onClick={onPlay}
          >
            <Play className="mr-2 h-4 w-4" />
            {isPlayMode ? 'Stop' : 'Play'}
          </Button>
          <Button 
            variant={hasUnsavedChanges ? 'warning' : 'outline'} 
            size="lg" 
            className="w-full" 
            onClick={onSave}
            disabled={!hasUnsavedChanges}
          >
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <Button variant={published ? 'default' : 'outline'} size="sm" className="justify-start" onClick={() => { onTogglePublish?.(); }}>
            {published ? 'Opublikowana' : 'Szkic'}
          </Button>
          <Badge variant="outline" className="text-[10px]">
            {hasUnsavedChanges ? 'Do zapisania' : 'Zapisano'}
          </Badge>
        </div>
        <Button variant="outline" size="sm" className="w-full justify-start" onClick={onToggleInspector}>
          <PanelRightOpen className="mr-2 h-4 w-4" /> Pokaż inspektor
        </Button>
        {(history?.length ?? 0) > 0 && (
          <div className="mt-2">
            <div className="text-[10px] text-sidebar-foreground/60 mb-1">Historia wersji</div>
            <div className="flex flex-col gap-1 max-h-24 overflow-auto pr-1">
              {history?.map((h) => (
                <div key={h} className="text-[10px] text-sidebar-foreground/70">{new Date(h).toLocaleString()}</div>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" onClick={onNewProject}><Plus className="mr-2 h-3 w-3" />New</Button>
          <Button variant="outline" size="sm" onClick={onLoad}><FolderOpen className="mr-2 h-3 w-3" />Load</Button>
          <Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive/10" onClick={onClear} disabled={blockCount === 0}><Trash2 className="mr-2 h-3 w-3" />Clear</Button>
        </div>
      </div>

      {/* Scene/Properties now in InspectorPanel */}

      {/* Saved Projects → navigate to user's projects */}
      <div className="p-4 border-b border-sidebar-border">
        <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/games')}>
          <FolderOpen className="mr-2 h-4 w-4" />
          Go to My Projects
        </Button>
      </div>

      {/* Prefabs */}
      <div className="p-4 border-b border-sidebar-border space-y-2">
        <button className="w-full text-sm font-semibold text-sidebar-foreground flex items-center justify-between relative group" onClick={() => setPrefabsOpen(v => !v)}>
          <span className="flex items-center"><Layers className="mr-2 h-4 w-4" />Prefabs</span>
          {prefabsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className={`absolute left-0 -ml-4 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded ${prefabsOpen ? 'bg-primary' : 'bg-transparent group-hover:bg-accent/60'}`}></span>
        </button>
        {prefabsOpen && (
          <div className="space-y-2">
            <Button variant="outline" size="sm" onClick={savePrefab}>Save current as prefab</Button>
            <div className="space-y-1">
              {readPrefabs().length === 0 && (
                <div className="text-xs text-sidebar-foreground/70">No prefabs saved.</div>
              )}
              {readPrefabs().map(pf => (
                <div key={pf.name} className="flex items-center justify-between text-xs">
                  <span className="truncate" title={pf.name}>{pf.name}</span>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => insertPrefab(pf)}>Insert</Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      const list = readPrefabs().filter(x => x.name !== pf.name);
                      writePrefabs(list);
                    }}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tools are accessible from bottom toolbar; keep minimal quick actions here if needed */}

      {/* Blocks Section (two big tiles) */}
      <div className="flex-1 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-sidebar-foreground mb-3">Blocks</h3>
        <div className="grid grid-cols-2 gap-3">
          {primaryBlocks.map((block) => {
            const isDraggingOrArmed = draggedItem === block.id || droppedBlock?.type === block.id;
            const isActive = selectedBlockTile === block.id;
            return (
              <Card 
                key={block.id}
                className={`cursor-grab active:cursor-grabbing bg-sidebar-accent border-sidebar-border hover:border-sidebar-primary transition-transform ${isDraggingOrArmed ? 'opacity-50 scale-95 ring-2 ring-primary' : (isActive ? 'ring-2 ring-primary' : '')}`}
                draggable
                onClick={() => {
                  if (draggedItem) return;
                  setSelectedBlockTile(prev => {
                    const next = prev === block.id ? null : block.id;
                    try {
                      if (next) onBlockDrop(block.id as any); else setDroppedBlockStore(null);
                    } catch {}
                    return next;
                  });
                }}
                onDragStart={(e) => handleDragStart(e, block.id as 'cube' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'plate' | 'ramp' | 'torus' | 'wedge' | 'door' | 'window' | 'fence')}
                onDragEnd={(e) => handleDragEnd(e, block.id as 'cube' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'plate' | 'ramp' | 'torus' | 'wedge' | 'door' | 'window' | 'fence')}
                title={`Drag to the 3D scene to place a ${block.name.toLowerCase()}.`}
              >
                <CardHeader className="pb-1">
                  <CardTitle className="flex items-center text-sm text-sidebar-foreground">
                    <div className={`p-3 rounded-lg mr-3 ${block.color} text-white`}>
                      <block.icon className="h-5 w-5" />
                    </div>
                    {block.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-[11px] text-sidebar-foreground/70">{block.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="space-y-3">
          <Button variant="outline" size="sm" className="w-full justify-between" onClick={() => setMoreShapesOpen(v => !v)}>
            Więcej kształtów
            {moreShapesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          {moreShapesOpen && (
            <div className="grid grid-cols-2 gap-3">
              {extraBlocks.map((block) => {
                const isDraggingOrArmed = draggedItem === block.id || droppedBlock?.type === block.id;
                const isActive = selectedBlockTile === block.id;
                return (
                  <Card 
                    key={block.id}
                    className={`cursor-grab active:cursor-grabbing bg-sidebar-accent border-sidebar-border hover:border-sidebar-primary transition-transform ${isDraggingOrArmed ? 'opacity-50 scale-95 ring-2 ring-primary' : (isActive ? 'ring-2 ring-primary' : '')}`}
                    draggable
                    onClick={() => {
                      if (draggedItem) return;
                      setSelectedBlockTile(prev => {
                        const next = prev === block.id ? null : block.id;
                        try {
                          if (next) onBlockDrop(block.id as any); else setDroppedBlockStore(null);
                        } catch {}
                        return next;
                      });
                    }}
                    onDragStart={(e) => handleDragStart(e, block.id as 'cube' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'plate' | 'ramp' | 'torus' | 'wedge' | 'door' | 'window' | 'fence')}
                    onDragEnd={(e) => handleDragEnd(e, block.id as 'cube' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'plate' | 'ramp' | 'torus' | 'wedge' | 'door' | 'window' | 'fence')}
                    title={`Drag to the 3D scene to place a ${block.name.toLowerCase()}.`}
                  >
                    <CardHeader className="pb-1">
                      <CardTitle className="flex items-center text-sm text-sidebar-foreground">
                        <div className={`p-3 rounded-lg mr-3 ${block.color} text-white`}>
                          <block.icon className="h-5 w-5" />
                        </div>
                        {block.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-[11px] text-sidebar-foreground/70">{block.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-sidebar-foreground/80">Gameplay</h4>
          <div className="grid grid-cols-2 gap-3">
            {gameplayBlocks.map((block) => {
              const isDraggingOrArmed = draggedItem === block.id || droppedBlock?.type === (block.id as any);
              const isActive = selectedBlockTile === block.id;
              return (
                <Card
                  key={block.id}
                  className={`cursor-grab active:cursor-grabbing bg-sidebar-accent border-sidebar-border hover:border-sidebar-primary transition-transform ${isDraggingOrArmed ? 'opacity-50 scale-95 ring-2 ring-primary' : (isActive ? 'ring-2 ring-primary' : '')}`}
                  draggable
                  onClick={() => {
                    if (draggedItem) return;
                    setSelectedBlockTile(prev => {
                      const next = prev === block.id ? null : block.id;
                      try {
                        if (next) onBlockDrop(block.id as any); else setDroppedBlockStore(null);
                      } catch {}
                      return next;
                    });
                  }}
                  onDragStart={(e) => handleDragStart(e, block.id as any)}
                  onDragEnd={(e) => handleDragEnd(e, block.id as any)}
                  title={`Drag to the 3D scene to place a ${block.name.toLowerCase()}.`}
                >
                  <CardHeader className="pb-1">
                    <CardTitle className="flex items-center text-sm text-sidebar-foreground">
                      <div className={`p-3 rounded-lg mr-3 ${block.color} text-white`}>
                        <block.icon className="h-5 w-5" />
                      </div>
                      {block.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-[11px] text-sidebar-foreground/70">{block.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Settings (collapsible, compact) */}
      <div className="p-4 border-t border-sidebar-border space-y-3 sticky bottom-0 z-10 bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/60">
        <button onClick={() => setAdvancedOpen(v => !v)} className="w-full text-sm font-semibold text-sidebar-foreground flex items-center justify-between relative group">
          <span className="flex items-center"><Settings className="mr-2 h-4 w-4" />Settings</span>
          {advancedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className={`absolute left-0 -ml-4 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded ${advancedOpen ? 'bg-primary' : 'bg-transparent group-hover:bg-accent/60'}`}></span>
        </button>
        {advancedOpen && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Builder Mode</span>
              <Button variant={builderModeEnabled ? 'default' : 'outline'} size="sm" onClick={() => setBuilderModeEnabled(!builderModeEnabled)}>
                {builderModeEnabled ? 'On' : 'Off'}
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-sidebar-foreground/80">
              <span>Current block</span>
              <div className="flex items-center gap-2">
                <Button variant={builderCurrentType === 'cube' ? 'default' : 'outline'} size="sm" onClick={() => setBuilderCurrentType('cube')}>1: Cube</Button>
                <Button variant={builderCurrentType === 'sphere' ? 'default' : 'outline'} size="sm" onClick={() => setBuilderCurrentType('sphere')}>2: Sphere</Button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Grid className="h-4 w-4 text-sidebar-foreground/80" />
                <span>Grid</span>
              </div>
              <Button variant={gridVisible ? 'default' : 'outline'} size="sm" onClick={() => setGridVisible(!gridVisible)}>
                {gridVisible ? 'On' : 'Off'}
              </Button>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Magnet className="h-4 w-4 text-sidebar-foreground/80" />
                <span>Snap</span>
              </div>
              <Button variant={snapEnabled ? 'default' : 'outline'} size="sm" onClick={() => setSnapEnabled(!snapEnabled)}>
                {snapEnabled ? 'On' : 'Off'}
              </Button>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Snap size</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSnapSize(Math.max(0.1, Number((snapSize || 1).toFixed(1)) - 0.1))}>-</Button>
                <Badge variant="outline" className="min-w-[3rem] justify-center">{Number(snapSize || 1).toFixed(1)}</Badge>
                <Button variant="outline" size="sm" onClick={() => setSnapSize(Number((snapSize || 1)) + 0.1)}>+</Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant={theme === 'default' ? 'default' : 'outline'} size="sm" onClick={() => handleThemeChange('default')}>Default</Button>
              <Button variant={theme === 'kids' ? 'default' : 'outline'} size="sm" onClick={() => handleThemeChange('kids')}>Kids</Button>
              <Button variant={theme === 'contrast' ? 'default' : 'outline'} size="sm" onClick={() => handleThemeChange('contrast')}>Contrast</Button>
            </div>
            <Button variant={reduceMotion ? 'default' : 'outline'} size="sm" onClick={handleReduceMotionToggle}>
              {reduceMotion ? 'Reduced motion: On' : 'Reduced motion: Off'}
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;