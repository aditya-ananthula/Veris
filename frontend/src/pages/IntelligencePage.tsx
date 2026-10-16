import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Send, Loader2, Sparkles, Flame, FileText } from "lucide-react";
import { api } from "../services/api";
import { useSession } from "../hooks/useSession";
import { Card, EmptyState, ErrorBanner, SparkleBadge } from "../components/ui";
import { MessageBubble } from "../components/MessageBubble";
import type { ChatMessage, DocumentMeta, IntelContradictStatsResponse } from "../types";

const SUGGESTED = [
  "Summarize the key points in these documents.",
  "What entities, dates, or figures are mentioned?",
  "Are there any contradictions between documents?",
];

export function IntelligencePage() {
  const { sessionId } = useSession();
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [verifiedRate, setVerifiedRate] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanStats, setScanStats] = useState<IntelContradictStatsResponse | null>(null);

  const loadDocs = async (sid: string) => {
    try {
      setDocs(await api.documentsMeta(sid));
    } catch {
      setDocs([]);
    }
  };

  const totalValidated = useMemo(() => {
    const total = messages.filter((m) => m.role === "assistant" && !m.error).length;
    const supported = messages.filter((m) => m.role === "assistant" && !m.error && /SUPPORTED/.test(m.validation ?? "")).length;
    return total > 0 ? Math.round((supported / total) * 100) : null;
  }, [messages]);

  useEffect(() => {
    setVerifiedRate(totalValidated);
  }, [totalValidated]);

  useEffect(() => {
    if (sessionId) void loadDocs(sessionId);
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, asking]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || asking || !sessionId) return;
    if (docs.length === 0) {
      setError("Upload at least one document before asking questions.");
      return;
    }
    setError("");
    setMessages((m) => [...m, { id: Date.now() + "-u", role: "user", text: q }]);
    setInput("");
    setAsking(true);
    try {
      const res = await api.ask(q, sessionId);
      setMessages((m) => [
        ...m,
        { id: Date.now() + "-a", role: "assistant", text: res.answer, sources: res.sources, validation: res.validation },
      ]);
      void loadDocs(sessionId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Question failed.";
      setMessages((m) => [...m, { id: Date.now() + "-e", role: "assistant", text: msg, error: true }]);
    } finally {
      setAsking(false);
    }
  };

  const scanContradictions = async () => {
    if (!sessionId) return;
    setScanning(true);
    try {
      const stats = await api.intelContradictionsScan(sessionId);
      setScanStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Contradiction scan failed.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      <aside className="lg:w-1/4 flex flex-col gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400">Session context</h3>
              <p className="mt-1 text-xs text-slate-400">
                {docs.length} docs · {docs.reduce((n, d) => n + d.chunks, 0)} chunks
              </p>
            </div>
            <SparkleBadge count={docs.length} />
          </div>
          <ul className="scroll-slim mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
            {docs.map((d) => (
              <li key={d.filename} className="truncate rounded-md border border-slate-700/40 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-colors">
                {d.filename}
              </li>
            ))}
          </ul>
          <Link to="/documents" className="mt-3 block rounded-lg border border-slate-600 px-3 py-1.5 text-center text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
            Manage documents
          </Link>
        </Card>
        {scanStats && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Flame size={16} className="text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-100">Contradiction scan</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div>
                <p className="text-slate-500">Compared</p>
                <p className="text-white">{scanStats.total_compared}</p>
              </div>
              <div>
                <p className="text-slate-500">Conflicts</p>
                <p className="text-red-400">{scanStats.conflicts}</p>
              </div>
              <div>
                <p className="text-slate-500">Matches</p>
                <p className="text-emerald-400">{scanStats.matches}</p>
              </div>
              <div>
                <p className="text-slate-500">Uncertain</p>
                <p className="text-amber-400">{scanStats.uncertain}</p>
              </div>
            </div>
          </Card>
        )}
      </aside>

      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-100">Intelligence</h2>
            <p className="mt-1 text-sm text-slate-400">Ask grounded questions with cited passages and verification.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] text-slate-400 border-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
              {verifiedRate === null ? "No data" : verifiedRate + "% verified"}
            </span>
            <button
              onClick={scanContradictions}
              disabled={docs.length === 0 || scanning}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800"
            >
              <Flame size={14} /> Scan
            </button>
          </div>
        </div>
        {error && <ErrorBanner message={error} />}
        <Card className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {docs.length === 0 ? (
              <EmptyState
                title="No documents yet"
                hint="Upload documents first, then ask questions. Your questions will be answered with cited passages from your documents."
                action={
                  <Link to="/documents" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-400">
                    <FileText size={15} className="mr-2" /> Go to library
                  </Link>
                }
              />
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800/50 border border-slate-700/40 flex items-center justify-center text-accent-400 mb-4">
                  <Sparkles size={32} />
                </div>
                <h3 className="text-sm font-semibold text-slate-100">Ask your first question</h3>
                <p className="mt-1 text-sm text-slate-400 max-w-xs">
                  Try asking about the content of your uploaded documents. Answers include cited evidence.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      onClick={() => void ask(s)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:border-slate-500 hover:text-white transition-all"
                    >
                      <Sparkles size={12} className="text-accent-400" /> {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
                {asking && (
                  <div className="flex items-center gap-2 text-sm text-slate-400" role="status">
                    <Loader2 size={16} className="animate-spin text-accent-400" />
                    Retrieving and verifying…
                  </div>
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>
          <form
            className="mt-auto border-t border-slate-700/40 pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your documents…"
                className="flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 hover:border-slate-500 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none transition-all"
                aria-label="Ask a question"
                maxLength={4000}
                disabled={asking}
              />
              <button
                type="submit"
                disabled={asking || !input.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-400 hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                <Send size={15} /> Ask
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

