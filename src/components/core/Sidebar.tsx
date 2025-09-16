import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
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
  Blocks
} from 'lucide-react';
import { useProjectStore } from '@/lib/projectStore';

interface SidebarProps {
  onSave: () => void;
  onPlay: () => void;
  onLoad: () => void;
  onClear: () => void;
  onNewProject: () => void;
  blockCount?: number;
  projectName?: string;
  hasUnsavedChanges?: boolean;
}

const Sidebar = ({ 
  onSave, 
  onPlay, 
  onLoad,
  onClear,
  onNewProject,
  blockCount = 0, 
  projectName = "Untitled Project",
  hasUnsavedChanges = false 
}: SidebarProps) => {
  const [selectedTool, setSelectedTool] = useState<string>('select');
  const [presetNames, setPresetNames] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sandbox-inventory-presets');
      const map = raw ? JSON.parse(raw) : {};
      const names = Object.keys(map).sort();
      setPresetNames(names);
    } catch {}
  }, []);

  // Editor and inventory bindings via composite store
  const {
    // Terrain brush
    terrainBrushMode,
    terrainBrushSize,
    terrainBrushStrength,
    terrainBrushColor,
    setTerrainBrushMode,
    setTerrainBrushSize,
    setTerrainBrushStrength,
    setTerrainBrushColor,
    // Tool
    setSelectedTool: setSelectedToolGlobal,
    // Inventory
    inventorySlots,
    selectedInventorySlot,
    setInventorySlot,
    selectInventorySlot,
  } = useProjectStore();

  const tools = [
    { id: 'select', name: 'Select', icon: MousePointer },
    { id: 'move', name: 'Move', icon: RotateCcw },
    { id: 'paint', name: 'Terrain', icon: Layers },
  ];


  return (
    <aside className="w-80 h-full bg-sidebar border-r border-sidebar-border flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-sidebar-border">
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
        <div className="flex items-center text-sm text-sidebar-foreground/70">
          <FileText className="mr-1 h-3 w-3" />
          {projectName}
        </div>
      </div>

      {/* Main panel */}
      <Tabs defaultValue="actions" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-1 px-4 pt-2">
          <TabsTrigger value="actions" className="gap-2">
            <Blocks className="h-4 w-4" />
            Actions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="flex-1 flex flex-col overflow-y-auto mt-0">
          {/* Project Actions */}
          <div className="p-4 border-b border-sidebar-border space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onNewProject}
                className="justify-start"
              >
                <Plus className="mr-1 h-3 w-3" />
                New
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onLoad}
                className="justify-start"
              >
                <FolderOpen className="mr-1 h-3 w-3" />
                Load
              </Button>
            </div>
            
            <Button 
              variant="warning" 
              size="lg" 
              className="w-full" 
              onClick={onSave}
              disabled={!hasUnsavedChanges}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Project
            </Button>
            
            <Button 
              variant="success" 
              size="lg" 
              className="w-full" 
              onClick={onPlay}
            >
              <Play className="mr-2 h-4 w-4" />
              Play Scene
            </Button>
          </div>

          {/* Inventory manage */}
          <div className="p-4 border-b border-sidebar-border space-y-3">
            <h3 className="text-sm font-semibold text-sidebar-foreground">Inventory</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="justify-start" onClick={() => {
                const items = [
                  { type: 'cube' },
                  { type: 'sphere' },
                  { type: 'cylinder' },
                  { type: 'ramp' },
                  { type: 'plate' },
                  { type: 'torus' },
                  { type: 'wedge' },
                  { type: 'start' },
                  { type: 'finish' },
                ] as const;
                items.forEach((it, i) => setInventorySlot(i, { type: it.type }));
                selectInventorySlot(0);
              }}>Basic Build</Button>
              <Button variant="outline" size="sm" className="justify-start" onClick={() => {
                const items = [
                  { type: 'cube_bouncy' },
                  { type: 'cube_ice' },
                  { type: 'cube_conveyor' },
                  { type: 'cube_boost' },
                  { type: 'cube_slow' },
                  { type: 'cube_sticky' },
                  { type: 'hazard' },
                  { type: 'checkpoint' },
                  { type: 'finish' },
                ] as const;
                items.forEach((it, i) => setInventorySlot(i, { type: it.type }));
                selectInventorySlot(0);
              }}>Mechanics</Button>
              <Button variant="outline" size="sm" className="justify-start" onClick={() => {
                const items = [
                  { type: 'cube' },
                  { type: 'door' },
                  { type: 'window' },
                  { type: 'fence' },
                  { type: 'plate' },
                  { type: 'ramp' },
                  { type: 'start' },
                  { type: 'checkpoint' },
                  { type: 'finish' },
                ] as const;
                items.forEach((it, i) => setInventorySlot(i, { type: it.type }));
                selectInventorySlot(0);
              }}>Gameplay</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                for (let i = 0; i < 9; i++) setInventorySlot(i, null);
                selectInventorySlot(0);
              }}>Clear All</Button>
              <Button variant="default" size="sm" onClick={() => {
                const items = [
                  { type: 'cube' },
                  { type: 'sphere' },
                  { type: 'cylinder' },
                  { type: 'ramp' },
                  { type: 'plate' },
                  { type: 'torus' },
                  { type: 'wedge' },
                  { type: 'start' },
                  { type: 'finish' },
                ] as const;
                items.forEach((it, i) => setInventorySlot(i, { type: it.type }));
                selectInventorySlot(0);
              }}>Reset Default</Button>
            </div>
            <p className="text-xs text-sidebar-foreground/70">Tip: użyj hotbara na dole, aby wybierać i kolorować sloty.</p>

            {/* Custom presets */}
            <div className="mt-2 space-y-2">
              <h4 className="text-xs font-medium text-sidebar-foreground/80">Custom Presets</h4>
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const name = (window.prompt('Nazwa presetu:', 'My Inventory') || '').trim();
                    if (!name) return;
                    try {
                      const slots = (inventorySlots || []).slice(0, 9);
                      const selected = Number(selectedInventorySlot || 0);
                      const raw = localStorage.getItem('sandbox-inventory-presets');
                      const map = raw ? JSON.parse(raw) : {};
                      map[name] = { slots, selected };
                      localStorage.setItem('sandbox-inventory-presets', JSON.stringify(map));
                      // refresh list
                      const names = Object.keys(map).sort();
                      setPresetNames(names);
                      setSelectedPreset(name);
                    } catch {}
                  }}
                >Save Preset</Button>
                <select
                  className="flex-1 h-8 px-2 py-1 text-sm rounded-md border border-sidebar-border bg-background"
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                >
                  <option value="">Select preset…</option>
                  {presetNames.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedPreset}
                  onClick={() => {
                    try {
                      const raw = localStorage.getItem('sandbox-inventory-presets');
                      const map = raw ? JSON.parse(raw) : {};
                      const preset = map[selectedPreset];
                      if (!preset) return;
                      const slots = Array.isArray(preset.slots) ? preset.slots.slice(0, 9) : [];
                      for (let i = 0; i < 9; i++) {
                        const entry = slots[i] || null;
                        setInventorySlot(i, entry ? { type: entry.type, color: entry.color } : null);
                      }
                      const sel = typeof preset.selected === 'number' ? Math.max(0, Math.min(8, Math.floor(preset.selected))) : 0;
                      selectInventorySlot(sel);
                    } catch {}
                  }}
                >Load</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!selectedPreset}
                  onClick={() => {
                    try {
                      const raw = localStorage.getItem('sandbox-inventory-presets');
                      const map = raw ? JSON.parse(raw) : {};
                      if (map[selectedPreset]) {
                        delete map[selectedPreset];
                        localStorage.setItem('sandbox-inventory-presets', JSON.stringify(map));
                        const names = Object.keys(map).sort();
                        setPresetNames(names);
                        setSelectedPreset('');
                      }
                    } catch {}
                  }}
                >Delete</Button>
              </div>
            </div>
          </div>

          {/* Stats & Scene Actions */}
          <div className="p-4 border-b border-sidebar-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-sidebar-foreground/70">Objects:</span>
              <Badge variant="secondary" className="bg-sidebar-accent">
                <Layers className="mr-1 h-3 w-3" />
                {blockCount}
              </Badge>
            </div>
            
            {blockCount > 0 && (
              <Button 
                variant="destructive" 
                size="sm" 
                className="w-full"
                onClick={onClear}
              >
                <Trash2 className="mr-2 h-3 w-3" />
                Clear Scene
              </Button>
            )}
          </div>

          {/* Tool Selection */}
          <div className="p-4 border-b border-sidebar-border">
            <h3 className="text-sm font-semibold text-sidebar-foreground mb-3">Tools</h3>
            <div className="grid grid-cols-2 gap-2">
              {tools.map((tool) => (
                <Button
                  key={tool.id}
                  variant={selectedTool === tool.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setSelectedTool(tool.id);
                    if (['select','move','paint'].includes(tool.id)) {
                      setSelectedToolGlobal(tool.id as any);
                    }
                  }}
                  className="justify-start"
                >
                  <tool.icon className="mr-1 h-3 w-3" />
                  {tool.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Terrain Brush Panel */}
          {selectedTool === 'paint' && (
            <div className="p-4 border-b border-sidebar-border space-y-3">
              <h3 className="text-sm font-semibold text-sidebar-foreground">Terrain Brush</h3>
              <div className="grid grid-cols-2 gap-2">
                {(['raise','lower','smooth','paint'] as const).map((m) => (
                  <Button key={m} variant={terrainBrushMode === m ? 'default' : 'outline'} size="sm" onClick={() => setTerrainBrushMode(m)}>{m}</Button>
                ))}
              </div>
              <div className="space-y-2 text-xs">
                <label className="flex items-center justify-between gap-2">
                  <span>Size</span>
                  <input type="range" min={0.1} max={25} step={0.1} value={terrainBrushSize} onChange={(e) => setTerrainBrushSize(Number(e.target.value))} className="w-40" />
                  <span className="w-10 text-right">{terrainBrushSize.toFixed(1)}</span>
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span>Strength</span>
                  <input type="range" min={0.01} max={2} step={0.01} value={terrainBrushStrength} onChange={(e) => setTerrainBrushStrength(Number(e.target.value))} className="w-40" />
                  <span className="w-10 text-right">{terrainBrushStrength.toFixed(2)}</span>
                </label>
                {terrainBrushMode === 'paint' && (
                  <div className="flex items-center justify-between gap-2">
                    <span>Color</span>
                    <input type="color" value={`#${terrainBrushColor.toString(16).padStart(6,'0')}`} onChange={(e) => setTerrainBrushColor(parseInt(e.target.value.replace('#',''), 16))} />
                  </div>
                )}
              </div>
              <p className="text-xs text-sidebar-foreground/70">Tip: drag over the ground to sculpt/paint.</p>
            </div>
          )}

          {/* Block Palette removed: now managed via hotbar inventory */}

          {/* Settings */}
          <div className="p-4 border-t border-sidebar-border">
            <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </div>
        </TabsContent>

      </Tabs>
    </aside>
  );
};

export default Sidebar;