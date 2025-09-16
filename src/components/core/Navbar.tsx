import { Button } from '@/components/ui/button';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/lib/store';
import { LogIn, UserPlus, MessageCircle, Boxes, Search, X, Filter, User, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { useEffect, useRef, useState, memo, useDeferredValue } from 'react';
import { apiFetch } from '@/lib/api';

// Lightweight client-side chunk prefetching for lazy routes
const __prefetchedChunks: Record<string, boolean> = {};
const prefetchChunk = (key: string, loader: () => Promise<unknown>) => {
  if (__prefetchedChunks[key]) return;
  __prefetchedChunks[key] = true;
  try { void loader().catch(() => {}); } catch {}
};

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const { 
    isLoggedIn, 
    canAccessGames, 
    canAccessMarketplace, 
    user,
    userName 
  } = usePermissions();

  const isActive = (match: (p: string) => boolean) => match(path);
  
  // Global search state (navbar)
  const [searchText, setSearchText] = useState('');
  const deferredSearchText = useDeferredValue(searchText);
  const [authorFilter, setAuthorFilter] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [openSuggestions, setOpenSuggestions] = useState(false);
  const [suggestGames, setSuggestGames] = useState<Array<{ id: string; name: string; ownerName?: string }>>([]);
  const [suggestAuthors, setSuggestAuthors] = useState<string[]>([]);
  const suggestionsAbortRef = useRef<AbortController | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  
  useEffect(() => {
    if (!deferredSearchText || deferredSearchText.trim().length < 2) {
      setSuggestGames([]);
      setSuggestAuthors([]);
      return;
    }
    const ctrl = new AbortController();
    try { suggestionsAbortRef.current?.abort(); } catch {}
    suggestionsAbortRef.current = ctrl;
    const t = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ page: '1', limit: '5', q: deferredSearchText.trim() });
        const resp = await apiFetch<{ games: Array<{ id: string; name: string; ownerName?: string }> }>(`/games?${params.toString()}`, { method: 'GET', signal: ctrl.signal as any });
        const games = Array.isArray(resp?.games) ? resp.games : [];
        setSuggestGames(games);
        const authors = Array.from(new Set(games.map(g => (g.ownerName || 'Użytkownik').trim()))).slice(0, 5);
        setSuggestAuthors(authors);
      } catch (e: any) {
        if (!ctrl.signal.aborted) { setSuggestGames([]); setSuggestAuthors([]); }
      }
    }, 180);
    return () => { window.clearTimeout(t); try { ctrl.abort(); } catch {} };
  }, [deferredSearchText]);
  
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const root = searchBoxRef.current;
      if (!root) return;
      if (!(root as any).contains(e.target as Node)) setOpenSuggestions(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);
  
  const addTag = (t: string) => {
    const v = t.trim();
    if (!v) return;
    setTags(prev => (prev.includes(v) ? prev : [...prev, v]));
    setTagInput('');
  };
  
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));
  
  const applySearch = (opts?: { q?: string; author?: string; tags?: string[] }) => {
    const q = (opts?.q ?? searchText).trim();
    const author = (opts?.author ?? authorFilter).trim();
    const tagList = (opts?.tags ?? tags).map(x => x.trim()).filter(Boolean);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (author) params.set('author', author);
    if (tagList.length) params.set('tags', tagList.join(','));
    navigate(`/${params.toString() ? `?${params.toString()}` : ''}`);
    setOpenSuggestions(false);
  };
  
  // Don't show navbar on login page
  if (path === '/login') {
    return null;
  }

  return (
    <div className="w-full bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="group flex items-center gap-2 rounded-md px-1 py-1 text-sm font-semibold text-foreground hover:text-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition"
          aria-label="Block‑Scape Studio - Strona główna"
          title="Block‑Scape Studio"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-[hsl(var(--brand-news))] text-background shadow-sm">
            <Boxes className="h-4 w-4" />
          </span>
          <span className="whitespace-nowrap">Block‑Scape Studio</span>
        </button>

        {/* Nawigacja główna (lewa): Gry, Aktualności */}
        <div className="flex items-center gap-1 ml-4">
          <Button
            variant={isActive(p => p === '/' ) ? 'default' : 'ghost'}
            onClick={() => navigate('/')}
          >
            Gry
          </Button>
          <Button
            variant={isActive(p => p.startsWith('/news')) ? 'default' : 'ghost'}
            onMouseEnter={() => prefetchChunk('news', () => import('@/pages/News'))}
            onClick={() => navigate('/news')}
          >
            Aktualności
          </Button>
          {isLoggedIn && (
            <Button
              variant={isActive(p => p.startsWith('/skin-studio')) ? 'default' : 'ghost'}
              onMouseEnter={() => prefetchChunk('skin-studio', () => import('@/pages/SkinStudio'))}
              onClick={() => navigate('/skin-studio')}
            >
              Skin Studio
            </Button>
          )}
        </div>

        {/* Global search (center) */}
        <div className="hidden md:flex flex-1 justify-center mx-4">
          <div className="relative w-full max-w-lg" ref={searchBoxRef}>
            <div className="flex items-center rounded-full border border-border bg-background/80 backdrop-blur px-2.5 py-1 focus-within:ring-2 focus-within:ring-ring">
              <Search className="mr-2 h-3 w-3 text-muted-foreground" />
              <input
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setOpenSuggestions(true); }}
                onFocus={() => setOpenSuggestions(true)}
                onKeyDown={(e) => {
                  if ((e as any).key === 'Enter') applySearch();
                  if ((e as any).key === 'Escape') setOpenSuggestions(false);
                }}
                placeholder="Szukaj światów, autorów..."
                className="w-full bg-transparent outline-none text-sm h-8"
                aria-label="Globalne wyszukiwanie"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => { setSearchText(''); setOpenSuggestions(false); }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Wyczyść"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="ml-1 h-7 w-7 rounded-full p-0" aria-label="Filtry wyszukiwania">
                    <Filter className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="center" className="w-96">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Autor</div>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={authorFilter}
                          onChange={(e) => setAuthorFilter(e.target.value)}
                          placeholder="np. Anna"
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Tagi</div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => { if ((e as any).key === 'Enter') addTag(tagInput); }}
                            placeholder="Dodaj tag i naciśnij Enter"
                            className="pl-9"
                          />
                        </div>
                        <Button size="sm" variant="outline" onClick={() => addTag(tagInput)}>Dodaj</Button>
                      </div>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {tags.map((t) => (
                            <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs">
                              <Tag className="h-3 w-3" />
                              <span>{t}</span>
                              <button aria-label={`Usuń tag ${t}`} onClick={() => removeTag(t)} className="text-muted-foreground hover:text-foreground">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setAuthorFilter(''); setTags([]); }}>Wyczyść</Button>
                      <Button size="sm" onClick={() => applySearch()}>Zastosuj</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {openSuggestions && (suggestGames.length > 0 || suggestAuthors.length > 0) && (
              <div className="absolute z-50 mt-1.5 w-full rounded-lg border bg-popover shadow-lg overflow-hidden">
                <Command className="rounded-none">
                  <CommandList>
                    <CommandEmpty>Brak sugestii</CommandEmpty>
                    {suggestGames.length > 0 && (
                      <CommandGroup heading="Światy" className="text-xs">
                        {suggestGames.map((g) => (
                          <CommandItem key={g.id} value={g.name} onSelect={() => navigate(`/play/${g.id}`)}>
                            <span className="truncate text-sm">{g.name}</span>
                            <span className="ml-auto text-[11px] text-muted-foreground">{g.ownerName || 'Twórca'}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {suggestAuthors.length > 0 && (
                      <CommandGroup heading="Autorzy" className="text-xs">
                        {suggestAuthors.map((a) => (
                          <CommandItem key={a} value={a} onSelect={() => applySearch({ author: a })}>
                            <User className="mr-2 h-3 w-3" />
                            <span className="text-sm">{a}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </div>
            )}
          </div>
        </div>

        {/* Akcje (prawa): dla zalogowanych + logowanie/rejestracja */}
        <div className="ml-auto flex items-center gap-1">
          {isLoggedIn && canAccessGames && (
            <Button
              variant={isActive(p => p.startsWith('/games')) ? 'default' : 'ghost'}
              onMouseEnter={() => prefetchChunk('user-games', () => import('@/pages/UserGames'))}
              onClick={() => navigate('/games')}
            >
              Moje Projekty
            </Button>
          )}

          {isLoggedIn && canAccessMarketplace && (
            <Button
              variant={isActive(p => p.startsWith('/marketplace')) ? 'default' : 'ghost'}
              onMouseEnter={() => prefetchChunk('marketplace', () => import('@/pages/Marketplace'))}
              onClick={() => navigate('/marketplace')}
            >
              Rynek
            </Button>
          )}

          {isLoggedIn && (
            <Button
              variant={isActive(p => p.startsWith('/chat')) ? 'default' : 'ghost'}
              onMouseEnter={() => prefetchChunk('chat', () => import('@/pages/Chat'))}
              onClick={() => navigate('/chat')}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Chat
            </Button>
          )}

          {isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={isActive(p => p.startsWith('/profile')) ? 'default' : 'ghost'} className="max-w-[200px]" onMouseEnter={() => prefetchChunk('profile', () => import('@/pages/Profile'))}>
                  <Avatar className="h-5 w-5">
                    {user?.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                    ) : (
                      <AvatarFallback>{(userName || user?.email || 'U')[0].toUpperCase()}</AvatarFallback>
                    )}
                  </Avatar>
                  <span className="truncate">{userName || user?.email || 'Profil'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  Profil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/games')}>
                  Moje gry
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { 
                    // Get logout function from the auth store directly
                    const logout = useAuthStore.getState().logout;
                    logout(); 
                    navigate('/'); 
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  Wyloguj się
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onMouseEnter={() => prefetchChunk('login', () => import('@/pages/Login'))}
                onClick={() => navigate('/login')}
              >
                <LogIn className="h-4 w-4" />
                Zaloguj się
              </Button>
              <Button
                variant="hero"
                size="sm"
                onMouseEnter={() => prefetchChunk('login', () => import('@/pages/Login'))}
                onClick={() => navigate('/login')}
              >
                <UserPlus className="h-4 w-4" />
                Dołącz
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(Navbar);


