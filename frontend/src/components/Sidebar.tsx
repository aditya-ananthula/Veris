import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, FlaskConical, Network, Settings2, Menu, X, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const links = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/documents', label: 'Documents', icon: FileText, end: false },
  { to: '/intelligence', label: 'Intelligence', icon: FlaskConical, end: false },
  { to: '/knowledge', label: 'Knowledge', icon: Network, end: false },
];

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 rounded-lg border border-slate-600 bg-slate-800/80 p-2.5 backdrop-blur-md"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle navigation"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
      <aside
        className={`fixed lg:static z-40 flex h-screen shrink-0 flex-col border-r border-[rgba(167,139,250,0.16)] bg-[rgba(14,10,26,0.72)] px-3 py-6 backdrop-blur-md transition-all duration-300 ${
          collapsed ? 'w-16 lg:w-16' : 'w-60 lg:w-60'
        }`}
      >
        <div className="flex items-center justify-between gap-2.5 px-1 py-2 mb-8">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="icon-haze flex h-9 w-9 items-center justify-center group-hover:scale-105 transition-transform duration-200">
              <ShieldCheck size={20} />
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-[15px] font-semibold tracking-tight text-slate-100 truncate">Veris</p>
                <p className="text-[11px] text-slate-500 truncate">Intelligence Console</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="p-1.5 rounded-md bg-slate-800/60 border border-slate-600/40 text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-all"
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <ChevronRight size={14} className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {!collapsed && (
          <nav className="mt-6 flex flex-col gap-1 px-1" aria-label="Primary">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 group ${
                    isActive
                      ? 'bg-[rgba(139,92,246,0.12)] border border-[rgba(167,139,250,0.35)] text-accent-300 shadow-[0_0_20px_rgba(139,92,246,0.25)]'
                      : 'border border-transparent text-slate-400 hover:bg-[rgba(139,92,246,0.08)] hover:border-[rgba(167,139,250,0.2)] hover:text-slate-200 group-hover:-translate-x-0.5'
                  }`
                }
              >
                <div className="icon-haze icon-haze-sm flex h-8 w-8 items-center justify-center shrink-0">
                  <Icon size={17} />
                </div>
                <span className="font-medium">{label}</span>
              </NavLink>
            ))}
          </nav>
        )}
        <div className="mt-auto flex flex-col gap-2">
          <NavLink
            to="/settings"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                isActive ? 'bg-slate-800 text-accent-400' : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'
              }`
            }
          >
            <Settings2 size={14} />
            {!collapsed && <span>Settings</span>}
          </NavLink>
          {!collapsed && (
            <div className="rounded-xl border border-slate-700/40 bg-slate-850/60 px-3 py-3 text-[10px] leading-relaxed text-slate-500">
              Session-scoped store. Documents clear on backend restart or after 1h idle.
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function ShieldCheck({ size }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}
