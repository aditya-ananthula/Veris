import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Network, Cloud, Share2 } from 'lucide-react';
import { useKnowledge, KnowledgeStatus } from './KnowledgeLayout';
import { useKnowledgeData } from '../hooks/useKnowledgeData';
import { GlassGraph } from '../components/charts/GlassGraph';
import { ProjectionPreview } from '../components/charts/ChunkCloud';
import { connectionNames, documentConnection } from '../components/charts/documentConnections';
import { colorFor } from '../components/charts/knowledgeLayout';

export function KnowledgePage() {
  const { sessionId, revision } = useKnowledge();
  const nav = useNavigate();
  const graph = useKnowledgeData(sessionId, 'graph', revision);
  const chunks = useKnowledgeData(sessionId, 'chunks', revision);
  const entities = useKnowledgeData(sessionId, 'entities', revision);
  const docs = graph.data?.documents ?? [];
  const edges = graph.data?.edges ?? [];
  const connections = [...edges].sort((a, b) => b.weight - a.weight || a.source.localeCompare(b.source)).slice(0, 4);
  const openDocument = (id: string) => nav('/knowledge/graph?document=' + encodeURIComponent(id));
  return <>
    <KnowledgeStatus loading={graph.loading} error={graph.error} empty={!docs.length}/>
    {!graph.loading && !graph.error && !!docs.length && <>
      <div className="atlas-main">
        <section className="atlas-map">
        <header className="atlas-section-heading"><div><span className="knowledge-kicker">01 / SOURCE GRAPH</span><h2>How your sources connect</h2><p>Each node is a document. Links represent shared entities, not a relevance score.</p></div><Link to="/knowledge/graph" aria-label="Open Document Graph"><ArrowUpRight size={22}/></Link></header>
          <GlassGraph height={430} nodes={docs.map(d => ({ id: d.doc_id, label: d.filename, type: 'document', detail: `${d.chunks} passages` }))} edges={edges.map(documentConnection)} onSelect={openDocument} onEdgeSelect={id => { const edge = edges.map(documentConnection).find(e => e.id === id); if (edge) openDocument(edge.source); }}/>
        </section>
        <aside className="atlas-discoveries"><span className="knowledge-kicker">SHARED EVIDENCE</span><h2>Strongest connections</h2><p>Ranked by shared-entity count. Select a pair to inspect its sources.</p>
          <div className="connection-list">{connections.map((e, i) => <button key={e.source + e.target} onClick={() => openDocument(e.source)}><span className="connection-rank">0{i + 1} <ArrowUpRight size={15}/></span><strong>{connectionNames(e).join(' · ') || `${e.weight} shared entities`}</strong><span>{docs.find(d => d.doc_id === e.source)?.filename}<br/>{docs.find(d => d.doc_id === e.target)?.filename}</span><small>{e.weight} shared {e.weight === 1 ? 'entity' : 'entities'} · {Math.round(e.similarity * 100)}% overlap</small></button>)}</div>
          {!connections.length && <div className="atlas-no-connections"><Network size={28}/><h3>Independent sources, for now.</h3><p>Connections appear when validated facts mention the same entity in more than one document.</p></div>}
        </aside>
      </div>
      <div className="atlas-secondary">
        <section className="atlas-card atlas-passages"><header><span className="knowledge-kicker">02 / SOURCE PASSAGES</span><Cloud size={20}/></header><h2>Read the evidence</h2><p>Search stored passages, see their source context, and open the original document.</p>
          {chunks.loading || chunks.error ? <KnowledgeStatus loading={chunks.loading} error={chunks.error} empty={false}/> : chunks.data?.chunks.some(c => c.projection) ? <ProjectionPreview chunks={chunks.data.chunks}/> : <div className="atlas-empty-preview">{chunks.data?.chunks.length ? 'Passages are available to read. No projection is available yet.' : 'No stored passages yet.'}</div>}
          <Link className="atlas-open" to="/knowledge/chunks">Explore Chunk Cloud <ArrowUpRight size={18}/></Link>
        </section>
        <section className="atlas-card atlas-entities"><header><span className="knowledge-kicker">03 / EXTRACTED ENTITIES</span><Share2 size={20}/></header><h2>People, organizations, and ideas</h2><p>Entities are linked to the facts and passages that mention them.</p>
          {entities.loading || entities.error ? <KnowledgeStatus loading={entities.loading} error={entities.error} empty={false}/> : <div className="atlas-entity-index">{[...(entities.data ?? [])].sort((a, b) => b.fact_count - a.fact_count).slice(0, 8).map(e => <Link key={e.entity_id} to={'/knowledge/entities?q=' + encodeURIComponent(e.canonical_name)}><i style={{ backgroundColor: colorFor(e.entity_type) }}/><span><strong>{e.canonical_name}</strong><small>{e.entity_type}</small></span><em>{e.fact_count} facts</em></Link>)}{!entities.data?.length && <p>No entities extracted yet.</p>}</div>}
          <Link className="atlas-open" to="/knowledge/entities">Explore entities <ArrowUpRight size={18}/></Link>
        </section>
      </div>
    </>}
  </>;
}
export default KnowledgePage;
