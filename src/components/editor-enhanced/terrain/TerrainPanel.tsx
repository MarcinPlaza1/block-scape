import React, { useCallback } from 'react';
import { 
  Mountain, 
  Waves, 
  Paintbrush, 
  Circle, 
  Square,
  Triangle,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { usePhysicsContext } from '../scene/PhysicsProvider';

interface TerrainPanelProps {
  isVisible: boolean;
  onClose: () => void;
  terrainBrushMode: 'raise' | 'lower' | 'smooth' | 'paint';
  terrainBrushSize: number;
  terrainBrushStrength: number;
  terrainBrushColor: number;
  onBrushModeChange: (mode: 'raise' | 'lower' | 'smooth' | 'paint') => void;
  onBrushSizeChange: (size: number) => void;
  onBrushStrengthChange: (strength: number) => void;
  onBrushColorChange: (color: number) => void;
}

const terrainTools = [
  { mode: 'raise' as const, icon: Mountain, label: 'Podnieś', tooltip: 'Kliknij i przeciągaj, aby podnieść teren' },
  { mode: 'lower' as const, icon: Waves, label: 'Obniż', tooltip: 'Kliknij i przeciągaj, aby obniżyć teren' },
  { mode: 'smooth' as const, icon: Circle, label: 'Wygładź', tooltip: 'Wygładź nierówności terenu' },
  { mode: 'paint' as const, icon: Paintbrush, label: 'Maluj', tooltip: 'Maluj teren wybranym kolorem' },
];

const terrainPresets = [
  { name: 'Płaski', icon: Square, height: 0 },
  { name: 'Pagórki', icon: Waves, height: 2 },
  { name: 'Góry', icon: Triangle, height: 5 },
];

export const TerrainPanel: React.FC<TerrainPanelProps> = ({
  isVisible,
  onClose,
  terrainBrushMode,
  terrainBrushSize,
  terrainBrushStrength,
  terrainBrushColor,
  onBrushModeChange,
  onBrushSizeChange,
  onBrushStrengthChange,
  onBrushColorChange,
}) => {
  if (!isVisible) return null;

  const physics = usePhysicsContext();

  const handleApplyPreset = useCallback((preset: 'flat' | 'hilly' | 'mountains') => {
    try {
      const scene = (window as any).scene3D?.getScene?.() || (window as any).__babylonScene__;
      // Fallback: try to derive scene from ground
      const ground = (window as any).scene3D?.getGround?.();
      const effectiveScene = scene || (ground ? ground.getScene() : null);
      if (!effectiveScene) return;
      const newGround = physics.applyTerrainPreset(effectiveScene, preset);
      // Update references used by input/brush systems
      if ((window as any).scene3D?.setGround) {
        (window as any).scene3D.setGround(newGround);
      }
    } catch {}
  }, [physics]);

  return (
    <div className="absolute right-4 top-20 w-80 bg-card/95 backdrop-blur-md rounded-lg shadow-2xl border border-border/50 overflow-hidden animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="bg-primary/10 p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mountain className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Edytor Terenu</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <span className="text-xl">×</span>
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Quick Presets */}
        <div>
          <h4 className="text-sm font-medium mb-3 text-muted-foreground">Szybkie presety</h4>
          <div className="grid grid-cols-3 gap-2">
            {terrainPresets.map((preset) => (
              <Button
                key={preset.name}
                variant="outline"
                size="sm"
                className="flex flex-col gap-1 h-auto py-2"
                onClick={() => handleApplyPreset(
                  preset.name === 'Płaski' ? 'flat' : (preset.name === 'Pagórki' ? 'hilly' : 'mountains')
                )}
              >
                <preset.icon className="w-4 h-4" />
                <span className="text-xs">{preset.name}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Terrain Tools */}
        <div>
          <h4 className="text-sm font-medium mb-3 text-muted-foreground">Narzędzia terenu</h4>
          <div className="grid grid-cols-2 gap-2">
            {terrainTools.map((tool) => (
              <Button
                key={tool.mode}
                variant={terrainBrushMode === tool.mode ? 'default' : 'outline'}
                size="sm"
                onClick={() => onBrushModeChange(tool.mode)}
                className="flex items-center gap-2 justify-start"
                title={tool.tooltip}
              >
                <tool.icon className="w-4 h-4" />
                <span>{tool.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Brush Settings */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Ustawienia pędzla</h4>
          
          {/* Size */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm">Rozmiar</label>
              <span className="text-sm text-muted-foreground w-12 text-right">
                {terrainBrushSize.toFixed(1)}
              </span>
            </div>
            <Slider
              value={[terrainBrushSize]}
              onValueChange={([value]) => onBrushSizeChange(value)}
              min={0.5}
              max={20}
              step={0.5}
              className="w-full"
            />
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>Mały</span>
              <span>Duży</span>
            </div>
          </div>

          {/* Strength */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm">Siła</label>
              <span className="text-sm text-muted-foreground w-12 text-right">
                {terrainBrushStrength.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[terrainBrushStrength]}
              onValueChange={([value]) => onBrushStrengthChange(value)}
              min={0.01}
              max={1.0}
              step={0.01}
              className="w-full"
            />
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>Delikatna</span>
              <span>Mocna</span>
            </div>
          </div>

          {/* Color Picker (only for paint mode) */}
          {terrainBrushMode === 'paint' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm">Kolor</label>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded border border-border"
                    style={{ backgroundColor: `#${terrainBrushColor.toString(16).padStart(6, '0')}` }}
                  />
                  <input
                    type="color"
                    value={`#${terrainBrushColor.toString(16).padStart(6, '0')}`}
                    onChange={(e) => onBrushColorChange(parseInt(e.target.value.replace('#', ''), 16))}
                    className="w-0 h-0 opacity-0"
                    id="terrain-color-picker"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('terrain-color-picker')?.click()}
                  >
                    Wybierz
                  </Button>
                </div>
              </div>
              
              {/* Color Presets */}
              <div className="grid grid-cols-6 gap-1 mt-2">
                {[
                  0x4a9d4a, // Trawa
                  0x8b7355, // Ziemia
                  0xc2b280, // Piasek
                  0x808080, // Kamień
                  0x3b3b3b, // Asfalt
                  0xffffff, // Śnieg
                ].map((color) => (
                  <button
                    key={color}
                    className="w-full aspect-square rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: `#${color.toString(16).padStart(6, '0')}` }}
                    onClick={() => onBrushColorChange(color)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="bg-muted/50 rounded-md p-3">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-primary mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Wskazówka:</p>
              <p>Przytrzymaj i przeciągaj myszą po terenie, aby zastosować wybrany efekt.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
