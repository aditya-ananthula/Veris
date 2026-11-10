import { createContext, useContext, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Network, Cloud, Share2, RefreshCw, Compass } from 'lucide-react';
import { useSession } from '../hooks/useSession';
import { clearKnowledgeCache, useKnowledgeData } from '../hooks/useKnowledgeData';
import '../styles/knowledge.css';

const Context = createContext({ sessionId: '', revision: 0, refresh: () => {} });
export const useKnowledge = () => useContext(Context);
export const knowledgeViews = [
  { path: 'graph', title: 'Document Graph', icon: Network, description: 'See which sources share entities and inspect the evidence behind each link.' },
  { path: 'chunks', title: 'Chunk Cloud', icon: Cloud, description: 'Search source passages, inspect their context, and open the original document.' },
  { path: 'entities', title: 'Entities & Relationships', icon: Share2, description: 'Trace extracted facts and relationships back to their supporting passages.' },
];
const totalLabels = [
  { key: 'documents', label: 'Documents' },
  { key: 'chunks', label: 'Passages' },
  { key: 'entities', label: 'Entities' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'facts', label: 'Facts' },
  { key: 'topics', label: 'Topics' },
] as const;
export function KnowledgeLayout() {
  const { sessionId } = useSession();
  const [revision, setRevision] = useState(0);
  const { pathname } = useLocation();
  const view = knowledgeViews.find(v => pathname.endsWith('/' + v.path));
  const refresh = () => { clearKnowledgeCache(sessionId); setRevision(r => r + 1); };
  const stats = useKnowledgeData(sessionId, 'stats', revision);
  return <Context.Provider value={{ sessionId, revision, refresh }}>
    <section className={"knowledge" + (view ? " knowledge-detail" : "")}>
      <header className="knowledge-heading">
        <div><span className="knowledge-kicker">KNOWLEDGE / {view ? 'EXPLORER' : 'ATLAS'}</span><h1>{view?.title ?? 'Knowledge atlas'}</h1><p>{view?.description ?? 'Map your sources, follow shared entities, and inspect the evidence behind each connection.'}</p></div>
        <button onClick={refresh} className="knowledge-refresh" aria-label="Refresh knowledge data"><RefreshCw size={15} /> Refresh</button>
      </header>
      <div className="knowledge-totals" aria-label="Workspace totals">
        {totalLabels.map(({ key, label }) => {
          const value = stats.data?.[key];
          return <div key={key} title={value === undefined ? `${label} count unavailable` : `${value.toLocaleString()} ${label.toLowerCase()} in this workspace`}><strong>{stats.loading || stats.error || value === undefined ? '—' : value.toLocaleString()}</strong><span>{label}</span></div>;
        })}
      </div>
      <nav className="knowledge-tabs" aria-label="Knowledge views">
        <NavLink to="/knowledge" end><Compass size={16}/> Atlas</NavLink>
        {knowledgeViews.map(v => <NavLink key={v.path} to={'/knowledge/' + v.path}><v.icon size={16}/>{v.title}</NavLink>)}
      </nav>
      {stats.error && <button className="error" onClick={refresh}>Workspace totals unavailable. Retry</button>}
      <Outlet />
    </section>
  </Context.Provider>;
}
export function KnowledgeStatus({ loading, error, empty }: { loading: boolean; error: string; empty: boolean }) {
  const { refresh } = useKnowledge();
  if (error) return <div className="status error" role="alert"><h2>Unable to load this view</h2><p>{error}</p><button onClick={refresh}>Retry</button></div>;
  if (loading) return <div className="loading-state" role="status" aria-label="Loading knowledge"><span>Gathering your evidence…</span><div className="skeleton"/><div className="skeleton"/></div>;
  if (empty) return <div className="empty-state"><Compass size={32}/><h2>Your next discovery starts with a source.</h2><p>Upload documents to reveal their passages, entities and connections.</p><NavLink to="/documents" className="veris-btn-primary">Open Documents</NavLink></div>;
  return null;
}
