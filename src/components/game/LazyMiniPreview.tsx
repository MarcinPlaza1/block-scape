import { memo, useEffect, useMemo, useRef, useState } from 'react';
import MiniPreview from './MiniPreview';
import { apiFetch } from '@/lib/api';
import { generateMiniPreviewDataUrl } from '@/lib/miniPreviewGenerator';

type LazyMiniPreviewProps = {
  gameId: string;
  className?: string;
};

const LazyMiniPreview = memo(({ gameId, className }: LazyMiniPreviewProps) => {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const enhancedRef = useRef<boolean>(false);
  const [hovered, setHovered] = useState<boolean>(false);
  const loadingRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Trigger fetch when intersecting or hovered
  useEffect(() => {
    if (loaded) return;
    const el = containerRef.current;
    if (!el) return;
    const tryLoad = async () => {
      if (loadingRef.current || loaded) return;
      loadingRef.current = true;
      try {
        const detail = await apiFetch<{ game: { id: string; blocks: any[] } }>(`/games/${gameId}`);
        const list = Array.isArray(detail.game.blocks) ? detail.game.blocks : [];
        setBlocks(list);
        // One-shot render to data URL for perf
        const url = await generateMiniPreviewDataUrl(list, { width: 480, height: 270, jpegQuality: 0.6, hardwareScale: 2, usePipeline: false });
        setImageUrl(url);
        setLoaded(true);
      } catch {
        loadingRef.current = false;
      }
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          tryLoad();
        }
      });
    }, { rootMargin: '80px' });

    observer.observe(el);
    return () => observer.disconnect();
  }, [loaded, gameId]);

  useEffect(() => {
    if (hovered && !loaded) {
      // Fallback: load on hover
      (async () => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        try {
          const detail = await apiFetch<{ game: { id: string; blocks: any[] } }>(`/games/${gameId}`);
          const list = Array.isArray(detail.game.blocks) ? detail.game.blocks : [];
          setBlocks(list);
          const url = await generateMiniPreviewDataUrl(list, { width: 480, height: 270, jpegQuality: 0.6, hardwareScale: 2, usePipeline: true, msaaSamples: 2 });
          setImageUrl(url);
          setLoaded(true);
          enhancedRef.current = true;
        } catch {
          loadingRef.current = false;
        }
      })();
    }
  }, [hovered, loaded, gameId]);

  // If already loaded (e.g., by intersection without pipeline), upgrade quality on hover once
  useEffect(() => {
    if (hovered && loaded && imageUrl && !enhancedRef.current && blocks.length > 0) {
      (async () => {
        try {
          const url = await generateMiniPreviewDataUrl(blocks, { width: 480, height: 270, jpegQuality: 0.7, hardwareScale: 2, usePipeline: true, msaaSamples: 2 });
          setImageUrl(url);
          enhancedRef.current = true;
        } catch {}
      })();
    }
  }, [hovered, loaded, imageUrl, blocks]);

  // Debounced resize refresh (only when hovered to avoid background cost)
  useEffect(() => {
    const onResize = () => {
      if (!hovered || !loaded || blocks.length === 0) return;
      const handle = window.setTimeout(async () => {
        try {
          const url = await generateMiniPreviewDataUrl(blocks, { width: 480, height: 270, jpegQuality: 0.6, hardwareScale: 2, usePipeline: enhancedRef.current, msaaSamples: 2 });
          setImageUrl(url);
        } catch {}
      }, 200);
      return () => window.clearTimeout(handle);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [hovered, loaded, blocks]);

  const handleMouseEnter = () => setHovered(true);
  const handleMouseLeave = () => setHovered(false);

  return (
    <div
      ref={containerRef}
      className={className || 'h-24 bg-card/60'}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative' }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="Podgląd" className="w-full h-full object-cover" />
      ) : loaded ? (
        <MiniPreview className="w-full h-full" blocks={blocks} />
      ) : null}
    </div>
  );
});

export default LazyMiniPreview;


