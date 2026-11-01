import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { DependencyGraph, DependencyNode } from '../../types';

interface DependencyMapProps {
  graph: DependencyGraph;
  height?: number;
  className?: string;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

type Point = { x: number; y: number; vx: number; vy: number };
const TYPE_COLORS: Record<string, string> = { person: '#67e8f9', organization: '#a78bfa', location: '#fbbf24', product: '#fb7185', concept: '#22d3ee', policy: '#6ee7b7', date: '#f59e0b', unknown: '#94a3b8' };
const colorFor = (type: string) => TYPE_COLORS[type.toLowerCase()] ?? TYPE_COLORS.unknown;
const CONVERGE_SPEED = 0.012;

function finite(n: number): number { return Number.isFinite(n) ? n : 0; }

/** Deterministic spiral initial positions — never all at origin. */
function initialPositions(count: number, width: number, height: number): Point[] {
  const out: Point[] = [];
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.34;
  for (let i = 0; i < count; i++) {
    const phi = i * 2.39996323;
    const r = radius * Math.sqrt((i + 1) / Math.max(count, 1));
    out.push({ x: finite(cx + Math.cos(phi) * r), y: finite(cy + Math.sin(phi) * r), vx: 0, vy: 0 });
  }
  return out;
}

export function DependencyMap({ graph, height = 460, className = '', selectedId = '', onSelect }: DependencyMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(760);
  const [points, setPoints] = useState<Point[]>([]);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [drag, setDrag] = useState<{ node: number | null; x: number; y: number; tx: number; ty: number } | null>(null);
  const [hoverId, setHoverId] = useState('');
  const nodeIndex = useMemo(() => new Map(graph.nodes.map((node, index) => [node.id, index])), [graph.nodes]);
  const positionsRef = useRef<Point[]>([]);
  const settledRef = useRef(false);

  useEffect(() => {
    const measure = () => setWidth(Math.max(320, svgRef.current?.clientWidth || 760));
    measure();
    const observer = new ResizeObserver(measure);
    if (svgRef.current) observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (graph.nodes.length === 0) { setPoints([]); return; }
    const next = initialPositions(graph.nodes.length, width, height);
    positionsRef.current = next;
    setPoints(next);
    setView({ scale: 1, tx: 0, ty: 0 });
    settledRef.current = false;
  }, [graph.nodes, width, height]);

    const tick = useCallback(() => {
    if (points.length === 0 || points.length !== graph.nodes.length || settledRef.current) return;
    const next = points.map((p) => ({ ...p, vx: finite(p.vx), vy: finite(p.vy) }));
    const halfW = width / 2 - 36;
    const halfH = height / 2 - 44;

    for (let i = 0; i < next.length; i++) {
      const a = next[i];
      for (let j = i + 1; j < next.length; j++) {
        const b = next[j];
        const dx = b.x - a.x || 0.01; const dy = b.y - a.y || 0.01;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const force = Math.min(12, 900 / (distance * distance));
        const fx = (dx / distance) * force; const fy = (dy / distance) * force;
        a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
      }
    }

    graph.edges.forEach((edge) => {
      const source = nodeIndex.get(edge.source); const target = nodeIndex.get(edge.target);
      if (source === undefined || target === undefined) return;
      const a = next[source]; const b = next[target];
      const dx = b.x - a.x; const dy = b.y - a.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const force = (distance - 110) * 0.01;
      a.vx += (dx / distance) * force; a.vy += (dy / distance) * force;
      b.vx -= (dx / distance) * force; b.vy -= (dy / distance) * force;
    });

    let maxMove = 0;
    next.forEach((point, index) => {
      if (drag?.node === index) return;
      point.vx = (point.vx - point.x * 0.012) * 0.8;
      point.vy = (point.vy - point.y * 0.012) * 0.8;
      point.x = finite(Math.max(-halfW, Math.min(halfW, point.x + point.vx)));
      point.y = finite(Math.max(-halfH, Math.min(halfH, point.y + point.vy)));
      maxMove = Math.max(maxMove, Math.abs(point.vx), Math.abs(point.vy));
    });

    setPoints(next);
    if (maxMove < CONVERGE_SPEED && !drag?.node) settledRef.current = true;
    else requestAnimationFrame(tick);
  }, [points, graph.edges, width, height, drag?.node, nodeIndex]);

  useEffect(() => { requestAnimationFrame(tick); }, [tick]);

  const toGraph = useCallback((event: React.MouseEvent<SVGSVGElement | SVGGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (event.clientX - rect.left - rect.width / 2 - view.tx) / view.scale, y: (event.clientY - rect.top - rect.height / 2 - view.ty) / view.scale };
  }, [view]);
  const reset = useCallback(() => { settledRef.current = false; setView({ scale: 1, tx: 0, ty: 0 }); }, []);
  const visibleEdges = graph.edges.filter((edge) => nodeIndex.has(edge.source) && nodeIndex.has(edge.target));

  return <div className={`relative w-full ${className}`}>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1"><p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Entity network</p><div className="flex items-center gap-1"><button onClick={() => setView((current) => ({ ...current, scale: Math.min(3, current.scale * 1.2) }))} className="veris-btn-ghost" aria-label="Zoom in"><ZoomIn size={13} /></button><button onClick={() => setView((current) => ({ ...current, scale: Math.max(0.5, current.scale / 1.2) }))} className="veris-btn-ghost" aria-label="Zoom out"><ZoomOut size={13} /></button><button onClick={reset} className="veris-btn-ghost" title="Fit view"><Maximize size={13} /></button><button onClick={reset} className="veris-btn-ghost" title="Reset view"><RotateCcw size={13} /></button></div></div>
    <svg ref={svgRef} width="100%" height={height} className="block w-full rounded-xl border border-slate-700/40 bg-slate-950/40" onMouseMove={(event) => { if (!drag) return; if (drag.node !== null) { const point = toGraph(event); setPoints((current) => current.map((item, index) => index === drag.node ? { ...item, x: point.x, y: point.y, vx: 0, vy: 0 } : item)); } else setView((current) => ({ ...current, tx: drag.tx + event.clientX - drag.x, ty: drag.ty + event.clientY - drag.y })); }} onMouseUp={() => setDrag(null)} onMouseLeave={() => setDrag(null)} onMouseDown={(event) => setDrag({ node: null, x: event.clientX, y: event.clientY, tx: view.tx, ty: view.ty })}>
      <g transform={`translate(${width / 2 + view.tx} ${height / 2 + view.ty}) scale(${view.scale})`}>
        {visibleEdges.map((edge) => { const source = points[nodeIndex.get(edge.source)!]; const target = points[nodeIndex.get(edge.target)!]; if (!source || !target) return null; const highlighted = selectedId === edge.source || selectedId === edge.target || hoverId === edge.source || hoverId === edge.target; return <line key={edge.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke={highlighted ? '#a78bfa' : 'rgba(139,124,246,.26)'} strokeWidth={highlighted ? 2 : 1.15} />; })}
        {graph.nodes.map((node: DependencyNode, index) => { const point = points[index]; if (!point) return null; const active = selectedId === node.id; const hovered = hoverId === node.id; const color = colorFor(node.type); const radius = active ? 18 : hovered ? 16 : 13; return <g key={node.id} transform={`translate(${point.x} ${point.y})`} className="cursor-pointer" onMouseDown={(event) => { event.stopPropagation(); setDrag({ node: index, x: event.clientX, y: event.clientY, tx: view.tx, ty: view.ty }); }} onMouseEnter={() => setHoverId(node.id)} onMouseLeave={() => setHoverId('')} onClick={() => onSelect?.(node.id)}><defs><radialGradient id={`entGrad-${node.id}`} cx="30%" cy="30%" r="70%"><stop offset="0%" stopColor="#ffffff" stopOpacity={active ? 0.4 : hovered ? 0.32 : 0.26} /><stop offset="55%" stopColor={color} stopOpacity={0.5} /><stop offset="100%" stopColor={color} stopOpacity={0} /></radialGradient></defs><circle r={radius + 5} fill="none" stroke={color} strokeOpacity={active ? 0.35 : hovered ? 0.25 : 0.12} strokeWidth={2} className="transition-all" /><circle r={radius} fill={`url(#entGrad-${node.id})`} stroke={color} strokeWidth={active ? 3 : hovered ? 2.5 : 1.5} fillOpacity={active ? 0.22 : hovered ? 0.17 : 0.12} className="transition-all" /><circle r={radius * 0.4} cx={-radius * 0.35} cy={-radius * 0.35} fill="#ffffff" fillOpacity={active ? 0.45 : hovered ? 0.38 : 0.32} className="transition-all" /><text y={-radius - 12} textAnchor="middle" fill={active ? '#ffffff' : hovered ? '#e2e8f0' : '#b4c2d9'} fontSize="11" fontWeight="700" letterSpacing="0.02em" className="transition-all" pointerEvents="none">{node.label.length > 24 ? `${node.label.slice(0, 23)}…` : node.label}</text><text y={radius + 16} textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="600" pointerEvents="none">{node.factCount} mentions</text></g>; })}
      </g>
    </svg>
    <p className="mt-2 text-center text-[11px] text-slate-500">{graph.nodes.length} entities · {visibleEdges.length} verified relationships · drag to arrange, drag empty space to pan</p>
  </div>;
}

export default DependencyMap;