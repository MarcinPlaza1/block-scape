import { describe, it, expect, beforeEach } from 'vitest';
import { useBlocksStore } from '@/features/projects/stores/blocks.store';
import type { Block } from '@/types/project';

const B = (id: string, overrides: Partial<Block> = {}): Block => ({ id, type: 'cube', position: { x: 0, y: 0, z: 0 }, ...overrides } as Block);

describe('useBlocksStore more', () => {
  beforeEach(() => {
    const s = useBlocksStore.getState();
    s.setBlocks([]);
    s.setSelectedBlockId(null);
    s.setSelectedBlockIds([]);
  });

  it('updateBlock merges props', () => {
    const s = useBlocksStore.getState();
    s.addBlock(B('u1'));
    s.updateBlock('u1', { name: 'X' } as any);
    const blk = useBlocksStore.getState().blocks.find(b => b.id === 'u1') as any;
    expect(blk.name).toBe('X');
  });

  it('setBlockPosition updates vector', () => {
    const s = useBlocksStore.getState();
    s.addBlock(B('p1'));
    s.setBlockPosition('p1', { x: 5, y: 6, z: 7 });
    const blk = useBlocksStore.getState().blocks.find(b => b.id === 'p1')!;
    expect(blk.position).toEqual({ x: 5, y: 6, z: 7 });
  });

  it('rotation normalizes X/Y/Z to 0..360', () => {
    const s = useBlocksStore.getState();
    s.addBlock(B('r1'));
    s.setBlockRotationX('r1', -10);
    s.setBlockRotationY('r1', 370);
    s.setBlockRotationZ('r1', 720);
    const blk = useBlocksStore.getState().blocks.find(b => b.id === 'r1') as any;
    expect(blk.rotationX).toBe(350);
    expect(blk.rotationY).toBe(10);
    expect(blk.rotationZ).toBe(0);
  });

  it('duplicateBlock sets selection to copy', () => {
    const s = useBlocksStore.getState();
    s.addBlock(B('d1', { name: 'Box' }));
    s.duplicateBlock('d1');
    const st = useBlocksStore.getState();
    expect(st.blocks.length).toBe(2);
    expect(st.selectedBlockIds.length).toBe(1);
    expect(st.selectedBlockId).toBeTruthy();
  });

  it('clearBlocks empties without errors', () => {
    const s = useBlocksStore.getState();
    s.addBlocks([B('a'), B('b')]);
    s.clearBlocks();
    expect(useBlocksStore.getState().blocks).toHaveLength(0);
  });

  it('removeBlock clears selectedBlockId if targeted', () => {
    const s = useBlocksStore.getState();
    s.addBlocks([B('a')]);
    s.setSelectedBlockId('a');
    s.removeBlock('a');
    expect(useBlocksStore.getState().selectedBlockId).toBeNull();
  });
});


