import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Bell, ChefHat, Clock, FileBarChart, LayoutDashboard, LogOut, Menu, Moon, Package, ShoppingBasket, Sparkles, Sun, TrendingDown, Trash2, X } from 'lucide-react';
import { api } from './api';
import { useAuth } from './auth';
import { useFetch } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/purchases', label: 'Purchases', icon: ShoppingBasket },
  { to: '/usage', label: 'Daily usage', icon: ChefHat },
  { to: '/waste', label: 'Food waste', icon: Trash2 },
  { to: '/forecast', label: 'Forecast', icon: Sparkles },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
];
export const alertIcon = { out: AlertTriangle, low: TrendingDown, expired: AlertTriangle, expiring: Clock };
export const alertTone = (a) => (a.severity === 'critical' ? 'danger' : 'accent');

function useTheme() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'light');
  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('kp_theme', next);
    setTheme(next);
  };
  return [theme, toggle];
}

function AlertBell() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const ref = useRef(null);
  const { data, reload } = useFetch(() => api.get('/alerts'), []);
  useEffect(() => { reload(); setOpen(false); }, [loc.pathname]); // eslint-disable-line
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const alerts = data || [];
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Alerts">
        <Bell size={18} />
        {alerts.length > 0 && <motion.span key={alerts.length} className="dot" initial={{ scale: 0 }} animate={{ scale: 1 }}>{alerts.length}</motion.span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="dropdown" initial={{ opacity: 0, scale: 0.94, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: -8 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }}>
            <div style={{ padding: '8px 12px 10px', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 18 }}>Alerts</div>
            <div className="list" style={{ maxHeight: 380, overflowY: 'auto' }}>
              {alerts.length === 0 && <div className="empty" style={{ padding: 24 }}>You're all caught up. No alerts right now.</div>}
              {alerts.map((a) => { const I = alertIcon[a.type]; return (
                <button key={a.id} className={`row-item tone-${alertTone(a)}`} onClick={() => { nav(a.type === 'expired' ? '/waste' : '/inventory'); setOpen(false); }}>
                  <span className="ic"><I size={18} /></span><span className="tx">{a.message}</span>
                </button>); })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenu(false), [loc.pathname]);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="shell">
      {menu && <div className="overlay" style={{ zIndex: 35 }} onClick={() => setMenu(false)} />}
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 13h4l2.5-7 4 13 3-8H22" /></svg></div>
          <div><div className="brand-name">KitchenPulse</div><div className="brand-sub">Smart inventory</div></div>
        </div>
        <nav className="nav">
          <div className="nav-label">Workspace</div>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              {({ isActive }) => (<>{isActive && <motion.span layoutId="nav-pip" className="pip" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}<n.icon size={19} />{n.label}</>)}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="user-card">
            <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
            <div style={{ minWidth: 0 }}><div className="nm">{user.name}</div><div className="rl">{user.role}</div></div>
            <button className="icon-btn" style={{ marginLeft: 'auto', background: 'transparent', borderColor: 'rgba(255,255,255,.12)', color: '#fff', width: 36, height: 36 }} onClick={logout} aria-label="Sign out"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn hamburger" onClick={() => setMenu((m) => !m)} aria-label="Menu">{menu ? <X size={18} /> : <Menu size={18} />}</button>
          <span className="date">{today}</span>
          <div className="top-actions">
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={theme} initial={{ rotate: -90, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 90, opacity: 0, scale: 0.6 }} transition={{ duration: 0.2 }} style={{ display: 'grid' }}>
                  {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                </motion.span>
              </AnimatePresence>
            </button>
            <AlertBell />
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
