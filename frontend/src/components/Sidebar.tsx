import { NavLink } from 'react-router-dom';
import { FileText, LayoutDashboard, FlaskConical, Settings2, ShieldCheck, Menu, X } from 'lucide-react';
import { useState } from 'react';

const links = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/documents', label: 'Documents', icon: FileText, end: false },
  { to: '/intelligence', label: 'Intelligence', icon: FlaskConical, end: false },
  { to: '/settings', label: 'Settings', icon: Settings2, end: false },
];

export function Sidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="lg:hidden fixed top-3 left-3 z-50 rounded-md border border-ink-700 bg-ink-900 p-2"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle navigation"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
      <aside
        className={`fixed lg:static z-40 flex h-screen w-60 shrink-0 flex-col border-r border-ink-700/70 bg-ink-900/80 px-4 py-5 transition-transform ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-2.5 px-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500/15 text-accent-400">
            <ShieldCheck size={20} />
          </span>
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-white">Veris</p>
            <p className="text-[11px] text-slate-400">Documents to Intelligence</p>
          </div>
        </div>
        <nav className="mt-7 flex flex-col gap-1" aria-label="Primary">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-accent-500/15 text-white'
                    : 'text-slate-400 hover:bg-ink-800 hover:text-slate-200'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-lg border border-ink-700/70 bg-ink-850 p-3 text-[11px] leading-relaxed text-slate-400">
          Ephemeral session store. Documents clear on backend restart or after 1h idle.
        </div>
      </aside>
    </>
  );
}
