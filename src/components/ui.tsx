'use client';
import { useEffect, useId, useRef, useState, type ReactNode, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, animate, useInView } from 'framer-motion';
import clsx from 'clsx';
import { STATUSES } from '@/lib/statuses';
import {
  X, Check, Search as SearchIcon, Bug, BookOpen, CheckSquare, Zap, GitBranch, ChevronsUp, ChevronUp, Equal, ChevronDown, ChevronsDown, Inbox, AlertCircle,
} from 'lucide-react';

/* ───────────── primitives ───────────── */
export function Spinner({ size = 16 }: { size?: number }) {
  return <span style={{ width: size, height: size, animation: 'spin .7s linear infinite' }} className="inline-block rounded-full border-2 border-current border-t-transparent" aria-label="Loading" />;
}

export function Avatar({ user, size = 28, ring }: { user?: { name?: string; color?: string; avatarUrl?: string } | null; size?: number; ring?: boolean }) {
  if (!user) return (
    <span title="Unassigned" style={{ width: size, height: size }} className="inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border-strong)] text-faint">
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
    </span>
  );
  const initials = (user.name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const c = user.color || '#7c5cff';
  if (user.avatarUrl) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.avatarUrl} alt={user.name || 'User'} title={user.name} width={size} height={size} loading="lazy" decoding="async" style={{ width: size, height: size, boxShadow: ring ? '0 0 0 2px var(--bg)' : undefined }} className="inline-block shrink-0 select-none rounded-full bg-[var(--surface-2)] object-cover" />
  );
  return (
    <span title={user.name} style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, ${c}, ${c}99)`, boxShadow: ring ? '0 0 0 2px var(--bg)' : undefined }} className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white">
      {initials}
    </span>
  );
}

export function AvatarStack({ users, max = 4, size = 26 }: { users: ({ name?: string; color?: string; avatarUrl?: string } | undefined)[]; max?: number; size?: number }) {
  const shown = users.filter(Boolean).slice(0, max);
  const extra = users.filter(Boolean).length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((u, i) => <div key={i} style={{ marginLeft: i ? -8 : 0 }}><Avatar user={u} size={size} ring /></div>)}
      {extra > 0 && <span style={{ marginLeft: -8, width: size, height: size }} className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-surface-2 text-[10px] font-semibold text-muted">+{extra}</span>}
    </div>
  );
}

/* ───────────── issue visuals ───────────── */
const TYPE = {
  epic: { icon: Zap, color: '#a78bfa' }, story: { icon: BookOpen, color: '#34d399' }, task: { icon: CheckSquare, color: '#60a5fa' },
  bug: { icon: Bug, color: '#f87171' }, subtask: { icon: GitBranch, color: '#94a3b8' },
} as const;
export function TypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const t = TYPE[type as keyof typeof TYPE] || TYPE.task; const I = t.icon;
  return <span title={type} style={{ width: size, height: size, background: `${t.color}26`, color: t.color }} className="inline-flex shrink-0 items-center justify-center rounded-md"><I size={size * 0.62} strokeWidth={2.4} /></span>;
}
const PRIO = { Highest: [ChevronsUp, '#f87171'], High: [ChevronUp, '#fb923c'], Medium: [Equal, '#fbbf24'], Low: [ChevronDown, '#60a5fa'], Lowest: [ChevronsDown, '#94a3b8'] } as const;
export function PriorityIcon({ priority, withLabel }: { priority: string; withLabel?: boolean }) {
  const [I, c] = PRIO[priority as keyof typeof PRIO] || PRIO.Medium;
  return <span title={priority} className="inline-flex items-center gap-1.5" style={{ color: c, filter: priority === 'Highest' ? `drop-shadow(0 0 6px ${c})` : undefined }}><I size={16} strokeWidth={2.6} />{withLabel && <span className="text-[13px] text-text">{priority}</span>}</span>;
}
const STATUS_NAMES: Record<string, string> = { ...Object.fromEntries(STATUSES.map((s) => [s.id, s.name])), review: 'In Review', qa: 'QA', customer: 'Waiting for customer' };
/** Human label for a status id (falls back to the project's own names, then a capitalised id). */
export function statusName(id: string, project?: { statuses: { id: string; name: string }[] }) {
  const n = project?.statuses.find((x) => x.id === id)?.name ?? STATUS_NAMES[id] ?? id;
  return n.charAt(0).toUpperCase() + n.slice(1);
}
export function StatusChip({ project, status, category, small }: { project?: { statuses: { id: string; name: string; color: string }[] }; status: string; category?: string; small?: boolean }) {
  const s = project?.statuses.find((x) => x.id === status);
  const color = s?.color || (category === 'done' ? '#34d399' : category === 'inprogress' ? '#7c5cff' : '#94a3b8');
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide', small ? 'h-5 px-2 text-[10px]' : 'h-6 px-2.5 text-[11px]')} style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />{statusName(status, project)}
    </span>
  );
}
export const fmtDuration = (s: number) => { if (!s) return '0m'; const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`; };
export function relTime(d: string | Date) {
  const diff = Date.now() - +new Date(d); const m = Math.round(diff / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`; const h = Math.round(m / 60); if (h < 24) return `${h}h ago`; const dd = Math.round(h / 24); if (dd < 30) return `${dd}d ago`;
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ───────────── layout bits ───────────── */
export function PageHeader({ title, subtitle, actions, icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <div className="min-w-0"><h1 className="text-[22px] font-semibold leading-tight sm:text-[24px]">{title}</h1>{subtitle && <p className="mt-1 text-[14px] text-muted">{subtitle}</p>}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export function Card({ children, className, spotlight, ...rest }: { children: ReactNode; className?: string; spotlight?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  const onMove = (e: MouseEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`); };
  return <div {...rest} onMouseMove={spotlight ? onMove : undefined} className={clsx('glass card', spotlight && 'spot', className)}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) { return <div className={clsx('skeleton', className)} />; }
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return <div className="space-y-2.5">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>;
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-surface-2 text-accent shadow-[var(--glow)]">{icon || <Inbox size={28} />}</div>
      <h3 className="text-[17px] font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center py-14 text-center">
      <AlertCircle size={30} className="mb-3 text-danger" /><p className="font-medium">{message}</p>
      {onRetry && <button className="btn mt-4" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/* ───────────── progress ───────────── */
export function ProgressBar({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null); const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} className="w-full overflow-hidden rounded-full bg-[var(--surface-2)]" style={{ height }}>
      <motion.div className={clsx('h-full rounded-full', !color && 'grad-bar')} style={color ? { background: color } : undefined} initial={{ width: 0 }} animate={{ width: inView ? `${Math.min(100, Math.max(0, value))}%` : 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}
export function ProgressRing({ value, size = 64, stroke = 7, label }: { value: number; size?: number; stroke?: number; label?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r; const id = useId();
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="var(--accent)" /><stop offset="100%" stopColor="var(--accent-2)" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={stroke} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round" fill="none" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.min(100, value) / 100) }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <div className="absolute text-[13px] font-semibold tabular-nums">{label ?? `${Math.round(value)}%`}</div>
    </div>
  );
}
export function CountUp({ value, duration = 1, decimals = 0 }: { value: number; duration?: number; decimals?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => { const c = animate(0, value, { duration, ease: 'easeOut', onUpdate: (x) => setV(x) }); return () => c.stop(); }, [value, duration]);
  return <span className="tabular-nums">{v.toFixed(decimals)}</span>;
}

/* ───────────── Tabs with sliding indicator ───────────── */
export function Tabs<T extends string>({ tabs, value, onChange, id }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; id: string }) {
  return (
    <div role="tablist" className="inline-flex max-w-full flex-wrap gap-1 border-b-2 border-[var(--border)]">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={clsx('relative -mb-[2px] border-b-2 border-transparent px-2 pb-2 pt-1 text-[14px] font-medium transition-colors', value === t.id ? 'text-accent' : 'text-muted hover:border-[var(--border-strong)] hover:text-text')}>
          {value === t.id && <motion.span layoutId={`tab-${id}`} className="absolute inset-x-0 -bottom-[2px] h-[2px] bg-[var(--accent)]" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          <span className="relative flex items-center gap-1.5">{t.label}{t.count !== undefined && <span className={clsx('rounded-[3px] px-1.5 text-[11px] font-semibold', value === t.id ? 'bg-[var(--accent-soft)] text-accent' : 'bg-[var(--surface-2)] text-muted')}>{t.count}</span>}</span>
        </button>
      ))}
    </div>
  );
}

/* ───────────── Modal / Drawer ───────────── */
function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = prev; };
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, children, width = 560, footer, padded = true, scroll = false, centered = false }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; width?: number; footer?: ReactNode; padded?: boolean; scroll?: boolean; centered?: boolean }) {
  useEscape(open, onClose);
  const body = padded ? <div className={clsx('p-4 sm:p-6', scroll && 'min-h-0 flex-1 overflow-y-auto')}>{children}</div> : scroll ? <div className="min-h-0 flex-1 overflow-y-auto">{children}</div> : children;
  return (
    <AnimatePresence>
      {open && (
        <div className={clsx('fixed inset-0 z-[80] flex justify-center overflow-y-auto p-3 sm:p-4', centered ? 'items-center' : 'items-start pt-[8vh]')}>
          <motion.div className="fixed inset-0 bg-black/55" initial={{ opacity: 0, backdropFilter: 'blur(0px)' }} animate={{ opacity: 1, backdropFilter: 'blur(8px)' }} exit={{ opacity: 0, backdropFilter: 'blur(0px)' }} onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Dialog'} style={{ maxWidth: width }} className={clsx('glass-solid relative w-full rounded-3xl', scroll && 'flex flex-col overflow-hidden', scroll && (centered ? 'max-h-[min(920px,90vh)]' : 'max-h-[min(860px,84vh)]'))} initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.97 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
            {title && <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3.5 sm:px-6 sm:py-4"><h2 className="min-w-0 text-[17px] font-semibold">{title}</h2><button aria-label="Close" onClick={onClose} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button></div>}
            {body}
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] px-4 py-3.5 sm:px-6 sm:py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Drawer({ open, onClose, children, width = 760 }: { open: boolean; onClose: () => void; children: ReactNode; width?: number }) {
  useEscape(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <motion.div className="absolute inset-0 bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside role="dialog" aria-modal="true" style={{ width: `min(${width}px, 100vw)` }} className="glass-solid absolute right-0 top-0 h-full overflow-y-auto rounded-l-3xl" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 340, damping: 38 }}>
            {children}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger, typeToConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void | Promise<void>; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; typeToConfirm?: string }) {
  const [typed, setTyped] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setTyped(''); }, [open]);
  return (
    <Modal open={open} onClose={onClose} title={title} width={460} footer={<><button className="btn" onClick={onClose}>Cancel</button><button disabled={busy || (!!typeToConfirm && typed !== typeToConfirm)} className={clsx('btn', danger ? 'btn-danger' : 'btn-primary')} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{busy && <Spinner />}{confirmLabel}</button></>}>
      <div className="text-muted">{message}</div>
      {typeToConfirm && <div className="mt-4"><label className="label">Type <b className="text-text">{typeToConfirm}</b> to confirm</label><input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus /></div>}
    </Modal>
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string; children: ReactNode; hint?: string }) {
  return <div><label className="label">{label}</label>{children}{hint && !error && <p className="mt-1 text-xs text-faint">{hint}</p>}{error && <p className="field-err" role="alert">{error}</p>}</div>;
}

export function Dropdown({ trigger, children, align = 'right' }: { trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: globalThis.MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      <AnimatePresence>
        {open && <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.14 }} className={clsx('glass-solid absolute z-50 mt-2 min-w-[200px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl p-1.5', align === 'right' ? 'right-0' : 'left-0')}>{children(() => setOpen(false))}</motion.div>}
      </AnimatePresence>
    </div>
  );
}
export function MenuItem({ children, onClick, danger, icon, active }: { children: ReactNode; onClick?: () => void; danger?: boolean; icon?: ReactNode; active?: boolean }) {
  return <button onClick={onClick} className={clsx('relative flex w-full items-center gap-2.5 rounded-[3px] px-3 py-2 text-left text-[14px] transition-colors hover:bg-[var(--surface-2)]', danger && 'text-danger', active && 'bg-[var(--accent-soft)] text-accent')}>{icon}{children}</button>;
}

const SEARCH_THRESHOLD = 7;
const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
/** Custom listbox (Siva Durga style): 40px trigger, portal panel that flips upward, search once the list is long, keyboard friendly. */
export function Select({ value, onChange, options, className, disabled, placeholder = 'Select…', searchable: forceSearch, ...rest }: { searchable?: boolean; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string; disabled?: boolean; placeholder?: string; 'aria-label'?: string }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState(''); const [idx, setIdx] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null);
  const trig = useRef<HTMLButtonElement>(null); const search = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value); const searchable = forceSearch ?? options.length > SEARCH_THRESHOLD;
  const list = searchable && q.trim() ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())) : options;
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = trig.current?.getBoundingClientRect(); if (!r) return;
      const below = window.innerHeight - r.bottom, above = r.top; const up = below < 260 && above > below;
      const w = Math.min(Math.max(r.width, 160), window.innerWidth - 16);
      setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), width: w, maxH: Math.min(288, (up ? above : below) - 16), top: up ? undefined : r.bottom + 6, bottom: up ? window.innerHeight - r.top + 6 : undefined });
    };
    const onScroll = (e: Event) => { if (!(e.target as HTMLElement)?.closest?.('[data-listbox]')) place(); };
    const close = (e: Event) => { if (!(e.target as HTMLElement)?.closest?.('[data-listbox]') && !trig.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trig.current?.focus(); } };
    place(); setQ(''); setIdx(Math.max(0, options.findIndex((o) => o.value === value)));
    if (searchable) requestAnimationFrame(() => search.current?.focus());
    window.addEventListener('resize', place); window.addEventListener('scroll', onScroll, true);
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', onScroll, true); document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const pick = (v: string) => { onChange(v); setOpen(false); trig.current?.focus(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open && ['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); setOpen(true); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(list.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (list[idx]) pick(list[idx].value); }
  };
  useEffect(() => { document.querySelector(`[data-lb="${idx}"]`)?.scrollIntoView({ block: 'nearest' }); }, [idx]);
  return (
    <div className={clsx('relative', className || 'w-full')}>
      <button ref={trig} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-label={rest['aria-label']} disabled={disabled} onClick={() => setOpen((o) => !o)} onKeyDown={onKey}
        className={clsx('flex h-10 w-full items-center gap-2 rounded-lg border bg-[var(--surface)] px-3 text-left text-[14px] transition-all disabled:cursor-not-allowed disabled:opacity-50', open ? 'border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]')}>
        <span className={clsx('min-w-0 flex-1 truncate', !selected && 'text-faint')}>{cap(selected?.label ?? placeholder)}</span>
        <ChevronDown size={15} className={clsx('shrink-0 text-faint transition-transform', open && 'rotate-180 text-accent')} />
      </button>
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div data-listbox role="listbox" initial={{ opacity: 0, y: pos.bottom ? 6 : -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.14 }}
              style={{ position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, zIndex: 200 }} className="glass-solid overflow-hidden rounded-xl">
              {searchable && <div className="border-b border-[var(--border)] p-2"><div className="relative"><SearchIcon size={14} className="absolute left-2.5 top-[9px] text-faint" /><input ref={search} aria-label="Search options" value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={onKey} placeholder="Search…" className="h-8 w-full rounded-lg border border-[var(--border)] bg-transparent pl-8 pr-2 text-[13px] outline-none focus:border-[var(--accent)]" /></div></div>}
              <div className="overflow-y-auto p-1" style={{ maxHeight: pos.maxH - (searchable ? 48 : 0) }}>
                {list.length === 0 && <div className="px-3 py-4 text-center text-[13px] text-faint">No matches</div>}
                {list.map((o, i) => (
                  <button key={o.value + i} type="button" role="option" aria-selected={o.value === value} data-lb={i} onMouseEnter={() => setIdx(i)} onClick={() => pick(o.value)}
                    className={clsx('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors', i === idx && 'bg-[var(--accent-soft)]', o.value === value && 'font-semibold')}>
                    <span className="min-w-0 flex-1 truncate">{cap(o.label)}</span>{o.value === value && <Check size={14} className="shrink-0 text-accent" />}
                  </button>))}
              </div>
            </motion.div>)}
        </AnimatePresence>, document.body)}
    </div>
  );
}

/** Simple client-side pagination footer. */
export function Pagination({ page, pageSize, total, onPage, onPageSize }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; onPageSize?: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize)); const from = total === 0 ? 0 : (page - 1) * pageSize + 1; const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 text-[13px] text-muted">
      <span>{from}–{to} of {total}</span>
      <div className="flex items-center gap-2">
        {onPageSize && <select aria-label="Rows per page" className="input !h-8 !w-auto !py-0 text-[13px]" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>{Array.from(new Set([10, 25, 50, pageSize])).sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n} / page</option>)}</select>}
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">Prev</button>
        <span className="min-w-[64px] text-center">Page {page} / {pages}</span>
        <button className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">Next</button>
      </div>
    </div>
  );
}

/** Client-side paging for a list. Spread `bar` into <Pagination />. */
export function usePaged<T>(items: T[] | undefined, initialSize = 10) {
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(initialSize);
  const total = items?.length ?? 0; const pages = Math.max(1, Math.ceil(total / pageSize)); const cur = Math.min(page, pages);
  const rows = (items || []).slice((cur - 1) * pageSize, cur * pageSize);
  const bar = { page: cur, pageSize, total, onPage: setPage, onPageSize: (n: number) => { setPageSize(n); setPage(1); } };
  return { rows, bar };
}
