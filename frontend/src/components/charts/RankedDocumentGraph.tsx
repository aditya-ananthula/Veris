import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Network, Search, ZoomIn, ZoomOut } from 'lucide-react';
import type { DocumentEdge, DocumentGraph, DocumentGraphEdge, DocumentNode, DocumentRankEntry } from '../../types';

interface RankedDocumentGraphProps {
  documents: Array<{
    doc_id: string;
    filename: string;
    extension: string;
    status: string;
    extraction_status: string;
    extraction_error: string | null;
    chunks: number;
  }>;
  edges: DocumentGraphEdge[];
  height?: number;
  className?: string;
}

const MIN_NODE_R = 20;
const MAX_NODE_R = 48;
const LAYOUT_RADIUS_FACTOR = 0.45;
const SIMULATION_DAMPING = 0.85;
const SIMULATION_K = 0.06;
const SIMULATION_CENTER_PULL = 0.02;
const CONVERGE_SPEED = 0.015;

/** A DocumentNode plus physics-simulation velocity fields. */
type SimNode = DocumentNode & { vx: number; vy: number };

const STATUS_COLORS: Record<string, string> = {
  complete: '#10b981',
  extracting: '#f59e0b',
  failed: '#ef4444',
  pending: '#64748b',
  indexed: '#22d3ee',
};

function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function rankAndSize(docs: Array<{ chunks: number; doc_id: string; filename: string; status: string }>) {
  const sorted = [...docs].sort((a, b) => b.chunks - a.chunks || a.filename.localeCompare(b.filename));
  const maxChunks = Math.max(1, ...sorted.map((d) => d.chunks));
  const minChunks = Math.min(...sorted.map((d) => d.chunks));
  const ranked: DocumentRankEntry[] = sorted.map((d, i) => ({
    rank: i + 1,
    filename: d.filename,
    chunks: d.chunks,
    status: d.status || 'indexed',
    docId: d.doc_id,
  }));
  const sizeFor = (chunks: number) => {
    if (maxChunks === minChunks) return (MIN_NODE_R + MAX_NODE_R) / 2;
    const t = (chunks - minChunks) / (maxChunks - minChunks);
    return MIN_NODE_R + t * (MAX_NODE_R - MIN_NODE_R);
  };
  return { ranked, sizeFor, maxChunks };
}

function buildDocumentGraph(
  docs: Array<{ doc_id: string; filename: string; chunks: number; status: string; extraction_status: string }>,
  sourceEdges: DocumentGraphEdge[],
): DocumentGraph {
  const { ranked, sizeFor } = rankAndSize(docs);
  const rankById = new Map(ranked.map((r) => [r.docId, r.rank]));

  const nodes: DocumentNode[] = docs.map((d) => {
    const size = sizeFor(d.chunks);
    return {
      id: d.doc_id,
      label: d.filename,
      filename: d.filename,
      chunks: d.chunks,
      rank: rankById.get(d.doc_id) ?? 0,
      status: (d.extraction_status || d.status || 'indexed') as DocumentNode['status'],
      size,
      x: 0,
      y: 0,
    };
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = sourceEdges.filter((edge) => edge.source !== edge.target && nodeIds.has(edge.source) && nodeIds.has(edge.target) && Number.isFinite(edge.weight) && edge.weight > 0)
    .map((edge) => ({ id: `${edge.source}:${edge.target}:${edge.rel_type}`, source: edge.source, target: edge.target, relType: edge.rel_type, evidence: edge.evidence, verified: true }));
  return { nodes, edges };
}

/** Deterministic initial positions distributed across the canvas (no origin collapse). */
function initialPositions(count: number, width: number, height: number): Array<{ x: number; y: number }> {
  const out = Array<{ x: number; y: number }>();
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * LAYOUT_RADIUS_FACTOR;
  for (let i = 0; i < count; i++) {
    // Fibonacci-ish spiral: deterministic, well distributed, never all at origin.
    const phi = i * 2.39996323;
    const r = radius * Math.sqrt((i + 1) / count);
    out.push({ x: cx + Math.cos(phi) * r, y: cy + Math.sin(phi) * r });
  }
  return out;
}

export function RankedDocumentGraph({
  documents,
  edges,
  height = 480,
  className = '',
}: RankedDocumentGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [edgesState, setEdgesState] = useState<DocumentEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<DocumentNode | null>(null);
  const [hoverNode, setHoverNode] = useState<number | null>(null);
  const [dragNode, setDragNode] = useState<number | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [viewBox, setViewBox] = useState({ x: -400, y: -240, w: 800, h: 480 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'indexed' | 'extracting' | 'complete' | 'failed' | 'pending'>('all');
  const widthRef = { current: 0 };
  const centerRef = { x: 0, y: 0 };

  const graph = useMemo(() => {
    if (!documents.length) return { nodes: [] as DocumentNode[], edges: [] as DocumentEdge[] };
    return buildDocumentGraph(
      documents.map((d) => ({
        doc_id: d.doc_id,
        filename: d.filename,
        chunks: d.chunks,
        status: d.status,
        extraction_status: d.extraction_status,
      })),
       edges,
    );
  }, [documents, edges]);

  const filteredNodes = useMemo(() => {
    return graph.nodes.filter((n) => {
      if (filterStatus !== 'all' && n.status !== filterStatus) return false;
      if (searchQuery && !n.label.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [graph.nodes, searchQuery, filterStatus]);
  const isMountedRef = useRef(false);

  // Stable deterministic layout: only recompute when the underlying graph changes.
  // Positions persist across rerenders/refreshes unless nodes/edges change.
  useEffect(() => {
    if (!graph.nodes.length) {
      setNodes([]);
      setEdgesState([]);
      return;
    }
    const width = widthRef.current || 600;
    const pos = initialPositions(graph.nodes.length, width, height);
    const initial = graph.nodes.map((n, i) => ({
      ...n,
      x: finite(pos[i].x),
      y: finite(pos[i].y),
      vx: 0,
      vy: 0,
    }));
    setNodes(initial);
    setEdgesState(graph.edges);
    centerRef.x = width / 2;
    centerRef.y = height / 2;
    setViewBox({ x: -width / 2, y: -height / 2, w: width, h: height });
    isMountedRef.current = true;
  }, [graph.nodes, graph.edges, height]);

  const settle = useRef<boolean>(false);

  const simulate = useCallback(() => {
    if (!nodes.length || settle.current) return;
    const next = nodes.map((n) => ({ ...n, vx: finite(n.vx), vy: finite(n.vy) }));
    const idxById = new Map(nodes.map((n, i) => [n.id, i]));

    // Edge forces: pull connected nodes toward a sensible separation.
    for (const e of edgesState) {
      const si = idxById.get(e.source);
      const ti = idxById.get(e.target);
      if (si === undefined || ti === undefined) continue;
      const s = next[si];
      const t = next[ti];
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.hypot(dx, dy) || 1;
      const targetDist = (s.size + t.size) / 2 + 45;
      const force = ((dist - targetDist) / dist) * SIMULATION_K;
      const fx = dx * force;
      const fy = dy * force;
      s.vx -= fx;
      s.vy -= fy;
      t.vx += fx;
      t.vy += fy;
    }

    // Repulsion between all nodes + center pull.
    for (let i = 0; i < next.length; i++) {
      const a = next[i];
      a.vx -= a.x * SIMULATION_CENTER_PULL;
      a.vy -= a.y * SIMULATION_CENTER_PULL;
      for (let j = i + 1; j < next.length; j++) {
        const b = next[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const minDist = (a.size + b.size) / 2 + 18;
        if (dist < minDist) {
          const push = ((minDist - dist) / dist) * 0.04;
          const fx = dx * push;
          const fy = dy * push;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }
    }

    let maxMove = 0;
    for (let i = 0; i < next.length; i++) {
      const n = next[i];
      n.vx *= SIMULATION_DAMPING;
      n.vy *= SIMULATION_DAMPING;
      n.x = finite(n.x + n.vx);
      n.y = finite(n.y + n.vy);
      maxMove = Math.max(maxMove, Math.abs(n.vx), Math.abs(n.vy));
      if (dragNode === i) {
        n.x = dragPoint.x;
        n.y = dragPoint.y;
        n.vx = 0;
        n.vy = 0;
      }
    }

    setNodes(next);
    if (maxMove < CONVERGE_SPEED && !dragNode) {
      settle.current = true;
    } else {
      requestAnimationFrame(simulate);
    }
  }, [nodes, edgesState, dragNode, dragPoint]);

  useEffect(() => {
    requestAnimationFrame(simulate);
  }, [simulate]);

  const fitToView = useCallback(() => {
    if (!svgRef.current || !nodes.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 100;
    const maxX = Math.max(...xs) + 100;
    const minY = Math.min(...ys) - 100;
    const maxY = Math.max(...ys) + 100;
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const scale = Math.min(rect.width / w, rect.height / h, 1.2);
    setViewBox({
      x: (minX + maxX) / 2 - rect.width / (2 * scale),
      y: (minY + maxY) / 2 - rect.height / (2 * scale),
      w: rect.width / scale,
      h: rect.height / scale,
    });
  }, [nodes]);

  const nodeColor = (status: string) => STATUS_COLORS[status] || '#94a3b8';

  const rankedList = useMemo(() => {
    return graph.nodes
      .slice()
      .sort((a, b) => b.chunks - a.chunks || a.rank - b.rank)
      .map((n, i) => ({ ...n, rank: i + 1 }));
  }, [graph.nodes]);

  const onNodeMouseDown = (e: React.MouseEvent, i: number) => {
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgPt = svg.createSVGPoint();
    svgPt.x = e.clientX - rect.left;
    svgPt.y = e.clientY - rect.top;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svgPt.matrixTransform(ctm.inverse());
    setDragPoint({ x: pt.x - centerRef.x, y: pt.y - centerRef.y });
    setDragNode(i);
  };

  const onNodeMouseMove = (e: React.MouseEvent) => {
    if (dragNode === null) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgPt = svg.createSVGPoint();
    svgPt.x = e.clientX - rect.left;
    svgPt.y = e.clientY - rect.top;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svgPt.matrixTransform(ctm.inverse());
    setDragPoint({ x: pt.x - centerRef.x, y: pt.y - centerRef.y });
  };

  const nodeLabel = useCallback(
    (n: DocumentNode) => {
      const idx = nodes.findIndex((x) => x.id === n.id);
      const isFocused = selectedNode?.id === n.id || hoverNode === idx;
      if (isFocused) return n.label;
      return n.label.length > 18 ? n.label.slice(0, 17) + '…' : n.label;
    },
    [selectedNode, hoverNode, nodes],
  );

  const isNodeVisible = (n: DocumentNode) => {
    return filteredNodes.some((fn) => fn.id === n.id);
  };

  return (
    <div className={`relative w-full min-h-[400px] ${className}`} style={{ height }} ref={containerRef}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-2">
        <div className="flex items-center gap-2">
          <Network size={16} className="text-accent-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Ranked Document Graph
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Search size={14} className="text-slate-500" />
          <input
            type="text"
            placeholder="Search documents…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded border border-slate-600 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none"
          />
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-2 py-1.5 rounded text-xs border ${filterStatus === 'all' ? 'border-accent-500/30 bg-accent-500/10 text-accent-300' : 'border-slate-600/40 bg-slate-900 text-slate-400 hover:border-slate-500'}`}
          >
            All
          </button>
          {(['indexed', 'extracting', 'complete', 'failed', 'pending'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-2 py-1.5 rounded text-xs border ${filterStatus === st ? 'border-accent-500/30 bg-accent-500/10 text-accent-300' : 'border-slate-600/40 bg-slate-900 text-slate-400 hover:border-slate-500'}`}
            >
              {st}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fitToView}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100 hover:border-slate-500 transition-colors"
            title="Fit to view"
          >
            <ZoomIn size={13} /> Fit
          </button>
          <button
            onClick={() => setViewBox({ x: -400, y: -240, w: 800, h: 480 })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100 hover:border-slate-500 transition-colors"
            title="Reset view"
          >
            <ZoomOut size={13} /> Reset
          </button>
        </div>
      </div>
      <div className={`relative w-full bg-slate-950/40 rounded-xl border border-slate-700/40 overflow-hidden`} style={{ height }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="w-full h-full"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          onMouseUp={() => setDragNode(null)}
          onMouseMove={onNodeMouseMove}
          style={{ cursor: dragNode !== null ? 'grabbing' : 'default' }}
        >
          {edgesState.map((e) => {
            const si = nodes.findIndex((n) => n.id === e.source);
            const ti = nodes.findIndex((n) => n.id === e.target);
            if (si < 0 || ti < 0) return null;
            const s = nodes[si];
            const t = nodes[ti];
            if (!isNodeVisible(s) || !isNodeVisible(t)) return null;
            const dx = t.x - s.x;
            const dy = t.y - s.y;
            const dist = Math.hypot(dx, dy) || 1;
            const nx = -dy / dist;
            const ny = dx / dist;
            const isHighlighted = selectedNode && (selectedNode.id === e.source || selectedNode.id === e.target);
            return (
              <path
                key={e.id}
                d={`M ${s.x} ${s.y} Q ${(s.x + t.x) / 2 + nx * 24} ${(s.y + t.y) / 2 + ny * 24} ${t.x} ${t.y}`}
                fill="none"
                stroke={isHighlighted ? '#22d3ee' : 'rgba(139,124,246,0.18)'}
                strokeWidth={isHighlighted ? 2.5 : 1.2}
                strokeLinecap="round"
                className="transition-all duration-300"
                style={{
                  filter: isHighlighted ? 'drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]' : 'none',
                }}
              />
            );
          })}
          {nodes.map((n, i) => {
            if (!isNodeVisible(n)) return null;
            const hovered = i === hoverNode;
            const sel = selectedNode?.id === n.id;
            const r = sel ? n.size + 6 : hovered ? n.size + 4 : n.size;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onMouseDown={(e) => onNodeMouseDown(e, i)}
                onMouseEnter={() => setHoverNode(i)}
                onMouseLeave={() => setHoverNode(null)}
                onClick={() => setSelectedNode(sel ? null : n)}
                className="cursor-grab active:cursor-grabbing"
              >
                <defs>
                  <radialGradient id={`nodeGrad-${n.id}`} cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={sel ? 0.35 : hovered ? 0.28 : 0.22} />
                    <stop offset="55%" stopColor={nodeColor(n.status)} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={nodeColor(n.status)} stopOpacity={0} />
                  </radialGradient>
                </defs>
                {/* Outer glow / luminous border */}
                <circle
                  r={r + 6}
                  fill="none"
                  stroke={nodeColor(n.status)}
                  strokeOpacity={sel ? 0.35 : hovered ? 0.25 : 0.12}
                  strokeWidth={2}
                  className="transition-all duration-300"
                />
                {/* Translucent glass surface */}
                <circle
                  r={r}
                  fill="url(#nodeGrad-${n.id})"
                  stroke={nodeColor(n.status)}
                  strokeWidth={sel ? 3 : hovered ? 2.5 : 1.5}
                  fillOpacity={sel ? 0.22 : hovered ? 0.17 : 0.12}
                  className="transition-all duration-300"
                />
                {/* Inner reflection highlight */}
                <circle
                  r={r * 0.42}
                  cx={-r * 0.35}
                  cy={-r * 0.35}
                  fill="#ffffff"
                  fillOpacity={sel ? 0.45 : hovered ? 0.38 : 0.32}
                  className="transition-all duration-300"
                />
                <text
                  x={0}
                  y={-r - 12}
                  textAnchor="middle"
                  fill={sel ? '#ffffff' : hovered ? '#e2e8f0' : '#b4c2d9'}
                  fontSize="10"
                  fontWeight="700"
                  letterSpacing="0.02em"
                  className="transition-all"
                  style={{
                    filter: sel || hovered ? 'drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]' : 'none',
                  }}
                  pointerEvents="none"
                >
                  {nodeLabel(n)}
                </text>
                <text
                  x={0}
                  y={r + 16}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="9"
                  fontWeight="600"
                  pointerEvents="none"
                >
                  {n.chunks} chunks
                </text>
              </g>
            );
          })}
        </svg>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[10px] text-slate-500">
          <span>Nodes: {nodes.filter(isNodeVisible).length}</span>
          <span>·</span>
          <span>Edges: {edgesState.length}</span>
          <span className="text-xs">Drag nodes · hover for details · click to select</span>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Companion ranked list */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-sm p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
            Documents by chunk count
          </h3>
          <ol className="space-y-1.5">
            {rankedList.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => setSelectedNode(selectedNode?.id === n.id ? null : n)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    selectedNode?.id === n.id
                      ? 'bg-accent-500/10 border border-accent-500/30'
                      : 'hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <span className="text-xs font-mono text-slate-500 w-6">#{n.rank}</span>
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: nodeColor(n.status) }}
                  />
                  <span className="text-sm text-slate-200 truncate flex-1">{n.label}</span>
                  <span className="text-xs font-mono text-slate-400">{n.chunks}</span>
                </button>
              </li>
            ))}
            {rankedList.length === 0 && (
              <li className="text-sm text-slate-500 text-center py-6">No documents indexed</li>
            )}
          </ol>
        </div>

        {/* Detail panel */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              {selectedNode ? 'Selected document' : 'Document details'}
            </h3>
            {selectedNode && (
              <button
                onClick={() => setSelectedNode(null)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Eye size={12} /> Clear
              </button>
            )}
          </div>
          {selectedNode ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="sm:col-span-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Name</p>
                <p className="text-slate-200 truncate" title={selectedNode.label}>
                  {selectedNode.label}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Rank</p>
                <p className="text-accent-400 font-mono">#{selectedNode.rank}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Chunk count</p>
                <p className="text-slate-200 font-mono">{selectedNode.chunks}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Status</p>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    selectedNode.status === 'complete'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : selectedNode.status === 'failed'
                        ? 'border-red-500/30 bg-red-500/10 text-red-300'
                        : selectedNode.status === 'extracting'
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                          : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                  }`}
                >
                  {selectedNode.status}
                </span>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">
              Select a node or a list entry to inspect document rank, chunk count, and status.
            </p>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            Node size reflects the real chunk count. Rank is descending by chunk count.
            Edges connect documents that share at least one extracted entity.
          </p>
        </div>
      </div>
    </div>
  );
}

export default RankedDocumentGraph;