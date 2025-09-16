import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Move3d, RotateCw, Maximize2, Square } from 'lucide-react';
import type { GizmoType } from '@/components/editor-enhanced/scene/useGizmos';

interface GizmoControlsProps {
  currentGizmo: GizmoType;
  onGizmoChange: (type: GizmoType) => void;
  disabled?: boolean;
}

export function GizmoControls({ currentGizmo, onGizmoChange, disabled = false }: GizmoControlsProps) {
  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg bg-card">
      <span className="text-sm font-medium text-muted-foreground">Transform:</span>
      <ToggleGroup 
        type="single" 
        value={currentGizmo} 
        onValueChange={(value) => onGizmoChange(value as GizmoType || 'none')}
        disabled={disabled}
      >
        <ToggleGroupItem value="position" aria-label="Move" className="h-8 w-8 p-0">
          <Move3d className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="rotation" aria-label="Rotate" className="h-8 w-8 p-0">
          <RotateCw className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="scale" aria-label="Scale" className="h-8 w-8 p-0">
          <Maximize2 className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="boundingBox" aria-label="Bounding Box" className="h-8 w-8 p-0">
          <Square className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

export default GizmoControls;
