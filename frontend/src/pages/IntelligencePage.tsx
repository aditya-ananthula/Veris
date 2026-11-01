import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Loader2, Paperclip } from 'lucide-react';
import { api } from '../services/api';
import { useSession } from '../hooks/useSession';
import { AiOrb } from '../components/AiOrb';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
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
  const [attachments, setAttachments] = useState<File[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  useEffect(() => { if (sessionId) api.documentsMeta(sessionId).then(setDocs).catch(() => {}); }, [sessionId]);

  useEffect(() => {
    if (!atBottomRef.current || !containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [msgs, asking]);

  const onScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    atBottomRef.current = scrollHeight - scrollTop - clientHeight < 80;
  }, []);

  const ask = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || asking || !sessionId) return;
      if (!docs.length) { setMsgs((m) => [...m, { id: 'e' + Date.now(), role: 'assistant', text: 'Upload at least one document first.', error: true }]); return; }
      setMsgs((m) => [...m, { id: 'u' + Date.now(), role: 'user', text: q }]);
      setInput(''); setAttachments([]); setAsking(true);
      atBottomRef.current = true;
      try {
        const r = await api.ask(q, sessionId);
        setMsgs((m) => [...m, { id: 'a' + Date.now(), role: 'assistant', text: r.answer, sources: r.sources, validation: r.validation }]);
      } catch (e) { setMsgs((m) => [...m, { id: 'e' + Date.now(), role: 'assistant', text: e instanceof Error ? e.message : 'Failed.', error: true }]); }
      finally { setAsking(false); }
    },
    [sessionId, docs.length, asking],
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void ask(input);
      }
    },
    [input, ask],
  );

  useEffect(() => { const q = params.get('q'); if (q && sessionId && docs.length) void ask(q);
  }, [sessionId, docs.length]);
  const runCompare = async () => {
    if (!docA || !docB || !sessionId) return;
    setBusy2(true); setCmp('');
    try { const r = await api.intelCompareDocuments(sessionId, docA, docB); setCmp(r.summary + ' Matches: ' + r.matches.length + '. Conflicts: ' + r.conflicts.length + '.'); }
    catch (e) { setCmp(e instanceof Error ? e.message : 'Compare failed.'); }
    finally { setBusy2(false); }
  };
  const PILLS: string[] = ['What are the key findings?', 'Summarize the main risks', 'Compare doc A vs doc B', 'What are the contradictions?'];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[20px] font-semibold text-gradient veris-intel-title">Intelligence</h1>
        <p className="text-[12.5px] text-slate-400">Ask questions, compare documents, and find contradictions.</p>
        <div className="mt-2 flex gap-1.5">
          {['ask', 'compare', 'contradictions'].map((t) => (<button key={t} onClick={() => setTab(t)} className={'veris-tab' + (tab === t ? ' veris-tab-active' : '')}>{t[0].toUpperCase() + t.slice(1)}</button>))}
        </div></div>
        <div className="flex items-center gap-2"><AiOrb size={72} /><p className="text-right text-[10.5px] text-slate-500">Your<br />documents.<br />Deeper<br />Answers.</p></div>
      </div>
      {tab === 'ask' && (
        <div className="flex flex-col gap-3">
          <div className="veris-panel p-0 flex flex-col h-[520px] min-h-[320px]" ref={containerRef} onScroll={onScroll}>
            <div className="overflow-y-auto p-4 flex flex-col gap-3 flex-1">
              {msgs.length === 0 && !asking && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="grid gap-3 md:grid-cols-2 w-full max-w-md px-4">
                    {PILLS.map((p) => (
                      <button key={p} onClick={() => void ask(p)} className="w-full rounded-lg bg-black/30 px-3 py-2.5 text-left text-[11.5px] text-slate-300 hover:border hover:border-violet-400/40">
                        {p}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-[11.5px] text-slate-500">{docs.length === 0 ? 'Upload documents to start asking.' : docs.length + ' documents ready for questions.'}</p>
                </div>
              )}
              {msgs.map((m) => (
                <div key={m.id} className="flex w-full flex-col">
                  {m.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-xl rounded-br-sm bg-accent-500/20 px-4 py-2.5 text-sm text-slate-100 whitespace-pre-wrap">
                        <MarkdownRenderer text={m.text} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <div className="max-w-[92%] rounded-xl rounded-bl-sm border border-ink-700/70 bg-ink-900 px-4 py-3">
                        {m.error ? (
                          <p className="text-sm text-red-300 whitespace-pre-wrap">{m.text}</p>
                        ) : (
                          <>
                            <MarkdownRenderer text={m.text} />
                            {m.validation && <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-ink-700 px-2 py-0.5 text-[11px] text-slate-400">
                              {(m.validation.split('\n')[0]).slice(0, 90)}
                            </div>}
                            {!!m.sources?.length && (
                              <div className="mt-3 border-t border-ink-700/70 pt-2.5">
                                <button className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 hover:text-accent-300 transition-colors">
                                  Cited evidence <span className="ml-0.5 rounded-full bg-accent-500/15 px-1.5 py-px font-mono text-[10px] text-accent-300">{m.sources.length}</span>
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {asking && (
                <div className="flex items-center gap-2 text-[12px] text-slate-400"><Loader2 size={14} className="animate-spin" /> Thinking…
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            {/* Composer pinned at the bottom of the chat viewport */}
            <div className="border-t border-slate-700/40 bg-slate-950/60 backdrop-blur p-3">
              <div className="flex gap-2">
                <button
                  onClick={() => (document.getElementById('chat-attach') as HTMLInputElement)?.click()}
                  disabled={asking}
                  className="shrink-0 rounded-lg border border-slate-600/50 p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" aria-label="Attach files"
                >
                  <Paperclip size={16} />
                </button>
                <input id="chat-attach" type="file" multiple accept=".pdf,.docx,.txt,.md" className="hidden"
                  onChange={(e) => { if (e.target.files?.length) setAttachments(Array.from(e.target.files)); e.target.value = ''; }} />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Ask Veris anything about your documents… (Shift+Enter newline)"
                  className="flex-1 rounded-lg border border-slate-600/50 bg-slate-900/60 px-3.5 py-2.5 text-[13px] text-slate-100 placeholder-slate-500 focus:border-accent-500/60 focus:ring-1 focus:ring-accent-500/40 outline-none disabled:opacity-60 disabled:cursor-not-allowed" disabled={asking}
                />
                {attachments.length > 0 && (
                  <span className="text-[10px] text-accent-300 bg-accent-500/10 rounded px-2 py-1 flex items-center gap-1">
                    {attachments.length} file{attachments.length > 1 ? 's' : ''} attached
                  </span>
                )}
                <button
                  onClick={() => { void ask(input + (attachments.length ? ' [attached: ' + attachments.map((f) => f.name).join(', ') + ']' : '')); }}
                  disabled={asking || !input.trim()}
                  className="shrink-0 rounded-lg border border-accent-500/40 bg-gradient-to-b from-accent-500 to-violet-600 text-slate-950 px-4 py-2.5 text-sm font-medium shadow-[0_0_14px_rgba(167,139,250,0.35)] hover:from-accent-400 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all" aria-label="Send"
                >
                  {asking ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-slate-500"><span>Deep search</span><span>·</span><span>All documents</span></div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500">
            <span>Citations appear under each answer. Source excerpts are quoted verbatim from your documents.</span>
          </div>
        </div>
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
