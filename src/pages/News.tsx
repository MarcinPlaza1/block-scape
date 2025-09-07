import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

type NewsItem = { id: string; title: string; description: string; image?: string; date?: string; category?: string };

const News = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(6);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const resp = await apiFetch<{ news: NewsItem[]; total: number; page: number; limit: number }>(`/news?page=${page}&limit=${limit}`);
        if (!mounted) return;
        setItems(resp.news || []);
        setTotal(resp.total || 0);
      } catch {
        if (!mounted) return;
        setItems([]);
        setTotal(0);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [page, limit]);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  return (
    <div className="min-h-screen w-full bg-gradient-bg p-6">
      {/* SEO meta */}
      {(() => { 
        document.title = 'Aktualności — Block‑Scape Studio'; 
        let m = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
        if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'description'); document.head.appendChild(m); }
        m.setAttribute('content', 'Nowości, aktualizacje i ogłoszenia społeczności Block‑Scape.');
        return null; 
      })()}
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">
            <span className="align-middle">Aktualności</span>
            <span className="ml-3 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: 'hsl(var(--brand-news))' }} />
          </h1>
        </div>
        <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg">Aktualności</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Ładowanie…</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground">Brak aktualności.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((n) => (
                  <Card key={n.id} className="border-border overflow-hidden">
                    <CardContent className="p-0">
                      {n.image ? (
                        <div className="h-32 bg-card/60">
                          <img src={n.image} alt={n.title} className="w-full h-full object-cover" />
                        </div>
                      ) : null}
                      <div className="p-4 space-y-2">
                        <div className="text-xs text-muted-foreground">
                          <span className="px-2 py-0.5 rounded-full bg-secondary/60" style={{ color: 'hsl(var(--brand-news))' }}>{n.category}</span>
                          <span className="ml-2 opacity-70">{n.date}</span>
                        </div>
                        <div className="font-medium">{n.title}</div>
                        <div className="text-sm text-muted-foreground line-clamp-3">{n.description}</div>
                        <Button variant="link" className="px-0" onClick={() => (window.location.href = `/news/${n.id}`)}>Czytaj więcej</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">{total > 0 ? `Znaleziono ${total} wpisów` : 'Brak wyników'}</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Poprzednia</Button>
                <div className="text-sm">Strona {page} z {pages}</div>
                <Button variant="outline" size="sm" onClick={() => setPage(p => (p < pages ? p + 1 : p))} disabled={page >= pages}>Następna</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default News;


