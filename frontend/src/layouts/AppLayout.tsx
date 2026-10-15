import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { api } from '../services/api';

const titles: Record<string, string> = {
  '/': 'Overview',
  '/documents': 'Documents',
  '/intelligence': 'Intelligence',
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
    <div className="flex min-h-screen bg-ink-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-ink-700/70 bg-ink-900/60 px-5 py-3 lg:px-8">
          <h1 className="pl-10 text-sm font-medium text-slate-300 lg:pl-0">
            {titles[pathname] ?? 'Veris'}
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
              online === null
                ? 'border-ink-700 text-slate-400'
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
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
