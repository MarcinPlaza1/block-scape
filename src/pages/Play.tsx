import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Scene3D from '@/components/Scene3D';
import type { Block } from '@/components/scene/types';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';

type PublicGame = {
  id: string;
  name: string;
  blocks: Block[];
  updatedAt: string;
  likes?: number;
};

const Play = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [game, setGame] = useState<PublicGame | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<'first' | 'orbit'>('first');
  const [likes, setLikes] = useState<number>(0);
  const [youLike, setYouLike] = useState<boolean>(false);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<{ id: string; name: string; timeMs: number; createdAt: string }[]>([]);
  const [finished, setFinished] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) { setError('Brak identyfikatora gry'); setLoading(false); return; }
      setLoading(true);
      try {
        const resp = await apiFetch<{ game: PublicGame }>(`/games/${id}/public`);
        if (!mounted) return;
        setGame(resp.game);
        setLikes(resp.game.likes || 0);
        setError(null);
      } catch (e: any) {
        if (!mounted) return;
        // Fallback: try auth route in case owner viewing draft
        try {
          const priv = await apiFetch<{ game: PublicGame }>(`/games/${id}`);
          if (mounted) { setGame(priv.game); setLikes(priv.game.likes || 0); setError(null); }
        } catch (ee: any) {
          setError(ee?.message || 'Nie znaleziono gry lub jest nieopublikowana.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) return;
      try {
        const l = await apiFetch<{ likes: number; youLike: boolean }>(`/games/${id}/likes`);
        if (mounted) { setLikes(l.likes); setYouLike(l.youLike); }
      } catch {}
      try {
        const lb = await apiFetch<{ leaderboard: { id: string; name: string; timeMs: number; createdAt: string }[] }>(`/games/${id}/leaderboard`);
        if (mounted) setLeaderboard(lb.leaderboard || []);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    if (cameraMode === 'first' && startAt === null) setStartAt(performance.now());
  }, [cameraMode, startAt]);

  useEffect(() => {
    if (startAt === null) return;
    let raf: number;
    const tick = () => {
      setElapsedMs(performance.now() - (startAt || 0));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startAt]);

  const toggleLike = async () => {
    if (!id) return;
    try {
      if (youLike) {
        const r = await apiFetch<{ likes: number; youLike: boolean }>(`/games/${id}/likes`, { method: 'DELETE' });
        setLikes(r.likes); setYouLike(r.youLike);
      } else {
        const r = await apiFetch<{ likes: number; youLike: boolean }>(`/games/${id}/likes`, { method: 'POST' });
        setLikes(r.likes); setYouLike(r.youLike);
      }
    } catch {}
  };

  const submitScore = async () => {
    if (!id || !startAt) return;
    try {
      const timeMs = Math.round(elapsedMs);
      await apiFetch(`/games/${id}/leaderboard`, { method: 'POST', body: JSON.stringify({ timeMs }) });
      const lb = await apiFetch<{ leaderboard: { id: string; name: string; timeMs: number; createdAt: string }[] }>(`/games/${id}/leaderboard`);
      setLeaderboard(lb.leaderboard || []);
    } catch {}
  };

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  const blocks: Block[] = useMemo(() => {
    return Array.isArray(game?.blocks) ? game!.blocks : [];
  }, [game]);

  return (
    <div className="relative w-full h-screen bg-gradient-bg">
      {/* Top overlay */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <Button variant="outline" size="sm" onClick={() => navigate('/games')}>Wróć</Button>
          <div className="text-sm text-muted-foreground truncate max-w-[50vw]">
            {game?.name || 'Ładowanie…'}
          </div>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <Button size="sm" variant="outline" onClick={() => setCameraMode((m) => (m === 'first' ? 'orbit' : 'first'))}>
            Kamera: {cameraMode === 'first' ? 'Pierwsza' : 'Orbita'}
          </Button>
          <Button size="sm" onClick={() => { try { navigator.clipboard.writeText(window.location.href); } catch {} }}>Kopiuj link</Button>
          <Button size="sm" variant={youLike ? 'default' : 'outline'} onClick={toggleLike}>{youLike ? '❤️' : '🤍'} {likes}</Button>
        </div>
      </div>

      {/* Scene container */}
      <div className="w-full h-full">
        <Scene3D
          loadedBlocks={blocks}
          isPlayMode={true}
          cameraMode={cameraMode}
          onGameStart={() => { setFinished(false); setElapsedMs(0); setStartAt(performance.now()); try { (window as any).toast?.({ title: 'Start!', description: 'Timer uruchomiony.' }); } catch {} }}
          onGameCheckpoint={() => { try { (window as any).toast?.({ title: 'Checkpoint', description: 'Zapisano punkt odrodzenia.' }); } catch {} }}
          onGameFinish={() => { if (!finished) { setFinished(true); submitScore(); try { (window as any).toast?.({ title: 'Meta!', description: 'Wynik zapisany.' }); } catch {} } }}
          onGameHazard={() => { try { (window as any).toast?.({ title: 'Ups!', description: 'Powrót do checkpointu.' }); } catch {} }}
        />
      </div>

      {/* Bottom overlay: timer & submit */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-auto flex items-center gap-2 bg-card/90 border border-border rounded-xl px-3 py-2 shadow-lg">
        <div className="text-sm">Czas: <span className="font-semibold">{fmt(elapsedMs)}</span></div>
        <Button size="sm" variant="outline" onClick={() => { setFinished(false); setStartAt(performance.now()); setElapsedMs(0); }}>Reset</Button>
        <Button size="sm" onClick={submitScore}>Zapisz wynik</Button>
      </div>

      {/* Right overlay: leaderboard */}
      <div className="absolute top-20 right-3 z-10 pointer-events-auto bg-card/90 border border-border rounded-xl px-3 py-2 shadow-lg w-64 max-h-[40vh] overflow-auto">
        <div className="text-sm font-semibold mb-2">Tablica wyników</div>
        {leaderboard.length === 0 ? (
          <div className="text-xs text-muted-foreground">Brak wyników. Bądź pierwszy!</div>
        ) : (
          <ol className="text-sm space-y-1">
            {leaderboard.map((e, i) => (
              <li key={e.id} className="flex items-center justify-between">
                <span className="text-muted-foreground">{i + 1}.</span>
                <span className="truncate mx-2">{e.name}</span>
                <span className="font-medium">{fmt(e.timeMs)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="text-sm text-muted-foreground">Ładowanie gry…</div>
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="text-sm text-destructive">{error}</div>
            <Button onClick={() => navigate('/games')}>Wróć do gier</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Play;


