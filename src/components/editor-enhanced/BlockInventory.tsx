import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useProjectStore } from '@/lib/projectStore';
import type { BlockType } from '@/types/project';
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
  Plus
} from 'lucide-react';

type SlotItem = { type: BlockType; color?: number } | null;

const BLOCK_META: Record<BlockType, { name: string; Icon: any; bg: string }> = {
  cube: { name: 'Cube', Icon: Box, bg: 'bg-blue-500' },
  cube_bouncy: { name: 'Bouncy', Icon: Square, bg: 'bg-green-600' },
  cube_ice: { name: 'Ice', Icon: Snowflake, bg: 'bg-cyan-500' },
  cube_conveyor: { name: 'Conveyor', Icon: Activity, bg: 'bg-amber-500' },
  cube_boost: { name: 'Boost', Icon: Zap, bg: 'bg-violet-600' },
  cube_slow: { name: 'Slow', Icon: Snail, bg: 'bg-yellow-500' },
  cube_sticky: { name: 'Sticky', Icon: StickyNote, bg: 'bg-lime-600' },
  sphere: { name: 'Sphere', Icon: Circle, bg: 'bg-purple-500' },
  cylinder: { name: 'Cylinder', Icon: CylinderIcon, bg: 'bg-slate-500' },
  cone: { name: 'Cone', Icon: ConeIcon, bg: 'bg-rose-500' },
  pyramid: { name: 'Pyramid', Icon: PyramidIcon, bg: 'bg-orange-500' },
  plate: { name: 'Plate', Icon: Minus, bg: 'bg-zinc-600' },
  ramp: { name: 'Ramp', Icon: TentTree, bg: 'bg-teal-600' },
  torus: { name: 'Torus', Icon: Donut, bg: 'bg-pink-500' },
  wedge: { name: 'Wedge', Icon: Slice, bg: 'bg-emerald-600' },
  door: { name: 'Door', Icon: DoorOpen, bg: 'bg-amber-700' },
  window: { name: 'Window', Icon: PanelsTopLeft, bg: 'bg-sky-500' },
  fence: { name: 'Fence', Icon: FenceIcon, bg: 'bg-gray-500' },
  start: { name: 'Start', Icon: Flag, bg: 'bg-emerald-500' },
  checkpoint: { name: 'Checkpoint', Icon: CheckCircle2, bg: 'bg-yellow-500' },
  finish: { name: 'Finish', Icon: Trophy, bg: 'bg-sky-500' },
  hazard: { name: 'Hazard', Icon: Flame, bg: 'bg-red-600' },
};

function isEditableElement(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  const editable = (el as any).isContentEditable;
  return editable || tag === 'input' || tag === 'textarea' || tag === 'select';
}

const BlockInventory: React.FC<{ className?: string }> = ({ className }) => {
  const {
    inventorySlots: slots,
    selectedInventorySlot: selected,
    setInventorySlot: setSlot,
    selectInventorySlot: selectSlot,
    cycleInventorySlot: cycleSlot,
    lastUsedColorByType: lastColors,
    setLastUsedColorForType: setLastColor,
    droppedBlock: dropped,
    setDroppedBlock: setDropped,
  } = useProjectStore();

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Ensure exactly 9 slots
  const normalizedSlots = useMemo<SlotItem[]>(() => {
    const arr = Array.isArray(slots) ? slots.slice(0, 9) : [];
    while (arr.length < 9) arr.push(null);
    return arr;
  }, [slots]);

  const handlePick = useCallback((index: number, ev?: React.MouseEvent) => {
    const item = normalizedSlots[index];
    // Quick color assign: Shift-click opens color input via prompt; Alt-click copies builder last color
    if (ev) {
      if (item && (ev as any).shiftKey) {
        const hex = window.prompt('Wprowadź kolor HEX (np. #4f46e5):', `#${(item.color ?? lastColors?.[item.type] ?? 0x6b7280).toString(16).padStart(6, '0')}`);
        if (hex && /^#?[0-9a-fA-F]{6}$/.test(hex.trim())) {
          const v = parseInt(hex.replace('#',''), 16);
          setSlot(index, { type: item.type, color: v });
          setLastColor(item.type, v);
          // do not toggle placement here; user likely just edited color
          return;
        }
      }
      if (item && (ev as any).altKey) {
        const color = lastColors?.[item.type];
        if (typeof color === 'number') setSlot(index, { type: item.type, color });
        return;
      }
    }
    selectSlot(index);
    if (item) {
      if (dropped?.type === item.type) {
        setDropped(null);
      } else {
        setDropped({ type: item.type });
      }
    } else {
      setDropped(null);
    }
  }, [normalizedSlots, selectSlot, setDropped, dropped, lastColors, setSlot, setLastColor]);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (isEditableElement(e.target)) return;
    // Digit 1..9 or Numpad1..9
    const key = e.key;
    // Quick color set from numeric ctrl+digit (apply to selected slot)
    if ((e.ctrlKey || e.metaKey) && /^\d$/.test(key)) {
      const num = parseInt(key, 10);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        const idx = selected;
        const item = normalizedSlots[idx];
        if (item) {
          // Simple palette: numbers map to 9 preset colors
          const palette = [
            0x6b7280, // gray
            0x4f46e5, // indigo
            0x10b981, // emerald
            0xf59e0b, // amber
            0xef4444, // red
            0x06b6d4, // cyan
            0x8b5cf6, // violet
            0x22c55e, // green
            0xf97316, // orange
          ];
          const color = palette[num - 1];
          setSlot(idx, { type: item.type, color });
          setLastColor(item.type, color);
        }
        return;
      }
    }
    if (/^\d$/.test(key)) {
      const num = parseInt(key, 10);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        handlePick(num - 1);
        return;
      }
    }
    if (key === '[') {
      e.preventDefault();
      cycleSlot(-1);
      const next = (selected - 1 + 9) % 9;
      const item = normalizedSlots[next];
      if (item) setDropped({ type: item.type });
      return;
    }
    if (key === ']') {
      e.preventDefault();
      cycleSlot(1);
      const next = (selected + 1) % 9;
      const item = normalizedSlots[next];
      if (item) setDropped({ type: item.type });
      return;
    }
  }, [cycleSlot, handlePick, normalizedSlots, selected, setDropped]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    // Only when cursor over the inventory bar
    if (!containerRef.current) return;
    if (!(containerRef.current as any).contains(e.target as Node)) return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1 as 1 | -1;
    cycleSlot(dir);
    const next = (selected + (dir === 1 ? 1 : -1) + 9) % 9;
    const item = normalizedSlots[next];
    if (item) setDropped({ type: item.type });
  }, [cycleSlot, normalizedSlots, selected, setDropped]);

  const handleDropOnSlot = useCallback((index: number, ev: React.DragEvent) => {
    ev.preventDefault();
    const data = ev.dataTransfer.getData('text/plain');
    const type = (data || '').trim() as BlockType;
    if (!type || !BLOCK_META[type as BlockType]) return;
    setSlot(index, { type });
  }, [setSlot]);

  return (
    <div
      ref={containerRef}
      className={
        `pointer-events-auto select-none rounded-2xl border border-border bg-card/90 backdrop-blur shadow-xl px-2 py-2 ${className || ''}`
      }
      onWheel={onWheel}
    >
      <div className="flex items-stretch gap-1">
        {normalizedSlots.map((item, i) => {
          const isSelected = i === selected;
          const isActive = !!item && dropped?.type === item.type;
          const meta = item ? BLOCK_META[item.type] : null;
          return (
            <button
              key={i}
              className={
                `relative h-14 w-14 rounded-xl border transition ${
                  isSelected ? 'border-primary ring-2 ring-primary/40' : 'border-border'
                } ${isActive ? 'bg-primary/10' : 'bg-background/60'} hover:bg-background`
              }
              title={item ? `${meta?.name} • ${i + 1}` : `Empty • ${i + 1}`}
              onClick={(e) => handlePick(i, e)}
              onContextMenu={(e) => { e.preventDefault(); setSlot(i, null); if (isActive) setDropped(null); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDropOnSlot(i, e)}
            >
              {item ? (
                <div className="flex h-full w-full items-center justify-center">
                  <div className={`p-2 rounded-md text-white ${meta?.bg || 'bg-muted'}`}>
                    {meta?.Icon ? <meta.Icon className="h-5 w-5" /> : null}
                  </div>
                  {typeof item.color === 'number' && (
                    <span
                      className="absolute right-1 bottom-1 h-3 w-3 rounded-full border border-white/70"
                      style={{ backgroundColor: `#${item.color.toString(16).padStart(6, '0')}` }}
                    />
                  )}
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Plus className="h-5 w-5" />
                </div>
              )}
              <span className="absolute left-1 top-1 text-[10px] font-semibold text-muted-foreground">
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>
      {/* HUD: Selected item info */}
      <div className="mt-2 flex items-center justify-center gap-2">
        {(() => {
          const item = normalizedSlots[selected];
          if (!item) return null;
          const meta = BLOCK_META[item.type];
          return (
            <div className="inline-flex items-center gap-2 rounded-md border border-border bg-background/70 px-2 py-1">
              <div className={`p-1 rounded text-white ${meta?.bg || 'bg-muted'}`}>
                {meta?.Icon ? <meta.Icon className="h-3.5 w-3.5" /> : null}
              </div>
              <span className="text-xs text-foreground font-medium">{meta?.name}</span>
              {typeof item.color === 'number' && (
                <span
                  className="h-3 w-3 rounded-full border border-white/70"
                  title={`#${item.color.toString(16).padStart(6,'0')}`}
                  style={{ backgroundColor: `#${item.color.toString(16).padStart(6,'0')}` }}
                />
              )}
            </div>
          );
        })()}
      </div>
      <div className="mt-1 flex items-center justify-between px-1">
        <span className="text-[10px] text-muted-foreground">1–9 wybór slotu • [ / ] przewijanie • Ctrl+1..9 szybki kolor</span>
        <span className="text-[10px] text-muted-foreground">PPM wyczyść • Shift-klik ustaw kolor • Alt-klik użyj ostatniego koloru</span>
      </div>
    </div>
  );
};

export default BlockInventory;


