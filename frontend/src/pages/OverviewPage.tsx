import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudUpload } from 'lucide-react';
import { api } from '../services/api';
import { useSession } from '../hooks/useSession';
import { AiOrb } from '../components/AiOrb';
import type { Capabilities, DocumentMeta } from '../types';

const CAPS = [
  { icon: 'Ask', t: 'Ask', d: 'Get grounded answers with source citations.' },
  { icon: 'Cmp', t: 'Compare', d: 'Find differences, similarities and conflicts.' },
  { icon: 'Exp', t: 'Explore', d: 'Visualize connections across documents.' },
  { icon: 'New', t: 'Discover', d: 'Extract key entities and relationships.' },
];

export function OverviewPage() {
  const { sessionId } = useSession();
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!sessionId) return;
    Promise.all([api.capabilities(), api.documentsMeta(sessionId)])
      .then(([c, m]) => { setCaps(c); setDocs(m); }).catch(() => {});
  }, [sessionId]);
  const upload = async (files: FileList | null) => {
    if (!files || !files.length || !sessionId) return;
    setBusy(true); setMsg('');
    try {
      for (const f of Array.from(files)) {
        const r = await api.absorb(f, sessionId);
        setMsg('Added ' + r.filename + ' (' + r.chunks_added + ' chunks).');
      }
      setDocs(await api.documentsMeta(sessionId));
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Upload failed.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="veris-panel p-6 sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] sm:text-[30px] font-semibold leading-tight tracking-tight text-white">
              Turn your documents<br />into intelligence.
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-slate-400">
              Upload, explore, ask questions, compare sources, and uncover hidden connections.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
              {CAPS.map((c) => (
                <div key={c.t} className="veris-panel veris-cap-card p-3">
                  <span className="veris-cap-icon">{c.icon}</span>
                  <p className="mt-2 text-[13px] font-semibold text-white">{c.t}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{c.d}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-center gap-3">
            <AiOrb size={185} />
            <p className="hidden text-right text-[11px] leading-relaxed text-slate-500 lg:block">
              More<br />Clarity.<br />Deeper<br />Understanding.
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="veris-panel veris-panel-neon p-6 text-center">
          <CloudUpload size={30} className="mx-auto text-violet-300" />
          <p className="mt-2 text-[13.5px] font-semibold text-white">Upload your documents to get started</p>
          <p className="mx-auto mt-1 max-w-xs text-[11.5px] text-slate-400">
            Drag and drop files here or click to browse.
          </p>
          <button className="veris-btn-primary mt-4" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? 'Uploading...' : 'Browse Files'}
          </button>
          <input ref={fileRef} type="file" multiple className="hidden"
            accept={caps?.supported_extensions.join(',')}
            onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />
          {msg && <p className="mt-3 text-[11.5px] text-cyan-300">{msg}</p>}
          {docs.length > 0 && <p className="mt-1 text-[11px] text-slate-500">{docs.length} documents in workspace</p>}
        </div>
        <div className="veris-panel p-6">
          <p className="text-[13px] font-semibold text-white">See what you can do</p>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="veris-step-num">1</span>
              <div><p className="text-[13px] font-semibold text-slate-100">Upload documents</p>
              <p className="text-[11.5px] text-slate-400">Add your research, reports or notes</p></div>
            </div>
            <div className="flex items-start gap-3">
              <span className="veris-step-num">2</span>
              <div><p className="text-[13px] font-semibold text-slate-100">We process and analyze</p>
              <p className="text-[11.5px] text-slate-400">Extract text, create chunks, generate embeddings</p></div>
            </div>
            <div className="flex items-start gap-3">
              <span className="veris-step-num">3</span>
              <div><p className="text-[13px] font-semibold text-slate-100">Explore and ask</p>
              <p className="text-[11.5px] text-slate-400">Visualize, compare and get insights with sources.</p></div>
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <Link to="/documents" className="veris-btn-ghost">Documents</Link>
            <Link to="/intelligence" className="veris-btn-ghost">Intelligence</Link>
            <Link to="/knowledge" className="veris-btn-ghost">Knowledge</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
