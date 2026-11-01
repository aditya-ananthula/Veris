import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, FlaskConical, Network, Settings2, LifeBuoy, Menu, X } from 'lucide-react';
import { useState } from 'react';

const links = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/documents', label: 'Documents', icon: FileText, end: false },
  { to: '/intelligence', label: 'Intelligence', icon: FlaskConical, end: false },
  { to: '/knowledge', label: 'Knowledge', icon: Network, end: false },
];

function LogoMark() {
  return <span className="veris-logo-mark" aria-hidden="true"><svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" stroke="url(#verisLogoGradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 11.5l2 2 4-4.5" stroke="#a5f3fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><defs><linearGradient id="verisLogoGradient" x1="4" y1="2" x2="20" y2="22"><stop stopColor="#c4b5fd" /><stop offset="1" stopColor="#67e8f9" /></linearGradient></defs></svg></span>;
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const isKnowledgeRoute = pathname.startsWith('/knowledge');
  const itemClass = (active: boolean) => `veris-nav-item${active ? ' veris-nav-item-active' : ''}`;
  return <>
    <button className="veris-mobile-nav-toggle" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation">{open ? <X size={19} /> : <Menu size={19} />}</button>
    {open && <button className="veris-nav-scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}
    <aside className={`veris-sidebar${open ? ' veris-sidebar-open' : ''}`}>
      <div className="veris-sidebar-brand"><LogoMark /><div><p>Veris</p><span>Intelligence</span></div></div>
      <nav className="veris-sidebar-nav" aria-label="Primary">{links.map(({ to, label, icon: Icon, end }) => {
        const active = end ? pathname === '/' : to === '/knowledge' ? isKnowledgeRoute : pathname === to;
        return <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={itemClass(active)}><Icon size={17} /><span>{label}</span></NavLink>;
      })}</nav>
      <nav className="veris-sidebar-footer" aria-label="Secondary"><NavLink to="/settings" onClick={() => setOpen(false)} className={itemClass(pathname === '/settings')}><Settings2 size={17} /><span>Settings</span></NavLink><NavLink to="/settings" onClick={() => setOpen(false)} className={itemClass(false)}><LifeBuoy size={17} /><span>Help</span></NavLink></nav>
    </aside>
  </>;
}