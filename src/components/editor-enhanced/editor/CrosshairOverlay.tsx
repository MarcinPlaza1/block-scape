import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/features/projects/stores';
import { Plus, MousePointer, RotateCcw } from 'lucide-react';

interface CrosshairOverlayProps {
  className?: string;
}

const CrosshairOverlay: React.FC<CrosshairOverlayProps> = ({ className }) => {
  const {
    selectedTool,
    droppedBlock,
    isPlayMode,
    gridVisible,
    snapEnabled,
  } = useProjectStore();

  // Don't show crosshair in play mode
  if (isPlayMode) return null;

  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMove, { passive: true } as any);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  const getCrosshairIcon = () => {
    if (droppedBlock) return Plus;
    switch (selectedTool) {
      case 'move': return RotateCcw;
      case 'paint': return MousePointer;
      default: return MousePointer;
    }
  };

  const getCrosshairColor = () => {
    if (droppedBlock) return 'text-green-400';
    switch (selectedTool) {
      case 'move': return 'text-blue-400';
      case 'paint': return 'text-yellow-400';
      default: return 'text-white';
    }
  };

  const CrosshairIcon = getCrosshairIcon();

  return (
    <div 
      className={cn(
        "fixed inset-0 pointer-events-none z-40",
        className
      )}
    >
      {/* Main crosshair at cursor position */}
      {cursorPos && (
        <div
          className="absolute"
          style={{ left: cursorPos.x, top: cursorPos.y, transform: 'translate(-50%, -50%)' }}
        >
          {/* Center dot/icon */}
          <div className={cn(
            "flex items-center justify-center",
            "transition-all duration-200",
            droppedBlock && "scale-125 animate-pulse"
          )}>
            <CrosshairIcon 
              className={cn(
                "w-6 h-6 drop-shadow-lg",
                getCrosshairColor(),
                droppedBlock && "animate-spin"
              )} 
            />
          </div>

          {/* Crosshair lines */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Horizontal line */}
            <div className={cn(
              "absolute w-8 h-0.5 bg-white/60",
              "before:absolute before:w-2 before:h-0.5 before:bg-white before:-left-5",
              "after:absolute after:w-2 after:h-0.5 after:bg-white after:-right-5"
            )} />
            
            {/* Vertical line */}
            <div className={cn(
              "absolute h-8 w-0.5 bg-white/60",
              "before:absolute before:h-2 before:w-0.5 before:bg-white before:-top-5",
              "after:absolute after:h-2 after:w-0.5 after:bg-white after:-bottom-5"
            )} />
          </div>
        </div>
      )}

      {/* Grid overlay indicator */}
      {gridVisible && (
        <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" 
             style={{
               backgroundImage: `
                 linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
               `,
               backgroundSize: '32px 32px'
             }}
        />
      )}

      {/* Snap indicator - show centered around cursor if snap enabled */}
      {snapEnabled && cursorPos && (
        <div className="absolute" style={{ left: cursorPos.x, top: cursorPos.y, transform: 'translate(-50%, -50%)' }}>
          <div className="w-16 h-16 border border-white/30 rounded-sm" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-2 h-2 bg-white/50 rounded-full" />
          </div>
        </div>
      )}

      {/* Tool status indicator */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
        <div className="bg-black/60 text-white text-xs px-3 py-1 rounded-full border border-white/20 flex items-center gap-2">
          <CrosshairIcon className="w-3 h-3" />
          <span>
            {droppedBlock 
              ? `Placing ${droppedBlock.type.replace(/_/g, ' ')}` 
              : `${selectedTool.charAt(0).toUpperCase() + selectedTool.slice(1)} Mode`
            }
          </span>
          {snapEnabled && <span className="text-green-400">• SNAP</span>}
          {gridVisible && <span className="text-blue-400">• GRID</span>}
        </div>
      </div>

      {/* Placement instructions */}
      {droppedBlock && (
        <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2">
          <div className="bg-black/80 text-white text-sm px-4 py-2 rounded-lg border border-white/20 flex flex-col items-center gap-1">
            <div className="font-semibold">Block Placement Active</div>
            <div className="text-xs text-white/70 flex gap-4">
              <span>Left Click - Place</span>
              <span>•</span>
              <span>Right Click - Cancel</span>
              <span>•</span>
              <span>ESC - Exit</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrosshairOverlay;
