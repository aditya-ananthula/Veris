import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, Send } from 'lucide-react';
import { api } from '../services/api';
import { useSession } from '../hooks/useSession';

/** Signature Veris orb: layered cyan / violet / magenta rings. */
export function AiOrb({ size = 120, animate = true, className = '' }: { size?: number; animate?: boolean; className?: string }) {
  const rings = [6, 16, 28, 40];
  return (
    <div className={`veris-orb-wrap ${animate ? 'veris-float' : ''} ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <div className="absolute rounded-full" style={{ inset: -size * 0.28, background: 'radial-gradient(circle, rgba(139,92,246,0.28), rgba(34,211,238,0.1) 55%, transparent 70%)', filter: 'blur(10px)' }} />
      <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 38% 32%, rgba(196,181,253,0.85), rgba(139,92,246,0.5) 32%, rgba(34,211,238,0.3) 58%, rgba(8,6,22,0.9) 82%)' }} />
      <div className="absolute rounded-full veris-spin-slow" style={{ inset: '6%', background: 'conic-gradient(from 20deg, rgba(232,121,249,0.5), rgba(129,140,248,0.6), rgba(45,212,191,0.5), rgba(168,85,247,0.55), rgba(232,121,249,0.5))', filter: 'blur(5px)', animationPlayState: animate ? 'running' : 'paused' }} />
      {rings.map((pad, i) => (
        <div key={pad} className={`absolute rounded-full ${i % 2 ? 'veris-spin-slower' : 'veris-spin-slow'}`}
          style={{ inset: `${pad}%`, border: '1.5px solid rgba(255,255,255,0.22)', boxShadow: '0 0 18px rgba(139,92,246,0.4), inset 0 0 14px rgba(34,211,238,0.25)', animationPlayState: animate ? 'running' : 'paused' }} />
      ))}
      <div className="absolute rounded-full" style={{ inset: '30%', background: 'radial-gradient(circle at 42% 36%, rgba(255,255,255,0.95), rgba(196,181,253,0.5) 42%, rgba(34,211,238,0.28) 66%, transparent 80%)', filter: 'blur(2px)' }} />
      <div className="absolute inset-0 rounded-full" style={{ border: '1.5px solid rgba(255,255,255,0.25)', boxShadow: '0 0 42px rgba(139,92,246,0.6), 0 0 90px rgba(34,211,238,0.28), inset 0 0 30px rgba(139,92,246,0.35)' }} />
      <style>{`@keyframes veris-orb-spin { to { transform: rotate(360deg); } } @keyframes veris-orb-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } } .veris-float { animation: veris-orb-float 7s ease-in-out infinite; } .veris-spin-slow { animation: veris-orb-spin 22s linear infinite; } .veris-spin-slower { animation: veris-orb-spin 34s linear infinite reverse; }`}</style>
    </div>
  );
}

/** Persistent assistant bubble, bottom-right. Asks via real /ask endpoint. */
export function AssistantOrb() {
  const nav = useNavigate();
  const { sessionId } = useSession();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  const [err, setErr] = useState('');

  const ask = async () => {
    const text = q.trim();
    if (!text || busy || !sessionId) return;
    setBusy(true);
    setErr('');
    setAnswer('');
    try {
      const res = await api.ask(text, sessionId);
      setAnswer(res.answer);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ask failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="glass w-80 rounded-2xl p-4 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Sparkles size={14} className="text-accent-300" /> Veris Assistant</p>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white" aria-label="Close assistant"><X size={16} /></button>
          </div>
          <div className="mt-3 max-h-56 overflow-y-auto scroll-slim text-[13px] text-slate-300">
            {answer ? <p className="whitespace-pre-wrap">{answer}</p> : err ? <p className="text-red-300">{err}</p> : <p className="text-slate-500">Ask anything about your documents…</p>}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void ask(); }} placeholder="Ask Veris…" maxLength={500} className="flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-[13px] text-slate-100 outline-none focus:border-accent-500" aria-label="Ask Veris" />
            <button onClick={() => void ask()} disabled={busy || !q.trim()} className="rounded-lg bg-accent-500 px-3 py-2 text-white disabled:opacity-40 hover:bg-accent-400" aria-label="Send"><Send size={14} /></button>
          </div>
          <button onClick={() => nav('/intelligence')} className="mt-2 text-[11px] text-accent-300 hover:text-accent-200">Open Intelligence →</button>
        </div>
      )}
      <button onClick={() => setOpen((v) => !v)} aria-label="Toggle Veris assistant" className="group relative transition-transform hover:scale-105 active:scale-95">
        {busy && <span className="pulse-ring" />}
        <AiOrb size={56} animate={!busy} />
      </button>
    </div>
  );
}
