import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, RotateCcw, Plus, Minus, Maximize } from 'lucide-react';
import { api } from '../services/api';
import { useSession } from '../hooks/useSession';
import { RankedDocumentGraph } from '../components/charts';
import type { IntelDocumentGraphResponse, IntelEntity, IntelRelationship } from '../types';
export function DocumentGraphPage() {
  const { sessionId } = useSession();
  const [g, setG] = useState<IntelDocumentGraphResponse | null>(null);
  const [ents, setEnts] = useState<IntelEntity[]>([]);
  const [rels, setRels] = useState<IntelRelationship[]>([]);
  const [q, setQ] = useState('');
  const [zoom, setZoom] = useState(1);
  const [sel, setSel] = useState('');
  useEffect(() => {
    if (!sessionId) return;
    Promise.all([api.intelDocumentGraph(sessionId), api.intelEntities(sessionId), api.intelRelationships(sessionId)])
      .then(([gg, e, r]) => { setG(gg); setEnts(e); setRels(r); }).catch(() => {});
  }, [sessionId]);
  const docs = useMemo(() => (g?.documents ?? []).filter((d) => !q.trim() || d.filename.toLowerCase().includes(q.trim().toLowerCase())), [g, q]);
  const selected = docs.find((d) => d.doc_id === sel) ?? docs[0];
  const conns = useMemo(() => (g?.edges ?? []).filter((e) => selected && (e.source === selected.doc_id || e.target === selected.doc_id)).slice(0, 6), [g, selected]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/knowledge" className="veris-btn-ghost">‹ Knowledge</Link>
        <div><h1 className="text-[19px] font-semibold text-white">Document Graph</h1>
        <p className="text-[12px] text-slate-400">Explore how your documents connect through shared content.</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents..." className="veris-input" style={{ paddingLeft: 30 }} />
        </div>
        <select className="veris-input" style={{ width: 130 }}><option>All Documents</option></select>
        <select className="veris-input" style={{ width: 135 }}><option>All Connections</option></select>
        <button onClick={() => { setQ(''); setSel(''); setZoom(1); }} className="veris-btn-ghost"><RotateCcw size={13} /> Reset</button>
      </div>
      <div className="grid gap-3 xl:grid-cols-[1fr_290px]">
        <div className="veris-panel relative p-2">
          <div style={{ transform: 'scale(' + zoom + ')', transformOrigin: 'center', transition: 'transform .25s' }}>
            <RankedDocumentGraph documents={docs} relationships={rels} entities={ents} height={470} />
          </div>
          <div className="absolute bottom-3 left-3 flex gap-1.5">
            <button onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.15).toFixed(2)))} className="veris-btn-ghost" style={{ padding: '5px 9px' }} aria-label="Zoom in"><Plus size={13} /></button>
            <button onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))} className="veris-btn-ghost" style={{ padding: '5px 9px' }} aria-label="Zoom out"><Minus size={13} /></button>
            <button onClick={() => setZoom(1)} className="veris-btn-ghost" style={{ padding: '5px 10px' }}><Maximize size={12} /> Fit View</button>
          </div>
          <div className="absolute bottom-3 right-3 hidden items-center gap-2 text-[10.5px] text-slate-500 sm:flex">
            Connection Strength <span className="inline-block h-1.5 w-16 rounded-full" style={{ background: 'linear-gradient(90deg,#22d3ee,#a78bfa,#f472b6)' }} />
          </div>
        </div>
        <div className="veris-panel p-4">
          {!selected ? <p className="text-[12px] text-slate-500">Upload documents to inspect connections.</p> : (
            <div>
              <p className="truncate text-[13px] font-semibold text-white">{selected.filename}</p>
              <p className="text-[10.5px] text-slate-500">{selected.chunks} chunks · Processed</p>
              <div className="mt-2 flex gap-1.5 text-[10.5px]"><span className="veris-tab veris-tab-active">Overview</span><span className="veris-tab">Related ({conns.length})</span></div>
              <p className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Key Topics</p>
              <div className="flex flex-wrap gap-1.5">{(selected.key_topics ?? []).slice(0, 6).map((t) => (<span key={t} className="veris-pill" style={{ cursor: 'default' }}>{t}</span>))}{(selected.key_topics ?? []).length === 0 && <span className="text-[11px] text-slate-500">No topics yet.</span>}</div>
              <p className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Connected Documents</p>
              <div className="flex flex-col gap-1.5">{conns.map((c, i) => (<div key={i} className="flex items-center justify-between rounded-lg bg-black/30 px-2.5 py-1.5 text-[11px] text-slate-300"><span className="truncate">{c.rel_type}</span><span className="font-mono text-cyan-300">{c.similarity?.toFixed(2)}</span></div>))}{conns.length === 0 && <span className="text-[11px] text-slate-500">No shared-entity links yet.</span>}</div>
              {!!sel || docs[0] ? <button onClick={() => selected && setSel(selected.doc_id)} className="veris-btn-primary mt-4 w-full">Open Document</button> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
