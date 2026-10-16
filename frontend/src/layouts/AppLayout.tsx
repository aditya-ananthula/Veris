import { useEffect, useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { api } from '../services/api';
import { MeshGradient } from '../components/MeshGradient';
import { Bell, User, HelpCircle } from 'lucide-react';

const titles: Record<string, string> = {
  '/': 'Overview',
  '/documents': 'Documents',
  '/intelligence': 'Intelligence',
  '/knowledge': 'Knowledge Graph',
  '/settings': 'Settings',
};

export function AppLayout() {
  const { pathname } = useLocation();
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .health()
      .then(() => alive && setOnline(true))
      .catch(() => alive && setOnline(false));
    const t = setInterval(() => {
      api
        .health()
        .then(() => alive && setOnline(true))
        .catch(() => alive && setOnline(false));
    }, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="flex min-h-screen relative bg-transparent">
      <MeshGradient blobs={5} />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[rgba(167,139,250,0.16)] bg-[rgba(14,10,26,0.62)] backdrop-blur-md px-5 py-3 lg:px-8 sticky top-0 z-20">
          <Link to="/" className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent hover:border-[rgba(167,139,250,0.35)] hover:bg-[rgba(139,92,246,0.10)] transition-colors">
            <span className="icon-haze icon-haze-sm flex h-6 w-6 items-center justify-center">
              <User size={16} />
            </span>
            <span className="text-sm font-semibold tracking-tight text-slate-100">Veris</span>
          </Link>
          <div className="hidden lg:flex items-center gap-1">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
                online === null
                  ? 'border-slate-600 text-slate-400'
                  : online
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/30 bg-red-500/10 text-red-300'
              }`}
              role="status"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  online === null ? 'bg-slate-500' : online ? 'bg-emerald-400' : 'bg-red-400'
                }`}
              />
              {online === null ? 'Checking backend…' : online ? 'Backend connected' : 'Backend offline'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="icon-haze icon-haze-sm p-2 transition-transform hover:scale-105" aria-label="Notifications">
              <Bell size={18} />
            </button>
            <button className="icon-haze icon-haze-sm p-2 transition-transform hover:scale-105" aria-label="Help">
              <HelpCircle size={18} />
            </button>
          </div>
        </header>
        <div className="flex items-center justify-between border-b border-slate-700/40 bg-slate-900/40 px-5 py-2.5 lg:px-8">
          <h1 className="text-sm font-semibold tracking-tight text-slate-100">{titles[pathname] ?? 'Veris'}</h1>
        </div>
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
