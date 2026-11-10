import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText, Trash2, ExternalLink, Sparkles, Network } from 'lucide-react';
import { api, sourceUrl } from '../services/api';
import { useSession } from '../hooks/useSession';
import { clearKnowledgeCache } from '../hooks/useKnowledgeData';
import { DocumentUpload } from '../components/DocumentUpload';
import { Inspector } from '../components/Inspector';
import type { IntelDocument } from '../types';

export const statusOf = (d: IntelDocument) => d.index_available === false || d.extraction_status === 'failed' ? 'Failed' : ['pending','extracting'].includes(d.extraction_status) ? 'Processing' : 'Completed';
export const fileSize = (n?: number | null) => n == null ? 'Unavailable' : n < 1024 ? n+' B' : n < 1048576 ? (n / 1024).toFixed(1)+' KB' : (n / 1048576).toFixed(2)+' MB';
export function DocumentsPage() {
  const { sessionId } = useSession();
  const [params] = useSearchParams();
  const [docs, setDocs] = useState<IntelDocument[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(''), [status, setStatus] = useState('All'), [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState<Set<string>>(new Set()), [inspected, setInspected] = useState('');
  const [page, setPage] = useState(0);
  const load = useCallback(async () => {
    if (!sessionId) return;
    setError('');
    try { setDocs(await api.intelDocuments(sessionId)); }
    catch(e) { setError(e instanceof Error ? e.message : 'Unable to load documents.'); }
    finally { setLoading(false); }
  }, [sessionId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!docs.some(d => statusOf(d) === 'Processing')) return; const timer = setInterval(() => void load(), 5000); return () => clearInterval(timer); }, [docs, load]);
  useEffect(() => { const d = docs.find(d => d.doc_id === params.get('doc') || d.filename === params.get('file')); if (d) setInspected(d.doc_id); }, [docs, params]);
  useEffect(() => setPage(0), [query, status, sort]);
  const rows = useMemo(() => docs.filter(d => d.filename.toLowerCase().includes(query.toLowerCase()) && (status === 'All' || statusOf(d) === status)).sort((a,b) => sort === 'name' ? a.filename.localeCompare(b.filename) : sort === 'chunks' ? b.chunks-a.chunks : (b.created_at ?? 0)-(a.created_at ?? 0)), [docs,query,status,sort]);
  const visible = rows.slice(page*30, (page+1)*30), doc = docs.find(d => d.doc_id === inspected);
  const remove = async (targets: IntelDocument[]) => {
    if (!targets.length || !window.confirm('Delete '+targets.length+' document(s), original files and all associated indexed evidence? This cannot be undone.')) return;
    setBusy(true); setError(''); let done = 0, failure = '';
    try { for (const d of targets) { await api.deleteDocument(d.filename, sessionId); done++; } }
    catch(e) { failure = e instanceof Error ? e.message : 'Deletion failed.'; }
    finally { clearKnowledgeCache(sessionId); setSelected(new Set()); setInspected(''); setNotice(done+' document(s) deleted.'); await load(); if (failure) setError(failure); setBusy(false); }
  };
  const retry = async (d: IntelDocument) => {
    setBusy(true); setError(''); let failure = '';
    try { await api.intelRetry(d.doc_id, sessionId); }
    catch(e) { failure = e instanceof Error ? e.message : 'Analysis failed.'; }
    finally { clearKnowledgeCache(sessionId); await load(); if (failure) setError(failure); setBusy(false); }
  };
  const toggle = (id: string) => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  return <section className="page">
    <header className="page-heading"><div><h1>Documents</h1><p>Manage and inspect your source material.</p></div><button className="veris-btn-danger" disabled={busy || !docs.length} onClick={() => void remove(docs)}><Trash2 size={18}/>Delete All</button></header>
    {error && <div className="status error" role="alert">{error}<button onClick={() => void load()}>Refresh documents</button></div>}{notice && <p role="status">{notice}</p>}
    <div className={'document-workspace'+(doc ? ' has-inspector' : '')}><div className="document-main">
      <DocumentUpload sessionId={sessionId} onComplete={load}/>
      <div className="controls-bar"><div className="status-tabs">{['All','Processing','Completed','Failed'].map(s => <button key={s} aria-pressed={s === status} className={s === status ? 'active' : ''} onClick={() => setStatus(s)}>{s} ({docs.filter(d => s === 'All' || statusOf(d) === s).length})</button>)}</div>
        <input type="search" aria-label="Search documents" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search documents…"/>
        <select aria-label="Sort documents" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Date added</option><option value="name">Name</option><option value="chunks">Chunk count</option></select></div>
      <div className="panel table-panel">{loading ? <p role="status">Loading documents…</p> : <><div className="table-scroll"><table className="document-table"><thead><tr><th><input type="checkbox" aria-label="Select all matching documents" checked={!!rows.length && rows.every(d => selected.has(d.doc_id))} onChange={e => setSelected(e.target.checked ? new Set(rows.map(d => d.doc_id)) : new Set())}/></th><th>Name</th><th>Type</th><th>Size</th><th>Chunks</th><th>Status</th><th>Date added</th><th>Actions</th></tr></thead><tbody>{visible.map(d => <tr key={d.doc_id} className={inspected === d.doc_id ? 'selected' : ''}><td><input type="checkbox" aria-label={'Select '+d.filename} checked={selected.has(d.doc_id)} onChange={() => toggle(d.doc_id)}/></td><td><button className="document-name" onClick={() => setInspected(d.doc_id)}><FileText size={19}/>{d.filename}</button></td><td><span className="badge">{d.extension.replace('.','').toUpperCase()}</span></td><td>{fileSize(d.size_bytes)}</td><td>{d.chunks.toLocaleString()}</td><td><span className={'badge status-'+statusOf(d).toLowerCase()}>{statusOf(d)}</span></td><td>{d.created_at ? new Date(d.created_at*1000).toLocaleDateString() : 'Unavailable'}</td><td><button aria-label={'Delete '+d.filename} disabled={busy} onClick={() => void remove([d])}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>
        {!rows.length && <div className="empty-state"><h2>{docs.length ? 'No matching documents' : 'Your library starts here'}</h2><p>{docs.length ? 'Try another search or status.' : 'Upload your first document above.'}</p></div>}
        {rows.length > 30 && <div className="pager"><button disabled={!page} onClick={() => setPage(p => p-1)}>Previous</button><span>{page+1} / {Math.ceil(rows.length/30)}</span><button disabled={(page+1)*30 >= rows.length} onClick={() => setPage(p => p+1)}>Next</button></div>}</>}</div>
      {!!selected.size && <div className="panel selection-bar"><span>{selected.size} document(s) selected</span><button className="veris-btn-danger" disabled={busy} onClick={() => void remove(docs.filter(d => selected.has(d.doc_id)))}><Trash2 size={16}/>Delete Selected</button></div>}
    </div>{doc && <Inspector title={doc.filename} onClose={() => setInspected('')}><p>{doc.extension.toUpperCase()} · {fileSize(doc.size_bytes)}</p><h3>Summary</h3><p>{doc.summary || 'No summary has been extracted for this source.'}</p><dl><div><dt>Chunks</dt><dd>{doc.chunks}</dd></div><div><dt>Entities</dt><dd>{doc.entity_count ?? 0}</dd></div><div><dt>Added</dt><dd>{doc.created_at ? new Date(doc.created_at*1000).toLocaleString() : 'Unavailable'}</dd></div><div><dt>Analysis</dt><dd>{doc.extraction_status}</dd></div></dl><div className="chips">{doc.key_topics?.map(t => <span className="badge" key={t}>{t}</span>)}</div>{doc.index_available === false && <p role="status">The vector index is unavailable for this legacy document. Re-upload its original file to restore search and passages. Stored findings have been preserved.</p>}{doc.extraction_error && <p className="muted">{doc.extraction_error}</p>}
      {['failed','skipped'].includes(doc.extraction_status) && <button disabled={busy} onClick={() => void retry(doc)}>Retry analysis</button>}
      <div className="inspector-actions">{doc.source_available ? <a className="veris-btn-primary" href={sourceUrl(sessionId,doc.doc_id)} target="_blank" rel="noreferrer"><ExternalLink size={16}/>Open document</a> : <p>Original file unavailable for this legacy source. Recorded findings are preserved; passages are available only while its vector index exists.</p>}<Link className="veris-btn-secondary" to={'/intelligence?doc='+encodeURIComponent(doc.doc_id)}><Sparkles size={16}/>Ask about this document</Link><Link className="veris-btn-secondary" to={'/knowledge/chunks?document='+encodeURIComponent(doc.doc_id)}><Network size={16}/>Visualize passages</Link></div>
    </Inspector>}</div>
  </section>;
}