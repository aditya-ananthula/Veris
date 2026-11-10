import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Crosshair, GitBranch, Network, RotateCcw, X } from 'lucide-react';
import { Inspector } from '../components/Inspector';
import { api } from '../services/api';
import { useKnowledge, KnowledgeStatus } from './KnowledgeLayout';
import { useKnowledgeData } from '../hooks/useKnowledgeData';
import { GlassGraph } from '../components/charts/GlassGraph';
import { colorFor } from '../components/charts/knowledgeLayout';
import { entityConnections, neighborhood } from '../components/charts/entityConnections';
import type { IntelEntityDetailResponse, IntelEntity, IntelRelationship } from '../types';
export { isDirectional } from '../components/charts/entityConnections';
const EMPTY_ENTITIES: IntelEntity[] = [];
const EMPTY_RELATIONSHIPS: IntelRelationship[] = [];
export function EntitiesPage() {
  const { sessionId, revision } = useKnowledge();
  const ents = useKnowledgeData(sessionId, 'entities', revision);
  const rels = useKnowledgeData(sessionId, 'relationships', revision);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [type, setType] = useState('all');
  const [relationType, setRelationType] = useState('all');
  const [selected, setSelected] = useState('');
  const [selectedEdge, setSelectedEdge] = useState('');
  const [focus, setFocus] = useState('');
  const [detail, setDetail] = useState<IntelEntityDetailResponse>();
  const [detailError, setDetailError] = useState('');
  const [retry, setRetry] = useState(0);
  const [trail, setTrail] = useState<string[]>([]);
  const [connectionPage, setConnectionPage] = useState(0);
  const entities = ents.data ?? EMPTY_ENTITIES;
  const relationships = rels.data ?? EMPTY_RELATIONSHIPS;
  const connections = useMemo(() => entityConnections(relationships), [relationships]);
  const edges = useMemo(() => connections.filter(e => relationType === 'all' || e.label === relationType), [connections, relationType]);
  const focusIds = useMemo(() => focus ? neighborhood(focus, edges) : null, [focus, edges]);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => entities.filter(e => (!focusIds || focusIds.has(e.entity_id)) && (type === 'all' || e.entity_type === type) && [e.canonical_name, ...e.aliases].some(name => name.toLowerCase().includes(normalizedQuery))), [entities, focusIds, type, normalizedQuery]);
  const filteredIds = useMemo(() => new Set(filtered.map(e => e.entity_id)), [filtered]);
  const visibleConnections = edges.filter(e => filteredIds.has(e.source) && filteredIds.has(e.target));
  const nodes = useMemo(() => filtered.map(e => ({ id: e.entity_id, label: e.canonical_name, type: e.entity_type, size: e.fact_count, detail: `${e.fact_count} facts · ${edges.filter(r => r.source === e.entity_id || r.target === e.entity_id).length} links` })), [filtered, edges]);
  const edge = connections.find(e => e.id === selectedEdge);
  const selectedEntity = entities.find(e => e.entity_id === selected);
  const label = (id: string) => entities.find(e => e.entity_id === id)?.canonical_name ?? id;
  const setSearch = (value: string) => {
    setQuery(value);
    setParams(current => { const next = new URLSearchParams(current); value ? next.set('q', value) : next.delete('q'); return next; }, { replace: true });
  };
  const select = (id: string) => { setSelected(id); setSelectedEdge(''); setTrail(t => [...t.filter(v => v !== id), id].slice(-6)); if (focus) setFocus(id); };
  const follow = (id: string) => { setSearch(''); setType('all'); select(id); };
  const close = () => { setSelected(''); setSelectedEdge(''); };
  useEffect(() => { setQuery(params.get('q') ?? ''); }, [params]);
  useEffect(() => { setDetail(undefined); setDetailError(''); if (!selected || !sessionId) return; let active = true; api.intelEntityDetail(sessionId, selected).then(d => { if (active) setDetail(d); }).catch(e => { if (active) setDetailError(e.message); }); return () => { active = false; }; }, [selected, sessionId, revision, retry]);
  useEffect(() => { close(); setFocus(''); setTrail([]); }, [sessionId]);
  useEffect(() => {
    setConnectionPage(0);
    setSelectedEdge('');
    if (selected && !filteredIds.has(selected)) setSelected('');
  }, [query, type, relationType, focus, filteredIds, selected]);
  const connectionPages = Math.max(1, Math.ceil(visibleConnections.length / 12));
  const currentConnectionPage = Math.min(connectionPage, connectionPages - 1);
  return <>
    <div className="knowledge-filters explorer-filters"><label>Find an entity<input type="search" value={query} onChange={e => setSearch(e.target.value)} placeholder="Search names and aliases…"/></label><label>Relationship<select value={relationType} onChange={e => setRelationType(e.target.value)}><option value="all">All relationships</option>{[...new Set(connections.map(e => e.label))].sort().map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></label><button onClick={() => { setSearch(''); setType('all'); setRelationType('all'); setFocus(''); close(); setTrail([]); }}><RotateCcw size={14}/> Reset</button></div>
    <KnowledgeStatus loading={ents.loading || rels.loading} error={ents.error || rels.error} empty={!entities.length}/>
    {!ents.loading && !rels.loading && !ents.error && !rels.error && !!entities.length && <>
      <div className="explorer-source-strip" aria-label="Entity type filters"><button aria-pressed={type === 'all'} onClick={() => setType('all')}>All types <span>{entities.length}</span></button>{[...new Set(entities.map(e => e.entity_type))].sort().map(t => <button key={t} aria-pressed={type === t} onClick={() => setType(type === t ? 'all' : t)}><i style={{ background: colorFor(t) }}/>{t}<span>{entities.filter(e => e.entity_type === t).length}</span></button>)}</div>
      {(focus || trail.length > 0) && <div className="explorer-trail"><span>{focus ? 'Neighborhood' : 'Exploration trail'}</span>{focus ? <><strong>{label(focus)}</strong><button onClick={() => setFocus('')}><X size={13}/> Show full network</button></> : trail.map(id => <button key={id} onClick={() => follow(id)}>{label(id)}<ArrowRight size={12}/></button>)}</div>}
      <div className={'knowledge-workspace' + (selectedEntity || edge ? ' has-inspector' : '')}>
        <section className="atlas-map entity-explorer"><header className="atlas-section-heading"><div><span className="knowledge-kicker">RELATIONSHIP EXPLORER / {focus ? 'NEIGHBORHOOD' : 'NETWORK'}</span><h2>{focus ? 'Direct connections' : 'How entities relate'}</h2><p>Select an entity to inspect its facts, or a relationship to read its supporting source passages.</p></div><Network size={22}/></header><div className="entity-instruction"><span>{filtered.length} of {entities.length} entities · {visibleConnections.length} relationships · Hover to trace connections.</span>{selectedEntity && <button aria-pressed={focus === selected} onClick={() => { setFocus(focus ? '' : selected); setSearch(''); setType('all'); }}><Crosshair size={14}/>{focus ? 'Show full network' : 'Focus connections'}</button>}</div>
          <GlassGraph nodes={nodes} edges={visibleConnections} selectedId={selected} selectedEdgeId={selectedEdge} onSelect={select} onEdgeSelect={id => { setSelectedEdge(id); setSelected(''); }} height={520}/>
        </section>
        {edge ? <Inspector title="Relationship evidence" onClose={close}><span className="knowledge-kicker">{edge.records.length} SUPPORTING {edge.records.length === 1 ? 'RECORD' : 'RECORDS'}</span><div className="relationship-sentence"><button onClick={() => follow(edge.source)}>{label(edge.source)}</button><span>{edge.directed ? '→' : '↔'} {edge.label.replace(/_/g, ' ')}</span><button onClick={() => follow(edge.target)}>{label(edge.target)}</button></div>{edge.records.map(r => <article className="evidence-card" key={r.rel_id}><blockquote>{r.evidence || 'No evidence excerpt was stored for this relationship.'}</blockquote><Link to={'/knowledge/chunks?document=' + encodeURIComponent(r.doc_id)}>Read source passages <ArrowRight size={13}/></Link><Link to={'/documents?doc=' + encodeURIComponent(r.doc_id)}>Open source document</Link></article>)}</Inspector> : selectedEntity ? <Inspector title={selectedEntity.canonical_name} onClose={close}>
          <span className="knowledge-kicker">{selectedEntity.entity_type} / {selectedEntity.fact_count} FACTS</span><button className="explorer-focus" onClick={() => { setFocus(selected); setQuery(''); setType('all'); }}><Crosshair size={15}/> Explore this neighborhood</button>
          <h3>Follow a connection</h3><div className="entity-neighbors">{edges.filter(e => e.source === selected || e.target === selected).map(e => { const other = e.source === selected ? e.target : e.source; return <div key={e.id}><button onClick={() => follow(other)}><i style={{ background: colorFor(entities.find(v => v.entity_id === other)?.entity_type ?? '') }}/><span>{label(other)}<small>{!e.directed ? '↔' : e.source === selected ? '→' : '←'} {e.label.replace(/_/g, ' ')}</small></span><ArrowRight size={14}/></button><button className="neighbor-evidence" aria-label={`Read evidence for ${label(other)}`} onClick={() => { setSelectedEdge(e.id); setSelected(''); }}>Evidence</button></div>; })}{!edges.some(e => e.source === selected || e.target === selected) && <p>No connections match this relationship filter.</p>}</div>
          <h3>Extracted facts</h3>{detailError ? <div role="alert"><p>{detailError}</p><button onClick={() => setRetry(n => n + 1)}>Retry evidence</button></div> : !detail || detail.entity_id !== selected ? <p role="status">Loading source evidence…</p> : <>{!!detail.aliases.length && <div className="chips">{detail.aliases.map(a => <span className="badge" key={a}>{a}</span>)}</div>}{detail.facts.map(f => <article className="evidence-card" key={f.fact_id}><strong>{f.attribute}: {f.value} {f.unit}</strong><blockquote>{f.evidence}</blockquote><small>{f.status}</small><Link to={'/knowledge/chunks?document=' + encodeURIComponent(f.doc_id)}>{f.filename} <ArrowRight size={13}/></Link></article>)}{!detail.facts.length && <p>No facts stored for this entity.</p>}</>}
        </Inspector> : null}
      </div>
      <section className="explorer-reading-list"><header><div><span className="knowledge-kicker">CONNECTION DESK</span><h2>{visibleConnections.length} connections to investigate</h2></div><GitBranch size={22}/></header><div className="relationship-cards">{visibleConnections.slice(currentConnectionPage * 12, (currentConnectionPage + 1) * 12).map(e => <button key={e.id} aria-pressed={selectedEdge === e.id} onClick={() => { setSelectedEdge(e.id); setSelected(''); }}><span className="relationship-card-type">{e.label.replace(/_/g, ' ')}<ArrowRight size={14}/></span><strong>{label(e.source)} <span>{e.directed ? '→' : '↔'}</span> {label(e.target)}</strong><p>{e.records[0].evidence.slice(0, 160)}</p><small>{e.records.length} supporting {e.records.length === 1 ? 'record' : 'records'} · Read evidence</small></button>)}</div>{!visibleConnections.length && <p className="visual-empty">No validated connections match. Clear filters or explore an individual entity.</p>}<div className="pager"><button disabled={!currentConnectionPage} onClick={() => setConnectionPage(p => p - 1)}>Previous connections</button><span>{currentConnectionPage + 1} / {connectionPages}</span><button disabled={currentConnectionPage + 1 >= connectionPages} onClick={() => setConnectionPage(p => p + 1)}>Next connections</button></div></section>
    </>}
  </>;
}
export default EntitiesPage;
