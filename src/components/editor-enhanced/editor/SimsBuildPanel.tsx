import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useEditState } from '@/components/editor-enhanced/scene/systems';
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
  Home,
  Gamepad2,
  Shapes,
  Wrench,
  X,
  Search,
  Filter,
  Grid3X3
} from 'lucide-react';

type BlockCategory = 'basic' | 'mechanics' | 'gameplay' | 'decorative';

interface BlockData {
  type: BlockType;
  name: string;
  description: string;
  category: BlockCategory;
  Icon: any;
  color: string;
  tags: string[];
}

const BLOCK_CATALOG: BlockData[] = [
  // Basic Blocks
  { type: 'cube', name: 'Cube', description: 'Basic building block', category: 'basic', Icon: Box, color: '#6b7280', tags: ['solid', 'basic'] },
  { type: 'sphere', name: 'Sphere', description: 'Round building block', category: 'basic', Icon: Circle, color: '#8b5cf6', tags: ['round', 'basic'] },
  { type: 'cylinder', name: 'Cylinder', description: 'Cylindrical block', category: 'basic', Icon: CylinderIcon, color: '#64748b', tags: ['round', 'basic'] },
  { type: 'cone', name: 'Cone', description: 'Conical block', category: 'basic', Icon: ConeIcon, color: '#f97316', tags: ['pointed', 'basic'] },
  { type: 'pyramid', name: 'Pyramid', description: 'Triangular pyramid', category: 'basic', Icon: PyramidIcon, color: '#ef4444', tags: ['pointed', 'basic'] },
  { type: 'plate', name: 'Plate', description: 'Flat thin block', category: 'basic', Icon: Minus, color: '#52525b', tags: ['flat', 'thin'] },
  { type: 'ramp', name: 'Ramp', description: 'Sloped block', category: 'basic', Icon: TentTree, color: '#0d9488', tags: ['slope', 'movement'] },
  { type: 'wedge', name: 'Wedge', description: 'Triangular wedge', category: 'basic', Icon: Slice, color: '#059669', tags: ['slope', 'basic'] },
  { type: 'torus', name: 'Torus', description: 'Donut-shaped block', category: 'basic', Icon: Donut, color: '#ec4899', tags: ['round', 'hollow'] },

  // Mechanical Blocks
  { type: 'cube_bouncy', name: 'Bouncy Block', description: 'Makes objects bounce', category: 'mechanics', Icon: Square, color: '#10b981', tags: ['bounce', 'physics'] },
  { type: 'cube_ice', name: 'Ice Block', description: 'Slippery surface', category: 'mechanics', Icon: Snowflake, color: '#06b6d4', tags: ['slip', 'physics'] },
  { type: 'cube_conveyor', name: 'Conveyor', description: 'Moves objects along', category: 'mechanics', Icon: Activity, color: '#f59e0b', tags: ['move', 'transport'] },
  { type: 'cube_boost', name: 'Boost Pad', description: 'Accelerates objects', category: 'mechanics', Icon: Zap, color: '#8b5cf6', tags: ['speed', 'boost'] },
  { type: 'cube_slow', name: 'Slow Block', description: 'Slows down objects', category: 'mechanics', Icon: Snail, color: '#eab308', tags: ['slow', 'physics'] },
  { type: 'cube_sticky', name: 'Sticky Block', description: 'Objects stick to it', category: 'mechanics', Icon: StickyNote, color: '#84cc16', tags: ['sticky', 'physics'] },

  // Gameplay Elements
  { type: 'start', name: 'Start Point', description: 'Player spawn location', category: 'gameplay', Icon: Flag, color: '#22c55e', tags: ['spawn', 'start'] },
  { type: 'checkpoint', name: 'Checkpoint', description: 'Save progress point', category: 'gameplay', Icon: CheckCircle2, color: '#eab308', tags: ['checkpoint', 'save'] },
  { type: 'finish', name: 'Finish Line', description: 'Level completion goal', category: 'gameplay', Icon: Trophy, color: '#3b82f6', tags: ['finish', 'goal'] },
  { type: 'hazard', name: 'Hazard', description: 'Dangerous obstacle', category: 'gameplay', Icon: Flame, color: '#dc2626', tags: ['danger', 'hazard'] },

  // Decorative Elements
  { type: 'door', name: 'Door', description: 'Decorative door block', category: 'decorative', Icon: DoorOpen, color: '#92400e', tags: ['decoration', 'building'] },
  { type: 'window', name: 'Window', description: 'Decorative window block', category: 'decorative', Icon: PanelsTopLeft, color: '#0ea5e9', tags: ['decoration', 'building'] },
  { type: 'fence', name: 'Fence', description: 'Decorative fence block', category: 'decorative', Icon: FenceIcon, color: '#6b7280', tags: ['decoration', 'barrier'] },
];

const CATEGORY_META = {
  basic: { name: 'Basic Blocks', Icon: Shapes, color: 'text-blue-500' },
  mechanics: { name: 'Mechanics', Icon: Wrench, color: 'text-orange-500' },
  gameplay: { name: 'Gameplay', Icon: Gamepad2, color: 'text-green-500' },
  decorative: { name: 'Decorative', Icon: Home, color: 'text-purple-500' },
};

interface SimsBuildPanelProps {
  isVisible: boolean;
  onClose: () => void;
  className?: string;
}

const SimsBuildPanel: React.FC<SimsBuildPanelProps> = ({ 
  isVisible, 
  onClose, 
  className 
}) => {
  const [selectedCategory, setSelectedCategory] = useState<BlockCategory>('basic');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const edit = useEditState();
  const [hotbarSlots, setHotbarSlots] = useState<Array<{ type: BlockType } | null>>([null, null, null, null, null, null, null, null, null]);

  // Filter blocks based on search and tags
  const filteredBlocks = BLOCK_CATALOG.filter(block => {
    const matchesSearch = !searchQuery || 
      block.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      block.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      block.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTags = selectedTags.length === 0 || 
      selectedTags.some(tag => block.tags.includes(tag));
    
    return block.category === selectedCategory && matchesSearch && matchesTags;
  });

  // Get all unique tags for current category
  const availableTags = Array.from(
    new Set(
      BLOCK_CATALOG
        .filter(block => block.category === selectedCategory)
        .flatMap(block => block.tags)
    )
  ).sort();

  const handleBlockClick = useCallback((block: BlockData) => {
    // Set current placement tool and block type
    edit.setCurrentBlockType(block.type);
    edit.setCurrentTool('place');
    
    // Optional: maintain a local hotbar mirror for UX
    setHotbarSlots(prev => {
      const next = [...prev];
      let target = next.findIndex(s => !s);
      if (target === -1) target = 0;
      next[target] = { type: block.type };
      return next;
    });
    
    onClose();
  }, [edit, onClose]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  }, []);

  if (!isVisible) return null;

  return (
    <div className={cn(
      "fixed inset-y-0 right-0 z-50 w-96",
      "bg-background/95 backdrop-blur-sm border-l border-border shadow-2xl",
      "transform transition-transform duration-300",
      isVisible ? "translate-x-0" : "translate-x-full",
      className
    )}>
      <Card className="h-full rounded-none border-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Build Mode</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search blocks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          {/* Tag filters */}
          {availableTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {availableTags.map(tag => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleTag(tag)}
                >
                  <Filter className="w-3 h-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Categories */}
        <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as BlockCategory)}>
          <TabsList className="grid w-full grid-cols-2 grid-rows-2 mx-4 mt-4">
            {(Object.entries(CATEGORY_META) as [BlockCategory, typeof CATEGORY_META.basic][]).map(([key, meta]) => (
              <TabsTrigger key={key} value={key} className="flex items-center gap-1 text-xs">
                <meta.Icon className={cn("w-3 h-3", meta.color)} />
                <span className="hidden sm:inline">{meta.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Block Grid */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full px-4 pb-4">
              <div className="grid grid-cols-2 gap-3 mt-4">
                {filteredBlocks.map((block) => (
                  <Card
                    key={block.type}
                    className="p-3 cursor-pointer hover:shadow-md hover:scale-105 transition-all duration-200 border-2 hover:border-primary/50"
                    onClick={() => handleBlockClick(block)}
                  >
                    <div className="flex flex-col items-center text-center gap-2">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: block.color }}
                      >
                        <block.Icon className="w-6 h-6 text-white drop-shadow" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{block.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{block.description}</div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {block.tags.slice(0, 2).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-[10px] px-1 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              
              {filteredBlocks.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Search className="w-8 h-8 mb-2" />
                  <p className="text-sm">No blocks found</p>
                  <p className="text-xs">Try adjusting your search or filters</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </Tabs>
      </Card>
    </div>
  );
};

export default SimsBuildPanel;
