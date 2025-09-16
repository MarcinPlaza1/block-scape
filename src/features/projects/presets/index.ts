import type { Block, ProjectData, TerrainData } from '@/types/project';

export type PresetId = 'empty' | 'platformer' | 'maze' | 'parkour' | 'sandbox';

export interface PresetMeta {
  id: PresetId;
  name: string;
  description: string;
  thumbnail?: string;
}

export interface PresetDefinition extends PresetMeta {
  create(initialName?: string): { name: string; blocks: Block[]; terrain?: TerrainData };
}

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const empty: PresetDefinition = {
  id: 'empty',
  name: 'Pusty projekt',
  description: 'Czysta scena z płaskim terenem, idealna na start.',
  create(initialName = 'Nowy projekt') {
    const blocks: Block[] = [];
    return { name: initialName, blocks };
  },
};

const platformer: PresetDefinition = {
  id: 'platformer',
  name: 'Platformówka',
  description: 'Zestaw podstawowych platform, start i meta.',
  create(initialName = 'Platformer Starter') {
    const blocks: Block[] = [
      { id: makeId('start'), type: 'start', position: { x: 0, y: 1, z: 0 } },
      { id: makeId('plate'), type: 'plate', position: { x: 0, y: 0, z: 0 }, scale: { x: 10, y: 1, z: 10 } },
      { id: makeId('plate'), type: 'plate', position: { x: 14, y: 2, z: 0 }, scale: { x: 6, y: 1, z: 6 } },
      { id: makeId('plate'), type: 'plate', position: { x: 26, y: 4, z: 0 }, scale: { x: 4, y: 1, z: 4 } },
      { id: makeId('finish'), type: 'finish', position: { x: 32, y: 5, z: 0 } },
    ];
    return { name: initialName, blocks };
  },
};

const maze: PresetDefinition = {
  id: 'maze',
  name: 'Labirynt',
  description: 'Prosty labirynt z punktem startu i mety.',
  create(initialName = 'Maze Starter') {
    const blocks: Block[] = [
      { id: makeId('start'), type: 'start', position: { x: -8, y: 1, z: -8 } },
      { id: makeId('finish'), type: 'finish', position: { x: 8, y: 1, z: 8 } },
    ];
    // Walls outline (placeholder simple square)
    for (let i = -8; i <= 8; i += 2) {
      blocks.push({ id: makeId('wall'), type: 'cube', position: { x: i, y: 1, z: -10 }, scale: { x: 2, y: 2, z: 1 } });
      blocks.push({ id: makeId('wall'), type: 'cube', position: { x: i, y: 1, z: 10 }, scale: { x: 2, y: 2, z: 1 } });
      blocks.push({ id: makeId('wall'), type: 'cube', position: { x: -10, y: 1, z: i }, scale: { x: 1, y: 2, z: 2 } });
      blocks.push({ id: makeId('wall'), type: 'cube', position: { x: 10, y: 1, z: i }, scale: { x: 1, y: 2, z: 2 } });
    }
    return { name: initialName, blocks };
  },
};

const parkour: PresetDefinition = {
  id: 'parkour',
  name: 'Parkour',
  description: 'Sekwencja skoków z platformami o różnej trudności.',
  create(initialName = 'Parkour Starter') {
    const blocks: Block[] = [
      { id: makeId('start'), type: 'start', position: { x: 0, y: 1, z: 0 } },
    ];
    for (let i = 1; i <= 10; i++) {
      blocks.push({ id: makeId('p'), type: 'plate', position: { x: i * 4, y: i % 3 === 0 ? 4 : 2, z: (i % 2) * 2 }, scale: { x: 3, y: 1, z: 3 } });
    }
    blocks.push({ id: makeId('finish'), type: 'finish', position: { x: 48, y: 5, z: 4 } });
    return { name: initialName, blocks };
  },
};

const sandbox: PresetDefinition = {
  id: 'sandbox',
  name: 'Sandbox',
  description: 'Kilka podstawowych klocków do szybkiego prototypowania.',
  create(initialName = 'Sandbox Starter') {
    const blocks: Block[] = [
      { id: makeId('start'), type: 'start', position: { x: 0, y: 1, z: 0 } },
      { id: makeId('cube'), type: 'cube', position: { x: 2, y: 1, z: 2 } },
      { id: makeId('ramp'), type: 'ramp', position: { x: 6, y: 1, z: 0 } },
      { id: makeId('plate'), type: 'plate', position: { x: -4, y: 0, z: -2 }, scale: { x: 6, y: 1, z: 6 } },
    ];
    return { name: initialName, blocks };
  },
};

export const PRESETS: PresetDefinition[] = [empty, platformer, maze, parkour, sandbox];

export function getPresetMeta(): PresetMeta[] {
  return PRESETS.map(({ id, name, description, thumbnail }) => ({ id, name, description, thumbnail }));
}

export function createFromPreset(id: PresetId, initialName?: string) {
  const preset = PRESETS.find(p => p.id === id) || empty;
  return preset.create(initialName);
}


