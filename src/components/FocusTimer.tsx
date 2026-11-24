'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Maximize2, X, Brain } from 'lucide-react';
import { Card, ProgressRing, Select } from './ui';
import { api, errMsg, invalidate, toast } from '@/lib/api';

/** Pomodoro focus mode: pick an issue, run 25m, auto-logs the work on completion. */
export function FocusTimer({ issues }: { issues: any[] }) {
  const [minutes, setMinutes] = useState(25); const [left, setLeft] = useState(25 * 60); const [running, setRunning] = useState(false);
  const [issueKey, setIssueKey] = useState(''); const [full, setFull] = useState(false);
  const startRef = useRef(0);
  useEffect(() => { if (!issueKey && issues[0]) setIssueKey(issues[0].key); }, [issues, issueKey]);
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setLeft((l) => (l <= 1 ? 0 : l - 1)), 1000);
    return () => clearInterval(iv);
  }, [running]);
  useEffect(() => {
    if (running && left === 0) {
      setRunning(false);
      if (issueKey) api(`/api/issues/${issueKey}/worklogs`, { body: { time: `${minutes}m`, description: 'Focus session' } }).then(() => { toast.success(`Focus session complete — ${minutes}m logged on ${issueKey}`); invalidate('/api/dashboard'); }).catch((e) => toast.error(errMsg(e)));
      setLeft(minutes * 60);
    }
  }, [left, running, issueKey, minutes]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false);
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  void startRef;
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
  const pct = ((minutes * 60 - left) / (minutes * 60)) * 100;
  const controls = (big?: boolean) => (
    <div className={big ? 'flex flex-col items-center gap-8' : ''}>
      <div className="flex items-center justify-center py-2"><ProgressRing value={pct} size={big ? 280 : 120} stroke={big ? 10 : 8} label={<span className={big ? 'text-6xl font-semibold' : 'text-[26px] font-semibold'}>{mm}:{ss}</span>} /></div>
      <div className={big ? 'flex w-full max-w-sm flex-col gap-3' : 'mt-3 space-y-2.5'}>
        <Select aria-label="Focus issue" value={issueKey} onChange={setIssueKey} disabled={running} options={issues.length ? issues.map((i) => ({ value: i.key, label: `${i.key} · ${i.summary}`.slice(0, 48) })) : [{ value: '', label: 'No assigned issues' }]} />
        <div className="flex items-center gap-2">
          <button className="btn btn-primary flex-1" onClick={() => setRunning((r) => !r)} disabled={!issueKey}>{running ? <><Pause size={15} /> Pause</> : <><Play size={15} /> {left < minutes * 60 ? 'Resume' : 'Start focus'}</>}</button>
          <button className="btn btn-icon" aria-label="Reset" onClick={() => { setRunning(false); setLeft(minutes * 60); }}><RotateCcw size={15} /></button>
          {!running && <Select aria-label="Duration" className="!w-[92px]" value={String(minutes)} onChange={(v) => { setMinutes(+v); setLeft(+v * 60); }} options={[15, 25, 45, 60].map((m) => ({ value: String(m), label: m + 'm' }))} />}
        </div>
      </div>
    </div>
  );
  return (
    <>
      <Card className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[var(--accent)] opacity-20 blur-3xl" />
        <div className="mb-1 flex items-center justify-between"><h2 className="flex items-center gap-2 text-[16px] font-semibold"><Brain size={16} className="text-accent" /> Focus mode</h2><button className="btn btn-ghost btn-sm btn-icon" aria-label="Fullscreen focus" onClick={() => setFull(true)}><Maximize2 size={14} /></button></div>
        {controls()}
      </Card>
      <AnimatePresence>
        {full && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[96] flex items-center justify-center bg-[var(--bg)]/95 backdrop-blur-xl">
          <button className="btn btn-ghost btn-icon absolute right-6 top-6" onClick={() => setFull(false)} aria-label="Exit focus"><X size={20} /></button>{controls(true)}</motion.div>}
      </AnimatePresence>
    </>
  );
}
