import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, RotateCcw } from 'lucide-react';
import { api } from '../services/api';
import { useSession } from '../hooks/useSession';
import { DependencyMap } from '../components/charts';
import type { IntelEntity, IntelEntityDetailResponse, IntelRelationship } from '../types';
export function EntitiesPage() {
  const { sessionId } = useSession();
  const [ents, setEnts] = useState<IntelEntity[]>([]);
  const [rels, setRels] = useState<IntelRelationship[]>([]);
  const [q, setQ] = useState('');
  const [typeF, setTypeF] = useState('all');
  const [sel, setSel] = useState<IntelEntityDetailResponse | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!sessionId) return;
    Promise.all([api.intelEntities(sessionId), api.intelRelationships(sessionId)])
      .then(([e, r]) => { setEnts(e); setRels(r); setError(''); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load entities.'));
  }, [sessionId]);
  const shown = useMemo(() => ents.filter((e) => (!q.trim() || e.canonical_name.toLowerCase().includes(q.trim().toLowerCase())) && (typeF === 'all' || e.entity_type === typeF)), [ents, q, typeF]);
  const graph = useMemo(() => {
    const ids = new Set(shown.map((e) => e.entity_id));
    return {
      nodes: shown.slice(0, 60).map((e) => ({ id: e.entity_id, label: e.canonical_name, type: e.entity_type, factCount: e.fact_count, status: e.status })),
      edges: rels.filter((r) => ids.has(r.src_entity_id) && ids.has(r.dst_entity_id)).slice(0, 120).map((r) => ({ id: r.rel_id, source: r.src_entity_id, target: r.dst_entity_id, relType: r.rel_type, evidence: r.evidence })),
    };
  }, [shown, rels]);
  const open = async (id: string) => {
    if (!sessionId) return;
    try { setSel(await api.intelEntityDetail(sessionId, id)); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load entity details.'); }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/knowledge" className="veris-btn-ghost">Knowledge</Link>
        <div><h1 className="text-[19px] font-semibold text-white">Entities & Relationships</h1>
        <p className="text-[12px] text-slate-400">Explore key entities, concepts and how they connect.</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1" style={{ minWidth: 180 }}>
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entities..." className="veris-input" style={{ paddingLeft: 30 }} />
        </div>
        <select value={typeF} onChange={(e) => setTypeF(e.target.value)} className="veris-input" style={{ width: 130 }}>
          <option value="all">All Types</option><option value="person">Person</option><option value="organization">Organization</option><option value="product">Product</option><option value="date">Date</option>
        </select>
        <button onClick={() => { setQ(''); setTypeF('all'); setSel(null); }} className="veris-btn-ghost"><RotateCcw size={13} /> Reset</button>
      </div>
      {error && <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">{error}</p>}
      <div className="grid gap-3 xl:grid-cols-[1fr_290px]">
        <div className="veris-panel relative p-2">
          {graph.nodes.length === 0 ? <p className="px-4 py-14 text-center text-[12.5px] text-slate-500">No entities yet — upload documents first.</p> : <DependencyMap graph={graph} selectedId={sel?.entity_id} onSelect={(id) => void open(id)} height={520} />}
        </div>
        <div className="veris-panel p-4">
          <p className="text-[12px] font-semibold text-white">Entity Details</p>
          {!sel ? (
            <div className="mt-2 flex max-h-[380px] flex-col gap-1.5 overflow-y-auto">
              {shown.slice(0, 30).map((e) => (
                <button key={e.entity_id} onClick={() => void open(e.entity_id)} className="rounded-lg bg-black/30 px-2.5 py-1.5 text-left text-[11.5px] text-slate-200">{e.canonical_name} <span className="text-slate-500">· {e.entity_type}</span></button>
              ))}
              {shown.length === 0 && <p className="text-[11.5px] text-slate-500">No entities match.</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[13px] font-semibold text-white">{sel.canonical_name}</p>
              <p className="text-[10.5px] text-slate-500">{sel.entity_type} · {sel.fact_count} facts</p>
              <div className="mt-2 flex max-h-44 flex-col gap-1.5 overflow-y-auto">
                {(sel.facts ?? []).slice(0, 8).map((f) => (<div key={f.fact_id} className="rounded-lg border border-slate-700/40 bg-black/30 px-3 py-2 text-[11px] leading-relaxed text-slate-200"><span className="font-mono text-cyan-300">{f.subject}</span> <span className="text-slate-400">·</span> <span className="font-medium text-slate-100">{f.attribute}</span> <span className="text-slate-400">=</span> <span className="font-mono text-violet-300 truncate">{f.value}</span></div>))}
              </div>
              <div className="mt-3 border-t border-slate-700/40 pt-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Related Entities</p>
                <div className="flex flex-wrap gap-1.5">{(sel.related_entities ?? []).map((r) => (<button key={r.entity_id} onClick={() => void open(r.entity_id)} className="veris-pill">{r.canonical_name}</button>))}</div>
              </div>
              <button onClick={() => setSel(null)} className="veris-btn-ghost mt-4 w-full">Back to list</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
