import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditState } from '@/components/editor-enhanced/scene/systems';
import type { BlockType } from '@/types/project';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Box,
  Circle,
  Square,
  Snowflake,
  Activity,
  Zap,
  Snail,
  StickyNote,
  Cylinder as CylinderIcon,
  Cone as ConeIcon,
  Pyramid as PyramidIcon,
  Minus,
  TentTree,
  Donut,
  Slice,
  DoorOpen,
  PanelsTopLeft,
  Fence as FenceIcon,
  Flag,
  CheckCircle2,
  Trophy,
  Flame,
} from 'lucide-react';

type SlotItem = { type: BlockType; color?: number } | null;

const BLOCK_META: Record<BlockType, { name: string; Icon: any; bg: string }> = {
  cube: { name: 'Cube', Icon: Box, bg: 'bg-stone-500' },
  cube_bouncy: { name: 'Bouncy', Icon: Square, bg: 'bg-emerald-600' },
  cube_ice: { name: 'Ice', Icon: Snowflake, bg: 'bg-cyan-400' },
  cube_conveyor: { name: 'Conveyor', Icon: Activity, bg: 'bg-amber-600' },
  cube_boost: { name: 'Boost', Icon: Zap, bg: 'bg-purple-600' },
  cube_slow: { name: 'Slow', Icon: Snail, bg: 'bg-yellow-600' },
  cube_sticky: { name: 'Sticky', Icon: StickyNote, bg: 'bg-lime-600' },
  sphere: { name: 'Sphere', Icon: Circle, bg: 'bg-blue-500' },
  cylinder: { name: 'Cylinder', Icon: CylinderIcon, bg: 'bg-gray-500' },
  cone: { name: 'Cone', Icon: ConeIcon, bg: 'bg-orange-500' },
  pyramid: { name: 'Pyramid', Icon: PyramidIcon, bg: 'bg-red-500' },
  plate: { name: 'Plate', Icon: Minus, bg: 'bg-zinc-600' },
  ramp: { name: 'Ramp', Icon: TentTree, bg: 'bg-teal-600' },
  torus: { name: 'Torus', Icon: Donut, bg: 'bg-pink-500' },
  wedge: { name: 'Wedge', Icon: Slice, bg: 'bg-emerald-600' },
  door: { name: 'Door', Icon: DoorOpen, bg: 'bg-amber-700' },
  window: { name: 'Window', Icon: PanelsTopLeft, bg: 'bg-sky-500' },
  fence: { name: 'Fence', Icon: FenceIcon, bg: 'bg-gray-600' },
  start: { name: 'Start', Icon: Flag, bg: 'bg-green-500' },
  checkpoint: { name: 'Checkpoint', Icon: CheckCircle2, bg: 'bg-yellow-500' },
  finish: { name: 'Finish', Icon: Trophy, bg: 'bg-blue-500' },
  hazard: { name: 'Hazard', Icon: Flame, bg: 'bg-red-600' },
};

interface MinecraftHotbarProps {
  className?: string;
}

const MinecraftHotbar: React.FC<MinecraftHotbarProps> = ({ className }) => {
  const edit = useEditState();
  // Local hotbar state (9 slots)
  const [slots, setSlots] = useState<SlotItem[]>([
    { type: 'cube' },
    { type: 'sphere' },
    { type: 'cylinder' },
    { type: 'cone' },
    { type: 'pyramid' },
    { type: 'plate' },
    { type: 'ramp' },
    { type: 'torus' },
    { type: 'wedge' },
  ]);
  const [selected, setSelected] = useState<number>(0);
  
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Ensure exactly 9 slots
  const normalizedSlots = useMemo<SlotItem[]>(() => {
    const arr = Array.isArray(slots) ? slots.slice(0, 9) : [];
    while (arr.length < 9) arr.push(null);
    return arr;
  }, [slots]);

  const handleSlotClick = useCallback((index: number) => {
    setSelected(index);
    const item = normalizedSlots[index];
    if (item) {
      edit.setCurrentBlockType(item.type);
      edit.setCurrentTool('place');
    } else {
      edit.setCurrentTool('select');
    }
  }, [normalizedSlots, edit]);

  // Keyboard shortcuts (1-9 keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      const key = e.key;
      if (key >= '1' && key <= '9') {
        e.preventDefault();
        const slotIndex = parseInt(key) - 1;
        handleSlotClick(slotIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSlotClick]);

  // Mouse wheel scrolling
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Only handle wheel when cursor is over the scene area
      const target = e.target as HTMLElement;
      if (!target.closest('[data-scene-container]')) return;

      // Don't interfere with camera controls - only when holding Ctrl
      if (!e.ctrlKey) return;

      e.preventDefault();
      const direction = e.deltaY > 0 ? 1 : -1;
      const newIndex = (selected + direction + 9) % 9;
      setSelected(newIndex);
      const item = normalizedSlots[newIndex];
      if (item) {
        edit.setCurrentBlockType(item.type);
        edit.setCurrentTool('place');
      } else {
        edit.setCurrentTool('select');
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [selected, normalizedSlots, edit]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50",
        "pointer-events-none", // Allow clicks to pass through empty areas
        className
      )}
    >
      <Card className="bg-black/80 border-gray-600 shadow-2xl pointer-events-auto">
        <div className="flex items-center p-2 gap-1">
          {normalizedSlots.map((item, index) => {
            const isSelected = index === selected;
            const isEmpty = !item;
            const meta = item ? BLOCK_META[item.type] : null;
            const isActive = edit.currentTool === 'place' && item?.type === (edit.currentBlockType as BlockType);

            return (
              <div key={index} className="relative">
                <button
                  onClick={() => handleSlotClick(index)}
                  className={cn(
                    "w-14 h-14 border-2 transition-all duration-150",
                    "flex flex-col items-center justify-center",
                    "hover:scale-105 active:scale-95",
                    isSelected 
                      ? "border-white bg-white/20 shadow-lg shadow-white/50" 
                      : "border-gray-400 bg-gray-800/50 hover:border-gray-300",
                    isActive && "ring-2 ring-yellow-400 ring-opacity-75",
                    isEmpty && "bg-gray-900/50"
                  )}
                  title={meta ? `${meta.name} (${index + 1})` : `Empty Slot (${index + 1})`}
                >
                  {meta && (
                    <>
                      <div 
                        className={cn("w-6 h-6 rounded flex items-center justify-center", meta.bg)}
                      >
                        <meta.Icon className="w-4 h-4 text-white drop-shadow" />
                      </div>
                      {item && (
                        <div className="text-[8px] text-white/80 font-medium leading-none mt-0.5 truncate w-full text-center">
                          {meta.name}
                        </div>
                      )}
                    </>
                  )}
                </button>
                
                {/* Slot number indicator */}
                <div className="absolute -top-1 -left-1 w-4 h-4 bg-gray-800 border border-gray-600 rounded text-[10px] text-white font-bold flex items-center justify-center">
                  {index + 1}
                </div>
                
                {/* Active placement indicator */}
                {isActive && (
                  <div className="absolute -top-2 -right-2 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </Card>
      
      {/* Usage hints */}
      <div className="mt-2 text-center">
        <div className="bg-black/60 text-white/70 text-xs px-3 py-1 rounded-full border border-gray-600">
          <span className="hidden sm:inline">1-9 keys to select • Ctrl+Scroll to cycle • </span>
          Click to place blocks
        </div>
      </div>
    </div>
  );
};

export default MinecraftHotbar;
