import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { useSession } from '../hooks/useSession';
import { AiOrb } from '../components/AiOrb';
import { MessageBubble } from '../components/MessageBubble';
import type { ChatMessage, DocumentMeta } from '../types';
export function IntelligencePage() {
  const { sessionId } = useSession();
  const [params] = useSearchParams();
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [tab, setTab] = useState('ask');
  const [docA, setDocA] = useState('');
  const [docB, setDocB] = useState('');
  const [cmp, setCmp] = useState('');
  const [busy2, setBusy2] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (sessionId) api.documentsMeta(sessionId).then(setDocs).catch(() => {}); }, [sessionId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, asking]);
  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || asking || !sessionId) return;
    if (!docs.length) { setMsgs((m) => [...m, { id: 'e' + Date.now(), role: 'assistant', text: 'Upload at least one document first.', error: true }]); return; }
    setMsgs((m) => [...m, { id: 'u' + Date.now(), role: 'user', text: q }]);
    setInput(''); setAsking(true);
    try {
      const r = await api.ask(q, sessionId);
      setMsgs((m) => [...m, { id: 'a' + Date.now(), role: 'assistant', text: r.answer, sources: r.sources, validation: r.validation }]);
    } catch (e) { setMsgs((m) => [...m, { id: 'e' + Date.now(), role: 'assistant', text: e instanceof Error ? e.message : 'Failed.', error: true }]); }
    finally { setAsking(false); }
  };
  useEffect(() => { const q = params.get('q'); if (q && sessionId && docs.length) void ask(q); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, docs.length]);
  const runCompare = async () => {
    if (!docA || !docB || !sessionId) return;
    setBusy2(true); setCmp('');
    try { const r = await api.intelCompareDocuments(sessionId, docA, docB); setCmp(r.summary + ' Matches: ' + r.matches.length + '. Conflicts: ' + r.conflicts.length + '.'); }
    catch (e) { setCmp(e instanceof Error ? e.message : 'Compare failed.'); }
    finally { setBusy2(false); }
  };
  const pills = ['What are the key findings?', 'Summarize the main risks', 'Compare doc A vs doc B', 'What are the contradictions?'];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[20px] font-semibold text-white">Intelligence</h1>
        <p className="text-[12.5px] text-slate-400">Ask questions, compare documents, and find contradictions.</p>
        <div className="mt-2 flex gap-1.5">
          {['ask', 'compare', 'contradictions'].map((t) => (<button key={t} onClick={() => setTab(t)} className={'veris-tab' + (tab === t ? ' veris-tab-active' : '')}>{t[0].toUpperCase() + t.slice(1)}</button>))}
        </div></div>
        <div className="flex items-center gap-2"><AiOrb size={72} /><p className="text-right text-[10.5px] text-slate-500">Your<br />documents.<br />Deeper<br />Answers.</p></div>
      </div>
      {tab === 'ask' && (
        <>
          <div className="veris-panel p-4">
            <div className="flex items-center gap-3">
              <Sparkles size={16} className="shrink-0 text-violet-300" />
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void ask(input); }}
                placeholder="Ask Veris anything about your documents..." className="flex-1 bg-transparent text-[13px] text-slate-100 outline-none placeholder:text-slate-500" />
              <button onClick={() => void ask(input)} disabled={asking || !input.trim()} className="veris-btn-primary" style={{ padding: '7px 12px' }} aria-label="Send">
                {asking ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
            <div className="mt-2 flex gap-3 text-[10.5px] text-slate-500"><span>Deep search</span><span>All documents</span></div>
          </div>
          <div className="flex flex-wrap gap-1.5">{pills.map((p) => (<button key={p} onClick={() => void ask(p)} className="veris-pill">{p}</button>))}</div>
          <div className="flex flex-col gap-3">
            {msgs.length === 0 && !asking && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="veris-panel p-4"><p className="text-[12px] font-semibold text-white">Example Questions</p>
                {['What are the key findings across all documents?', 'Compare the financial projections', 'What are the main risks mentioned?', 'Find contradictory statements'].map((s) => (<button key={s} onClick={() => void ask(s)} className="mt-1.5 block w-full rounded-lg bg-black/30 px-3 py-2 text-left text-[11.5px] text-slate-300 hover:border hover:border-violet-400/40">{s}</button>))}
                </div>
                <div className="veris-panel p-4"><p className="text-[12px] font-semibold text-white">Recent Queries</p>
                <p className="mt-2 text-[11.5px] text-slate-500">{docs.length === 0 ? 'Upload documents to start asking.' : docs.length + ' documents ready for questions.'}</p></div>
              </div>
            )}
            {msgs.map((m) => (<MessageBubble key={m.id} msg={m} />))}
            {asking && <p className="text-[12px] text-slate-400">Thinking...</p>}
            <div ref={bottomRef} />
          </div>
        </>
      )}
      {tab !== 'ask' && (
        <div className="veris-panel p-5">
          <p className="text-[13px] font-semibold text-white">{tab === 'compare' ? 'Compare two documents' : 'Contradictions'}</p>
          {tab === 'compare' ? (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <select value={docA} onChange={(e) => setDocA(e.target.value)} className="veris-input" style={{ maxWidth: 220 }}><option value="">Document A</option>{docs.map((d) => (<option key={d.filename} value={d.filename}>{d.filename}</option>))}</select>
                <select value={docB} onChange={(e) => setDocB(e.target.value)} className="veris-input" style={{ maxWidth: 220 }}><option value="">Document B</option>{docs.map((d) => (<option key={d.filename} value={d.filename}>{d.filename}</option>))}</select>
                <button onClick={() => void runCompare()} disabled={busy2 || !docA || !docB} className="veris-btn-primary">Compare</button>
              </div>
              {cmp && <p className="text-[12px] text-slate-300">{cmp}</p>}
            </div>
          ) : (<p className="mt-2 text-[12px] text-slate-400">Open the Entities or Document Graph views to inspect conflicting claims across your real documents.</p>)}
        </div>
      )}
    </div>
  );
}
