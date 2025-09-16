import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/features/projects/stores';
import ProjectSettingsDialog from './ProjectSettingsDialog';
import NewProjectDialog from './NewProjectDialog';
import type { EditorMode } from '@/types/editor';
import {
  Play,
  Edit,
  Grid3X3,
  Settings,
  Gamepad2,
  Eye,
  Hammer,
  PaintBucket,
  Save,
  FolderOpen,
  RotateCcw,
  Home
} from 'lucide-react';

// EditorMode is imported from '@/types/editor'

interface ModeSwitcherProps {
  onOpenBuildPanel?: () => void;
  onSave?: () => void;
  onLoad?: () => void;
  className?: string;
  quality?: 'low' | 'medium' | 'high';
  onQualityChange?: (q: 'low' | 'medium' | 'high') => void;
}

const ModeSwitcher: React.FC<ModeSwitcherProps> = ({
  onOpenBuildPanel,
  onSave,
  onLoad,
  className,
  quality,
  onQualityChange
}) => {
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const {
    isPlayMode,
    editorMode,
    setEditorMode,
    togglePlay,
    selectedTool,
    setSelectedTool,
    projectName,
    hasUnsavedChanges,
    blocks,
  } = useProjectStore();
  const blockCount = blocks?.length || 0;

  const handleModeSwitch = useCallback((mode: EditorMode) => {
    setEditorMode(mode);
  }, [setEditorMode]);

  const handleToolSwitch = useCallback((tool: 'select' | 'move' | 'paint') => {
    setSelectedTool(tool);
  }, [setSelectedTool]);

  const modeConfig = {
    build: {
      name: 'Build Mode',
      icon: Hammer,
      color: 'bg-blue-500',
      description: 'Create and modify your world',
      active: editorMode === 'build'
    },
    play: {
      name: 'Play Mode', 
      icon: Play,
      color: 'bg-green-500',
      description: 'Explore and test your creation',
      active: editorMode === 'play'
    },
    preview: {
      name: 'Preview (beta)',
      icon: Eye,
      color: 'bg-purple-500',
      description: 'Preview without editing',
      active: editorMode === 'preview'
    }
  };

  const tools = [
    { id: 'select', name: 'Select', icon: Edit, description: 'Select and inspect blocks' },
    { id: 'move', name: 'Move', icon: RotateCcw, description: 'Move and rotate objects' },
    { id: 'paint', name: 'Terrain', icon: PaintBucket, description: 'Sculpt terrain' },
  ];

  return (
    <div className={cn("fixed top-4 left-4 z-40 space-y-2", className)}>
      {/* Mode Switcher */}
      <Card className="bg-black/80 border-gray-600 shadow-2xl">
        <div className="p-3">
          <div className="flex items-center gap-2">
            {(Object.entries(modeConfig) as [EditorMode, typeof modeConfig.build][]).map(([mode, config]) => {
              const isActive = config.active;
              const Icon = config.icon;
              
              return (
                <Button
                  key={mode}
                  variant={isActive ? "default" : "secondary"}
                  size="sm"
                  className={cn(
                    "flex items-center gap-2 transition-all duration-200",
                    isActive ? config.color + " text-white shadow-lg" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  )}
                  onClick={() => handleModeSwitch(mode)}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{config.name}</span>
                  {isActive && <Badge variant="secondary" className="bg-white/20 text-white text-xs">Active</Badge>}
                </Button>
              );
            })}

            {/* Quality Selector */}
            <div className="ml-2 flex items-center gap-1">
              <span className="text-[10px] text-gray-400 hidden sm:inline">Quality</span>
              {(['low','medium','high'] as const).map((q) => (
                <Button
                  key={q}
                  variant={quality === q ? 'default' : 'secondary'}
                  size="sm"
                  className={cn(
                    'h-7 px-2 text-[11px]',
                    quality === q ? 'bg-gray-200 text-gray-900' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  )}
                  onClick={() => onQualityChange?.(q)}
                >
                  {q === 'low' ? 'Low' : q === 'medium' ? 'Med' : 'High'}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Build Tools (only show in build mode) */}
      {!isPlayMode && (
        <Card className="bg-black/80 border-gray-600 shadow-2xl">
          <div className="p-3">
            <div className="flex items-center gap-1">
              {tools.map((tool) => {
                const isActive = selectedTool === tool.id;
                const Icon = tool.icon;
                
                return (
                  <Button
                    key={tool.id}
                    variant={isActive ? "default" : "secondary"}
                    size="sm"
                    className={cn(
                      "flex items-center gap-2 transition-all duration-200",
                      isActive ? "bg-blue-500 text-white shadow-lg" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    )}
                    onClick={() => handleToolSwitch(tool.id as any)}
                    title={tool.description}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline text-xs">{tool.name}</span>
                  </Button>
                );
              })}
              
              {/* Build Panel Toggle */}
              <div className="mx-2 w-px h-6 bg-gray-600" />
              <Button
                variant="secondary"
                size="sm"
                className="bg-gray-700 text-gray-300 hover:bg-gray-600"
                onClick={onOpenBuildPanel}
                title="Open build panel"
              >
                <Grid3X3 className="w-4 h-4" />
                <span className="hidden lg:inline text-xs ml-1">Blocks</span>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Project Info & Quick Actions */}
      <Card className="bg-black/80 border-gray-600 shadow-2xl">
        <div className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Home className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-white text-sm truncate">{projectName}</div>
                <div className="text-xs text-gray-400 flex items-center gap-2">
                  <span>{blockCount} blocks</span>
                  {hasUnsavedChanges && (
                    <>
                      <span>•</span>
                      <Badge variant="outline" className="border-yellow-500 text-yellow-400 text-[10px] px-1">
                        Unsaved
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Quick Action Button */}
            <Button
              variant="secondary"
              size="sm"
              className="bg-gray-700 text-gray-300 hover:bg-gray-600 flex-shrink-0"
              onClick={() => setShowQuickActions(!showQuickActions)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Quick Actions Dropdown */}
          {showQuickActions && (
            <div className="mt-3 pt-3 border-t border-gray-600 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 text-xs"
                  onClick={() => {
                    onSave?.();
                    setShowQuickActions(false);
                  }}
                  disabled={!hasUnsavedChanges}
                >
                  <Save className="w-3 h-3 mr-1" />
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 text-xs"
                  onClick={() => {
                    onLoad?.();
                    setShowQuickActions(false);
                  }}
                >
                  <FolderOpen className="w-3 h-3 mr-1" />
                  Load
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 text-xs"
                  onClick={() => { setSettingsOpen(true); setShowQuickActions(false); }}
                >
                  Ustawienia
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 text-xs"
                  onClick={() => { setNewOpen(true); setShowQuickActions(false); }}
                >
                  Nowy projekt
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Status Indicators */}
      <div className="flex flex-col gap-1">
        {isPlayMode && (
          <Card className="bg-green-900/80 border-green-600 shadow-lg">
            <div className="px-3 py-2 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-200 text-xs font-medium">Play Mode Active</span>
            </div>
          </Card>
        )}
        
        {!isPlayMode && selectedTool === 'paint' && (
          <Card className="bg-yellow-900/80 border-yellow-600 shadow-lg">
            <div className="px-3 py-2 flex items-center gap-2">
              <PaintBucket className="w-3 h-3 text-yellow-200" />
              <span className="text-yellow-200 text-xs font-medium">Terrain Mode</span>
            </div>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <ProjectSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <NewProjectDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
};

export default ModeSwitcher;
