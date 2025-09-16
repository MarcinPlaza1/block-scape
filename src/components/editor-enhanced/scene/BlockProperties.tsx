import { useMemo, useState } from 'react';
import { useProjectStore } from '@/lib/projectStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const BlockProperties = () => {
  const {
    selectedBlockId: selectedId,
    blocks,
    setBlocks,
    setBlockPosition,
    setBlockColor,
    renameBlock,
    setBlockGroup,
    setBlockRotationY,
    setBlockRotationX,
    setBlockRotationZ,
    setBlockScale,
  } = useProjectStore();

  const block = useMemo(() => blocks.find(b => b.id === selectedId), [blocks, selectedId]);
  const [name, setName] = useState<string>(() => block?.name || '');
  const [group, setGroup] = useState<string>(() => block?.group || '');
  const [x, setX] = useState<number>(() => block?.position?.x ?? 0);
  const [y, setY] = useState<number>(() => block?.position?.y ?? 0);
  const [z, setZ] = useState<number>(() => block?.position?.z ?? 0);
  const [rotationY, setRotationY] = useState<number>(() => (block?.rotationY ?? 0));
  const [rotationX, setRotationX] = useState<number>(() => (block?.rotationX ?? 0));
  const [rotationZ, setRotationZ] = useState<number>(() => (block?.rotationZ ?? 0));
  const [scale, setScale] = useState<number>(() => (block?.scale ?? 1));
  const [mechanic, setMechanic] = useState<string>(() => (block as any)?.mechanic || 'none');
  const [mechanicPower, setMechanicPower] = useState<number>(() => (block as any)?.mechanicPower ?? 1);

  if (!block) {
    return (
      <Card className="bg-sidebar-accent border-sidebar-border p-3 text-xs text-sidebar-foreground/80">
        <div>No block selected.</div>
      </Card>
    );
  }

  return (
    <Card className="bg-sidebar-accent border-sidebar-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Properties</span>
        <Badge variant="outline" className="text-[10px]">{block.type}</Badge>
      </div>

      <div className="space-y-2 text-xs">
        <label className="flex items-center justify-between gap-2">
          <span className="min-w-[4rem]">Name</span>
          <input className="flex-1 px-2 py-1 rounded border border-sidebar-border bg-background text-foreground" value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => renameBlock(block.id, name)}>Set</Button>
        </label>

        <label className="flex items-center justify-between gap-2">
          <span className="min-w-[4rem]">Group</span>
          <input className="flex-1 px-2 py-1 rounded border border-sidebar-border bg-background text-foreground" value={group} onChange={(e) => setGroup(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => setBlockGroup(block.id, group)}>Set</Button>
        </label>

        <div className="grid grid-cols-3 gap-2">
          <label className="flex items-center gap-1">
            <span>X</span>
            <input type="number" className="w-20 px-2 py-1 rounded border border-sidebar-border bg-background text-foreground" value={x} onChange={(e) => setX(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-1">
            <span>Y</span>
            <input type="number" className="w-20 px-2 py-1 rounded border border-sidebar-border bg-background text-foreground" value={y} onChange={(e) => setY(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-1">
            <span>Z</span>
            <input type="number" className="w-20 px-2 py-1 rounded border border-sidebar-border bg-background text-foreground" value={z} onChange={(e) => setZ(Number(e.target.value))} />
          </label>
        </div>
        <Button size="sm" variant="outline" onClick={() => setBlockPosition(block.id, { x, y, z })}>Apply Position</Button>

        <label className="flex items-center justify-between gap-2">
          <span className="min-w-[4rem]">Rotate Y</span>
          <input type="number" className="w-24 px-2 py-1 rounded border border-sidebar-border bg-background text-foreground" value={rotationY} onChange={(e) => setRotationY(Number(e.target.value))} />
          <Button size="sm" variant="outline" onClick={() => setBlockRotationY(block.id, rotationY)}>Apply</Button>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex items-center gap-1">
            <span>Rot X</span>
            <input type="number" className="w-20 px-2 py-1 rounded border border-sidebar-border bg-background text-foreground" value={rotationX} onChange={(e) => setRotationX(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-1">
            <span>Rot Z</span>
            <input type="number" className="w-20 px-2 py-1 rounded border border-sidebar-border bg-background text-foreground" value={rotationZ} onChange={(e) => setRotationZ(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-1">
            <span>Scale</span>
            <input type="number" step={0.1} className="w-20 px-2 py-1 rounded border border-sidebar-border bg-background text-foreground" value={scale} onChange={(e) => setScale(Number(e.target.value))} />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setBlockRotationX(block.id, rotationX)}>Apply Rot X</Button>
          <Button size="sm" variant="outline" onClick={() => setBlockRotationZ(block.id, rotationZ)}>Apply Rot Z</Button>
          <Button size="sm" variant="outline" onClick={() => setBlockScale(block.id, scale)}>Apply Scale</Button>
        </div>

        {(['cube_bouncy','cube_ice','cube_conveyor'].includes((block as any).type)) ? (
          <div className="text-xs text-muted-foreground">Texture-only block. Color is fixed.</div>
        ) : (
          <div className="flex items-center gap-2">
            {[0xEF4444, 0xF59E0B, 0x10B981, 0x3B82F6, 0x8B5CF6, 0x6B7280].map((c) => (
              <button key={c} className={`h-6 w-6 rounded-full border ${block.color === c ? 'ring-2 ring-primary' : 'border-sidebar-border'}`} style={{ backgroundColor: `#${c.toString(16).padStart(6, '0')}` }} onClick={() => setBlockColor(block.id, c)} title={`Color #${c.toString(16).padStart(6, '0')}`} />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => (window as any).scene3D?.alignSelectedToGrid?.()}>Align to grid</Button>
          <Button size="sm" variant="outline" onClick={() => (window as any).scene3D?.groundSelected?.()}>Ground Y</Button>
        </div>
        {block.type === 'cube' && (
          <div className="space-y-2 pt-2 border-t border-sidebar-border">
            <div className="text-xs font-semibold">Mechanic</div>
            <div className="flex items-center gap-2 text-xs">
              <select className="flex-1 px-2 py-1 rounded border border-sidebar-border bg-background text-foreground" value={mechanic} onChange={(e) => setMechanic(e.target.value)}>
                {['none','bouncy','ice','conveyor','boost','slow','sticky','checkpoint','finish','hazard'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input type="number" step={0.1} className="w-24 px-2 py-1 rounded border border-sidebar-border bg-background text-foreground" value={mechanicPower} onChange={(e) => setMechanicPower(Number(e.target.value))} />
              <Button size="sm" variant="outline" onClick={() => {
                try {
                  const next = (blocks || []).map(b => b.id === block.id ? { ...b, mechanic, mechanicPower: mechanicPower } : b);
                  setBlocks(next as any);
                } catch {}
              }}>Apply</Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default BlockProperties;


