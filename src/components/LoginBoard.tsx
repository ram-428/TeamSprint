'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, BookOpen, CheckSquare, Zap, Check } from 'lucide-react';

/** A self-playing mini kanban board for the login hero: cards fly between columns using shared-layout animations. */
const COLS = [{ name: 'To Do', c: '#94a3b8' }, { name: 'In Progress', c: '#7c5cff' }, { name: 'Done', c: '#34d399' }];
const CARDS = [
  { id: 'a', k: 'TS-101', t: 'SSO with Google & GitHub', I: Zap, c: '#a78bfa', pts: 8, u: ['#7c5cff', 'SD'], start: 0 },
  { id: 'b', k: 'TS-102', t: 'Fix checkout rounding bug', I: Bug, c: '#f87171', pts: 2, u: ['#22d3ee', 'KP'], start: 1 },
  { id: 'c', k: 'TS-103', t: 'Dark mode design tokens', I: BookOpen, c: '#34d399', pts: 5, u: ['#f472b6', 'OH'], start: 0 },
  { id: 'd', k: 'TS-104', t: 'Add rate limiting to API', I: CheckSquare, c: '#60a5fa', pts: 3, u: ['#fbbf24', 'AK'], start: 2 },
  { id: 'e', k: 'TS-105', t: 'Sprint burndown report', I: BookOpen, c: '#34d399', pts: 5, u: ['#34d399', 'PS'], start: 1 },
];

export function LoginBoard() {
  const [step, setStep] = useState(0);
  useEffect(() => { const t = setInterval(() => setStep((s) => s + 1), 2400); return () => clearInterval(t); }, []);
  // each card advances one column every 2 ticks (staggered by index), then wraps back to To Do
  const colOf = (i: number) => (CARDS[i].start + Math.floor((step + i) / 2)) % 3;
  const done = CARDS.filter((_, i) => colOf(i) === 2).reduce((a, c) => a + c.pts, 0);
  const total = CARDS.reduce((a, c) => a + c.pts, 0);

  return (
    <div className="glass relative w-full max-w-[640px] overflow-hidden rounded-[26px] p-4" style={{ transform: 'translateZ(0)' }}>
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="flex gap-1.5">{['#ff5f57', '#febc2e', '#28c840'].map((c) => <i key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />)}</span>
        <span className="ml-2 text-[12px] font-semibold text-muted">Sprint 12 · Checkout & SSO</span>
        <span className="ml-auto flex items-center gap-2 text-[11.5px] text-muted"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-success text-success" />Live</span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"><motion.div className="grad-bar h-full rounded-full" animate={{ width: `${(done / total) * 100}%` }} transition={{ type: 'spring', stiffness: 80, damping: 18 }} /></div>
      <div className="grid grid-cols-3 gap-3">
        {COLS.map((col, ci) => (
          <div key={col.name} className="min-h-[250px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2">
            <div className="mb-2 flex items-center gap-1.5 px-1 pt-0.5"><span className="h-2 w-2 rounded-full" style={{ background: col.c, boxShadow: `0 0 8px ${col.c}` }} /><span className="text-[10.5px] font-bold uppercase tracking-wide">{col.name}</span><span className="ml-auto text-[10.5px] text-faint">{CARDS.filter((_, i) => colOf(i) === ci).length}</span></div>
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {CARDS.map((c, i) => colOf(i) === ci && (
                  <motion.div key={c.id} layoutId={`lb-${c.id}`} layout transition={{ type: 'spring', stiffness: 260, damping: 26 }} className="relative rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-2.5 shadow-[0_6px_18px_-10px_rgba(0,0,0,.5)]">
                    <div className="text-[11.5px] font-medium leading-snug">{c.t}</div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded" style={{ background: `${c.c}28`, color: c.c }}><c.I size={10} strokeWidth={2.6} /></span>
                      <span className="key text-[10px]">{c.k}</span>
                      <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--surface-2)] px-1 text-[9.5px] font-semibold text-muted">{c.pts}</span>
                      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ background: c.u[0] }}>{c.u[1]}</span>
                    </div>
                    {ci === 2 && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-success text-white"><Check size={10} strokeWidth={3} /></motion.span>}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
