import { describe, it, expect, beforeEach } from 'vitest';
import { useBlocksStore } from '@/features/projects/stores/blocks.store';
import type { Block } from '@/types/project';

function b(id: string, overrides: Partial<Block> = {}): Block {
  return { id, type: 'cube', position: { x: 0, y: 0, z: 0 }, ...overrides } as Block;
}

describe('useBlocksStore extra', () => {
  beforeEach(() => {
    const api = useBlocksStore.getState();
    api.setBlocks([]);
    api.setSelectedBlockId(null);
    api.setSelectedBlockIds([]);
  });

  it('clamps scale between 0.1 and 10', () => {
    const s = useBlocksStore.getState();
    s.addBlock(b('s1'));
    s.setBlockScale('s1', -5);
    let blk = useBlocksStore.getState().blocks.find(x => x.id === 's1') as any;
    expect(blk.scale).toBe(0.1);
    s.setBlockScale('s1', 999);
    blk = useBlocksStore.getState().blocks.find(x => x.id === 's1') as any;
    expect(blk.scale).toBe(10);
  });

  it('renameBlock trims and ignores empty names', () => {
    const s = useBlocksStore.getState();
    s.addBlock(b('r1', { name: 'Old' }));
    s.renameBlock('r1', '   New   ');
    let blk = useBlocksStore.getState().blocks.find(x => x.id === 'r1') as any;
    expect(blk.name).toBe('New');
    s.renameBlock('r1', '   ');
    blk = useBlocksStore.getState().blocks.find(x => x.id === 'r1') as any;
    expect(blk.name).toBe('New');
  });

  it('removeBlocks updates selections correctly', () => {
    const s = useBlocksStore.getState();
    s.addBlocks([b('a'), b('b'), b('c')]);
    s.setSelectedBlockId('b');
    s.setSelectedBlockIds(['a','b']);
    s.removeBlocks(['a','b']);
    const state = useBlocksStore.getState();
    expect(state.blocks.map(x => x.id)).toEqual(['c']);
    expect(state.selectedBlockId).toBeNull();
    expect(state.selectedBlockIds).toEqual([]);
  });

  it('setSelectedBlockIds de-duplicates and preserves order of first occurrence', () => {
    const s = useBlocksStore.getState();
    s.setSelectedBlockIds(['x','y','x','z','y']);
    expect(useBlocksStore.getState().selectedBlockIds).toEqual(['x','y','z']);
  });

  it('setBlockColor does not color mechanic cubes with textures', () => {
    const s = useBlocksStore.getState();
    s.addBlocks([b('m1', { type: 'cube_bouncy' as any }), b('ok1', { type: 'cube' })]);
    s.setBlockColor('m1', 0xff0000);
    s.setBlockColor('ok1', 0x00ff00);
    const map: Record<string, number|undefined> = Object.fromEntries(useBlocksStore.getState().blocks.map(x => [x.id, (x as any).color]));
    expect(map['m1']).toBeUndefined();
    expect(map['ok1']).toBe(0x00ff00);
  });
});


