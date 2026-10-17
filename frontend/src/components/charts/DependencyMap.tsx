import { useEffect, useRef, useState, useCallback } from 'react';
import { Network, Eye } from 'lucide-react';
import type { DependencyGraph, DependencyNode } from '../../types';

interface DependencyMapProps {
  graph: DependencyGraph;
  height?: number;
  className?: string;
}

const NODE_R = 30;
const NODE_R_HOVER = 38;
type Point = { x: number; y: number; vx: number; vy: number };

export function DependencyMap({ graph, height = 320, className = '' }: DependencyMapProps) {
  const [nodes, setNodes] = useState<Point[]>([]);
  const [hoverNode, setHoverNode] = useState<number | null>(null);
  const [dragNode, setDragNode] = useState<number | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const widthRef = { current: 0 };
  useEffect(() => {
    if (!graph.nodes.length) return;
    const radius = Math.min(widthRef.current || 400, height) * 0.32;
    const initial = graph.nodes.map((_, i: number) => {
      const angle = (i / graph.nodes.length) * 2 * Math.PI;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4 };
    });
    setNodes(initial);
  }, [graph.nodes.length, height]);
  useEffect(() => { setHoverNode(null); setDragNode(null); }, [graph.nodes.length]);

  const simulate = useCallback(() => {
    if (!graph.nodes.length || !graph.edges.length) return;
    const next = nodes.map((n) => ({ ...n }));
    const k = 0.02, damping = 0.88;
    for (const e of graph.edges) {
      const sIdx = graph.nodes.findIndex((n: { id: string }) => n.id === e.source);
      const tIdx = graph.nodes.findIndex((n: { id: string }) => n.id === e.target);
      if (sIdx < 0 || tIdx < 0) continue;
      const s = next[sIdx], t = next[tIdx];
      const dx = t.x - s.x, dy = t.y - s.y, dist = Math.hypot(dx, dy) || 1;
      const force = (dist - 90) * k, fx = (dx / dist) * force, fy = (dy / dist) * force;
      s.vx -= fx; s.vy -= fy; t.vx += fx; t.vy += fy;
    }
    for (let i = 0; i < next.length; i++) {
      const n = next[i];
      n.vx -= n.x * 0.015; n.vy -= n.y * 0.015;
      n.vx *= damping; n.vy *= damping; n.x += n.vx; n.y += n.vy;
      if (dragNode === i) { n.x = dragPoint.x; n.y = dragPoint.y; n.vx = 0; n.vy = 0; }
    }
    setNodes(next);
    requestAnimationFrame(simulate);
  }, [nodes, graph.nodes, graph.edges, dragNode, dragPoint]);

  const rafRef = useRef(0);
  useEffect(() => { rafRef.current = requestAnimationFrame(simulate); return () => cancelAnimationFrame(rafRef.current); }, [simulate]);

  const nodeColor = (type: unknown) => ({ person: '#7fe3ff', organization: '#b79cff', location: '#ffc3a0', product: '#ff7b9c', policy: '#7fe3a8', unknown: '#94a3b8' }[(typeof type === 'string' ? type : 'unknown').toLowerCase()] ?? '#94a3b8');
  const statusColor = (status: string) => (status === 'resolved' || status === 'validated' ? '#10b981' : status === 'disputed' || status === 'failed' ? '#ef4444' : status === 'uncertain' || status === 'pending' || status === 'extracting' ? '#f59e0b' : '#64748b');
  const cx = (widthRef.current / 2) || 200;
  const cy = height / 2;

  const onNodeMove = (e: React.MouseEvent, i: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setDragPoint({ x: e.clientX - rect.left - cx, y: e.clientY - rect.top - cy });
    setDragNode(i);
  };

  return (
    <div className={`relative w-full min-h-[300px] ${className}`} style={{ height }}>
      <div className="absolute -top-3 left-2 flex items-center gap-2">
        <Network size={16} className="text-accent-400" />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Entity dependency map</span>
        <button className="ml-auto inline-flex items-center gap-1 rounded border border-ink-700 bg-ink-900 px-2 py-0.5 text-xs text-slate-300 hover:text-white" onClick={() => setDragNode(null)} title="Release node">
          <Eye size={12} /> Free node
        </button>
      </div>
      <svg width="100%" height={height} className="w-full h-full" ref={(el) => { if (el) widthRef.current = el.clientWidth; }}
        onMouseMove={(e) => { if (dragNode !== null) { const r = e.currentTarget.getBoundingClientRect(); setDragPoint({ x: e.clientX - r.left - cx, y: e.clientY - r.top - cy }); } }}
        onMouseUp={() => setDragNode(null)}
      >
        {graph.edges.map((e: { id: string; source: string; target: string }) => {
          const sIdx = graph.nodes.findIndex((n: { id: string }) => n.id === e.source);
          const tIdx = graph.nodes.findIndex((n: { id: string }) => n.id === e.target);
          if (sIdx < 0 || tIdx < 0) return null;
          const s = nodes[sIdx], t = nodes[tIdx];
          if (!s || !t) return null;
          const dx = t.x - s.x, dy = t.y - s.y, dist = Math.hypot(dx, dy) || 1;
          const nx = -dy / dist, ny = dx / dist;
          const hovered = hoverNode === sIdx || hoverNode === tIdx;
          return (
            <path key={e.id} d={`M ${cx + s.x} ${cy + s.y} Q ${cx + (s.x + t.x) / 2 + nx * 22} ${cy + (s.y + t.y) / 2 + ny * 22} ${cx + t.x} ${cy + t.y}`}
              fill="none" stroke={hovered ? '#a855f7' : 'rgba(139,124,246,0.25)'} strokeWidth={hovered ? 2.5 : 1.5} strokeLinecap="round"
              className="transition-all duration-300" style={{ filter: hovered ? 'drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'none' }}
              onMouseEnter={() => setHoverNode(sIdx)} onMouseLeave={() => setHoverNode(null)} />
          );
        })}
        {graph.nodes.map((n: DependencyNode, i: number) => {
          const hovered = i === hoverNode;
          const r = hovered ? NODE_R_HOVER : NODE_R;
          const pos = nodes[i] ?? { x: 0, y: 0 };
          return (
            <g key={n.id} transform={`translate(${cx + pos.x}, ${cy + pos.y})`}
              onMouseMove={(e) => onNodeMove(e, i)} onMouseDown={(e) => { e.stopPropagation(); onNodeMove(e, i); }}
              className="cursor-grab active:cursor-grabbing">
              <circle r={r} fill={nodeColor(n.type)} fillOpacity={0.12} stroke={nodeColor(n.type)} strokeWidth={2} className="transition-all duration-300" style={{ filter: hovered ? 'drop-shadow-[0_0_16px_rgba(255,255,255,0.15)]' : 'none' }} />
              <circle r={6} fill={statusColor(n.status)} />
              <text x={0} y={-r - 8} textAnchor="middle" fill="#c5c9d4" fontSize="11" fontWeight="600" className={`transition-all ${hovered ? 'text-white drop-shadow-[0_0_6px_rgba(0,0,0,0.6)]' : ''}`} pointerEvents="none">{n.label}</text>
              <text x={0} y={r + 16} textAnchor="middle" fill="#64748b" fontSize="10" pointerEvents="none">{n.factCount} facts</text>
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[10px] text-slate-500">
        <span>Nodes: {graph.nodes.length}</span><span>·</span><span>Edges: {graph.edges.length}</span>
        <span className="text-xs">Drag a node · hover edge/nodes to highlight</span>
      </div>
    </div>
  );
}

export default DependencyMap;

