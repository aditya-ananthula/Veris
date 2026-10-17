import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, FlaskConical, Network, Settings2, LifeBuoy } from 'lucide-react';
import { useState } from 'react';

const links = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/documents', label: 'Documents', icon: FileText, end: false },
  { to: '/intelligence', label: 'Intelligence', icon: FlaskConical, end: false },
  { to: '/knowledge', label: 'Knowledge', icon: Network, end: false },
];

function LogoMark() {
  return (
    <span className="veris-logo-mark" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" stroke="url(#vg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 11.5l2 2 4-4.5" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="vg" x1="4" y1="2" x2="20" y2="22">
            <stop stopColor="#a78bfa" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const knowledgeActive = pathname.startsWith('/knowledge');

  const itemCls = (active: boolean) =>
    `veris-nav-item ${active ? 'veris-nav-item-active' : ''}`;

  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 rounded-lg border border-[rgba(167,139,250,0.3)] bg-[#14102a]/90 p-2.5 backdrop-blur-md text-slate-200"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle navigation"
      >
        {open ? '✕' : '☰'}
      </button>
      <aside
        className={`veris-sidebar fixed lg:sticky top-0 z-40 flex h-screen shrink-0 flex-col px-3 py-5 transition-transform duration-300 w-60 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-2.5 px-2 py-1">
          <LogoMark />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-tight text-white leading-none">Veris</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">Intelligence</p>
          </div>
        </div>

        <nav className="mt-7 flex flex-col gap-1.5" aria-label="Primary">
          {links.map(({ to, label, icon: Icon, end }) => {
            const active = end ? pathname === '/' : to === '/knowledge' ? knowledgeActive : pathname === to;
            return (
              <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={itemCls(active)}>
                <span className="veris-nav-icon">
                  <Icon size={16} />
                </span>
                <span className="text-[13.5px] font-medium">{label}</span>
                {active && <span className="veris-nav-glow" aria-hidden="true" />}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1.5 pb-1">
          <NavLink to="/settings" onClick={() => setOpen(false)} className={({ isActive }) => itemCls(isActive && pathname === '/settings')}>
            <span className="veris-nav-icon">
              <Settings2 size={16} />
            </span>
            <span className="text-[13.5px] font-medium">Settings</span>
          </NavLink>
          <NavLink to="/settings" onClick={() => setOpen(false)} className="veris-nav-item">
            <span className="veris-nav-icon">
              <LifeBuoy size={16} />
            </span>
            <span className="text-[13.5px] font-medium">Help</span>
          </NavLink>
        </div>
      </aside>
    </>
  );
}

