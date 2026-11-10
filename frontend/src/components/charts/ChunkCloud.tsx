import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Crosshair, ExternalLink, Orbit, Search, X } from 'lucide-react';
import { useKnowledgeData } from '../../hooks/useKnowledgeData';
import { colorFor, type StoredChunk } from './knowledgeLayout';
import { CLOUD_PAGE_SIZE, cloudPoints, hasProjection, sourceNeighbors, type CloudMode } from './cloudLayout';
import { KnowledgeStatus } from '../../pages/KnowledgeLayout';
import { sourceUrl } from '../../services/api';
import { Inspector } from '../Inspector';

const EMPTY_CHUNKS: StoredChunk[] = [];

function PassageMark({ color, active = false }: { color: string; active?: boolean }) {
  return (
    <g className="passage-mark">
      <circle r="17" fill={color} opacity=".1" />
      <circle r="10" fill="#101b31" stroke={color} strokeWidth="1.5" />
      <circle r="5" fill={color} opacity=".82" />
      <circle cx="-2" cy="-2" r="1.8" fill="#fff" opacity=".92" />
      {active && <circle r="15" fill="none" stroke="#d7f7ff" strokeWidth="1.2" className="passage-selection-ring" />}
    </g>
  );
}

function SourceRegion({
  cluster,
  isSourceMode,
}: {
  cluster: { x: number; y: number; rx: number; ry: number; id: string; count: number; name: string };
  isSourceMode: boolean;
}) {
  const color = colorFor(cluster.id);
  return (
    <g className="source-region" style={{ color }} pointerEvents="none">
      {isSourceMode && <ellipse cx={cluster.x} cy={cluster.y} rx={cluster.rx} ry={cluster.ry} fill="currentColor" fillOpacity=".035" stroke="currentColor" strokeOpacity=".2" strokeWidth="1" />}
    </g>
  );
}

export function ProjectionPreview({ chunks }: { chunks: StoredChunk[] }) {
  const sample = chunks.filter(hasProjection).slice(0, CLOUD_PAGE_SIZE);
  const points = cloudPoints(sample, 'projection');
  return <div className="cloud-mini"><svg viewBox="0 0 1000 570" aria-label="Stored embedding projection preview">{sample.map(c => { const p = points.get(c.id)!; return <g key={c.id} transform={`translate(${p.x} ${p.y})`}><PassageMark color={colorFor(c.docId)}/></g>; })}</svg></div>;
}
export function ChunkCloud({ sessionId, revision = 0 }: { sessionId: string; revision?: number; height?: number }) {
  const { data, loading, error } = useKnowledgeData(sessionId, 'chunks', revision);
  const documents = useKnowledgeData(sessionId, 'graph', revision);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [filter, setFilter] = useState(params.get('document') ?? '');
  const [selectedId, setSelectedId] = useState(params.get('chunk') ?? '');
  const [hovered, setHovered] = useState('');
  const [mode, setMode] = useState<CloudMode>('source');
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number }>();
  const uid = useId().replace(/:/g, '');
  const chunks = data?.chunks ?? EMPTY_CHUNKS;
  const selected = chunks.find(c => c.id === selectedId);
  const preview = chunks.find(c => c.id === hovered);
  const groups = useMemo(() => {
    const sources = new Map<string, { id: string; name: string; count: number }>();
    chunks.forEach(chunk => {
      const source = sources.get(chunk.docId);
      if (source) source.count++;
      else sources.set(chunk.docId, { id: chunk.docId, name: chunk.docFilename, count: 1 });
    });
    return [...sources.values()];
  }, [chunks]);
  const matches = useMemo(() => chunks.filter(c => (!filter || c.docId === filter) && (c.text + ' ' + c.docFilename).toLowerCase().includes(query.toLowerCase())), [chunks, filter, query]);
  const pages = Math.max(1, Math.ceil(matches.length / CLOUD_PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = useMemo(() => matches.slice(currentPage * CLOUD_PAGE_SIZE, (currentPage + 1) * CLOUD_PAGE_SIZE), [matches, currentPage]);
  const points = useMemo(() => cloudPoints(visible, mode), [visible, mode]);
  const matchingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    matches.forEach(chunk => counts.set(chunk.docId, (counts.get(chunk.docId) ?? 0) + 1));
    return counts;
  }, [matches]);
  const clusters = useMemo(() => groups.flatMap(group => {
    const members = visible.filter(chunk => chunk.docId === group.id && points.has(chunk.id));
    if (!members.length) return [];
    const coords = members.map(chunk => points.get(chunk.id)!);
    const xs = coords.map(point => point.x), ys = coords.map(point => point.y);
    const x = xs.reduce((sum, value) => sum + value, 0) / xs.length;
    const y = ys.reduce((sum, value) => sum + value, 0) / ys.length;
    return [{
      ...group,
      count: members.length,
      matchingCount: matchingCounts.get(group.id) ?? members.length,
      x,
      y,
      rx: Math.max(48, (Math.max(...xs) - Math.min(...xs)) / 2 + 22),
      ry: Math.max(40, (Math.max(...ys) - Math.min(...ys)) / 2 + 22),
    }];
  }), [groups, visible, points, matchingCounts]);
  const neighbors = sourceNeighbors(chunks, selected);
  const fit = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const updateParams = (values: Record<string, string>) => {
    setParams(current => {
      const next = new URLSearchParams(current);
      Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
      return next;
    }, { replace: true });
  };
  const updateParam = (key: string, value: string) => updateParams({ [key]: value });
  const setSearch = (value: string) => { setQuery(value); updateParam('q', value); };
  const setSourceFilter = (value: string) => { setFilter(value); updateParam('document', value); };
  const closeSelection = () => { setSelectedId(''); updateParam('chunk', ''); };
  useEffect(() => { setPage(0); setHovered(''); fit(); }, [query, filter, mode, sessionId]);
  useEffect(() => { setSelectedId(params.get('chunk') ?? ''); setQuery(params.get('q') ?? ''); setFilter(params.get('document') ?? ''); }, [params]);
  useEffect(() => { setSelectedId(params.get('chunk') ?? ''); setHovered(''); }, [sessionId]);
  useEffect(() => { const index = matches.findIndex(c => c.id === selectedId); if (index >= 0) setPage(Math.floor(index / CLOUD_PAGE_SIZE)); }, [selectedId, matches]);
  const select = (c: StoredChunk) => { setSelectedId(c.id); updateParam('chunk', c.id); setHovered(''); };
  const readNeighbor = (c?: StoredChunk) => { if (!c) return; setQuery(''); setFilter(c.docId); setSelectedId(c.id); updateParams({ q: '', document: c.docId, chunk: c.id }); setHovered(''); setPage(Math.floor(chunks.filter(v => v.docId === c.docId).findIndex(v => v.id === c.id) / CLOUD_PAGE_SIZE)); fit(); };
  const focusPassage = () => { if (!selected) return; const p = points.get(selected.id); if (p) { setZoom(2); setPan({ x: (500 - p.x) * 2, y: (285 - p.y) * 2 }); } else { setMode('source'); readNeighbor(selected); } };
  const localPoint = (svg: SVGSVGElement, x: number, y: number) => { const matrix = svg.getScreenCTM(); return matrix ? new DOMPoint(x, y).matrixTransform(matrix.inverse()) : { x, y }; };
  return <>
    <div className="knowledge-filters explorer-filters"><label>Search the collection<input type="search" value={query} onChange={e => setSearch(e.target.value)} placeholder="Find a phrase, idea or source…"/></label><div className="explorer-segment" aria-label="Cloud layout"><button aria-pressed={mode === 'source'} onClick={() => setMode('source')}>By source</button><button aria-pressed={mode === 'projection'} onClick={() => setMode('projection')}>By embedding</button></div><button onClick={() => { setParams({}); setQuery(''); setFilter(''); setSelectedId(''); setMode('source'); fit(); }}>Reset</button></div>
    <KnowledgeStatus loading={loading} error={error} empty={!chunks.length}/>
    {!loading && !error && !!chunks.length && <>
      <div className="explorer-source-strip" aria-label="Filter by source"><button aria-pressed={!filter} onClick={() => setSourceFilter('')}>All sources <span>{chunks.length}</span></button>{groups.map(g => <button key={g.id} aria-pressed={filter === g.id} onClick={() => setSourceFilter(filter === g.id ? '' : g.id)}><i style={{ background: colorFor(g.id) }}/><span className="source-name">{g.name}</span><span>{g.count}</span></button>)}</div>
      <div className={'knowledge-workspace' + (selected ? ' has-inspector' : '')}>
        <section className="atlas-map cloud-explorer">
          <header className="atlas-section-heading"><div><span className="knowledge-kicker">PASSAGE EXPLORER / {mode === 'source' ? 'BY SOURCE' : 'BY EMBEDDING'}</span><h2>{mode === 'source' ? 'Passages grouped by source' : 'Stored embedding projection'}</h2><p>{mode === 'source' ? 'Each point is a passage. Color and region identify its source document.' : 'Positions use stored 2D projections. Passages without coordinates remain available below.'}</p></div><Orbit size={22}/></header>
          <div className="viz-meta"><span><strong>{matches.length}</strong> matching passages · <strong>{visible.length}</strong> on this page · <strong>{points.size}</strong> plotted</span><div className="viz-controls"><button aria-label="Zoom out" onClick={() => setZoom(z => Math.max(.5, z / 1.25))}>−</button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" onClick={() => setZoom(z => Math.min(4, z * 1.25))}>+</button><button onClick={fit}>Fit view</button></div></div>
          <div className="cloud-stage">
            <svg viewBox="0 0 1000 570" role="group" aria-label={mode === 'source' ? 'Passages grouped by source document' : 'Passage embedding projection'} tabIndex={0} onKeyDown={e => { if (e.target !== e.currentTarget) return; const delta = { ArrowLeft: [35, 0], ArrowRight: [-35, 0], ArrowUp: [0, 35], ArrowDown: [0, -35] }[e.key]; if (delta) { e.preventDefault(); setPan(p => ({ x: p.x + delta[0], y: p.y + delta[1] })); } }}
              onPointerDown={e => { if ((e.target as Element).closest('[role="button"]')) return; const p = localPoint(e.currentTarget, e.clientX, e.clientY); drag.current = { ...p, px: pan.x, py: pan.y }; e.currentTarget.setPointerCapture(e.pointerId); setHovered(''); }}
              onPointerMove={e => { if (!drag.current) return; const p = localPoint(e.currentTarget, e.clientX, e.clientY); setPan({ x: drag.current.px + p.x - drag.current.x, y: drag.current.py + p.y - drag.current.y }); }} onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }}>
              <defs><pattern id={uid + 'grid'} width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#b3d7ff" opacity=".12"/></pattern></defs>
              <rect width="1000" height="570" fill={`url(#${uid}grid)`}/>
              <g className="cloud-world" transform={`translate(${500 + pan.x} ${285 + pan.y}) scale(${zoom}) translate(-500 -285)`}>
                {clusters.map(g => <SourceRegion key={g.id} cluster={g} isSourceMode={mode === 'source'}/>)}
                {mode === 'source' && clusters.map(g => {
                  const labelY = Math.min(525, Math.max(24, g.y + g.ry + 18));
                  return <g key={'label-' + g.id} className="cloud-source-label" role="button" tabIndex={0} aria-label={'Filter to ' + g.name} transform={`translate(${g.x} ${labelY})`} onClick={() => setSourceFilter(filter === g.id ? '' : g.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSourceFilter(filter === g.id ? '' : g.id); } }}>
                    <title>{g.name}</title><rect x="-100" y="-13" width="200" height="33" rx="8" fill="#111d32e8" stroke={colorFor(g.id)} strokeOpacity=".4"/><text textAnchor="middle" y="0" fill="#dfedfa" fontSize="10">{g.name.length > 28 ? g.name.slice(0, 25) + '…' : g.name}</text><text textAnchor="middle" y="13" fill="#abc5dc" fontSize="8">{g.count} of {g.matchingCount} matching passages shown</text>
                  </g>;
                })}
                {selected && mode === 'source' && [neighbors.previous, neighbors.next].map(c => { const a = points.get(selected.id), b = c && points.get(c.id); return a && b ? <line key={c!.id} className="passage-sequence" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#d3f6ff" strokeDasharray="3 5" opacity=".7"/> : null; })}
                {visible.map(c => { const p = points.get(c.id); if (!p) return null; const active = selectedId === c.id || hovered === c.id; return <g key={c.id} className={'cloud-particle' + (active ? ' is-active' : '')} data-chunk-id={c.id} role="button" tabIndex={0} aria-label={`${c.docFilename}, chunk ${c.chunkIndex + 1}`} aria-pressed={selectedId === c.id} transform={`translate(${p.x} ${p.y})`} opacity={selected && selected.docId !== c.docId ? .25 : 1} onClick={() => select(c)} onMouseEnter={() => setHovered(c.id)} onMouseLeave={() => setHovered('')} onFocus={() => setHovered(c.id)} onBlur={() => setHovered('')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(c); } }}>
                  <title>{c.docFilename + ': ' + c.text.slice(0, 160)}</title><circle r="20" fill="transparent"/><PassageMark color={colorFor(c.docId)} active={active}/>
                </g>; })}
              </g>
            </svg>
            {preview && <div className="cloud-hover-preview" aria-live="polite"><span className="knowledge-kicker">PASSAGE {preview.chunkIndex + 1} / {preview.docFilename}</span><p>{preview.text.slice(0, 220)}{preview.text.length > 220 ? '…' : ''}</p><small>Select to read and follow the source.</small></div>}
            {!matches.length && <div className="cloud-overlay-empty"><Search size={28}/><p>No passages match. Try another phrase or source.</p></div>}
            {!!matches.length && !points.size && <div className="cloud-overlay-empty"><Orbit size={28}/><p>No embeddings on this page. Every passage is available in Source islands.</p><button onClick={() => setMode('source')}>Show source islands</button></div>}
          </div>
          <div className="viz-footer"><span>Drag to pan · select a point to read its passage</span><div className="pager"><button aria-label="Previous passages" disabled={!currentPage} onClick={() => { setPage(currentPage - 1); fit(); }}>Previous</button><span>Page {currentPage + 1} of {pages}</span><button aria-label="Next passages" disabled={currentPage + 1 >= pages} onClick={() => { setPage(currentPage + 1); fit(); }}>Next</button></div></div>
          <p className="explorer-map-note">{mode === 'source' ? 'Regions and color identify the source document. Selecting a passage connects it to the previous and next passage in that source.' : `Stored 2D embedding projection. ${visible.length - points.size} passages on this page have no projection; they remain available in the reading list or in By source view.`}</p>
        </section>
        {selected && <Inspector title={`Passage ${selected.chunkIndex + 1}`} onClose={closeSelection}><span className="knowledge-kicker">READ THE SOURCE</span><h3>{selected.docFilename}</h3><div className="chips">{selected.page && <span className="badge">Page {selected.page}</span>}{selected.kind && <span className="badge">{selected.kind}</span>}</div><blockquote className="passage-full-text">{selected.text}</blockquote><div className="passage-stepper"><button aria-label="Previous source passage" disabled={!neighbors.previous} onClick={() => readNeighbor(neighbors.previous)}><ArrowLeft size={14}/> Previous</button><button aria-label="Next source passage" disabled={!neighbors.next} onClick={() => readNeighbor(neighbors.next)}>Next <ArrowRight size={14}/></button></div><button className="explorer-focus" onClick={focusPassage}><Crosshair size={15}/> Locate in cloud</button><div className="inspector-actions">{documents.data?.documents.find(d => d.doc_id === selected.docId)?.source_available && <a className="veris-btn-primary" href={sourceUrl(sessionId, selected.docId, selected.page)} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Open source</a>}<Link to={`/intelligence?doc=${encodeURIComponent(selected.docId)}&q=${encodeURIComponent('Explain this passage: ' + selected.text.slice(0, 600))}`}>Ask about this passage <ArrowRight size={14}/></Link><Link to={'/documents?doc=' + encodeURIComponent(selected.docId)}>View document</Link></div></Inspector>}
      </div>
      <section className="explorer-reading-list"><header><div><span className="knowledge-kicker">READING DESK</span><h2>{matches.length} matching passages</h2></div>{filter && <button onClick={() => setSourceFilter('')}><X size={13}/> Clear source</button>}</header><div className="passage-cards">{visible.map(c => <button key={c.id} aria-pressed={selectedId === c.id} onClick={() => select(c)}><span><i style={{ background: colorFor(c.docId) }}/>{c.docFilename} · Passage {c.chunkIndex + 1}{c.page ? ` · Page ${c.page}` : ''}</span><p>{c.text.slice(0, 160)}{c.text.length > 160 ? '…' : ''}</p><small>Read passage <ArrowRight size={13}/></small></button>)}</div></section>
    </>}
  </>;
}
export default ChunkCloud;
