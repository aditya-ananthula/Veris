import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Network, Search, ZoomIn, ZoomOut } from 'lucide-react';
import type {
  DocumentEdge,
  DocumentGraph,
  DocumentNode,
  DocumentRankEntry,
} from '../../types';

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
  relationships: Array<{
    rel_id: string;
    src_entity_id: string;
    rel_type: string;
    dst_entity_id: string;
    doc_id: string;
    evidence: string;
    status: string;
  }>;
  entities: Array<{
    entity_id: string;
    canonical_name: string;
    entity_type: string;
    aliases: string[];
    status: string;
    fact_count: number;
  }>;
  height?: number;
  className?: string;
}

const MIN_NODE_R = 22;
const MAX_NODE_R = 52;
const LAYOUT_RADIUS_FACTOR = 0.42;
const SIMULATION_DAMPING = 0.88;
const SIMULATION_K = 0.02;
const SIMULATION_CENTER_PULL = 0.015;

/** A DocumentNode plus physics-simulation velocity fields. */
type SimNode = DocumentNode & { vx: number; vy: number };

const STATUS_COLORS: Record<string, string> = {
  complete: '#10b981',
  extracting: '#f59e0b',
  failed: '#ef4444',
  pending: '#64748b',
  indexed: '#22d3ee',
};

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
  _entities: Array<{ entity_id: string; canonical_name: string }>,
  relationships: Array<{ src_entity_id: string; dst_entity_id: string; doc_id: string; evidence: string }>,
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
  const entityDocs = new Map<string, Set<string>>();
  relationships.forEach((r) => {
    if (!entityDocs.has(r.src_entity_id)) entityDocs.set(r.src_entity_id, new Set());
    if (!entityDocs.has(r.dst_entity_id)) entityDocs.set(r.dst_entity_id, new Set());
    entityDocs.get(r.src_entity_id)!.add(r.doc_id);
    entityDocs.get(r.dst_entity_id)!.add(r.doc_id);
  });

  const edgeMap = new Map<string, DocumentEdge>();
  entityDocs.forEach((docSet, entityId) => {
    const docList = Array.from(docSet).filter((d) => nodeIds.has(d));
    for (let i = 0; i < docList.length; i++) {
      for (let j = i + 1; j < docList.length; j++) {
        const a = docList[i];
        const b = docList[j];
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, {
            id: key,
            source: a,
            target: b,
            relType: 'shared_entity',
            evidence: `Both documents reference entity ${entityId}`,
            verified: true,
          });
        }
      }
    }
  });

  return { nodes, edges: Array.from(edgeMap.values()) };
}

export function RankedDocumentGraph({
  documents,
  relationships,
  entities,
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
      entities,
      relationships,
    );
  }, [documents, entities, relationships]);

  const filteredNodes = useMemo(() => {
    return graph.nodes.filter((n) => {
      if (filterStatus !== 'all' && n.status !== filterStatus) return false;
      if (searchQuery && !n.label.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [graph.nodes, searchQuery, filterStatus]);
  useEffect(() => {
    if (!graph.nodes.length) return;
    const width = widthRef.current || 600;
    const radius = Math.min(width, height) * LAYOUT_RADIUS_FACTOR;
    const initial = graph.nodes.map((_, i) => {
      const angle = (i / Math.max(graph.nodes.length, 1)) * 2 * Math.PI;
      const maxC = Math.max(1, ...graph.nodes.map((n) => n.chunks));
      const r = radius * (0.5 + 0.5 * (graph.nodes[i].chunks / maxC));
      return { ...graph.nodes[i], x: Math.cos(angle) * r, y: Math.sin(angle) * r, vx: 0, vy: 0 };
    });
    setNodes(initial);
    setEdgesState(graph.edges);
    centerRef.x = width / 2;
    centerRef.y = height / 2;
    setViewBox({ x: -width / 2, y: -height / 2, w: width, h: height });
  }, [graph.nodes.length, height]);
  const simulate = useCallback(() => {
    if (!nodes.length) return;
    const next = nodes.map((n) => ({ ...n, vx: n.vx || 0, vy: n.vy || 0 }));
    const idxById = new Map(nodes.map((n, i) => [n.id, i]));
    for (const e of edgesState) {
      const si = idxById.get(e.source);
      const ti = idxById.get(e.target);
      if (si === undefined || ti === undefined) continue;
      const s = next[si];
      const t = next[ti];
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.hypot(dx, dy) || 1;
      const targetDist = (s.size + t.size) / 2 + 40;
      const force = (dist - targetDist) * SIMULATION_K;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.vx -= fx;
      s.vy -= fy;
      t.vx += fx;
      t.vy += fy;
    }
    for (let i = 0; i < next.length; i++) {
      const n = next[i];
      n.vx -= n.x * SIMULATION_CENTER_PULL;
      n.vy -= n.y * SIMULATION_CENTER_PULL;
      n.vx *= SIMULATION_DAMPING;
      n.vy *= SIMULATION_DAMPING;
      n.x += n.vx;
      n.y += n.vy;
      if (dragNode === i) {
        n.x = dragPoint.x;
        n.y = dragPoint.y;
        n.vx = 0;
        n.vy = 0;
      }
    }
    setNodes(next);
    requestAnimationFrame(simulate);
  }, [nodes, edgesState, dragNode, dragPoint]);

  useEffect(() => {
    requestAnimationFrame(simulate);
  }, [simulate]);

  const fitToView = useCallback(() => {
    if (!svgRef.current || !nodes.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 80;
    const maxX = Math.max(...xs) + 80;
    const minY = Math.min(...ys) - 80;
    const maxY = Math.max(...ys) + 80;
    const w = maxX - minX;
    const h = maxY - minY;
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
                <circle
                  r={r}
                  fill={nodeColor(n.status)}
                  fillOpacity={sel ? 0.18 : hovered ? 0.14 : 0.10}
                  stroke={nodeColor(n.status)}
                  strokeWidth={sel ? 3 : hovered ? 2 : 1.5}
                  className="transition-all duration-300"
                  style={{
                    filter: sel || hovered ? 'drop-shadow-[0_0_16px_rgba(255,255,255,0.12)]' : 'none',
                  }}
                />
                <circle r={5} fill={STATUS_COLORS[n.status] ?? '#94a3b8'} />
                <text
                  x={0}
                  y={-r - 10}
                  textAnchor="middle"
                  fill={sel ? '#fff' : hovered ? '#c5c9d4' : '#94a3b8'}
                  fontSize="10"
                  fontWeight="600"
                  className="transition-all"
                  style={{
                    filter: sel || hovered ? 'drop-shadow-[0_0_6px_rgba(0,0,0,0.7)]' : 'none',
                  }}
                  pointerEvents="none"
                >
                  {nodeLabel(n)}
                </text>
                <text
                  x={0}
                  y={r + 14}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="9"
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