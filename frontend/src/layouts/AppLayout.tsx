import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Search } from 'lucide-react';
import { GalaxyBackground } from '../components/GalaxyBackground';
import { AssistantOrb } from '../components/AiOrb';
import { Sidebar } from '../components/Sidebar';

export function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const goAsk = () => {
    const question = query.trim();
    if (!question) return;
    navigate(`/intelligence?q=${encodeURIComponent(question)}`);
    setQuery('');
  };
  return (
    <div className="app">
      <GalaxyBackground orbAnchorId="orbpos" />
      <Sidebar />
      <div className="app-content">
        <header className="veris-topbar">
          <div className="veris-search">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') goAsk(); }} placeholder="Ask a question, or search your documents…" aria-label="Ask a question, or search your documents" />
            <span className="veris-kbd">Ctrl K</span>
          </div>
          <div className="veris-topbar-actions"><button className="veris-workspace">Research Workspace <ChevronDown size={13} /></button><span className="veris-avatar" title="Workspace user">JD</span></div>
        </header>
        <main key={pathname} className="main animate-fade-in"><Outlet /></main>
      </div>
      <AssistantOrb />
    </div>
  );
}
