import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

type NewsDetailData = { id: string; title: string; description: string; image?: string; date?: string; category?: string; content?: string };

const NewsDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<NewsDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        const resp = await apiFetch<{ news: NewsDetailData }>(`/news/${id}`);
        if (!mounted) return;
        setItem(resp.news);
        setError(null);
        document.title = `${resp.news.title} — Block‑Scape Studio`;
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Nie znaleziono aktualności.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  return (
    <div className="min-h-screen w-full bg-gradient-bg p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Aktualności</h1>
          <Button variant="outline" onClick={() => navigate('/news')}>Wróć</Button>
        </div>

        <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl">
          {loading ? (
            <CardContent className="p-4 text-sm text-muted-foreground">Ładowanie…</CardContent>
          ) : error ? (
            <CardContent className="p-4">
              <div className="text-sm text-destructive mb-3">{error}</div>
              <Button variant="outline" onClick={() => navigate('/news')}>Wróć do listy</Button>
            </CardContent>
          ) : item ? (
            <>
              <CardHeader>
                <CardTitle className="text-lg">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {item.image ? (
                  <div className="w-full h-48 bg-card/60 overflow-hidden rounded-md border border-border">
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                ) : null}
                <div className="text-xs text-muted-foreground">{item.category} • {item.date}</div>
                <div className="text-sm text-muted-foreground">{item.description}</div>
                {item.content && (
                  <div className="prose prose-invert max-w-none">
                    {item.content.split('\n').map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </>
          ) : null}
        </Card>
      </div>
    </div>
  );
};

export default NewsDetail;


