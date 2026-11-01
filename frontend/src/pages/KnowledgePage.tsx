import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AiOrb } from '../components/AiOrb';
import { api } from '../services/api';
import { useSession } from '../hooks/useSession';
import type { IntelStatsResponse } from '../types';
export function KnowledgePage() {
  const { sessionId } = useSession();
  const [s, setS] = useState<IntelStatsResponse | null>(null);
  useEffect(() => { if (sessionId) api.intelStats(sessionId).then(setS).catch(() => {}); }, [sessionId]);
  const cards = [
    { to: '/knowledge/graph', t: 'Document Graph', d: 'Visualize how your documents connect based on shared themes, topics and content similarity.', b: 'Open Document Graph', n: (s?.documents ?? 0) + ' nodes' },
    { to: '/knowledge/chunks', t: 'Chunk Cloud', d: 'Explore semantic similarity across all document chunks using embeddings.', b: 'Open Chunk Cloud', n: (s?.chunks ?? 0) + ' points' },
    { to: '/knowledge/entities', t: 'Entities & Relationships', d: 'Discover key entities, concepts and relationships extracted from your documents.', b: 'Open Entities & Relationships', n: (s?.entities ?? 0) + ' entities' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="veris-panel p-6 sm:p-8" style={{ minHeight: 280 }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] sm:text-[28px] font-semibold text-white leading-tight">Knowledge</h1>
            <p className="mt-1 text-[13px] text-slate-400">Explore your documents through interactive visualizations.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Link to="/knowledge/graph" className="veris-tab veris-tab-active">Document Graph</Link>
              <Link to="/knowledge/chunks" className="veris-tab">Chunk Cloud</Link>
              <Link to="/knowledge/entities" className="veris-tab">Entities & Relationships</Link>
            </div>
          </div>
          <AiOrb size={72} />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.t} className="veris-panel veris-cap-card p-4 sm:p-5">
            <p className="text-[15px] font-semibold text-white">{c.t}</p>
            <p className="mt-1 min-h-[58px] text-[12px] leading-relaxed text-slate-400">{c.d}</p>
            <p className="mt-1 text-[11px] text-slate-500">{c.n}</p>
            <Link to={c.to} className="veris-btn-primary mt-3 w-full">{c.b}</Link>
          </div>
        ))}
      </div>
      <div className="veris-panel veris-panel-neon flex flex-wrap items-center gap-x-8 gap-y-2 px-5 py-4">
        <p className="text-[12px] font-semibold text-white">Knowledge Insights</p>
        <span className="text-[12px] text-slate-300"><b className="text-white">{s?.chunks ?? 0}</b> <span className="text-slate-500">Total Chunks</span></span>
        <span className="text-[12px] text-slate-300"><b className="text-white">{s?.entities ?? 0}</b> <span className="text-slate-500">Entities</span></span>
        <span className="text-[12px] text-slate-300"><b className="text-white">{s?.relationships ?? 0}</b> <span className="text-slate-500">Relationships</span></span>
        <span className="text-[12px] text-slate-300"><b className="text-white">{s?.documents ?? 0}</b> <span className="text-slate-500">Documents</span></span>
      </div>
    </div>
  );
}
