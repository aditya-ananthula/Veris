import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, FlaskConical, Network, BarChart3, Settings2, LifeBuoy, Menu, X } from 'lucide-react';
import { useState } from 'react';

const links = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/documents', label: 'Documents', icon: FileText, end: false },
  { to: '/knowledge', label: 'Knowledge', icon: Network, end: false },
  { to: '/intelligence', label: 'Intelligence', icon: FlaskConical, end: false },
  { to: '/insights', label: 'Insights', icon: BarChart3, end: false },
];

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const isKnowledgeRoute = pathname.startsWith('/knowledge');
  const itemClass = (active: boolean) => `veris-nav-item${active ? ' veris-nav-item-active' : ''}`;
  return <>
    <button className="veris-mobile-nav-toggle veris-icon-button" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation" aria-expanded={open} aria-controls="primary-sidebar">{open ? <X size={19} /> : <Menu size={19} />}</button>
    {open && <button className="veris-nav-scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}
    <aside id="primary-sidebar" onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }} aria-expanded={open} className={`veris-sidebar${open ? ' veris-sidebar-open' : ''}`}>
      <div className="veris-sidebar-brand"><div><p>Veris</p><span>Document intelligence</span></div></div>
      <nav className="veris-sidebar-nav" aria-label="Primary">{links.map(({ to, label, icon: Icon, end }) => {
        const active = end ? pathname === '/' : to === '/knowledge' ? isKnowledgeRoute : pathname === to;
        return <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={itemClass(active)}><Icon size={17} /><span>{label}</span></NavLink>;
      })}</nav>
      <nav className="veris-sidebar-footer" aria-label="Secondary"><NavLink to="/settings" onClick={() => setOpen(false)} className={itemClass(pathname === '/settings')}><Settings2 size={17} /><span>Settings</span></NavLink><NavLink to="/help" onClick={() => setOpen(false)} className={itemClass(pathname === '/help')}><LifeBuoy size={17} /><span>Help</span></NavLink></nav>
    </aside>
  </>;
}