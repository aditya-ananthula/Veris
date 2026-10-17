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
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-[20px] font-semibold text-white">Knowledge</h1>
        <p className="text-[12.5px] text-slate-400">Explore your documents through interactive visualizations.</p>
        <div className="mt-2 flex gap-1.5">
          <Link to="/knowledge/graph" className="veris-tab">Document Graph</Link>
          <Link to="/knowledge/chunks" className="veris-tab">Chunk Cloud</Link>
          <Link to="/knowledge/entities" className="veris-tab">Entities & Relationships</Link>
        </div></div>
        <AiOrb size={64} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.t} className="veris-panel p-5">
            <p className="text-[13px] font-semibold text-white">{c.t}</p>
            <p className="mt-1 min-h-[54px] text-[11.5px] leading-relaxed text-slate-400">{c.d}</p>
            <p className="mt-1 text-[10.5px] text-slate-500">{c.n}</p>
            <Link to={c.to} className="veris-btn-primary mt-3 w-full">{c.b}</Link>
          </div>
        ))}
      </div>
      <div className="veris-panel flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
        <p className="text-[12px] font-semibold text-white">Knowledge Insights</p>
        <span className="text-[12px] text-slate-300"><b className="text-white">{s?.chunks ?? 0}</b> <span className="text-slate-500">Total Chunks</span></span>
        <span className="text-[12px] text-slate-300"><b className="text-white">{s?.entities ?? 0}</b> <span className="text-slate-500">Entities</span></span>
        <span className="text-[12px] text-slate-300"><b className="text-white">{s?.relationships ?? 0}</b> <span className="text-slate-500">Relationships</span></span>
        <span className="text-[12px] text-slate-300"><b className="text-white">{s?.documents ?? 0}</b> <span className="text-slate-500">Documents</span></span>
      </div>
    </div>
  );
}
