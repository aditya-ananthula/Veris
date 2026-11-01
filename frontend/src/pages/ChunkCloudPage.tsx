import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../services/api';
import { useSession } from '../hooks/useSession';
import { ChunkCloud } from '../components/charts';
import type { IntelDocument } from '../types';
export function ChunkCloudPage() {
  const { sessionId } = useSession();
  const [docs, setDocs] = useState<IntelDocument[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!sessionId) return;
    api.intelDocuments(sessionId).then(setDocs).catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load documents.'));
  }, [sessionId]);
  const shown = docs.filter((d) => !q.trim() || d.filename.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/knowledge" className="veris-btn-ghost">‹ Knowledge</Link>
        <div><h1 className="text-[19px] font-semibold text-white">Chunk Cloud</h1>
        <p className="text-[12px] text-slate-400">Explore semantic similarity across all document chunks.</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1" style={{ minWidth: 180 }}>
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chunks..." className="veris-input" style={{ paddingLeft: 30 }} />
        </div>
        <button onClick={() => setQ('')} className="veris-btn-ghost">Clear search</button>
      </div>
      <div className="veris-panel relative p-2">
        {error && <p className="mx-2 mt-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">{error}</p>}
        {shown.length === 0 ? (
          <p className="px-4 py-14 text-center text-[12.5px] text-slate-500">No chunks indexed yet — upload documents first.</p>
        ) : (
          <ChunkCloud sessionId={sessionId} documents={shown.map((d) => ({ doc_id: d.doc_id, filename: d.filename, chunks: d.chunks }))} height={520} />
        )}
      </div>
    </div>
  );
}
