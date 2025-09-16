import { m } from 'framer-motion';
import { useEffect, useState } from 'react';
import { SceneCanvas } from '@/components/scene/SceneCanvas';
import type { Scene3DProps } from '@/components/scene/types';
import type { QualityMode } from '@/components/scene/engine/SceneEngine';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';

const Scene3D = ({ 
  onBlockAdd, 
  droppedBlock, 
  onSceneStateChange,
  loadedBlocks,
  selectedTool = 'select',
  isPlayMode = false,
  terrainMode = 'flat',
  cameraMode = 'orbit',
  onGameStart,
  onGameCheckpoint,
  onGameFinish,
  onGameHazard,
  qualityMode = 'balanced'
}: Scene3DProps & { qualityMode?: QualityMode }) => {
  const [localQuality, setLocalQuality] = useState<QualityMode>(qualityMode);

  // Restore quality from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bss.quality');
      if (saved === 'performance' || saved === 'balanced' || saved === 'quality') {
        setLocalQuality(saved);
      }
    } catch {}
  }, []);

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem('bss.quality', localQuality);
    } catch {}
  }, [localQuality]);
  return (
    <m.div className="relative w-full h-full bg-gradient-bg" initial={{ opacity: 0.001 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      {/* Quality selector overlay */}
      <div className="absolute top-4 right-4 z-20 w-40">
        <Card className="bg-background/70 backdrop-blur-sm border-border/60">
          <div className="p-2">
            <Select value={localQuality} onValueChange={(v: QualityMode) => setLocalQuality(v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Jakość" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="performance">Wydajność</SelectItem>
                <SelectItem value="balanced">Zrównoważona</SelectItem>
                <SelectItem value="quality">Jakość</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>
      </div>
      <SceneCanvas
        onBlockAdd={onBlockAdd}
        droppedBlock={droppedBlock}
        onSceneStateChange={onSceneStateChange}
        loadedBlocks={loadedBlocks}
        selectedTool={selectedTool}
        isPlayMode={isPlayMode}
        terrainMode={terrainMode}
        cameraMode={cameraMode}
        onGameStart={onGameStart}
        onGameCheckpoint={onGameCheckpoint}
        onGameFinish={onGameFinish}
        onGameHazard={onGameHazard}
        qualityMode={localQuality}
      />
    </m.div>
  );
};

export default Scene3D;