import { Block } from '../types';
import { 
  Box as Cube, 
  Circle, 
  Cylinder, 
  Triangle, 
  Square, 
  Hexagon,
  Home,
  TreePine,
  Zap,
  Droplet,
  Wind,
  Flame,
  Shield,
  Target,
  Flag,
  AlertTriangle,
  DoorOpen,
  Grid3x3,
  Layers,
  Sparkles,
  Mountain,
  type LucideIcon
} from 'lucide-react';

export type BlockCategory = 
  | 'basic' 
  | 'shapes' 
  | 'nature' 
  | 'mechanical' 
  | 'interactive' 
  | 'decorative' 
  | 'special'
  | 'recent'
  | 'favorites';

export interface CategoryInfo {
  id: BlockCategory;
  name: string;
  icon: LucideIcon;
  color: string;
  description: string;
  blocks: Block['type'][];
}

export const blockCategories: CategoryInfo[] = [
  {
    id: 'basic',
    name: 'Basic Blocks',
    icon: Cube,
    color: '#6b7280',
    description: 'Essential building blocks',
    blocks: ['cube', 'plate', 'wedge', 'ramp']
  },
  {
    id: 'shapes',
    name: 'Shapes',
    icon: Circle,
    color: '#3b82f6',
    description: 'Geometric shapes for creative builds',
    blocks: ['sphere', 'cylinder', 'cone', 'pyramid', 'torus']
  },
  {
    id: 'mechanical',
    name: 'Mechanical',
    icon: Zap,
    color: '#8b5cf6',
    description: 'Blocks with special physics properties',
    blocks: ['cube_bouncy', 'cube_ice', 'cube_conveyor', 'cube_boost', 'cube_slow', 'cube_sticky']
  },
  {
    id: 'interactive',
    name: 'Interactive',
    icon: Target,
    color: '#10b981',
    description: 'Game mechanics and checkpoints',
    blocks: ['start', 'checkpoint', 'finish', 'hazard']
  },
  {
    id: 'decorative',
    name: 'Decorative',
    icon: Home,
    color: '#f59e0b',
    description: 'Decoration and detail blocks',
    blocks: ['door', 'window', 'fence']
  },
  {
    id: 'nature',
    name: 'Nature',
    icon: TreePine,
    color: '#059669',
    description: 'Natural and organic blocks',
    blocks: [] // To be expanded with grass, stone, wood etc.
  },
  {
    id: 'special',
    name: 'Special',
    icon: Sparkles,
    color: '#ec4899',
    description: 'Unique and advanced blocks',
    blocks: [] // For future special blocks
  }
];

// Quick access categories (dynamic)
export const dynamicCategories: Omit<CategoryInfo, 'blocks'>[] = [
  {
    id: 'recent',
    name: 'Recent',
    icon: Layers,
    color: '#64748b',
    description: 'Recently used blocks'
  },
  {
    id: 'favorites',
    name: 'Favorites',
    icon: Shield,
    color: '#dc2626',
    description: 'Your favorite blocks'
  }
];

// Block metadata for enhanced features
export interface BlockMetadata {
  type: Block['type'];
  name: string;
  category: BlockCategory;
  tags: string[];
  icon?: LucideIcon;
  previewColor: string;
  description: string;
  // Minecraft-style attributes
  stackSize?: number;
  placementSound?: 'stone' | 'wood' | 'glass' | 'metal' | 'soft';
  breakTime?: number;
  // Sims-style attributes
  price?: number;
  unlockLevel?: number;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  // Kogama-style attributes
  canRotate?: boolean;
  canScale?: boolean;
  canPaint?: boolean;
  physicsEnabled?: boolean;
}

export const blockMetadata: Record<Block['type'], BlockMetadata> = {
  'cube': {
    type: 'cube',
    name: 'Basic Cube',
    category: 'basic',
    tags: ['basic', 'building', 'solid'],
    icon: Cube,
    previewColor: '#6b7280',
    description: 'The fundamental building block',
    stackSize: 64,
    placementSound: 'stone',
    breakTime: 1.5,
    price: 10,
    rarity: 'common',
    canRotate: true,
    canScale: true,
    canPaint: true,
    physicsEnabled: true
  },
  'sphere': {
    type: 'sphere',
    name: 'Sphere',
    category: 'shapes',
    tags: ['shape', 'round', 'ball'],
    icon: Circle,
    previewColor: '#3b82f6',
    description: 'Perfect round sphere',
    stackSize: 64,
    placementSound: 'stone',
    breakTime: 1.8,
    price: 15,
    rarity: 'common',
    canRotate: false,
    canScale: true,
    canPaint: true,
    physicsEnabled: true
  },
  'cylinder': {
    type: 'cylinder',
    name: 'Cylinder',
    category: 'shapes',
    tags: ['shape', 'round', 'pillar'],
    icon: Cylinder,
    previewColor: '#3b82f6',
    description: 'Cylindrical pillar shape',
    stackSize: 64,
    placementSound: 'stone',
    breakTime: 1.8,
    price: 15,
    rarity: 'common',
    canRotate: true,
    canScale: true,
    canPaint: true,
    physicsEnabled: true
  },
  'cone': {
    type: 'cone',
    name: 'Cone',
    category: 'shapes',
    tags: ['shape', 'pointed', 'pyramid'],
    icon: Triangle,
    previewColor: '#3b82f6',
    description: 'Pointed cone shape',
    stackSize: 64,
    placementSound: 'stone',
    breakTime: 1.5,
    price: 15,
    rarity: 'common',
    canRotate: true,
    canScale: true,
    canPaint: true,
    physicsEnabled: true
  },
  'pyramid': {
    type: 'pyramid',
    name: 'Pyramid',
    category: 'shapes',
    tags: ['shape', 'egyptian', 'triangle'],
    icon: Mountain,
    previewColor: '#3b82f6',
    description: 'Four-sided pyramid',
    stackSize: 64,
    placementSound: 'stone',
    breakTime: 2.0,
    price: 20,
    rarity: 'uncommon',
    canRotate: true,
    canScale: true,
    canPaint: true,
    physicsEnabled: true
  },
  'plate': {
    type: 'plate',
    name: 'Plate',
    category: 'basic',
    tags: ['thin', 'floor', 'platform'],
    icon: Square,
    previewColor: '#6b7280',
    description: 'Thin platform block',
    stackSize: 64,
    placementSound: 'stone',
    breakTime: 1.0,
    price: 8,
    rarity: 'common',
    canRotate: true,
    canScale: true,
    canPaint: true,
    physicsEnabled: true
  },
  'ramp': {
    type: 'ramp',
    name: 'Ramp',
    category: 'basic',
    tags: ['slope', 'incline', 'stairs'],
    previewColor: '#6b7280',
    description: 'Sloped ramp for elevation',
    stackSize: 64,
    placementSound: 'stone',
    breakTime: 1.5,
    price: 15,
    rarity: 'common',
    canRotate: true,
    canScale: true,
    canPaint: true,
    physicsEnabled: true
  },
  'torus': {
    type: 'torus',
    name: 'Torus',
    category: 'shapes',
    tags: ['shape', 'donut', 'ring'],
    previewColor: '#3b82f6',
    description: 'Donut-shaped ring',
    stackSize: 64,
    placementSound: 'stone',
    breakTime: 2.0,
    price: 25,
    rarity: 'uncommon',
    canRotate: true,
    canScale: true,
    canPaint: true,
    physicsEnabled: true
  },
  'wedge': {
    type: 'wedge',
    name: 'Wedge',
    category: 'basic',
    tags: ['triangle', 'slope', 'corner'],
    previewColor: '#6b7280',
    description: 'Triangular wedge block',
    stackSize: 64,
    placementSound: 'stone',
    breakTime: 1.3,
    price: 12,
    rarity: 'common',
    canRotate: true,
    canScale: true,
    canPaint: true,
    physicsEnabled: true
  },
  'door': {
    type: 'door',
    name: 'Door',
    category: 'decorative',
    tags: ['entrance', 'building', 'interactive'],
    icon: DoorOpen,
    previewColor: '#92400e',
    description: 'Wooden door for buildings',
    stackSize: 16,
    placementSound: 'wood',
    breakTime: 2.0,
    price: 30,
    rarity: 'common',
    canRotate: true,
    canScale: false,
    canPaint: true,
    physicsEnabled: true
  },
  'window': {
    type: 'window',
    name: 'Window',
    category: 'decorative',
    tags: ['glass', 'building', 'transparent'],
    previewColor: '#60a5fa',
    description: 'Transparent glass window',
    stackSize: 16,
    placementSound: 'glass',
    breakTime: 0.5,
    price: 25,
    rarity: 'common',
    canRotate: true,
    canScale: true,
    canPaint: false,
    physicsEnabled: true
  },
  'fence': {
    type: 'fence',
    name: 'Fence',
    category: 'decorative',
    tags: ['barrier', 'decoration', 'boundary'],
    icon: Grid3x3,
    previewColor: '#9ca3af',
    description: 'Metal fence section',
    stackSize: 32,
    placementSound: 'metal',
    breakTime: 1.5,
    price: 20,
    rarity: 'common',
    canRotate: true,
    canScale: true,
    canPaint: true,
    physicsEnabled: true
  },
  'cube_bouncy': {
    type: 'cube_bouncy',
    name: 'Bouncy Cube',
    category: 'mechanical',
    tags: ['physics', 'bounce', 'spring'],
    previewColor: '#22c55e',
    description: 'Bounces objects that touch it',
    stackSize: 32,
    placementSound: 'soft',
    breakTime: 1.0,
    price: 50,
    rarity: 'uncommon',
    canRotate: true,
    canScale: true,
    canPaint: false,
    physicsEnabled: true
  },
  'cube_ice': {
    type: 'cube_ice',
    name: 'Ice Cube',
    category: 'mechanical',
    tags: ['physics', 'slippery', 'frozen'],
    icon: Droplet,
    previewColor: '#7dd3fc',
    description: 'Slippery ice surface',
    stackSize: 32,
    placementSound: 'glass',
    breakTime: 0.8,
    price: 40,
    rarity: 'uncommon',
    canRotate: true,
    canScale: true,
    canPaint: false,
    physicsEnabled: true
  },
  'cube_conveyor': {
    type: 'cube_conveyor',
    name: 'Conveyor',
    category: 'mechanical',
    tags: ['physics', 'movement', 'transport'],
    icon: Wind,
    previewColor: '#f97316',
    description: 'Moves objects in one direction',
    stackSize: 32,
    placementSound: 'metal',
    breakTime: 2.0,
    price: 60,
    rarity: 'uncommon',
    canRotate: true,
    canScale: true,
    canPaint: false,
    physicsEnabled: true
  },
  'cube_boost': {
    type: 'cube_boost',
    name: 'Boost Pad',
    category: 'mechanical',
    tags: ['physics', 'speed', 'launch'],
    icon: Zap,
    previewColor: '#a855f7',
    description: 'Launches objects with speed',
    stackSize: 16,
    placementSound: 'metal',
    breakTime: 2.0,
    price: 80,
    rarity: 'rare',
    canRotate: true,
    canScale: true,
    canPaint: false,
    physicsEnabled: true
  },
  'cube_slow': {
    type: 'cube_slow',
    name: 'Slow Field',
    category: 'mechanical',
    tags: ['physics', 'slow', 'trap'],
    previewColor: '#eab308',
    description: 'Slows down moving objects',
    stackSize: 16,
    placementSound: 'soft',
    breakTime: 1.5,
    price: 60,
    rarity: 'uncommon',
    canRotate: true,
    canScale: true,
    canPaint: false,
    physicsEnabled: true
  },
  'cube_sticky': {
    type: 'cube_sticky',
    name: 'Sticky Pad',
    category: 'mechanical',
    tags: ['physics', 'sticky', 'grip'],
    previewColor: '#84cc16',
    description: 'High friction surface',
    stackSize: 32,
    placementSound: 'soft',
    breakTime: 1.2,
    price: 45,
    rarity: 'uncommon',
    canRotate: true,
    canScale: true,
    canPaint: false,
    physicsEnabled: true
  },
  'start': {
    type: 'start',
    name: 'Start Point',
    category: 'interactive',
    tags: ['game', 'spawn', 'begin'],
    icon: Flag,
    previewColor: '#00ff88',
    description: 'Player spawn point',
    stackSize: 1,
    placementSound: 'metal',
    breakTime: 3.0,
    price: 100,
    rarity: 'rare',
    canRotate: true,
    canScale: false,
    canPaint: false,
    physicsEnabled: false
  },
  'checkpoint': {
    type: 'checkpoint',
    name: 'Checkpoint',
    category: 'interactive',
    tags: ['game', 'save', 'progress'],
    icon: Target,
    previewColor: '#ffcc00',
    description: 'Progress checkpoint',
    stackSize: 8,
    placementSound: 'metal',
    breakTime: 2.5,
    price: 75,
    rarity: 'uncommon',
    canRotate: true,
    canScale: false,
    canPaint: false,
    physicsEnabled: false
  },
  'finish': {
    type: 'finish',
    name: 'Finish Line',
    category: 'interactive',
    tags: ['game', 'end', 'goal'],
    icon: Flag,
    previewColor: '#00ccff',
    description: 'Level completion point',
    stackSize: 1,
    placementSound: 'metal',
    breakTime: 3.0,
    price: 100,
    rarity: 'rare',
    canRotate: true,
    canScale: false,
    canPaint: false,
    physicsEnabled: false
  },
  'hazard': {
    type: 'hazard',
    name: 'Hazard',
    category: 'interactive',
    tags: ['game', 'danger', 'reset'],
    icon: AlertTriangle,
    previewColor: '#ff3344',
    description: 'Dangerous area - resets player',
    stackSize: 16,
    placementSound: 'metal',
    breakTime: 2.0,
    price: 50,
    rarity: 'uncommon',
    canRotate: true,
    canScale: true,
    canPaint: false,
    physicsEnabled: false
  }
};

// Helper functions
export function getBlocksByCategory(category: BlockCategory): Block['type'][] {
  const categoryInfo = blockCategories.find(c => c.id === category);
  return categoryInfo?.blocks || [];
}

export function getBlockCategory(blockType: Block['type']): BlockCategory {
  return blockMetadata[blockType]?.category || 'basic';
}

export function getBlockMetadata(blockType: Block['type']): BlockMetadata | undefined {
  return blockMetadata[blockType];
}

export function searchBlocks(query: string): Block['type'][] {
  const lowercaseQuery = query.toLowerCase();
  
  return Object.entries(blockMetadata)
    .filter(([_, metadata]) => {
      return metadata.name.toLowerCase().includes(lowercaseQuery) ||
             metadata.description.toLowerCase().includes(lowercaseQuery) ||
             metadata.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery));
    })
    .map(([type]) => type as Block['type']);
}

// Get blocks by rarity
export function getBlocksByRarity(rarity: BlockMetadata['rarity']): Block['type'][] {
  return Object.entries(blockMetadata)
    .filter(([_, metadata]) => metadata.rarity === rarity)
    .map(([type]) => type as Block['type']);
}

// Get unlocked blocks based on level
export function getUnlockedBlocks(level: number): Block['type'][] {
  return Object.entries(blockMetadata)
    .filter(([_, metadata]) => !metadata.unlockLevel || metadata.unlockLevel <= level)
    .map(([type]) => type as Block['type']);
}
