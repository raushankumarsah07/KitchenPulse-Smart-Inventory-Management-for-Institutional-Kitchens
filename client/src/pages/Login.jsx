import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Leaf, LineChart, Lock, Mail, Sparkles, Timer, User } from 'lucide-react';
import { useAuth } from '../auth';
import { Button, Field, Segmented, Stagger, Rise } from '../ui';

const POINTS = [
  [Timer, 'Expiry-first stock', 'Batches are used earliest-expiry first, so food gets cooked before it spoils.'],
  [Sparkles, 'Demand forecasting', 'A machine-learning model predicts tomorrow\'s need and explains every purchase.'],
  [Leaf, 'Less food waste', 'See what is thrown away, why, and what it costs, week after week.'],
];

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try { mode === 'login' ? await login(f.email, f.password) : await register(f.name, f.email, f.password); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <div className="auth-art">
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
        <div className="brand">
          <div className="brand-mark"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 13h4l2.5-7 4 13 3-8H22" /></svg></div>
          <div className="brand-name">KitchenPulse</div>
        </div>
        <div>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
            Know your kitchen <em>before</em> the shelves run empty.
          </motion.h1>
          <Stagger className="auth-points">
            {POINTS.map(([I, t, d]) => (
              <Rise key={t} className="auth-point"><span className="ic"><I size={19} /></span><div><div style={{ fontWeight: 600 }}>{t}</div><div style={{ fontSize: 13.5, opacity: 0.72 }}>{d}</div></div></Rise>
            ))}
          </Stagger>
        </div>
        <div style={{ fontSize: 13, opacity: 0.55 }}>Smart inventory for college canteens, hostel messes and institutional kitchens.</div>
      </div>
      <div className="auth-form-side">
        <motion.form className="auth-card" onSubmit={submit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <div>
            <h2>{mode === 'login' ? 'Welcome back' : 'Create your kitchen account'}</h2>
            <p style={{ color: 'var(--muted)', marginTop: 6 }}>{mode === 'login' ? 'Sign in to manage stock, usage and waste.' : 'The first account becomes the kitchen manager.'}</p>
          </div>
          <Segmented id="auth-mode" value={mode} onChange={(m) => { setMode(m); setError(''); }} options={[{ value: 'login', label: 'Sign in' }, { value: 'register', label: 'Register' }]} />
          {mode === 'register' && (
            <Field label="Full name"><div className="input-wrap"><User size={17} className="lead" /><input className="input" value={f.name} onChange={set('name')} placeholder="e.g. Asha Rao" required autoComplete="name" /></div></Field>
          )}
          <Field label="Email"><div className="input-wrap"><Mail size={17} className="lead" /><input className="input" type="email" value={f.email} onChange={set('email')} placeholder="you@college.edu" required autoComplete="email" /></div></Field>
          <Field label="Password" hint={mode === 'register' ? 'At least 8 characters' : undefined}>
            <div className="input-wrap"><Lock size={17} className="lead" />
              <input className="input" type={show ? 'text' : 'password'} value={f.password} onChange={set('password')} placeholder="••••••••" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label="Show password" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'none', padding: 8, color: 'var(--faint)' }}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
          </Field>
          {error && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} style={{ color: 'var(--danger)', background: 'var(--danger-soft)', padding: '10px 14px', borderRadius: 12, fontSize: 14, fontWeight: 500 }}>{error}</motion.div>}
          <Button loading={busy} type="submit" style={{ padding: '13px 16px', fontSize: 15 }}>{mode === 'login' ? 'Sign in' : 'Create account'}</Button>
        </motion.form>
      </div>
    </div>
  );
}
