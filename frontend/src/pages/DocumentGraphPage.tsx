import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, RotateCcw, Network } from 'lucide-react';
import { Inspector } from '../components/Inspector';
import { useKnowledge, KnowledgeStatus } from './KnowledgeLayout';
import { useKnowledgeData } from '../hooks/useKnowledgeData';
import { GlassGraph } from '../components/charts/GlassGraph';
import { connectionNames, documentConnection } from '../components/charts/documentConnections';

export function DocumentGraphPage() {
  const { sessionId, revision } = useKnowledge();
  const { data, loading, error } = useKnowledgeData(sessionId, 'graph', revision);
  const [params] = useSearchParams();
  const [selected, setSelected] = useState(params.get('document') ?? '');
  const [selectedEdge, setSelectedEdge] = useState('');
  const [query, setQuery] = useState('');
  const [minimum, setMinimum] = useState(1);
  const docs = data?.documents ?? [];
  const edges = data?.edges ?? [];
  const nodes = useMemo(() => docs.map(d => ({ id: d.doc_id, label: d.filename, type: 'document', size: d.chunks, detail: `${d.chunks} passages` })), [docs]);
  const links = useMemo(() => edges.filter(e => e.weight >= minimum).map(documentConnection), [edges, minimum]);
  const matchingDocs = useMemo(() => docs.filter(d => d.filename.toLowerCase().includes(query.trim().toLowerCase())), [docs, query]);
  const matchingIds = useMemo(() => new Set(matchingDocs.map(d => d.doc_id)), [matchingDocs]);
  const matchingLinks = useMemo(() => links.filter(e => matchingIds.has(e.source) && matchingIds.has(e.target)), [links, matchingIds]);
  const doc = docs.find(d => d.doc_id === selected);
  const edge = links.find(e => e.id === selectedEdge);
  const related = links.filter(e => e.source === selected || e.target === selected);
  const selectDoc = (id: string) => { setSelected(id); setSelectedEdge(''); };
  const close = () => { setSelected(''); setSelectedEdge(''); };
  useEffect(() => {
    if (loading || error) return;
    if (selected && !matchingIds.has(selected)) setSelected('');
    if (selectedEdge && !matchingLinks.some(link => link.id === selectedEdge)) setSelectedEdge('');
  }, [loading, error, matchingIds, matchingLinks, selected, selectedEdge]);
  return <>
    <div className="knowledge-filters">
      <label>Find a source<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search document names…" /></label>
      <label>Minimum shared entities<select aria-label="Minimum shared entities" value={minimum} onChange={e => { setMinimum(Number(e.target.value)); setSelectedEdge(''); }}><option value={1}>1 or more</option><option value={2}>2 or more</option><option value={3}>3 or more</option></select></label>
      <button onClick={() => { setQuery(''); setMinimum(1); close(); }}><RotateCcw size={14}/> Reset</button>
      <p className="explorer-result-count" role="status" aria-live="polite">{matchingDocs.length} of {docs.length} sources · {matchingLinks.length} relationships</p>
    </div>
    <KnowledgeStatus loading={loading} error={error} empty={!docs.length}/>
    {!loading && !error && !!docs.length && <div className={'knowledge-workspace' + (doc || edge ? ' has-inspector' : '')}>
      <section className="atlas-map"><header className="atlas-section-heading"><div><span className="knowledge-kicker">SOURCE GRAPH</span><h2>Shared evidence between sources</h2><p>Lines connect documents with shared entities. Select a line to inspect the overlap and its supporting entities.</p></div><Network size={20}/></header>
        <GlassGraph nodes={nodes} edges={links} query={query} selectedId={selected} selectedEdgeId={selectedEdge} onSelect={selectDoc} onEdgeSelect={id => { setSelectedEdge(id); setSelected(''); }}/>
      </section>
      {edge ? <Inspector title="Why these sources connect" onClose={close}>
        <span className="knowledge-kicker">SHARED EVIDENCE</span>
        <div className="connection-endpoints">{[edge.source, edge.target].map(id => <button key={id} onClick={() => selectDoc(id)}>{docs.find(d => d.doc_id === id)?.filename ?? id}<ArrowUpRight size={14}/></button>)}</div>
        <h3>{edge.weight} shared {edge.weight === 1 ? 'entity' : 'entities'}</h3><div className="chips">{connectionNames(edge).map(name => <span className="badge" key={name}>{name}</span>)}</div>
        <p>These entities occur in validated facts from both documents.</p>
        <dl><div><dt>Entity-set overlap</dt><dd>{Math.round(edge.similarity * 100)}%</dd></div></dl><p className="muted">Shared entities divided by all distinct entities in the two sources. This is not a semantic similarity score.</p>
        <Link className="veris-btn-secondary" to="/knowledge/entities">Explore entity evidence <ArrowUpRight size={14}/></Link>
      </Inspector> : doc ? <Inspector title={doc.filename} onClose={close}>
        <span className="knowledge-kicker">SOURCE DETAILS</span><dl><div><dt>Passages</dt><dd>{doc.chunks}</dd></div><div><dt>Extraction</dt><dd>{doc.extraction_status}</dd></div></dl>
        <h3>Extracted topics</h3><div className="chips">{doc.key_topics?.length ? doc.key_topics.map(topic => <span className="badge" key={topic}>{topic}</span>) : <p>No topics extracted yet.</p>}</div>
        <h3>Connected sources · {related.length}</h3><div className="connection-list">{related.map(e => <button key={e.id} onClick={() => { setSelectedEdge(e.id); setSelected(''); }}><strong>{docs.find(d => d.doc_id === (e.source === selected ? e.target : e.source))?.filename}</strong><span>{connectionNames(e).join(' · ') || e.label}</span><small>{e.weight} shared · {Math.round(e.similarity * 100)}% entity overlap</small></button>)}</div>
        {!related.length && <p>No connections at this threshold.</p>}
        <div className="inspector-actions"><Link className="veris-btn-primary" to={'/documents?doc=' + encodeURIComponent(doc.doc_id)}>Open document <ArrowUpRight size={14}/></Link><Link to={'/knowledge/chunks?document=' + encodeURIComponent(doc.doc_id)}>Read source passages</Link></div>
      </Inspector> : null}
    </div>}
  </>;
}
export default DocumentGraphPage;
