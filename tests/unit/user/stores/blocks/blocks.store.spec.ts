import { describe, it, expect, beforeEach } from 'vitest';
import { useBlocksStore } from '@/features/projects/stores/blocks.store';
import type { Block } from '@/types/project';

function createBlock(id: string, overrides: Partial<Block> = {}): Block {
  return {
    id,
    type: 'cube',
    position: { x: 0, y: 0, z: 0 },
    ...overrides,
  } as Block;
}

describe('useBlocksStore', () => {
  beforeEach(() => {
    // Reset store by clearing blocks
    const api = useBlocksStore.getState();
    api.setBlocks([]);
    api.setSelectedBlockId(null);
    api.setSelectedBlockIds([]);
  });

  it('adds and removes a block', () => {
    const api = useBlocksStore.getState();
    const block = createBlock('a1');
    api.addBlock(block);
    expect(useBlocksStore.getState().blocks).toHaveLength(1);
    expect(useBlocksStore.getState().blocks[0].id).toBe('a1');

    api.removeBlock('a1');
    expect(useBlocksStore.getState().blocks).toHaveLength(0);
  });

  it('updates position and rotations get normalized', () => {
    const api = useBlocksStore.getState();
    const block = createBlock('b1');
    api.addBlock(block);
    api.setBlockPosition('b1', { x: 2, y: 3, z: 4 });
    api.setBlockRotationX('b1', 370);
    api.setBlockRotationY('b1', -10);
    api.setBlockRotationZ('b1', 720);
    const b = useBlocksStore.getState().blocks.find(x => x.id === 'b1')!;
    expect(b.position).toEqual({ x: 2, y: 3, z: 4 });
    expect((b as any).rotationX).toBe(10);
    expect((b as any).rotationY).toBe(350);
    expect((b as any).rotationZ).toBe(0);
  });

  it('duplicate selects the new copy', () => {
    const api = useBlocksStore.getState();
    const block = createBlock('c1', { name: 'Box' });
    api.addBlock(block);
    api.duplicateBlock('c1');
    const state = useBlocksStore.getState();
    expect(state.blocks.length).toBe(2);
    expect(state.selectedBlockId).toBeTruthy();
    expect(state.selectedBlockIds).toHaveLength(1);
  });

  it('paintBlocks colors only selected ids', () => {
    const api = useBlocksStore.getState();
    api.addBlocks([
      createBlock('p1'),
      createBlock('p2'),
      createBlock('p3'),
    ]);
    api.paintBlocks(['p1', 'p3'], 0xff00ff);
    const s = useBlocksStore.getState();
    const m: Record<string, number | undefined> = Object.fromEntries(s.blocks.map(b => [b.id, (b as any).color]));
    expect(m['p1']).toBe(0xff00ff);
    expect(m['p3']).toBe(0xff00ff);
    expect(m['p2']).toBeUndefined();
  });
});


