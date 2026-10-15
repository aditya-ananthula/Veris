import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { useSession } from '../hooks/useSession';
import { Card, EmptyState, ErrorBanner } from '../components/ui';
import { MessageBubble } from '../components/MessageBubble';
import type { ChatMessage, DocumentMeta } from '../types';

const SUGGESTED = [
  'Summarize the key points in these documents.',
  'What entities, dates, or figures are mentioned?',
  'Are there any contradictions between documents?',
];

export function IntelligencePage() {
  const { sessionId } = useSession();
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadDocs = async (sid: string) => {
    try {
      setDocs(await api.documentsMeta(sid));
    } catch {
      setDocs([]);
    }
  };

  useEffect(() => {
    if (sessionId) void loadDocs(sessionId);
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, asking]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || asking || !sessionId) return;
    if (docs.length === 0) {
      setError('Upload at least one document before asking questions.');
      return;
    }
    setError('');
    setMessages((m) => [...m, { id: `${Date.now()}-u`, role: 'user', text: q }]);
    setInput('');
    setAsking(true);
    try {
      const res = await api.ask(q, sessionId);
      setMessages((m) => [
        ...m,
        { id: `${Date.now()}-a`, role: 'assistant', text: res.answer, sources: res.sources, validation: res.validation },
      ]);
      void loadDocs(sessionId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Question failed.';
      setMessages((m) => [...m, { id: `${Date.now()}-e`, role: 'assistant', text: msg, error: true }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <div className="flex min-w-0 flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white">Intelligence</h2>
          <p className="mt-1 text-sm text-slate-400">Grounded QA with cited passages.</p>
        </div>
        {error && <ErrorBanner message={error} />}
        <Card className="flex min-h-[420px] flex-col p-4">
          <div className="scroll-slim flex max-h-[52vh] flex-col gap-3 overflow-y-auto pr-1">
            {messages.length === 0 && !asking ? (
              <div className="py-4">
                <EmptyState
                  title={docs.length === 0 ? 'No documents in this session' : 'Ask your first question'}
                  hint="Answers only use your uploaded collection."
                />
                {docs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SUGGESTED.map((s) => (
                      <button
                        key={s}
                        onClick={() => void ask(s)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-ink-700 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                      >
                        <Sparkles size={12} className="text-accent-400" /> {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              messages.map((m) => <MessageBubble key={m.id} msg={m} />)
            )}
            {asking && (
              <div className="flex items-center gap-2 text-sm text-slate-400" role="status">
                <Loader2 size={16} className="animate-spin text-accent-400" />
                Retrieving and verifying…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form
            className="mt-4 flex gap-2 border-t border-ink-700/70 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your documents…"
              className="min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-950 px-3.5 py-2.5 text-sm text-slate-100"
              aria-label="Ask a question"
              maxLength={4000}
            />
            <button
              type="submit"
              disabled={asking || !input.trim()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              <Send size={15} /> Ask
            </button>
          </form>
        </Card>
      </div>
      <aside className="flex flex-col gap-4">
        <Card className="p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">Session context</h3>
          <p className="mt-2 text-xs text-slate-400">
            {docs.length} docs · {docs.reduce((n, d) => n + d.chunks, 0)} chunks
          </p>
          <ul className="scroll-slim mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
            {docs.map((d) => (
              <li key={d.filename} className="truncate rounded-md bg-ink-950 px-2 py-1.5 text-xs text-slate-300">
                {d.filename}
              </li>
            ))}
          </ul>
          <Link to="/documents" className="mt-3 block rounded-lg border border-ink-700 px-3 py-1.5 text-center text-xs text-slate-300">
            Manage documents
          </Link>
        </Card>
      </aside>
    </div>
  );
}



