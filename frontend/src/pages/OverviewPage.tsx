import { useRef } from 'react';
import { CloudUpload, Sparkles, GitCompareArrows, Network } from 'lucide-react';
import { api } from '../services/api';
import { useSession } from '../hooks/useSession';
import { useNavigate } from 'react-router-dom';

const CAPS = [
  { Icon: Sparkles, t: 'Ask', d: 'Get grounded answers with source citations.', color: 'var(--emerald)', bg: 'rgba(52,211,153,.14)' },
  { Icon: GitCompareArrows, t: 'Compare', d: 'Find differences, similarities and conflicts.', color: '#b79cff', bg: 'rgba(139,92,246,.2)' },
  { Icon: Network, t: 'Explore', d: 'Visualize connections across your documents.', color: '#7aa2ff', bg: 'rgba(79,108,247,.2)' },
  { Icon: CloudUpload, t: 'Discover', d: 'Extract key entities, concepts, relationships.', color: 'var(--amber)', bg: 'rgba(245,158,11,.16)' },
];

export function OverviewPage() {
  const navigate = useNavigate();
  const { sessionId } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files || !files.length || !sessionId) return;
    try {
      for (const f of Array.from(files)) {
        const r = await api.absorb(f, sessionId);
        toast('Added ' + r.filename + ' (' + r.chunks_added + ' chunks)');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed.');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length) upload(files);
  };

  const toast = (m: string) => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = m;
    el.classList.add('show');
    clearTimeout((window as any).__vt);
    (window as any).__vt = setTimeout(() => el.classList.remove('show'), 2200);
  };

  return (
    <>
      <section className="hero">
        <div id="orbpos" aria-hidden="true"></div>
        <div className="tag" aria-hidden="true">More<br />Clarity.<br />Deeper<br />Understanding.</div>
        <h1>Turn your documents<br />into intelligence.</h1>
        <p className="sub">Upload, explore, ask questions, compare sources, and uncover hidden connections — all in one place.</p>
      </section>

      <div className="cards">
        {CAPS.map((c) => {
          const Icon = c.Icon;
          return (
            <div key={c.t} className="card" tabIndex={0} data-t={c.t}
              onClick={() => { if (c.t === 'Ask') navigate('/intelligence'); if (c.t === 'Compare') navigate('/intelligence'); if (c.t === 'Explore') navigate('/knowledge/graph'); if (c.t === 'Discover') navigate('/knowledge/entities'); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { if (c.t === 'Ask') navigate('/intelligence'); if (c.t === 'Compare') navigate('/intelligence'); if (c.t === 'Explore') navigate('/knowledge/graph'); if (c.t === 'Discover') navigate('/knowledge/entities'); } }}>
              <div className="ci" style={{ color: c.color, borderColor: c.color, background: c.bg }}>
                <Icon size={16} stroke={c.color} />
              </div>
              <h3>{c.t}</h3>
              <p>{c.d}</p>
            </div>
          );
        })}
      </div>

      <div className="row">
        <div className="drop" id="drop" tabIndex={0} role="button" aria-label="Upload documents"
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
          onDragEnter={(e) => { e.preventDefault(); }}
          onDragOver={(e) => { e.preventDefault(); }}
          onDragLeave={(e) => { e.preventDefault(); }}
          onDrop={handleDrop}>
          <svg viewBox="0 0 48 48" fill="none" stroke="#d4c8ff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M14 34a9 9 0 0 1-1-17.9A12 12 0 0 1 36 18a8 8 0 0 1-1 16"/><path d="M24 40V24M18 29l6-6 6 6"/></svg>
          <h2>Upload your documents to get started</h2>
          <p>Drag &amp; drop files here, or click to browse</p>
          <p>PDF, DOCX, TXT, MD (Max 10MB)</p>
          <button className="btn" id="browse" type="button" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>Browse Files</button>
          <input ref={fileRef} type="file" multiple hidden accept=".pdf,.docx,.txt,.md" onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ''; }} />
        </div>
        <div className="glass see">
          <h2>See what you can do</h2>
          <div className="step"><div className="n">1</div><div><h4>Upload documents</h4><p>Add your research, reports or notes</p></div></div>
          <div className="step"><div className="n">2</div><div><h4>We process &amp; analyze</h4><p>Extract text, create chunks, generate embeddings, identify entities and relationships</p></div></div>
          <div className="step"><div className="n">3</div><div><h4>Explore &amp; ask</h4><p>Visualize, compare and get insights with sources.</p></div></div>
        </div>
      </div>

      <div className="toast" id="toast" role="status"></div>
    </>
  );
}
