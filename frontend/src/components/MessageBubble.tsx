import { useState } from 'react';
import { CheckCircle2, Copy, ChevronDown, AlertTriangle, FileSearch } from 'lucide-react';
import type { ChatMessage } from '../types';

export function verdictTone(validation: string | undefined): 'ok' | 'warn' | 'muted' {
  const first = (validation ?? '').split('\n')[0].toUpperCase();
  if (first.includes('UNSUPPORTED') || first.includes('PARTIALLY')) return 'warn';
  if (first.includes('SUPPORTED')) return 'ok';
  return 'muted';
}

export function MessageBubble({ msg }: { msg: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(true);
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-br-sm bg-accent-500/20 px-4 py-2.5 text-sm text-slate-100">
          {msg.text}
        </div>
      </div>
    );
  }
  const tone = verdictTone(msg.validation);
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[92%] rounded-xl rounded-bl-sm border border-ink-700/70 bg-ink-900 px-4 py-3">
        {msg.error ? (
          <p className="text-sm text-red-300">{msg.text}</p>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{msg.text}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                  tone === 'ok'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : tone === 'warn'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                      : 'border-ink-700 text-slate-400'
                }`}
              >
                {tone === 'warn' ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                {(msg.validation ?? 'Validation: n/a').split('\n')[0].slice(0, 90)}
              </span>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(msg.text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-ink-800 hover:text-slate-200"
                aria-label="Copy response"
              >
                <Copy size={12} /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            {!!msg.validation && tone === 'warn' && (
              <details className="mt-2 text-xs text-amber-200/90">
                <summary className="cursor-pointer text-amber-300/80">Validation detail</summary>
                <pre className="mt-1 whitespace-pre-wrap rounded-md bg-ink-950 p-2 font-mono text-[11px]">
                  {msg.validation}
                </pre>
              </details>
            )}
            {!!msg.sources?.length && (
              <div className="mt-3 border-t border-ink-700/70 pt-2.5">
                <button
                  onClick={() => setShowSources((v) => !v)}
                  className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 hover:text-accent-300 transition-colors"
                  aria-expanded={showSources}
                >
                  <FileSearch size={13} className="text-accent-400" />
                  Cited evidence
                  <span className="ml-0.5 rounded-full bg-accent-500/15 px-1.5 py-px font-mono text-[10px] text-accent-300">
                    {msg.sources.length}
                  </span>
                  <ChevronDown size={13} className={`transition-transform ${showSources ? '' : '-rotate-90'}`} />
                </button>
                {showSources && (
                  <ol className="mt-2 flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
                    {msg.sources.map((s, i) => (
                      <li
                        key={i}
                        className="group rounded-md border border-ink-700/60 bg-ink-950 px-2.5 py-2 text-xs leading-relaxed text-slate-300 transition-colors hover:border-accent-500/30 hover:bg-ink-900/60"
                      >
                        <span className="mr-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-accent-500/15 px-1 font-mono text-[10px] text-accent-300 align-text-bottom">
                          {i + 1}
                        </span>
                        <span className="italic text-slate-300/90">{s}</span>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                  Cited passages come verbatim from your documents. Interpretive wording outside
                  these quotes is model-generated.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
