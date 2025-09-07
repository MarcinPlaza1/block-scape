import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { MoreVertical, Edit, Copy, Trash2, Upload, Download, Globe, EyeOff, CheckSquare, Play as PlayIcon, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import MiniPreview from '@/components/MiniPreview';
import type { Block } from '@/types/project';

interface GameSummary {
  id: string;
  name: string;
  updatedAt: string;
  published?: boolean;
  blocks?: Block[];
  thumbnail?: string | null;
  _count?: { likes?: number };
}

const UserGames = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc'>('updated_desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'drafts'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const fetchMe = useAuthStore(s => s.fetchMe);
  const email = user?.email || localStorage.getItem('auth-email');
  const { toast } = useToast();
  //

  useEffect(() => {
    let mounted = true;
    let abort = new AbortController();
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        if (!user || !token) await fetchMe();
        const resp = await apiFetch<{ games: GameSummary[] }>(`/users/me/games`, { method: 'GET', signal: abort.signal as any });
        if (mounted) setGames(resp.games || []);
      } catch (e: any) {
        if (!mounted || e?.name === 'AbortError') return;
        toast({ title: 'Sesja wygasła', description: 'Zaloguj się ponownie.', variant: 'destructive' });
        navigate('/login');
      } finally {
        if (mounted) setLoading(false);
      }
    }, 200);
    return () => {
      mounted = false;
      try { abort.abort(); } catch {}
      window.clearTimeout(handle);
    };
  }, [navigate, token, fetchMe, user]);

  const filteredGames = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = q ? games.filter(g => g.name.toLowerCase().includes(q)) : games;
    if (statusFilter === 'published') base = base.filter(g => !!g.published);
    if (statusFilter === 'drafts') base = base.filter(g => !g.published);
    const list = [...base];
    switch (sort) {
      case 'updated_asc':
        list.sort((a, b) => (a.updatedAt > b.updatedAt ? 1 : -1));
        break;
      case 'name_asc':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        list.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'updated_desc':
      default:
        list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    }
    return list;
  }, [games, query, sort, statusFilter]);

  const stats = useMemo(() => {
    const total = games.length;
    const published = games.filter(g => g.published).length;
    const drafts = total - published;
    const lastUpdated = games.length
      ? new Date(Math.max(...games.map(g => new Date(g.updatedAt).getTime())))
      : null;
    return { total, published, drafts, lastUpdated };
  }, [games]);

  const allVisibleSelected = filteredGames.length > 0 && filteredGames.every(g => selectedIds.has(g.id));
  const hasSelection = selectedIds.size > 0;

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds(prev => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        filteredGames.forEach(g => next.delete(g.id));
        return next;
      }
      const next = new Set(prev);
      filteredGames.forEach(g => next.add(g.id));
      return next;
    });
  };

  const startRename = (id: string, name: string) => {
    setActiveGameId(id);
    setRenameName(name);
    setRenameOpen(true);
  };

  const submitRename = async () => {
    if (!activeGameId) return;
    const name = renameName.trim();
    if (!name) return;
    setRenaming(true);
    try {
      const resp = await apiFetch<{ game: { id: string; name: string; updatedAt: string } }>(`/games/${activeGameId}`, {
        method: 'PUT',
        body: JSON.stringify({ name })
      });
      setGames(prev => prev.map(g => g.id === activeGameId ? { ...g, name: resp.game.name, updatedAt: resp.game.updatedAt } : g));
      setRenameOpen(false);
      setActiveGameId(null);
      toast({ title: 'Zmieniono nazwę projektu' });
    } catch (e: any) {
      toast({ title: 'Nie udało się zmienić nazwę', description: e?.message || 'Spróbuj ponownie.', variant: 'destructive' });
    } finally {
      setRenaming(false);
    }
  };

  const confirmDelete = async () => {
    const id = deletingId;
    if (!id) return;
    try {
      await apiFetch(`/games/${id}`, { method: 'DELETE' });
      setGames(prev => prev.filter(g => g.id !== id));
      setDeletingId(null);
      toast({ title: 'Usunięto projekt' });
    } catch (e: any) {
      toast({ title: 'Nie udało się usunąć', description: e?.message || 'Spróbuj ponownie.', variant: 'destructive' });
    }
  };

  const onDuplicate = async (id: string, name: string) => {
    setDuplicating(id);
    try {
      const detail = await apiFetch<{ game: { id: string; name: string; blocks: any } }>(`/games/${id}`);
      const baseName = name.startsWith('Copy of ') ? name : `Copy of ${name}`;
      const existing = new Set(games.map(g => g.name));
      let candidate = baseName;
      let i = 2;
      while (existing.has(candidate)) candidate = `${baseName} (${i++})`;
      const created = await apiFetch<{ game: { id: string; name: string; updatedAt: string } }>(`/games`, {
        method: 'POST',
        body: JSON.stringify({ name: candidate, blocks: (detail as any).game.blocks })
      });
      setGames(prev => [{ id: created.game.id, name: created.game.name, updatedAt: created.game.updatedAt }, ...prev]);
      toast({ title: 'Zduplikowano projekt' });
    } catch (e: any) {
      toast({ title: 'Nie udało się zduplikować', description: e?.message || 'Spróbuj ponownie.', variant: 'destructive' });
    } finally {
      setDuplicating(null);
    }
  };

  const togglePublish = async (id: string, next: boolean) => {
    try {
      const resp = await apiFetch<{ game: { id: string; published?: boolean; updatedAt: string } }>(`/games/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ published: next })
      });
      setGames(prev => prev.map(g => g.id === id ? { ...g, published: resp.game.published, updatedAt: resp.game.updatedAt } : g));
      toast({ title: next ? 'Opublikowano' : 'Cofnięto publikację' });
    } catch (e: any) {
      toast({ title: 'Nie udało się zmienić statusu publikacji', description: e?.message || 'Spróbuj ponownie.', variant: 'destructive' });
    }
  };

  // Lazy mini preview that fetches blocks on first viewport entry
  const LazyMiniPreview = ({ gameId, initialBlocks }: { gameId: string; initialBlocks?: Block[] }) => {
    const [blocks, setBlocks] = useState<Block[]>(initialBlocks || []);
    const [loaded, setLoaded] = useState<boolean>(!!initialBlocks);
    const loadingRef = useRef<boolean>(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (loaded) return;
      const el = containerRef.current;
      if (!el) return;
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(async (entry) => {
          if (entry.isIntersecting && !loadingRef.current) {
            loadingRef.current = true;
            try {
              const detail = await apiFetch<{ game: { id: string; blocks: Block[] } }>(`/games/${gameId}`);
              setBlocks(Array.isArray(detail.game.blocks) ? detail.game.blocks : []);
              setLoaded(true);
            } catch {}
            observer.disconnect();
          }
        });
      }, { rootMargin: '80px' });
      observer.observe(el);
      return () => observer.disconnect();
    }, [loaded, gameId]);

    return (
      <div ref={containerRef} className="h-24 bg-card/60">
        <MiniPreview className="w-full h-full" blocks={blocks} />
      </div>
    );
  };

  const bulkPublish = async (next: boolean) => {
    if (!hasSelection) return;
    const ids = Array.from(selectedIds);
    try {
      await Promise.allSettled(ids.map(id => apiFetch<{ game: { id: string; published?: boolean; updatedAt: string } }>(`/games/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ published: next })
      })));
      setGames(prev => prev.map(g => selectedIds.has(g.id) ? { ...g, published: next, updatedAt: new Date().toISOString() } : g));
      toast({ title: next ? 'Opublikowano wybrane' : 'Cofnięto publikację wybranych' });
      setSelectedIds(new Set());
    } catch (e: any) {
      toast({ title: 'Operacja nie powiodła się', description: e?.message || 'Spróbuj ponownie.', variant: 'destructive' });
    }
  };

  const bulkDelete = async () => {
    if (!hasSelection) return;
    const ids = Array.from(selectedIds);
    try {
      await Promise.allSettled(ids.map(id => apiFetch(`/games/${id}`, { method: 'DELETE' })));
      setGames(prev => prev.filter(g => !selectedIds.has(g.id)));
      setSelectedIds(new Set());
      toast({ title: 'Usunięto wybrane projekty' });
    } catch (e: any) {
      toast({ title: 'Nie udało się usunąć części projektów', description: e?.message || 'Spróbuj ponownie.', variant: 'destructive' });
    }
  };

  const exportSelected = async () => {
    if (!hasSelection) return;
    try {
      const ids = Array.from(selectedIds);
      const details = await Promise.all(ids.map(id => apiFetch<{ game: { id: string; name: string; blocks: any; published?: boolean; updatedAt: string } }>(`/games/${id}`)));
      const out = details.map(d => d.game);
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `blockscape-projects-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Wyeksportowano projekty' });
    } catch (e: any) {
      toast({ title: 'Nie udało się wyeksportować', description: e?.message || 'Spróbuj ponownie.', variant: 'destructive' });
    }
  };

  const onImportJson = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const items = Array.isArray(data) ? data : [data];
      const created = await Promise.allSettled(items.map((it: any) => apiFetch<{ game: { id: string; name: string; updatedAt: string } }>(`/games`, {
        method: 'POST',
        body: JSON.stringify({ name: it.name || 'Imported Project', blocks: it.blocks || [], published: !!it.published })
      })));
      const newOnes = created
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => ({ id: r.value.game.id, name: r.value.game.name, updatedAt: r.value.game.updatedAt }));
      if (newOnes.length > 0) {
        setGames(prev => [...newOnes, ...prev]);
        toast({ title: `Zaimportowano ${newOnes.length} projekt(y)` });
      } else {
        toast({ title: 'Brak poprawnych danych do importu', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Import nieudany', description: e?.message || 'Upewnij się, że to plik JSON.', variant: 'destructive' });
    }
  };

  const openInEditor = async (id: string) => {
    try {
      const resp = await apiFetch<{ game: { id: string; name: string; blocks: any } }>(`/games/${id}`);
      const projectData = {
        id: resp.game.id,
        name: resp.game.name,
        blocks: resp.game.blocks,
        timestamp: new Date().toISOString(),
        version: '1.2.0',
      };
      localStorage.setItem('sandbox-current-project', JSON.stringify(projectData));
      const slug = encodeURIComponent(resp.game.name.trim().replace(/\s+/g, '-').toLowerCase());
      navigate(`/editor/${slug}`);
    } catch {
      toast({ title: 'Nie udało się otworzyć projektu', description: 'Spróbuj ponownie.', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-bg">
      <Navbar />
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">
            <span className="align-middle">Twoje gry</span>
            <span className="ml-3 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: 'hsl(var(--brand-build))' }} />
          </h1>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportJson(f);
                e.currentTarget.value = '';
              }}
              id="import-json-input"
            />
            <Button variant="outline" onClick={() => document.getElementById('import-json-input')?.click()}>
              <Upload className="mr-1" /> Import JSON
            </Button>
            <Button variant="hero" onClick={() => navigate('/editor/nowy-projekt')}>Nowy projekt</Button>
          </div>
        </div>

        <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl">
          <CardHeader>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg">Zapisane projekty</CardTitle>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex-1 sm:flex-none">
                    <Input placeholder="Szukaj gier…" value={query} onChange={(e) => setQuery(e.target.value)} />
                  </div>
                  <Select value={sort} onValueChange={(v) => setSort(v as any)}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Sortowanie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="updated_desc">Ostatnio aktualizowane</SelectItem>
                      <SelectItem value="updated_asc">Najdawniej aktualizowane</SelectItem>
                      <SelectItem value="name_asc">Nazwa A–Z</SelectItem>
                      <SelectItem value="name_desc">Nazwa Z–A</SelectItem>
                    </SelectContent>
                  </Select>
                  <ToggleGroup type="single" value={statusFilter} onValueChange={(v) => setStatusFilter((v || 'all') as any)}>
                    <ToggleGroupItem value="all" aria-label="Wszystkie">Wszystkie</ToggleGroupItem>
                    <ToggleGroupItem value="published" aria-label="Opublikowane">Opublikowane</ToggleGroupItem>
                    <ToggleGroupItem value="drafts" aria-label="Szkice">Szkice</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">Razem: {stats.total}</Badge>
                <Badge variant="outline"><Globe className="h-3 w-3 mr-1" /> Opublikowane: {stats.published}</Badge>
                <Badge variant="outline"><EyeOff className="h-3 w-3 mr-1" /> Szkice: {stats.drafts}</Badge>
                {stats.lastUpdated && (
                  <span>Ostatnia zmiana: {stats.lastUpdated.toLocaleDateString()}</span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {hasSelection && (
              <div className="mb-4 flex flex-wrap items-center gap-2 justify-between bg-accent/40 border border-border rounded-md p-3">
                <div className="flex items-center gap-3">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAllVisible as any} />
                  <span className="text-sm">Zaznaczone: {selectedIds.size}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => bulkPublish(true)} className="text-[hsl(var(--brand-market))] border-[hsl(var(--brand-market))]/30 hover:bg-[hsl(var(--brand-market))]/10"><Globe /> Opublikuj</Button>
                  <Button size="sm" variant="outline" onClick={() => bulkPublish(false)}><EyeOff /> Cofnij publikację</Button>
                  <Button size="sm" variant="outline" onClick={exportSelected}><Download /> Eksport JSON</Button>
                  <Button size="sm" variant="destructive" onClick={bulkDelete}><Trash2 /> Usuń</Button>
                </div>
              </div>
            )}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredGames.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Brak gier. Zapisz projekt w edytorze, <Button variant="link" className="px-1" onClick={() => navigate('/editor/nowy-projekt')}>utwórz nowy</Button>
                lub <Button variant="link" className="px-1" onClick={() => document.getElementById('import-json-input')?.click()}>zaimportuj z JSON</Button>.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGames.map((g) => (
                  <Card key={g.id} className="border-border overflow-hidden">
                    <CardContent className="p-0">
                      {g.thumbnail ? (
                        <div className="h-24 bg-card/60">
                          <img src={g.thumbnail} alt={g.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <LazyMiniPreview gameId={g.id} initialBlocks={g.blocks as Block[] | undefined} />
                      )}
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Checkbox checked={selectedIds.has(g.id)} onCheckedChange={() => toggleSelectOne(g.id)} />
                            <div className="font-medium truncate" title={g.name}>{g.name}</div>
                            {typeof g.published !== 'undefined' && (
                              <Badge variant={g.published ? 'default' : 'secondary'} className="hidden sm:inline-flex">
                                {g.published ? 'Opublikowana' : 'Szkic'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openInEditor(g.id)}>Otwórz</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => startRename(g.id, g.name)}>
                                  <Edit className="mr-2 h-4 w-4" /> Zmień nazwę
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(g.id, g.name)} disabled={duplicating === g.id}>
                                  <Copy className="mr-2 h-4 w-4" /> {duplicating === g.id ? 'Duplikowanie…' : 'Duplikuj'}
                                </DropdownMenuItem>
                                {g.published ? (
                                  <DropdownMenuItem onClick={() => togglePublish(g.id, false)}>
                                    Ukryj (cofnij publikację)
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => togglePublish(g.id, true)}>
                                    Opublikuj
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => setDeletingId(g.id)} className="text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" /> Usuń
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div>Aktualizacja: {new Date(g.updatedAt).toLocaleDateString()}</div>
                          <div className="flex items-center gap-2">
                            {g.published && (
                              <Button size="sm" variant="success" onClick={() => navigate(`/play/${g.id}`)}>
                                <PlayIcon className="mr-1 h-4 w-4" /> Zagraj
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => openInEditor(g.id)} className="text-[hsl(var(--brand-build))] border-[hsl(var(--brand-build))]/30 hover:bg-[hsl(var(--brand-build))]/10">
                              <CheckSquare className="mr-1" /> Otwórz
                            </Button>
                            {typeof (g as any)._count?.likes === 'number' && (
                              <Badge variant="outline">❤ {(g as any)._count.likes}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rename dialog */}
        <Dialog open={renameOpen} onOpenChange={(o) => { setRenameOpen(o); if (!o) { setActiveGameId(null); setRenameName(''); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Zmień nazwę projektu</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Nazwa</Label>
              <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} placeholder="Nowa nazwa" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenameOpen(false)}>Anuluj</Button>
              <Button onClick={submitRename} disabled={renaming || !renameName.trim()}>{renaming ? 'Zapisywanie…' : 'Zapisz'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <AlertDialog open={!!deletingId} onOpenChange={(o) => { if (!o) setDeletingId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Usunąć projekt?</AlertDialogTitle>
              <AlertDialogDescription>Tej operacji nie można cofnąć.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Anuluj</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Usuń</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default UserGames;