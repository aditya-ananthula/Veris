import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { ChunkPoint } from '../../types';

interface ChunkCloudProps {
  sessionId: string;
  documents: Array<{ doc_id: string; filename: string; chunks: number }>;
  height?: number;
  className?: string;
}

const DOC_PALETTE = [
  '#22d3ee', '#a855f7', '#f472b6', '#34d399', '#f59e0b',
  '#60a5fa', '#f87171', '#4ade80', '#e879f9', '#fbbf24',
];

function colorForIndex(i: number) {
  return DOC_PALETTE[i % DOC_PALETTE.length];
}

/** Project high-dim embeddings to 2D via deterministic PCA (power iteration). */
function projectTo2D(embeddings: number[][]): Array<{ x: number; y: number }> {
  const n = embeddings.length;
  if (n === 0) return [];
  const dim = embeddings[0].length;
  if (n === 1 || dim === 0) return [{ x: 0, y: 0 }];

  const mean = new Array(dim).fill(0);
  for (const vec of embeddings) {
    for (let d = 0; d < dim; d++) mean[d] += vec[d];
  }
  for (let d = 0; d < dim; d++) mean[d] /= n;
  const centered = embeddings.map((vec) => vec.map((v, d) => v - mean[d]));

  const powerIterate = (input: number[][], exclude: number[] | null): number[] => {
    let dir = new Array(dim).fill(0).map((_, i) => ((i * 37 + 11) % 100) / 100 - 0.5);
    for (let iter = 0; iter < 30; iter++) {
      const next = new Array(dim).fill(0);
      for (const row of input) {
        let dot = 0;
        for (let d = 0; d < dim; d++) dot += row[d] * dir[d];
        if (exclude) {
          let ex = 0;
          for (let d = 0; d < dim; d++) ex += exclude[d] * row[d];
          dot -= ex;
        }
        for (let d = 0; d < dim; d++) next[d] += dot * row[d];
      }
      const norm = Math.hypot(...next);
      if (norm < 1e-9) break;
      dir = next.map((v) => v / norm);
    }
    return dir;
  };

  const pc1 = powerIterate(centered, null);
  const pc2 = powerIterate(centered, pc1);

  return centered.map((row) => {
    let x = 0;
    let y = 0;
    for (let d = 0; d < dim; d++) {
      x += row[d] * pc1[d];
      y += row[d] * pc2[d];
    }
    return { x, y };
  });
}

export function ChunkCloud({ sessionId, documents, height = 460, className = '' }: ChunkCloudProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<ChunkPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hover, setHover] = useState<ChunkPoint | null>(null);
  const [selected, setSelected] = useState<ChunkPoint | null>(null);
  const [filterDoc, setFilterDoc] = useState<string>('all');
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const dragRef = useRef({ active: false, startX: 0, startY: 0, baseTx: 0, baseTy: 0, moved: false });
  const screenRef = useRef<Array<{ p: ChunkPoint; sx: number; sy: number }>>([]);

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      setError('');
      const res = await api.intelChunks(sessionId);
      const raw = res.chunks.filter((c) => c.embedding && c.embedding.length > 0);
      if (raw.length === 0) {
        setPoints([]);
        return;
      }
      const proj = projectTo2D(raw.map((c) => c.embedding as number[]));
      const docIndex = new Map(documents.map((d, i) => [d.doc_id, i]));
      const built: ChunkPoint[] = raw.map((c, i) => ({
        id: c.id,
        chunkId: c.id,
        docId: c.docId,
        docFilename: c.docFilename,
        chunkIndex: c.chunkIndex,
        text: c.text,
        x: proj[i].x,
        y: proj[i].y,
        color: colorForIndex(docIndex.get(c.docId) ?? 0),
      }));
      setPoints(built);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chunk embeddings.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, documents]);

  useEffect(() => {
    void load();
  }, [load]);

  const docCounts = useMemo(() => {
    const counts = new Map<string, number>();
    points.forEach((p) => counts.set(p.docId, (counts.get(p.docId) ?? 0) + 1));
    return counts;
  }, [points]);

  const filtered = useMemo(
    () => (filterDoc === 'all' ? points : points.filter((p) => p.docId === filterDoc)),
    [points, filterDoc],
  );

  const layout = useMemo(() => {
    if (filtered.length === 0) return { pad: 48, minX: 0, minY: 0, spanX: 1, spanY: 1 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of filtered) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = 48;
    return { pad, minX, minY, spanX: maxX - minX || 1, spanY: maxY - minY || 1 };
  }, [filtered]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    if (cw === 0 || ch === 0) return;
    canvas.width = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    const { pad, minX, minY, spanX, spanY } = layout;
    const drawW = cw - pad * 2;
    const drawH = ch - pad * 2;
    const scale = Math.min(drawW / spanX, drawH / spanY) * view.scale;
    const offX = pad + (drawW - spanX * scale) / 2 + view.tx;
    const offY = pad + (drawH - spanY * scale) / 2 + view.ty;

    const screen: Array<{ p: ChunkPoint; sx: number; sy: number }> = [];
    for (const p of filtered) {
      const sx = offX + (p.x - minX) * scale;
      const sy = offY + (p.y - minY) * scale;
      screen.push({ p, sx, sy });
      const isHover = hover?.id === p.id;
      const isSel = selected?.id === p.id;
      const r = isSel ? 6 : isHover ? 5 : 2.6;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = isSel || isHover ? 1 : 0.7;
      ctx.fill();
      if (isSel || isHover) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    screenRef.current = screen;
  }, [filtered, layout, view, hover, selected]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  const findHit = (mx: number, my: number): ChunkPoint | null => {
    let best: ChunkPoint | null = null;
    let bestD = 100;
    for (const s of screenRef.current) {
      const dx = s.sx - mx;
      const dy = s.sy - my;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = s.p;
      }
    }
    return best;
  };

  const relPos = (e: { currentTarget: EventTarget; clientX: number; clientY: number }) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onMove = (e: React.MouseEvent) => {
    const { x, y } = relPos(e);
    if (dragRef.current.active) {
      const dx = x - dragRef.current.startX;
      const dy = y - dragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
      setView((v) => ({ ...v, tx: dragRef.current.baseTx + dx, ty: dragRef.current.baseTy + dy }));
      return;
    }
    setHover(findHit(x, y));
  };

  const onDown = (e: React.MouseEvent) => {
    const { x, y } = relPos(e);
    dragRef.current = { active: true, startX: x, startY: y, baseTx: view.tx, baseTy: view.ty, moved: false };
  };

  const onUp = (e: React.MouseEvent) => {
    const wasDrag = dragRef.current.moved;
    dragRef.current.active = false;
    if (!wasDrag) {
      const { x, y } = relPos(e);
      setSelected(findHit(x, y));
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setView((v) => ({ ...v, scale: Math.min(6, Math.max(0.4, v.scale * (e.deltaY < 0 ? 1.12 : 0.89))) }));
  };

  const legend = useMemo(
    () =>
      documents
        .map((d, i) => ({ id: d.doc_id, filename: d.filename, color: colorForIndex(i), count: docCounts.get(d.doc_id) ?? 0 }))
        .filter((d) => d.count > 0),
    [documents, docCounts],
  );

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <Cloud size={16} className="text-accent-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Chunk Cloud</span>
          {loading && <Loader2 size={13} className="animate-spin text-slate-500" />}
          <span className="text-[11px] text-slate-500">PCA projection of embeddings</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterDoc}
            onChange={(e) => setFilterDoc(e.target.value)}
            className="rounded-lg border border-slate-600/50 bg-slate-950/80 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-accent-500/60"
          >
            <option value="all">All documents</option>
            {documents.map((d) => (
              <option key={d.doc_id} value={d.doc_id}>{d.filename}</option>
            ))}
          </select>
          <button
            onClick={() => setView({ scale: 1, tx: 0, ty: 0 })}
            className="rounded-lg border border-slate-600/50 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            Reset view
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
      )}

      <div
        ref={wrapRef}
        className="relative w-full cursor-grab overflow-hidden rounded-xl border border-slate-700/40 bg-slate-950/40 active:cursor-grabbing"
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          onMouseMove={onMove}
          onMouseDown={onDown}
          onMouseUp={onUp}
          onMouseLeave={() => { dragRef.current.active = false; setHover(null); }}
          onWheel={onWheel}
          className="block"
        />
        {!loading && filtered.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-500">
            No chunk embeddings yet. Upload and index documents first.
          </div>
        )}
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-500">
          {filtered.length} chunks · scroll to zoom · drag to pan · click a point for details
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Documents</p>
          <div className="flex max-h-40 flex-wrap gap-x-3 gap-y-1.5 overflow-y-auto">
            {legend.map((d) => (
              <button
                key={d.id}
                onClick={() => setFilterDoc(filterDoc === d.id ? 'all' : d.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] transition-colors ${
                  filterDoc === d.id ? 'bg-accent-500/10 text-accent-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
                <span className="max-w-[140px] truncate">{d.filename}</span>
                <span className="font-mono text-[10px] text-slate-500">{d.count}</span>
              </button>
            ))}
            {legend.length === 0 && <span className="text-[11px] text-slate-500">No chunks</span>}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Chunk details</p>
            {selected && (
              <button
                onClick={() => setSelected(null)}
                className="rounded px-1.5 py-0.5 text-[11px] text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
          {selected ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="h-2 w-2 rounded-full" style={{ background: selected.color }} />
                <span className="text-slate-300">{selected.docFilename}</span>
                <span className="font-mono text-slate-500">#{selected.chunkIndex}</span>
              </div>
              <p className="max-h-24 overflow-y-auto rounded-md bg-slate-950/60 p-2 text-[11px] leading-relaxed text-slate-300">
                {selected.text}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">
              Hover or click a point to inspect its chunk text and source document.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChunkCloud;
