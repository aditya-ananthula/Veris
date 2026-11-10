import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { GalaxyBackground } from '../components/GalaxyBackground';
import { AssistantOrb } from '../components/AiOrb';
import { Sidebar } from '../components/Sidebar';

export function AppLayout() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const isChatPage = pathname === '/intelligence' && !['compare', 'contradictions'].includes(new URLSearchParams(search).get('tab') ?? 'ask');
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);
  const [query, setQuery] = useState('');
  const goAsk = () => {
    const question = query.trim();
    if (!question) return;
    navigate(`/intelligence?q=${encodeURIComponent(question)}`);
    setQuery('');
  };
  return (
    <div className={'app' + (isChatPage ? ' app-chat' : '')}>
      <GalaxyBackground orbAnchorId="orbpos" />
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Sidebar />
      <div className="app-content">
        <header className="veris-topbar">
          <div className="veris-search">
            <Search size={15} />
            <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') goAsk(); }} placeholder="Ask a question, or search your documents…" aria-label="Ask a question, or search your documents" />
            <span className="veris-kbd">Ctrl K</span>
          </div>
          <div className="veris-topbar-actions"></div>
        </header>
        <main id="main-content" tabIndex={-1} className={'main' + (pathname.startsWith('/knowledge') ? ' main-knowledge' : '') + (isChatPage ? ' main-chat' : '')}><Outlet /></main>
      </div>
      <AssistantOrb />
    </div>
  );
}
