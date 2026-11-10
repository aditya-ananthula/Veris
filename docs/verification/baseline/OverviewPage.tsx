import { useRef } from 'react';
import { CloudUpload, Sparkles, GitCompareArrows, Network } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useSession } from '../hooks/useSession';

const CAPS = [
  { Icon: Sparkles, t: 'Ask', d: 'Get grounded answers with source citations from your documents.', color: 'var(--emerald)', bg: 'rgba(110,231,183,0.10)' },
  { Icon: GitCompareArrows, t: 'Compare', d: 'Find differences, similarities and conflicts across docs.', color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
  { Icon: Network, t: 'Explore', d: 'Visualize connections between your documents.', color: '#67e8f9', bg: 'rgba(103,232,249,0.14)' },
  { Icon: CloudUpload, t: 'Upload', d: 'Drag and drop PDF, DOCX, TXT, MD files to get started.', color: 'var(--amber)', bg: 'rgba(245,158,11,0.12)' },
];

const routeFor = (label: string): string => {
  if (label === 'Ask') return '/intelligence';
  if (label === 'Compare') return '/intelligence';
  if (label === 'Explore') return '/knowledge/graph';
  return '/documents';
};

export function OverviewPage() {
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
        <h1 className="text-on-bg">Turn your documents<br />into <span className="text-gradient">intelligence.</span></h1>
        <p className="sub">Upload, explore, ask questions, compare sources, and uncover hidden connections — all in one place.</p>
      </section>

      <div className="cards">
        {CAPS.map((c) => (
          <Link
            key={c.t}
            to={routeFor(c.t)}
            className="card flex flex-col gap-3 cursor-pointer rounded-xl border border-slate-600/40 bg-slate-800/40 p-4 hover:border-accent-500/50 hover:bg-slate-700/60 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-accent-500/50 focus-visible:outline-offset-2"
            aria-label={c.t}
          >
            <div className="ci" style={{ color: c.color, borderColor: c.color, background: c.bg }}>
              <c.Icon size={16} stroke={c.color} />
            </div>
            <h3 className="margin-0 text-[15px] font-semibold text-slate-100">{c.t}</h3>
            <p className="text-[12px] text-slate-400 leading-1.5">{c.d}</p>
          </Link>
        ))}
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
          <button className="veris-btn-ghost" id="browse" type="button" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} style={{ fontSize: '11px', padding: '6px 12px', gap: '6px' }}>Browse Files</button>
          <input ref={fileRef} type="file" multiple hidden accept=".pdf,.docx,.txt,.md" onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ''; }} />
        </div>
        <div className="glass see">
          <h2>See what you can do</h2>
          <div className="step"><div className="n">1</div><div><h4>Upload documents</h4><p>Add your research, reports, or notes. PDF, DOCX, TXT, MD supported.</p></div></div>
          <div className="step"><div className="n">2</div><div><h4>We process & analyze</h4><p>Extract text, create chunks, generate embeddings, identify entities and relationships.</p></div></div>
          <div className="step"><div className="n">3</div><div><h4>Explore & ask</h4><p>Visualize connections, compare documents, and get insights with sources.</p></div></div>
        </div>
      </div>

      <div className="toast" id="toast" role="status"></div>
    </>
  );
}
