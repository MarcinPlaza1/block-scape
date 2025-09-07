import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import Navbar from '@/components/Navbar';
import heroScene from '@/assets/hero-scene.jpg';
import MiniPreview from '@/components/MiniPreview';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Hammer, Share2, Sparkles, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Block } from '@/types/project';

type PublishedGame = {
  id: string;
  name: string;
  updatedAt: string;
  ownerName?: string;
  thumbnail?: string | null;
  likes?: number;
};
type NewsItem = { id: string; title: string; description: string; image?: string; date?: string; category?: string; href?: string };
type Creator = { id: string; name: string; avatarUrl?: string | null; creations: number; likes?: number };

const Home = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<PublishedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc'>('updated_desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [lastProject, setLastProject] = useState<{ name: string; timestamp?: string } | null>(null);
  const [demoBlocks, setDemoBlocks] = useState<Block[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [tab, setTab] = useState<'trending' | 'latest'>('trending');
  const [showHero, setShowHero] = useState<boolean>(true);
  const [showDemo, setShowDemo] = useState<boolean>(true);

  useEffect(() => {
    // SEO: per-route meta
    document.title = 'Block‑Scape Studio — Twórz i graj w światy 3D';
    const ensureMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    ensureMeta('description', 'Zbuduj własny świat 3D w przeglądarce. Twórz, buduj i udostępniaj.');
  }, []);

  // Hide hero if previously dismissed for a period
  useEffect(() => {
    try {
      const raw = localStorage.getItem('home-hero-hidden-until');
      const until = raw ? parseInt(raw, 10) : 0;
      if (Number.isFinite(until) && Date.now() < until) setShowHero(false);
    } catch {}
  }, []);

  // Auto-hide hero after a short time (respectful nudge)
  useEffect(() => {
    if (!showHero) return;
    const t = window.setTimeout(() => { hideHero(); }, 10000);
    return () => window.clearTimeout(t);
  }, [showHero]);

  const hideHero = (rememberDays: number = 7) => {
    setShowHero(false);
    try { localStorage.setItem('home-hero-hidden-until', String(Date.now() + rememberDays * 24 * 60 * 60 * 1000)); } catch {}
  };

  // Demo card hide/show memory
  useEffect(() => {
    try {
      const raw = localStorage.getItem('home-demo-hidden-until');
      const until = raw ? parseInt(raw, 10) : 0;
      if (Number.isFinite(until) && Date.now() < until) setShowDemo(false);
    } catch {}
  }, []);

  useEffect(() => {
    if (!showDemo) return;
    const t = window.setTimeout(() => { hideDemo(); }, 10000);
    return () => window.clearTimeout(t);
  }, [showDemo]);

  const hideDemo = (rememberDays: number = 7) => {
    setShowDemo(false);
    try { localStorage.setItem('home-demo-hidden-until', String(Date.now() + rememberDays * 24 * 60 * 60 * 1000)); } catch {}
  };

  useEffect(() => {
    let mounted = true;
    let abort = new AbortController();
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        setError(null);
        const trendingSort = tab === 'trending' ? 'likes_desc' : sort;
        const params = new URLSearchParams({ page: String(page), limit: String(limit), sort: trendingSort, q: query });
        const resp = await apiFetch<{ games: PublishedGame[]; total: number; page: number; limit: number }>(`/games?${params.toString()}`, { method: 'GET', signal: abort.signal as any });
        if (!mounted) return;
        setGames(resp.games || []);
        setTotal(resp.total || 0);
      } catch (e: any) {
        if (!mounted || e?.name === 'AbortError') return;
        setGames([]);
        setTotal(0);
        setError('Nie udało się załadować listy gier.');
      } finally {
        if (mounted) setLoading(false);
      }
    }, 200);
    return () => {
      mounted = false;
      try { abort.abort(); } catch {}
      window.clearTimeout(handle);
    };
  }, [page, limit, sort, query, reloadKey, tab]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sandbox-current-project');
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p && p.name) setLastProject({ name: p.name, timestamp: p.timestamp });
    } catch {}
  }, []);

  useEffect(() => {
    // Load demo blocks for mini-preview
    (async () => {
      try {
        const resp = await apiFetch<{ game: { blocks: Block[] } }>(`/games/demo/public`);
        setDemoBlocks(Array.isArray(resp.game.blocks) ? resp.game.blocks : []);
      } catch {}
    })();
    // Load dynamic news and creators
    (async () => {
      try {
        const n = await apiFetch<{ news: NewsItem[] }>(`/news`);
        setNewsItems(Array.isArray(n.news) ? n.news : []);
      } catch { setNewsItems([]); }
      try {
        const c = await apiFetch<{ creators: Creator[] }>(`/creators/top`);
        setCreators(Array.isArray(c.creators) ? c.creators : []);
      } catch { setCreators([]); }
    })();
  }, []);

  const retryFetch = () => setReloadKey((k) => k + 1);

  const filtered = useMemo(() => games, [games]);
  const featuredGames = useMemo(() => {
    const list = [...games];
    list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return list.slice(0, 6);
  }, [games]);

  const openInEditor = async (id: string, name: string) => {
    try {
      // Use public endpoint to allow opening published games without requiring auth
      const resp = await apiFetch<{ game: { id: string; name: string; blocks: any } }>(`/games/${id}/public`);
      const projectData = {
        id: resp.game.id,
        name: resp.game.name,
        blocks: resp.game.blocks,
        timestamp: new Date().toISOString(),
        version: '1.2.0',
      };
      localStorage.setItem('sandbox-current-project', JSON.stringify(projectData));
      const slug = encodeURIComponent((name || resp.game.name).trim().toLowerCase().replace(/\s+/g, '-'));
      navigate(`/editor/${slug}`);
    } catch {}
  };

  return (
    <div className="min-h-screen w-full bg-gradient-bg">
      <Navbar />

      {/* Hero section (auto-dismissable) */}
      {showHero && (
        <div className="relative">
          <div
            className="absolute inset-0 opacity-35"
            style={{ backgroundImage: `url(${heroScene})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/70 to-background" />
          <button
            onClick={() => hideHero()}
            className="absolute top-3 right-3 z-10 bg-card/70 border border-border rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Zamknij baner"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative max-w-6xl mx-auto px-6 pt-10 pb-6">
            <div className="flex flex-col gap-4">
              <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
                Twórz, graj i publikuj światy 3D — wszystko w przeglądarce
              </h1>
              <p className="text-muted-foreground max-w-2xl">
                Zbuduj własny świat w edytorze sandboxowym, zapisz w chmurze i podziel się z innymi. Zero instalacji.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <Button variant="hero" size="lg" onClick={() => navigate('/editor/nowy-projekt')}>
                  Zbuduj świat
                </Button>
                <Button variant="success" size="lg" onClick={() => navigate('/play/demo')}>
                  Zagraj teraz
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-12 p-6">
        {/* Featured onboarding moved below main content */}
        {/* Onboarding: 3 steps */}
        <section className="order-3 lg:order-none hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Stwórz</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>Rozpocznij nowy projekt jednym kliknięciem i puść wodze wyobraźni.</p>
                <Button size="sm" onClick={() => navigate('/editor/nowy-projekt')}>Nowy projekt</Button>
              </CardContent>
            </Card>
            <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Hammer className="h-4 w-4 text-primary" /> Buduj</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>Używaj bloków, siatki i fizyki, aby tworzyć interaktywne światy 3D.</p>
                <Button size="sm" variant="outline" onClick={() => navigate('/games')}>Otwórz swoje projekty</Button>
              </CardContent>
            </Card>
            <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Share2 className="h-4 w-4 text-primary" /> Udostępnij</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>Publikuj, graj ze znajomymi i dziel się linkiem do swojej gry.</p>
                <Button size="sm" variant="secondary" onClick={() => navigate('/news')}>Zobacz poradniki</Button>
              </CardContent>
            </Card>
          </div>
        </section>
        {lastProject && (
          <section>
            <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl">
              <CardHeader>
                <CardTitle className="text-lg">Kontynuuj ostatni projekt</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate" title={lastProject.name}>{lastProject.name}</div>
                  {lastProject.timestamp && (
                    <div className="text-xs text-muted-foreground mt-1">Ostatnio: {new Date(lastProject.timestamp).toLocaleString()}</div>
                  )}
                </div>
                <Button onClick={() => {
                  try {
                    const raw = localStorage.getItem('sandbox-current-project');
                    if (!raw) return;
                    const p = JSON.parse(raw);
                    const slug = encodeURIComponent((p.name || 'projekt').trim().toLowerCase().replace(/\s+/g, '-'));
                    navigate(`/editor/${slug}`);
                  } catch {}
                }}>Kontynuuj</Button>
              </CardContent>
            </Card>
          </section>
        )}
        {featuredGames.length > 0 && (
          <section>
            <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl">
              <CardHeader>
                <CardTitle className="text-lg">Polecane światy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Carousel>
                    <CarouselContent className="-ml-2 md:-ml-4">
                      {featuredGames.map((g) => (
                        <CarouselItem key={g.id} className="pl-2 md:pl-4 basis-full md:basis-1/2 lg:basis-1/3">
                          <Card className="border-border overflow-hidden group">
                            <CardContent className="p-0">
                              {g.thumbnail ? (
                                <div className="h-36 bg-card/60">
                                  <img src={g.thumbnail} alt={g.name} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="h-36 bg-gradient-to-br from-primary/10 to-accent/10" />
                              )}
                              <div className="p-4 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium truncate" title={g.name}>{g.name}</div>
                                  <div className="text-xs text-muted-foreground mt-1">Aktualizacja: {new Date(g.updatedAt).toLocaleDateString()}</div>
                                </div>
                                <Button size="sm" onClick={() => openInEditor(g.id, g.name)}>
                                  Otwórz
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="-left-3 md:-left-6" />
                    <CarouselNext className="-right-3 md:-right-6" />
                  </Carousel>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <section className="lg:col-span-2 order-1">
            <div className="sticky top-0 z-10 -mt-6 mb-6 pt-4 pb-4 bg-card/80 supports-[backdrop-filter]:bg-background/60 backdrop-blur-md border border-border rounded-lg shadow-md">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">Opublikowane gry</h2>
                <Button variant="hero" onClick={() => navigate('/editor/nowy-projekt')}>Zbuduj</Button>
              </div>
              <div className="mt-3 w-full">
                <div className="flex items-center gap-4 bg-card/60 border border-border rounded-lg p-3">
                  <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setPage(1); }}>
                    <TabsList className="bg-secondary/60 rounded-lg">
                      <TabsTrigger value="trending" className="data-[state=active]:text-primary">Trendy</TabsTrigger>
                      <TabsTrigger value="latest" className="data-[state=active]:text-primary">Najnowsze</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="flex-1">
                    <Input
                      placeholder="Szukaj gier…"
                      value={query}
                      onChange={(e) => { setPage(1); setQuery(e.target.value); }}
                    />
                  </div>
                  {tab === 'latest' && (
                    <Select
                      value={sort}
                      onValueChange={(v) => { setPage(1); setSort(v as any); }}
                    >
                      <SelectTrigger className="w-[220px] rounded-lg bg-input border-input">
                        <SelectValue placeholder="Sortowanie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="updated_desc">Ostatnio aktualizowane</SelectItem>
                        <SelectItem value="updated_asc">Najdawniej aktualizowane</SelectItem>
                        <SelectItem value="name_asc">Nazwa A–Z</SelectItem>
                        <SelectItem value="name_desc">Nazwa Z–A</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Select
                    value={String(limit)}
                    onValueChange={(v) => { const n = parseInt(v, 10); setPage(1); setLimit(Number.isNaN(n) ? 12 : n); }}
                  >
                    <SelectTrigger className="w-[140px] rounded-lg bg-input border-input">
                      <SelectValue placeholder="Na stronę" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">12 / stronę</SelectItem>
                      <SelectItem value="24">24 / stronę</SelectItem>
                      <SelectItem value="48">48 / stronę</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl">
              <CardContent className="pt-4">
                {error ? (
                  <div className="flex items-center justify-between bg-accent/40 border border-border rounded-md p-3">
                    <div className="text-sm text-destructive">{error}</div>
                    <Button variant="outline" size="sm" onClick={retryFetch}>Spróbuj ponownie</Button>
                  </div>
                ) : loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Card key={i} className="border-border">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-36" />
                          </div>
                          <div className="flex gap-2">
                            <Skeleton className="h-8 w-24" />
                            <Skeleton className="h-8 w-8" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center bg-secondary/40 border border-border rounded-lg p-6">
                    <Sparkles className="h-6 w-6 text-primary mb-2" />
                    <div className="text-sm text-muted-foreground mb-3">Brak opublikowanych gier.</div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="hero" onClick={() => navigate('/editor/nowy-projekt')}>Zbuduj świat</Button>
                      <Button size="sm" variant="outline" onClick={() => { setQuery(''); setTab('trending'); setPage(1); }}>Wyczyść filtry</Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filtered.map((g) => (
                      <Card key={g.id} className="border-border">
                        <CardContent className="p-0">
                          {g.thumbnail ? (
                            <div className="h-28 bg-card/60">
                              <img src={g.thumbnail} alt={g.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="h-28 bg-gradient-to-br from-primary/10 to-accent/10" />
                          )}
                          <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium truncate" title={g.name}>{g.name}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">Autor: {g.ownerName || 'Użytkownik'}</div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="success" onClick={() => navigate(`/play/${g.id}`)}>
                              Zagraj
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openInEditor(g.id, g.name)} className="text-[hsl(var(--brand-build))] border-[hsl(var(--brand-build))]/30 hover:bg-[hsl(var(--brand-build))]/10">
                              Otwórz w edytorze
                            </Button>
                          </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                {total > 0 ? `Znaleziono ${total} gier` : 'Brak wyników'}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Poprzednia</Button>
                {/* Numeric pagination */}
                {Array.from({ length: Math.min(7, Math.max(1, Math.ceil(total / limit))) }).map((_, i) => {
                  const totalPages = Math.max(1, Math.ceil(total / limit));
                  const center = Math.min(Math.max(page, 4), totalPages - 3);
                  const num = totalPages <= 7 ? i + 1 : center + (i - 3);
                  if (num < 1 || num > totalPages) return null;
                  return (
                    <Button key={i} variant={num === page ? 'default' : 'outline'} size="sm" onClick={() => setPage(num)}>{num}</Button>
                  );
                })}
                <Button variant="outline" size="sm" onClick={() => setPage((p) => (p * limit < total ? p + 1 : p))} disabled={page * limit >= total}>Następna</Button>
              </div>
            </div>
          </section>

          <aside className="space-y-8 order-2">
            {showDemo && (
              <section>
                <div className="relative">
                  <button
                    onClick={() => hideDemo()}
                    className="absolute top-2 right-2 z-10 bg-card/70 border border-border rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label="Zamknij sekcję demo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl">
                    <CardHeader>
                      <CardTitle className="text-lg">Wypróbuj demo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="w-full h-40 bg-card/60 border border-border rounded-md overflow-hidden mb-3">
                        <MiniPreview className="w-full h-full" blocks={demoBlocks} />
                      </div>
                      <Button className="w-full" onClick={() => navigate('/play/demo')}>Zagraj teraz</Button>
                    </CardContent>
                  </Card>
                </div>
              </section>
            )}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Co nowego?</h2>
              <div className="space-y-4">
                {newsItems.map((item) => (
                  <Card key={item.id} className="border-border overflow-hidden group hover:border-primary/50 transition-all">
                    <CardContent className="p-0">
                      {item.image ? (
                        <div className="h-28 bg-card/60">
                          <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-28 bg-gradient-to-br from-secondary to-accent" />
                      )}
                      <div className="p-4">
                        <Badge variant="secondary" className="mb-2" style={{ color: 'hsl(var(--brand-news))' }}>{item.category}</Badge>
                        <div className="font-medium truncate mb-1">{item.title}</div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{item.description}</p>
                        <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => navigate(item.href || `/news/${item.id}`)}>
                          Czytaj więcej <ArrowRight className="ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Top twórcy</h2>
              <div className="space-y-3">
                {creators.map((creator) => (
                  <Card key={creator.id} className="border-border hover:bg-accent/50 transition-all">
                    <CardContent className="p-3 flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        {creator.avatarUrl ? <AvatarImage src={creator.avatarUrl} /> : <AvatarImage src="/avatar-default.svg" />}
                        <AvatarFallback>{creator.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{creator.name}</div>
                        <div className="text-xs text-muted-foreground">{creator.creations} kreacje • ❤ {creator.likes || 0}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate('/profile')}>Profil</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
            {/* Onboarding at bottom for guidance without overshadowing games */}
            <section className="hidden lg:block">
              <div className="grid grid-cols-1 gap-4">
                <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Stwórz</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-3">
                    <p>Rozpocznij nowy projekt jednym kliknięciem i puść wodze wyobraźni.</p>
                    <Button size="sm" onClick={() => navigate('/editor/nowy-projekt')}>Nowy projekt</Button>
                  </CardContent>
                </Card>
                <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><Hammer className="h-4 w-4 text-primary" /> Buduj</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-3">
                    <p>Używaj bloków, siatki i fizyki, aby tworzyć interaktywne światy 3D.</p>
                    <Button size="sm" variant="outline" onClick={() => navigate('/games')}>Otwórz swoje projekty</Button>
                  </CardContent>
                </Card>
                <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><Share2 className="h-4 w-4 text-primary" /> Udostępnij</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-3">
                    <p>Publikuj, graj ze znajomymi i dziel się linkiem do swojej gry.</p>
                    <Button size="sm" variant="secondary" onClick={() => navigate('/news')}>Zobacz poradniki</Button>
                  </CardContent>
                </Card>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Home;


