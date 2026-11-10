import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Inspector({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus({preventScroll:true});
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    if (window.innerWidth <= 1200) ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [title]);
  return <aside ref={ref} tabIndex={-1} className="knowledge-inspector" aria-label={title} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
    <div className="inspector-heading"><h2>{title}</h2><button className="veris-btn-ghost veris-icon-button" aria-label="Close inspector" onClick={onClose}><X size={18}/></button></div>
    {children}
  </aside>;
}
