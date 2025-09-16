import { memo, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, Heart, Sparkles } from 'lucide-react';

type PublishedGame = {
  id: string;
  name: string;
  updatedAt: string;
  ownerName?: string;
  thumbnail?: string | null;
  likes?: number;
  views?: number;
};

type ExploreGridProps = {
  filtered: PublishedGame[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  total: number;
  totalPages: number;
  page: number;
  limit: number;
  tab: 'trending' | 'latest' | 'friends';
  canCreateProjects: boolean;
  onlineMap: Record<string, number>;
  formatCount: (n: number | undefined | null) => string;
  onNavigateTo: (path: string) => void;
  onOpenInEditor?: (id: string, name: string) => void;
  canOpenOthersInEditor?: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onRetry: () => void;
  onClearFilters: () => void;
  loadMoreRef: React.RefObject<HTMLDivElement>;
  renderThumbnail: (g: PublishedGame, index: number, priority: boolean) => React.ReactNode;
};

const ExploreGrid = memo((props: ExploreGridProps) => {
  const {
    filtered,
    loading,
    loadingMore,
    error,
    total,
    totalPages,
    page,
    limit,
    tab,
    canCreateProjects,
    onlineMap,
    formatCount,
    onNavigateTo,
    onOpenInEditor,
    canOpenOthersInEditor,
    onPrevPage,
    onNextPage,
    onRetry,
    onClearFilters,
    loadMoreRef,
    renderThumbnail,
  } = props;

  // Re-observe sentinel if needed when page changes (parent creates observer)
  const sentinelRef = useRef(loadMoreRef.current);
  useEffect(() => { sentinelRef.current = loadMoreRef.current; }, [loadMoreRef]);

  return (
    <div className="space-y-6">
      {error ? (
        <Card className="voxel-surface voxel-bevel voxel-grid-lg voxel-pixel-bevel">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-medium text-destructive">Nie udało się załadować</div>
                <div className="text-sm text-muted-foreground">{error}</div>
              </div>
              <Button variant="outline" size="sm" onClick={onRetry}>
                🔄 Spróbuj ponownie
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden voxel-surface voxel-grid-lg voxel-pixel-bevel">
              <div className="h-48 shimmer" />
              <CardContent className="p-5 space-y-4">
                <div className="h-5 w-3/4 shimmer rounded" />
                <div className="h-4 w-1/2 shimmer rounded" />
                <div className="flex gap-2 pt-2">
                  <div className="h-8 w-20 shimmer rounded" />
                  <div className="h-8 w-16 shimmer rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="voxel-surface voxel-bevel voxel-grid-lg voxel-pixel-bevel">
          <CardContent className="p-12 text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Brak światów do odkrycia</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Społeczność nie opublikowała jeszcze żadnych światów.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button variant="hero" onClick={() => onNavigateTo(canCreateProjects ? '/editor/nowy-projekt' : '/login')}>
                {canCreateProjects ? '🌟 Stwórz Pierwszy' : '🚀 Zaloguj i Twórz'}
              </Button>
              <Button variant="outline" onClick={onClearFilters}>✨ Wyczyść filtry</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-8">
          {filtered.map((g, index) => {
            const isFeatured = index < 3 && tab === 'trending' && page === 1;
            return (
              <Card 
                key={g.id} 
                className="group overflow-hidden voxel-surface voxel-contrast-card voxel-pixel-bevel cursor-pointer hover:-translate-y-0.5 transition-transform hover:border-primary/40 hover:shadow-lg"
                role="button"
                tabIndex={0}
                onClick={() => onNavigateTo(`/play/${g.id}`)}
                onKeyDown={(e) => { if ((e as any).key === 'Enter') onNavigateTo(`/play/${g.id}`); }}
              >
                <div className="relative overflow-hidden">
                  <div className={`relative overflow-hidden ${isFeatured ? 'bg-gradient-to-br from-primary/10 to-accent/10' : 'bg-gradient-to-br from-primary/5 to-accent/5'}`}>
                    <div className="pt-[66%]" />
                    <div className="absolute inset-0">
                      {renderThumbnail(g, index, index < 3 && page === 1)}
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background/85 via-background/40 to-transparent" />
                    <div className="absolute top-3 left-3 z-10">
                      <div className="inline-flex items-center gap-2 rounded-full bg-black/45 text-white border border-white/10 backdrop-blur px-2 py-1">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--brand-build))]/30 to-[hsl(var(--brand-news))]/30 text-[10px] font-semibold border border-white/10">
                          {(g.ownerName || 'A')[0]?.toUpperCase()}
                        </span>
                        <span className="truncate max-w-[120px] text-xs">
                          {g.ownerName || 'Anonimowy Twórca'}
                        </span>
                      </div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 z-10 p-3">
                      <div className="mb-3 text-center">
                        <div className="text-white font-semibold text-lg truncate voxel-title" title={g.name}>
                          {g.name}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="inline-flex items-center gap-1.5 rounded-full bg-black/45 text-white border border-white/10 backdrop-blur px-2 py-1 cursor-default select-none">
                                <span className={`h-1.5 w-1.5 rounded-full ${((onlineMap[g.id] ?? 0) > 0) ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-400'}`} />
                                <Users className="h-3.5 w-3.5 text-emerald-300" />
                                <span className="text-xs tabular-nums">{formatCount(onlineMap[g.id] ?? 0)}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Gracze online</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button 
                          size="sm" 
                          variant="default" 
                          onClick={(e) => { e.stopPropagation(); onNavigateTo(`/play/${g.id}`); }}
                          className="pointer-events-auto bg-success text-success-foreground hover:bg-success/90 border border-success/30 shadow-lg hover:shadow-success-glow transition-all font-semibold"
                        >
                          ▶️ Zagraj
                        </Button>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="inline-flex items-center gap-1.5 rounded-full bg-black/45 text-white border border-white/10 backdrop-blur px-2 py-1 cursor-default select-none">
                                <Heart className="h-3.5 w-3.5 text-rose-300" />
                                <span className="text-xs tabular-nums">{formatCount(g.likes || 0)}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Polubienia</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                </div>
                <CardContent className="p-5">
                  <div className="flex items-center justify-end pt-2">
                    <div className="flex items-center gap-2 opacity-100">
                      {canOpenOthersInEditor && onOpenInEditor && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={(e) => { e.stopPropagation(); onOpenInEditor(g.id, g.name); }}
                          className="text-primary hover:text-primary hover:bg-primary/20 hover:shadow-sm transition-all"
                        >
                          ✏️ Edytuj
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {total > 0 && totalPages > 1 && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="text-xs text-muted-foreground">
            Strona <span className="text-foreground font-medium">{page}</span> z <span className="text-foreground font-medium">{totalPages}</span>
            <span className="hidden sm:inline"> • {total} {total === 1 ? 'gra' : total < 5 ? 'gry' : 'gier'} łącznie</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevPage}
              disabled={page === 1}
            >
              ← Poprzednia
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNextPage}
              disabled={page * limit >= total}
            >
              Następna →
            </Button>
          </div>
        </div>
      )}

      <div ref={loadMoreRef} className="h-10" />
      {loadingMore && (
        <div className="mt-4 text-center text-sm text-muted-foreground">Ładowanie…</div>
      )}
    </div>
  );
});

export default ExploreGrid;


