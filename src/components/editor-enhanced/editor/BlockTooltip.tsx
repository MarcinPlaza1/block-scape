import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
  MousePointer,
  Keyboard,
  Gamepad2,
  Palette
} from 'lucide-react';

interface BlockData {
  type: BlockType;
  name: string;
  description: string;
  category: string;
  Icon: any;
  color: string;
  properties?: string[];
  controls?: string[];
  tips?: string[];
}

const BLOCK_DATA: Record<BlockType, BlockData> = {
  cube: {
    type: 'cube',
    name: 'Basic Cube',
    description: 'Standard building block for construction',
    category: 'Basic Blocks',
    Icon: Box,
    color: '#6b7280',
    properties: ['Solid', 'Stackable', 'Colorable'],
    controls: ['Left click to place', 'Shift+click for color'],
    tips: ['Great for foundations and walls', 'Can be painted any color']
  },
  cube_bouncy: {
    type: 'cube_bouncy',
    name: 'Bouncy Block',
    description: 'Makes objects bounce with physics',
    category: 'Mechanical',
    Icon: Square,
    color: '#10b981',
    properties: ['Bouncy Surface', 'Physics Active', 'Multiplies Velocity'],
    controls: ['Left click to place', 'Test in play mode'],
    tips: ['Perfect for trampolines', 'Great for platforming games']
  },
  cube_ice: {
    type: 'cube_ice',
    name: 'Ice Block',
    description: 'Slippery surface that reduces friction',
    category: 'Mechanical',
    Icon: Snowflake,
    color: '#06b6d4',
    properties: ['Low Friction', 'Slippery Surface', 'Cool Effect'],
    controls: ['Left click to place', 'Walk on it to slide'],
    tips: ['Ideal for sliding puzzles', 'Use sparingly for balance']
  },
  cube_conveyor: {
    type: 'cube_conveyor',
    name: 'Conveyor Belt',
    description: 'Moves objects in a direction',
    category: 'Mechanical',
    Icon: Activity,
    color: '#f59e0b',
    properties: ['Directional Movement', 'Constant Force', 'Automated Transport'],
    controls: ['Left click to place', 'R to rotate direction'],
    tips: ['Great for automated systems', 'Chain together for long paths']
  },
  cube_boost: {
    type: 'cube_boost',
    name: 'Boost Pad',
    description: 'Accelerates objects forward',
    category: 'Mechanical',
    Icon: Zap,
    color: '#8b5cf6',
    properties: ['Speed Boost', 'Directional Force', 'Instant Acceleration'],
    controls: ['Left click to place', 'R to change direction'],
    tips: ['Perfect for racing tracks', 'Combine with ramps for jumps']
  },
  cube_slow: {
    type: 'cube_slow',
    name: 'Slow Block',
    description: 'Reduces object speed',
    category: 'Mechanical',
    Icon: Snail,
    color: '#eab308',
    properties: ['Speed Reduction', 'Drag Effect', 'Gradual Slowdown'],
    controls: ['Left click to place', 'Step on to slow down'],
    tips: ['Use before sharp turns', 'Good for puzzle timing']
  },
  cube_sticky: {
    type: 'cube_sticky',
    name: 'Sticky Block',
    description: 'Objects stick to this surface',
    category: 'Mechanical',
    Icon: StickyNote,
    color: '#84cc16',
    properties: ['High Adhesion', 'Stops Movement', 'Temporary Hold'],
    controls: ['Left click to place', 'Jump to break free'],
    tips: ['Great for wall climbing', 'Use for temporary stops']
  },
  sphere: {
    type: 'sphere',
    name: 'Sphere',
    description: 'Round building block',
    category: 'Basic Blocks',
    Icon: Circle,
    color: '#8b5cf6',
    properties: ['Round Shape', 'Rolls Naturally', 'Smooth Collisions'],
    controls: ['Left click to place', 'Naturally round physics'],
    tips: ['Perfect for decorative elements', 'Rolls down slopes naturally']
  },
  cylinder: {
    type: 'cylinder',
    name: 'Cylinder',
    description: 'Cylindrical building block',
    category: 'Basic Blocks',
    Icon: CylinderIcon,
    color: '#64748b',
    properties: ['Cylindrical Shape', 'Stable Base', 'Vertical Emphasis'],
    controls: ['Left click to place', 'R to rotate orientation'],
    tips: ['Great for pillars and supports', 'Can be used as wheels']
  },
  cone: {
    type: 'cone',
    name: 'Cone',
    description: 'Conical building block',
    category: 'Basic Blocks',
    Icon: ConeIcon,
    color: '#f97316',
    properties: ['Pointed Top', 'Stable Base', 'Tapered Shape'],
    controls: ['Left click to place', 'R to rotate'],
    tips: ['Perfect for roofs and spires', 'Use as traffic cones']
  },
  pyramid: {
    type: 'pyramid',
    name: 'Pyramid',
    description: 'Four-sided pyramid',
    category: 'Basic Blocks',
    Icon: PyramidIcon,
    color: '#ef4444',
    properties: ['Triangular Faces', 'Pointed Peak', 'Ancient Style'],
    controls: ['Left click to place', 'R to rotate base'],
    tips: ['Iconic architectural element', 'Great for monuments']
  },
  plate: {
    type: 'plate',
    name: 'Plate',
    description: 'Thin flat building block',
    category: 'Basic Blocks',
    Icon: Minus,
    color: '#52525b',
    properties: ['Flat Surface', 'Thin Profile', 'Platform Base'],
    controls: ['Left click to place', 'Stack for thicker platforms'],
    tips: ['Ideal for floors and platforms', 'Use multiple for custom thickness']
  },
  ramp: {
    type: 'ramp',
    name: 'Ramp',
    description: 'Sloped surface for elevation',
    category: 'Basic Blocks',
    Icon: TentTree,
    color: '#0d9488',
    properties: ['Sloped Surface', '45° Angle', 'Smooth Transition'],
    controls: ['Left click to place', 'R to change direction'],
    tips: ['Essential for accessibility', 'Chain together for long slopes']
  },
  wedge: {
    type: 'wedge',
    name: 'Wedge',
    description: 'Triangular prism block',
    category: 'Basic Blocks',
    Icon: Slice,
    color: '#059669',
    properties: ['Triangular Profile', 'Sharp Edge', 'Angled Surface'],
    controls: ['Left click to place', 'R to rotate orientation'],
    tips: ['Great for corners and edges', 'Use for custom angles']
  },
  torus: {
    type: 'torus',
    name: 'Torus',
    description: 'Donut-shaped ring block',
    category: 'Basic Blocks',
    Icon: Donut,
    color: '#ec4899',
    properties: ['Ring Shape', 'Hollow Center', 'Curved Surface'],
    controls: ['Left click to place', 'Objects can pass through'],
    tips: ['Decorative architectural element', 'Can be used as portals']
  },
  door: {
    type: 'door',
    name: 'Door',
    description: 'Decorative door block',
    category: 'Decorative',
    Icon: DoorOpen,
    color: '#92400e',
    properties: ['Decorative', 'Building Element', 'Architectural Detail'],
    controls: ['Left click to place', 'Purely decorative'],
    tips: ['Adds realism to buildings', 'Use with walls and windows']
  },
  window: {
    type: 'window',
    name: 'Window',
    description: 'Decorative window block',
    category: 'Decorative',
    Icon: PanelsTopLeft,
    color: '#0ea5e9',
    properties: ['Transparent Effect', 'Building Element', 'Light Feature'],
    controls: ['Left click to place', 'Semi-transparent'],
    tips: ['Brings life to walls', 'Combine with door blocks']
  },
  fence: {
    type: 'fence',
    name: 'Fence',
    description: 'Decorative barrier block',
    category: 'Decorative',
    Icon: FenceIcon,
    color: '#6b7280',
    properties: ['Barrier Element', 'Decorative Border', 'Partial Height'],
    controls: ['Left click to place', 'Chain together'],
    tips: ['Perfect for boundaries', 'Use to define areas']
  },
  start: {
    type: 'start',
    name: 'Start Point',
    description: 'Player spawn location',
    category: 'Gameplay',
    Icon: Flag,
    color: '#22c55e',
    properties: ['Spawn Point', 'Game Logic', 'Player Start'],
    controls: ['Left click to place', 'Only one per level'],
    tips: ['Where players begin', 'Essential for playable levels']
  },
  checkpoint: {
    type: 'checkpoint',
    name: 'Checkpoint',
    description: 'Progress save point',
    category: 'Gameplay',
    Icon: CheckCircle2,
    color: '#eab308',
    properties: ['Save Progress', 'Respawn Point', 'Game Logic'],
    controls: ['Left click to place', 'Touch to activate'],
    tips: ['Saves player progress', 'Use between difficult sections']
  },
  finish: {
    type: 'finish',
    name: 'Finish Line',
    description: 'Level completion goal',
    category: 'Gameplay',
    Icon: Trophy,
    color: '#3b82f6',
    properties: ['Win Condition', 'Game Logic', 'Level Complete'],
    controls: ['Left click to place', 'Touch to win'],
    tips: ['Completing the objective', 'End point of your level']
  },
  hazard: {
    type: 'hazard',
    name: 'Hazard',
    description: 'Dangerous obstacle block',
    category: 'Gameplay',
    Icon: Flame,
    color: '#dc2626',
    properties: ['Danger Zone', 'Game Over', 'Challenge Element'],
    controls: ['Left click to place', 'Avoid touching'],
    tips: ['Creates challenge', 'Use sparingly for fun gameplay']
  },
};

interface BlockTooltipProps {
  blockType?: BlockType;
  position: { x: number; y: number };
  visible: boolean;
  className?: string;
}

const BlockTooltip: React.FC<BlockTooltipProps> = ({
  blockType,
  position,
  visible,
  className
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Adjust position to keep tooltip in viewport
  useEffect(() => {
    if (!visible || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let newX = position.x;
    let newY = position.y;

    // Adjust horizontal position
    if (newX + rect.width > viewport.width - 20) {
      newX = viewport.width - rect.width - 20;
    }
    if (newX < 20) newX = 20;

    // Adjust vertical position  
    if (newY + rect.height > viewport.height - 20) {
      newY = position.y - rect.height - 20;
    }
    if (newY < 20) newY = 20;

    setAdjustedPosition({ x: newX, y: newY });
  }, [visible, position, blockType]);

  if (!visible || !blockType) return null;

  const blockData = BLOCK_DATA[blockType];
  if (!blockData) return null;

  return (
    <div
      ref={tooltipRef}
      className={cn(
        "fixed z-[100] pointer-events-none",
        "transform transition-all duration-200",
        visible ? "opacity-100 scale-100" : "opacity-0 scale-95",
        className
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        transformOrigin: 'top left'
      }}
    >
      <Card className="bg-black/95 border-gray-600 shadow-2xl backdrop-blur-sm max-w-80">
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: blockData.color }}
            >
              <blockData.Icon className="w-6 h-6 text-white drop-shadow" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-white text-sm">{blockData.name}</h3>
              <p className="text-gray-300 text-xs">{blockData.description}</p>
              <Badge variant="outline" className="text-[10px] mt-1 border-gray-500 text-gray-400">
                {blockData.category}
              </Badge>
            </div>
          </div>

          {/* Properties */}
          {blockData.properties && blockData.properties.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-3 h-3 text-gray-400" />
                <span className="text-xs font-medium text-gray-300">Properties</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {blockData.properties.map((prop, index) => (
                  <Badge key={index} variant="secondary" className="text-[10px] bg-gray-800 text-gray-300">
                    {prop}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          {blockData.controls && blockData.controls.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Keyboard className="w-3 h-3 text-gray-400" />
                <span className="text-xs font-medium text-gray-300">Controls</span>
              </div>
              <div className="space-y-0.5">
                {blockData.controls.map((control, index) => (
                  <div key={index} className="text-xs text-gray-400 flex items-center gap-2">
                    <MousePointer className="w-2.5 h-2.5" />
                    {control}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          {blockData.tips && blockData.tips.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-gray-700">
              <div className="flex items-center gap-2">
                <Palette className="w-3 h-3 text-yellow-400" />
                <span className="text-xs font-medium text-yellow-300">Tips</span>
              </div>
              <div className="space-y-0.5">
                {blockData.tips.map((tip, index) => (
                  <div key={index} className="text-xs text-gray-300">
                    • {tip}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default BlockTooltip;
