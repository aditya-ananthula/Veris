import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, Send } from 'lucide-react';
import { api } from '../services/api';
import { useSession } from '../hooks/useSession';

/** An imperfect, particulate light field rather than a hard-edged planet. */
export function AiOrb({ size = 120, animate = true, className = '' }: { size?: number; animate?: boolean; className?: string }) {
  const grains = [
    [17, 48, 2.2, 0.72], [27, 25, 1.6, 0.54], [34, 71, 1.4, 0.68], [43, 18, 2.4, 0.62],
    [51, 39, 1.3, 0.74], [58, 67, 2.1, 0.56], [66, 25, 1.6, 0.64], [73, 50, 2.8, 0.63],
    [80, 33, 1.2, 0.53], [84, 64, 2.3, 0.58], [23, 82, 1.8, 0.50], [45, 87, 1.3, 0.54],
    [67, 81, 1.7, 0.68], [91, 47, 1.5, 0.45], [10, 62, 1.2, 0.42], [38, 52, 1.1, 0.82],
  ];

  return (
    <div className={`veris-orb-wrap ${animate ? 'veris-float' : ''} ${className}`} style={{ width: size, height: size, ['--orb-motion' as string]: animate ? 'running' : 'paused' }} aria-hidden="true">
      <span className="veris-orb-aura veris-orb-aura-one" />
      <span className="veris-orb-aura veris-orb-aura-two" />
      <span className="veris-orb-mist veris-orb-mist-one" />
      <span className="veris-orb-mist veris-orb-mist-two" />
      <span className="veris-orb-pulse" />
      <span className="veris-orb-core" />
      <span className="veris-orb-shell" />
      <span className="veris-orb-reflect" />
      <span className="veris-orb-highlight" />
      <span className="veris-orb-dissolve veris-orb-dissolve-left" />
      <span className="veris-orb-dissolve veris-orb-dissolve-right" />
      {grains.map(([left, top, dotSize, opacity], index) => (
        <span key={index} className="veris-orb-grain" style={{ left: `${left}%`, top: `${top}%`, width: `${dotSize}px`, height: `${dotSize}px`, opacity, animationDelay: `${-index * 0.37}s` }} />
      ))}
    </div>
  );
}

/** Persistent assistant bubble, backed by the real /ask endpoint. */
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
    setBusy(true); setErr(''); setAnswer('');
    try { setAnswer((await api.ask(text, sessionId)).answer); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Ask failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="veris-assistant">
      {open && <div className="veris-assistant-panel animate-fade-in">
        <div className="veris-assistant-heading"><p><Sparkles size={14} /> Veris Assistant</p><button onClick={() => setOpen(false)} aria-label="Close assistant"><X size={16} /></button></div>
        <div className="veris-assistant-answer scroll-slim">{answer ? <p>{answer}</p> : err ? <p className="veris-assistant-error">{err}</p> : <p className="veris-assistant-placeholder">Ask anything about your documents…</p>}</div>
        <div className="veris-assistant-input"><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void ask(); }} placeholder="Ask Veris…" maxLength={500} aria-label="Ask Veris" /><button onClick={() => void ask()} disabled={busy || !q.trim()} aria-label="Send"><Send size={14} /></button></div>
        <button onClick={() => nav('/intelligence')} className="veris-assistant-link">Open Intelligence →</button>
      </div>}
      <button onClick={() => setOpen((v) => !v)} aria-label="Toggle Veris assistant" className="veris-assistant-toggle">{busy && <span className="pulse-ring" />}<AiOrb size={56} animate={!busy} /></button>
    </div>
  );
}