import { useEffect, useMemo, useRef, useState } from 'react';
import { CloudUpload, Search, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { useSession } from '../hooks/useSession';
import type { Capabilities, IntelDocument } from '../types';
const STAGES = ['Extract Text', 'Create Chunks', 'Generate Embeddings', 'Extract Entities', 'Build Knowledge'];
const extOf = (n: string) => n.split('.').pop()?.toLowerCase() ?? '';
const stOf = (d: IntelDocument) => {
  const s = (d.extraction_status || d.status || '').toLowerCase();
  if (s.includes('fail') || s.includes('error')) return 'failed';
  if (s.includes('complete') || s.includes('valid') || s.includes('index') || d.chunks > 0) return 'completed';
  return 'processing';
};
export function DocumentsPage() {
  const { sessionId } = useSession();
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [docs, setDocs] = useState<IntelDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [typeF, setTypeF] = useState('all');
  const [sortF, setSortF] = useState('newest');
  const fileRef = useRef<HTMLInputElement>(null);
  const load = async (sid: string) => {
    try { const [c, d] = await Promise.all([api.capabilities(), api.intelDocuments(sid)]); setCaps(c); setDocs(d); } catch { /* keep */ }
  };
  useEffect(() => { if (sessionId) void load(sessionId); }, [sessionId]);
  const counts = useMemo(() => ({ all: docs.length, processing: docs.filter((d) => stOf(d) === 'processing').length, completed: docs.filter((d) => stOf(d) === 'completed').length, failed: docs.filter((d) => stOf(d) === 'failed').length }), [docs]);
  const rows = useMemo(() => {
    let r = [...docs];
    if (tab !== 'all') r = r.filter((d) => stOf(d) === tab);
    if (q.trim()) r = r.filter((d) => d.filename.toLowerCase().includes(q.trim().toLowerCase()));
    if (typeF !== 'all') r = r.filter((d) => extOf(d.filename) === typeF);
    if (sortF === 'name') r.sort((a, b) => a.filename.localeCompare(b.filename));
    else if (sortF === 'size') r.sort((a, b) => b.chunks - a.chunks);
    return r;
  }, [docs, tab, q, typeF, sortF]);
  const upload = async (files: FileList | null) => {
    if (!files || !files.length || !sessionId) return;
    setBusy(true); setMsg('');
    try { for (const f of Array.from(files)) { const r = await api.absorb(f, sessionId); setMsg('Added ' + r.filename + ' (' + r.chunks_added + ' chunks).'); } await load(sessionId); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Upload failed.'); }
    finally { setBusy(false); }
  };
  const remove = async (fn: string) => {
    if (!sessionId || !confirm('Remove "' + fn + '"?')) return;
    try { await api.deleteDocument(fn, sessionId); await load(sessionId); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Delete failed.'); }
  };
  return (
    <div className="flex flex-col gap-4">
      <div><h1 className="text-[20px] font-semibold text-white">Your Documents</h1>
      <p className="text-[12.5px] text-slate-400">Manage, process and explore your document library.</p></div>
      <div className="grid gap-3 lg:grid-cols-[1fr_200px]">
        <div className="veris-panel veris-panel-neon p-5 text-center">
          <CloudUpload size={26} className="mx-auto text-violet-300" />
          <p className="mt-1 text-[13px] font-semibold text-white">Upload Documents</p>
          <p className="text-[11px] text-slate-400">Drag and drop files here, or click to browse</p>
          <button className="veris-btn-primary mt-3" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Uploading...' : 'Browse Files'}</button>
          <input ref={fileRef} type="file" multiple className="hidden" accept={caps?.supported_extensions.join(',')} onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />
          {msg && <p className="mt-2 text-[11.5px] text-cyan-300">{msg}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={() => fileRef.current?.click()} className="veris-panel px-3 py-2.5 text-left text-[12px] text-slate-200">From your device <span className="float-right text-slate-500">›</span></button>
          <button onClick={() => setMsg('Google Drive is not connected.')} className="veris-panel px-3 py-2.5 text-left text-[12px] text-slate-200">Google Drive <span className="float-right text-slate-500">›</span></button>
          <button onClick={() => setMsg('OneDrive is not connected.')} className="veris-panel px-3 py-2.5 text-left text-[12px] text-slate-200">OneDrive <span className="float-right text-slate-500">›</span></button>
          <button onClick={() => setMsg('Notion is not connected.')} className="veris-panel px-3 py-2.5 text-left text-[12px] text-slate-200">Notion <span className="float-right text-slate-500">›</span></button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {['all', 'processing', 'completed', 'failed'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={'veris-tab' + (tab === t ? ' veris-tab-active' : '')}>
            {t === 'all' ? 'All Documents' : t[0].toUpperCase() + t.slice(1)} ({(counts as Record<string, number>)[t]})
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents..." className="veris-input" style={{ paddingLeft: 30, width: 170 }} />
          </div>
          <select value={typeF} onChange={(e) => setTypeF(e.target.value)} className="veris-input" style={{ width: 100 }}>
            <option value="all">All Types</option><option value="pdf">PDF</option><option value="docx">DOCX</option><option value="txt">TXT</option><option value="md">MD</option>
          </select>
          <select value={sortF} onChange={(e) => setSortF(e.target.value)} className="veris-input" style={{ width: 95 }}>
            <option value="newest">Newest</option><option value="name">Name</option><option value="size">Chunks</option>
          </select>
        </div>
      </div>
      <div className="veris-panel p-2">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12.5px] text-slate-500">{docs.length === 0 ? 'No documents yet — upload above.' : 'No matches.'}</p>
        ) : (
          <ul className="flex flex-col">
            {rows.map((d) => {
              const st = stOf(d);
              return (
                <li key={d.doc_id} className="veris-doc-row border-b border-white/5 last:border-0">
                  <span className="veris-file-ic" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)', color: '#c4b5fd' }}>{extOf(d.filename).slice(0, 3).toUpperCase() || 'DOC'}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-slate-100">{d.filename}</p>
                    <p className="text-[10.5px] text-slate-500">{extOf(d.filename).toUpperCase()} · {d.chunks} chunks · v{d.version}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={'veris-status veris-status-' + st}>{st[0].toUpperCase() + st.slice(1)}</span>
                    <button onClick={() => void remove(d.filename)} className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-300" aria-label={'Delete ' + d.filename}><Trash2 size={14} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="veris-panel p-4">
        <p className="mb-3 text-[12px] font-semibold text-white">Processing Pipeline</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {STAGES.map((s, i) => (
            <div key={s} className="rounded-lg border border-white/10 bg-black/30 px-2 py-2.5 text-center">
              <span className="veris-step-num mx-auto" style={{ width: 24, height: 24 }}>{i + 1}</span>
              <p className="mt-1.5 text-[10.5px] font-medium leading-tight text-slate-300">{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
