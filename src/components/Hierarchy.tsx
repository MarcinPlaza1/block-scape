import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useProjectStore } from '@/lib/projectStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Trash2, Eye, EyeOff, Lock, Unlock, Copy, Pencil, MoreHorizontal } from 'lucide-react';

const Hierarchy = () => {
  const blocks = useProjectStore(s => (s as any).blocks) as { id: string; type: 'cube' | 'sphere'; position: { x: number; y: number; z: number }; name?: string; hidden?: boolean; locked?: boolean; group?: string }[];
  const selectedBlockId = useProjectStore(s => (s as any).selectedBlockId) as string | null;
  const selectedBlockIds = useProjectStore(s => (s as any).selectedBlockIds) as string[];
  const setSelectedBlockId = useProjectStore(s => (s as any).setSelectedBlockId) as (id: string | null) => void;
  const setSelectedBlockIds = useProjectStore(s => (s as any).setSelectedBlockIds) as (ids: string[]) => void;
  const removeBlock = useProjectStore(s => (s as any).removeBlock) as (id: string) => void;
  const removeBlocks = useProjectStore(s => (s as any).removeBlocks) as (ids: string[]) => void;
  const renameBlock = useProjectStore(s => (s as any).renameBlock) as (id: string, name: string) => void;
  const duplicateBlock = useProjectStore(s => (s as any).duplicateBlock) as (id: string) => void;
  const setBlockHidden = useProjectStore(s => (s as any).setBlockHidden) as (id: string, hidden: boolean) => void;
  const setBlockLocked = useProjectStore(s => (s as any).setBlockLocked) as (id: string, locked: boolean) => void;
  const setBlockGroup = useProjectStore(s => (s as any).setBlockGroup) as (id: string, group: string) => void;

  const [filter, setFilter] = useState('');
  const [showHidden, setShowHidden] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'cube' | 'sphere'>('all');
  const [groupOpen, setGroupOpen] = useState<{ cube: boolean; sphere: boolean }>(() => {
    try { return JSON.parse(localStorage.getItem('hierarchy-group-open') || '{"cube":true,"sphere":true}'); } catch { return { cube: true, sphere: true }; }
  });
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'distance'>(() => (localStorage.getItem('hierarchy-sort') as any) || 'name');
  const [groupFilter, setGroupFilter] = useState<string>(() => localStorage.getItem('hierarchy-group-filter') || '');
  const [newGroupName, setNewGroupName] = useState<string>('');
  const rowHeight = 40;
  const viewportHeight = 240;

  const items = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = (blocks || []).filter(b => {
      if (!showHidden && b.hidden) return false;
      if (typeFilter !== 'all' && b.type !== typeFilter) return false;
      if (groupFilter && (b.group || '') !== groupFilter) return false;
      if (!q) return true;
      const name = (b.name || '').toLowerCase();
      const pos = `${b.position.x},${b.position.y},${b.position.z}`;
      return name.includes(q) || b.type.includes(q) || pos.includes(q);
    });
    // get camera for distance
    let cam = { x: 0, y: 0, z: 0 } as any;
    try {
      const v = (window as any).scene3D?.getCameraPosition?.();
      if (v) cam = v;
    } catch {}
    let map = filtered.map(b => ({
      id: b.id,
      name: b.name,
      hidden: b.hidden,
      locked: b.locked,
      type: b.type,
      group: b.group || '',
      distance: Math.hypot((b.position.x - (cam.x || 0)), (b.position.y - (cam.y || 0)), (b.position.z - (cam.z || 0))),
      label: `${b.name || b.type} (${b.position.x.toFixed(1)}, ${b.position.y.toFixed(1)}, ${b.position.z.toFixed(1)})`,
    }));
    // simple sort: name, then type fallback
    map = [...map].sort((a, b) => {
      if (sortBy === 'name') return (a.name || a.type).localeCompare(b.name || b.type);
      if (sortBy === 'type') return a.type.localeCompare(b.type) || (a.name || '').localeCompare(b.name || '');
      return a.distance - b.distance;
    });
    return map;
  }, [blocks, filter, showHidden, typeFilter, sortBy, groupFilter]);

  const cubes = useMemo(() => items.filter(i => i.type === 'cube'), [items]);
  const spheres = useMemo(() => items.filter(i => i.type === 'sphere'), [items]);
  useEffect(() => { try { localStorage.setItem('hierarchy-group-open', JSON.stringify(groupOpen)); } catch {} }, [groupOpen]);
  useEffect(() => { try { localStorage.setItem('hierarchy-sort', sortBy); } catch {} }, [sortBy]);
  useEffect(() => { try { localStorage.setItem('hierarchy-group-filter', groupFilter); } catch {} }, [groupFilter]);

  const toggleSelect = useCallback((id: string) => {
    const set = new Set(selectedBlockIds || []);
    if (set.has(id)) {
      set.delete(id);
      const next = Array.from(set);
      setSelectedBlockIds(next);
      setSelectedBlockId(next.length === 1 ? next[0] : (next.length === 0 ? null : selectedBlockId && next.includes(selectedBlockId) ? selectedBlockId : (next[0] || null)));
    } else {
      set.add(id);
      const next = Array.from(set);
      setSelectedBlockIds(next);
      setSelectedBlockId(id);
    }
  }, [selectedBlockIds, selectedBlockId, setSelectedBlockIds, setSelectedBlockId]);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedBlockIds(Array.from(new Set([...(selectedBlockIds || []), ...ids])));
  }, [selectedBlockIds, setSelectedBlockIds]);

  const Row = ({ it }: { it: any }) => {
    const isSelected = selectedBlockIds?.includes(it.id) || selectedBlockId === it.id;
    return (
      <div className={`h-10 flex items-center justify-between px-2 rounded-md ${isSelected ? 'bg-sidebar-accent ring-1 ring-primary' : ''}`} onClick={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).closest('button') === null) toggleSelect(it.id); }}>
        <label className="flex items-center gap-2 min-w-0">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={!!(selectedBlockIds?.includes(it.id))}
            onChange={() => toggleSelect(it.id)}
          />
          <span className="truncate cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleSelect(it.id); }}>{it.label}</span>
        </label>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title={it.hidden ? 'Show' : 'Hide'} onClick={() => setBlockHidden(it.id, !it.hidden)}>
            {it.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title={it.locked ? 'Unlock' : 'Lock'} onClick={() => setBlockLocked(it.id, !it.locked)}>
            {it.locked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="More">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[8rem]">
              <DropdownMenuItem onClick={() => { const name = prompt('New name?', it.name || '') || ''; if (name) renameBlock(it.id, name); }}>
                <Pencil className="h-3 w-3 mr-2" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicateBlock(it.id)}>
                <Copy className="h-3 w-3 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => removeBlock(it.id)}>
                <Trash2 className="h-3 w-3 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  const VirtualList = ({ data }: { data: any[] }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const total = data.length;
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + 4;
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
    const endIndex = Math.min(total, startIndex + visibleCount);
    const topPadding = startIndex * rowHeight;
    const bottomPadding = (total - endIndex) * rowHeight;
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const onScroll = () => setScrollTop(el.scrollTop);
      el.addEventListener('scroll', onScroll);
      return () => el.removeEventListener('scroll', onScroll);
    }, []);
    return (
      <div ref={containerRef} className="border border-sidebar-border rounded-md" style={{ height: viewportHeight, overflowY: 'auto' }}>
        <div style={{ height: topPadding }} />
        {data.slice(startIndex, endIndex).map(it => (
          <Row key={it.id} it={it} />
        ))}
        <div style={{ height: bottomPadding }} />
      </div>
    );
  };

  return (
    <div className="p-4 border-b border-sidebar-border">
      <h3 className="text-sm font-semibold text-sidebar-foreground mb-3">Hierarchy</h3>
      <input
        className="w-full mb-2 px-2 py-1 text-xs bg-sidebar-accent border border-sidebar-border rounded"
        placeholder="Filter by name/type..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="flex items-center gap-2 mb-2">
        <Button size="sm" variant="outline" onClick={() => { setSelectedBlockId(null); setSelectedBlockIds([]); }}>Clear selection</Button>
        {selectedBlockIds?.length > 0 && (
          <span className="text-[10px] text-sidebar-foreground/70">Selected: {selectedBlockIds.length}</span>
        )}
      </div>
      <div className="flex items-center gap-2 mb-2 text-xs">
        <div className="flex items-center gap-1">
          <Button size="sm" variant={typeFilter === 'all' ? 'default' : 'outline'} onClick={() => setTypeFilter('all')}>All</Button>
          <Button size="sm" variant={typeFilter === 'cube' ? 'default' : 'outline'} onClick={() => setTypeFilter('cube')}>Cubes</Button>
          <Button size="sm" variant={typeFilter === 'sphere' ? 'default' : 'outline'} onClick={() => setTypeFilter('sphere')}>Spheres</Button>
        </div>
        <Button size="sm" variant={showHidden ? 'default' : 'outline'} onClick={() => setShowHidden(v => !v)}>{showHidden ? 'Hidden: On' : 'Hidden: Off'}</Button>
        {/* Group filter + create */}
        <input className="px-2 py-1 border border-sidebar-border rounded bg-sidebar-accent" placeholder="Filter by group" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} />
        <input className="px-2 py-1 border border-sidebar-border rounded bg-sidebar-accent" placeholder="New group..." value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => setNewGroupName('')}>Clear group input</Button>
        {selectedBlockIds?.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => {
            const g = (newGroupName || '').trim();
            if (!g) return;
            try {
              selectedBlockIds.forEach(id => setBlockGroup(id, g));
            } catch {}
          }}>Set group for selected</Button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span>Sort</span>
          <Button size="sm" variant={sortBy === 'name' ? 'default' : 'outline'} onClick={() => setSortBy('name')}>Name</Button>
          <Button size="sm" variant={sortBy === 'type' ? 'default' : 'outline'} onClick={() => setSortBy('type')}>Type</Button>
          <Button size="sm" variant={sortBy === 'distance' ? 'default' : 'outline'} onClick={() => setSortBy('distance')}>Distance</Button>
        </div>
        {selectedBlockIds?.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => removeBlocks(selectedBlockIds)}>
            <Trash2 className="h-3 w-3 mr-1" /> Delete ({selectedBlockIds.length})
          </Button>
        )}
      </div>

      {/* Grouped & virtualized */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <button className="font-semibold" onClick={() => setGroupOpen(s => ({ ...s, cube: !s.cube }))}>Cubes ({cubes.length})</button>
            {cubes.length > 0 && <Button size="sm" variant="ghost" onClick={() => selectAll(cubes.map(c => c.id))}>Select all</Button>}
          </div>
          {groupOpen.cube && <VirtualList data={cubes} />}
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <button className="font-semibold" onClick={() => setGroupOpen(s => ({ ...s, sphere: !s.sphere }))}>Spheres ({spheres.length})</button>
            {spheres.length > 0 && <Button size="sm" variant="ghost" onClick={() => selectAll(spheres.map(c => c.id))}>Select all</Button>}
          </div>
          {groupOpen.sphere && <VirtualList data={spheres} />}
        </div>
        <div className="flex items-center justify-between text-xs">
          <Button size="sm" variant="ghost" onClick={() => setGroupOpen({ cube: false, sphere: false })}>Collapse all</Button>
          <Button size="sm" variant="ghost" onClick={() => setGroupOpen({ cube: true, sphere: true })}>Expand all</Button>
        </div>
      </div>
    </div>
  );
};

export default Hierarchy;


