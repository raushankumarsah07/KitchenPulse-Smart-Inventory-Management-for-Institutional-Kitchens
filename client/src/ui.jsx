import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion } from 'framer-motion';
import { X } from 'lucide-react';

export function useFetch(fn, deps = []) {
  const [state, set] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    set((s) => ({ ...s, loading: true, error: null }));
    fn().then((data) => live && set({ data, loading: false, error: null })).catch((e) => live && set({ data: null, loading: false, error: e.message }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function Page({ title, subtitle, actions, children }) {
  return (
    <motion.div className="page" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
      <div className="page-head">
        <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {children}
    </motion.div>
  );
}

export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
export const rise = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } };
export const Stagger = ({ className, children }) => <motion.div className={className} variants={stagger} initial="hidden" animate="show">{children}</motion.div>;
export const Rise = ({ className, children, ...p }) => <motion.div className={className} variants={rise} {...p}>{children}</motion.div>;

export function AnimatedNumber({ value = 0, decimals = 0, prefix = '', suffix = '' }) {
  const ref = useRef(null);
  const from = useRef(0);
  useEffect(() => {
    const c = animate(from.current, value, {
      duration: 1.1, ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => { if (ref.current) ref.current.textContent = prefix + new Intl.NumberFormat('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v) + suffix; },
    });
    from.current = value;
    return () => c.stop();
  }, [value, decimals, prefix, suffix]);
  return <span ref={ref} className="num">{prefix}0{suffix}</span>;
}

export function Stat({ icon: Icon, label, value, tone = 'brand', hint, ...fmt }) {
  return (
    <Rise className={`card hover stat tone-${tone}`}>
      <div className="ico"><Icon size={22} /></div>
      <div><div className="val"><AnimatedNumber value={value} {...fmt} /></div><div className="lbl">{label}</div></div>
      {hint && <div className="hint">{hint}</div>}
    </Rise>
  );
}

export const Pill = ({ tone = 'neutral', children }) => <span className={`pill ${tone}`}>{children}</span>;
export const Card = ({ className = '', hover, children, ...p }) => <div className={`card ${hover ? 'hover' : ''} ${className}`} {...p}>{children}</div>;
export const CardHead = ({ title, sub, right }) => <div className="card-head"><div><h3>{title}</h3>{sub && <div className="sub">{sub}</div>}</div>{right}</div>;
export const Skeleton = ({ h = 20, w = '100%', r }) => <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;

export function Field({ label, error, hint, children, className = '' }) {
  return <div className={`field ${className}`}>{label && <label>{label}</label>}{children}{error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}</div>;
}

export function Segmented({ value, onChange, options, id = 'seg' }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.span layoutId={id} className="thumb" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon: Icon, title, text, action }) {
  return <div className="empty"><div className="ico"><Icon size={28} /></div><h3>{title}</h3><p>{text}</p>{action}</div>;
}

export function Button({ loading, children, variant = 'primary', size, className = '', ...p }) {
  return <button className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`} disabled={loading || p.disabled} {...p}>{loading && <span className="spin" />}{children}</button>;
}

export function Drawer({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside className="drawer" role="dialog" aria-label={title} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 360, damping: 38 }}>
            <div className="drawer-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
            <div className="drawer-body">{children}</div>
            {footer && <div className="drawer-foot">{footer}</div>}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function Confirm({ open, title, text, confirmLabel = 'Confirm', onConfirm, onCancel, danger = true }) {
  const [busy, setBusy] = useState(false);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} />
          <motion.div className="modal" role="alertdialog" initial={{ opacity: 0, scale: 0.92, x: '-50%', y: '-45%' }} animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }} exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}>
            <h3>{title}</h3><p>{text}</p>
            <div className="actions">
              <Button variant="ghost" onClick={onCancel}>Cancel</Button>
              <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{confirmLabel}</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
