import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { MeshGradient } from '../components/MeshGradient';
import { AssistantOrb } from '../components/AiOrb';
import { Search, ChevronDown } from 'lucide-react';

export function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const goAsk = () => {
    const text = q.trim();
    if (!text) return;
    navigate(`/intelligence?q=${encodeURIComponent(text)}`);
    setQ('');
  };

  return (
    <div className="flex min-h-screen relative bg-transparent">
      <MeshGradient blobs={5} />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="veris-topbar sticky top-0 z-20 flex items-center gap-3 px-5 py-3 lg:px-7">
          <div className="veris-search">
            <Search size={14} className="shrink-0 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') goAsk(); }}
              placeholder="Ask a question, or search your documents…"
              aria-label="Ask a question, or search your documents"
            />
            <span className="veris-kbd">Ctrl K</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="veris-workspace">
              Research Workspace <ChevronDown size={13} />
            </button>
            <span className="veris-avatar" title="Workspace user">JD</span>
          </div>
        </header>
        <main key={pathname} className="animate-fade-in mx-auto w-full max-w-7xl flex-1 px-5 py-6 lg:px-7">
          <Outlet />
        </main>
      </div>
      <AssistantOrb />
    </div>
  );
}
