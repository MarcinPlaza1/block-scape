import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, RefreshCw, BarChart3 } from 'lucide-react';
import { 
  getMemoryStats, 
  resetMemoryStats, 
  forceGarbageCollection, 
  getTextureCacheInfo,
  disposeTextureCache 
} from './blocks/createBlock';

interface MemoryDebugPanelProps {
  className?: string;
  visible?: boolean;
}

const MemoryDebugPanel: React.FC<MemoryDebugPanelProps> = ({ 
  className = '', 
  visible = false 
}) => {
  const [stats, setStats] = useState({
    meshes: 0,
    geometries: 0,
    materials: 0,
    textures: 0,
    lastCleanup: 0,
    timeSinceLastCleanup: 0
  });
  
  const [textureInfo, setTextureInfo] = useState({
    cachedTextures: 0
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!visible) return;

    const updateStats = () => {
      setStats(getMemoryStats());
      setTextureInfo(getTextureCacheInfo());
    };

    // Initial load
    updateStats();

    // Update every 2 seconds when visible
    const interval = setInterval(updateStats, 2000);

    return () => clearInterval(interval);
  }, [visible]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setStats(getMemoryStats());
    setTextureInfo(getTextureCacheInfo());
    await new Promise(resolve => setTimeout(resolve, 500)); // Visual feedback
    setIsRefreshing(false);
  };

  const handleResetStats = () => {
    resetMemoryStats();
    handleRefresh();
  };

  const handleForceGC = () => {
    forceGarbageCollection();
    setTimeout(handleRefresh, 100);
  };

  const handleClearTextureCache = () => {
    disposeTextureCache();
    handleRefresh();
  };

  if (!visible) return null;

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
    return `${Math.floor(ms / 60000)}m`;
  };

  return (
    <Card className={`p-4 bg-background/95 backdrop-blur-sm border-border ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Memory Debug</h3>
        </div>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleForceGC}
            className="h-7 w-7 p-0"
            title="Force Garbage Collection"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Meshes:</span>
            <Badge variant="outline" className="h-5 text-xs">
              {stats.meshes}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Geometries:</span>
            <Badge variant="outline" className="h-5 text-xs">
              {stats.geometries}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Materials:</span>
            <Badge variant="outline" className="h-5 text-xs">
              {stats.materials}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Textures:</span>
            <Badge variant="outline" className="h-5 text-xs">
              {stats.textures}
            </Badge>
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-muted-foreground">Cached Textures:</span>
            <Badge 
              variant={textureInfo.cachedTextures > 5 ? "secondary" : "outline"} 
              className="h-5 text-xs"
            >
              {textureInfo.cachedTextures}
            </Badge>
          </div>
          
          {textureInfo.cachedTextures > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearTextureCache}
              className="w-full h-6 text-xs"
            >
              Clear Texture Cache
            </Button>
          )}
        </div>

        <div className="pt-2 border-t border-border text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Last cleanup:</span>
            <span>{formatTime(stats.timeSinceLastCleanup)} ago</span>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleResetStats}
          className="w-full h-6 text-xs"
        >
          Reset Statistics
        </Button>
      </div>
    </Card>
  );
};

export default MemoryDebugPanel;
