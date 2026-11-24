'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Plus, LayoutDashboard, FolderKanban, Filter, Bell, Target, Moon, FileText, User as UserIcon, CornerDownLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Avatar, TypeIcon, StatusChip } from './ui';
import { useMe } from './UserContext';

type Item = { id: string; group: string; label: string; hint?: string; icon: React.ReactNode; run: () => void };

export function CommandPalette({ open, onClose, onCreate, toggleTheme }: { open: boolean; onClose: () => void; onCreate: () => void; toggleTheme: () => void }) {
  const router = useRouter(); const me = useMe();
  const [q, setQ] = useState(''); const [idx, setIdx] = useState(0);
  const [res, setRes] = useState<{ issues: any[]; projects: any[]; people: any[] }>({ issues: [], projects: [], people: [] });
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);
  useEffect(() => {
    if (!q.trim()) { setRes({ issues: [], projects: [], people: [] }); return; }
    const t = setTimeout(() => api<any>(`/api/search?q=${encodeURIComponent(q)}`).then(setRes).catch(() => {}), 140);
    return () => clearTimeout(t);
  }, [q]);

  const go = (href: string) => () => { onClose(); router.push(href); };
  const items: Item[] = useMemo(() => {
    const actions: Item[] = [
      ...(me.role !== 'guest' ? [{ id: 'a-create', group: 'Actions', label: 'Create issue', hint: 'C', icon: <Plus size={16} />, run: onCreate }] : []),
      { id: 'a-dash', group: 'Go to', label: 'Dashboard', hint: 'G D', icon: <LayoutDashboard size={16} />, run: go('/dashboard') },
      { id: 'a-proj', group: 'Go to', label: 'Projects', hint: 'G P', icon: <FolderKanban size={16} />, run: go('/projects') },
      { id: 'a-search', group: 'Go to', label: 'Advanced search (OQL)', hint: 'G S', icon: <Filter size={16} />, run: go('/search') },
      { id: 'a-inbox', group: 'Go to', label: 'Inbox', hint: 'G N', icon: <Bell size={16} />, run: go('/notifications') },
      ...(me.role !== 'guest' ? [{ id: 'a-goals', group: 'Go to', label: 'Goals & OKRs', icon: <Target size={16} />, run: go('/goals') }] : []),
      { id: 'a-theme', group: 'Actions', label: 'Switch theme (dark · light · simple)', icon: <Moon size={16} />, run: () => { toggleTheme(); onClose(); } },
    ];
    const needle = q.trim().toLowerCase();
    const filtered = needle ? actions.filter((a) => a.label.toLowerCase().includes(needle)) : actions;
    const found: Item[] = [
      ...res.issues.map((i) => ({ id: i._id, group: 'Issues', label: i.summary, hint: i.key, icon: <TypeIcon type={i.type} />, run: go(`/issues/${i.key}`) })),
      ...res.projects.map((p) => ({ id: p._id, group: 'Projects', label: p.name, hint: p.key, icon: <FileText size={16} style={{ color: p.color }} />, run: go(`/projects/${p.key}/board`) })),
      ...res.people.map((p) => ({ id: p._id, group: 'People', label: p.name, hint: p.title, icon: <Avatar user={p} size={20} />, run: go(`/search?oql=${encodeURIComponent(`assignee = "${p.name}" ORDER BY updated DESC`)}`) })),
    ];
    return [...found, ...filtered];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, res, me.role]);
  useEffect(() => setIdx(0), [q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); items[idx]?.run(); }
    else if (e.key === 'Escape') onClose();
  };
  useEffect(() => { document.querySelector(`[data-cp="${idx}"]`)?.scrollIntoView({ block: 'nearest' }); }, [idx]);

  let lastGroup = '';
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] flex items-start justify-center p-3 pt-[10vh] sm:p-4 sm:pt-[12vh]">
          <motion.div className="fixed inset-0 bg-black/60" initial={{ opacity: 0, backdropFilter: 'blur(0px)' }} animate={{ opacity: 1, backdropFilter: 'blur(10px)' }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div role="dialog" aria-label="Command palette" initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }} className="glass-solid relative w-full max-w-[620px] overflow-hidden rounded-3xl shadow-[var(--glow)]">
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-5">
              <Search size={18} className="text-accent2" />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search issues, projects, people or run a command…" className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" aria-label="Search" />
              <kbd>esc</kbd>
            </div>
            <div className="max-h-[52vh] overflow-y-auto p-2">
              {items.length === 0 && <p className="py-10 text-center text-muted">No results for “{q}”</p>}
              {items.map((it, i) => {
                const header = it.group !== lastGroup ? it.group : null; lastGroup = it.group;
                return (
                  <div key={it.id}>
                    {header && <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-faint">{header}</div>}
                    <button data-cp={i} onMouseMove={() => setIdx(i)} onClick={it.run} className="relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left">
                      {idx === i && <motion.span layoutId="cp-hl" className="absolute inset-0 rounded-xl bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/40" transition={{ type: 'spring', stiffness: 600, damping: 40 }} />}
                      <span className="relative flex w-5 justify-center text-muted">{it.icon}</span>
                      <span className="relative flex-1 truncate text-[14px]">{it.label}</span>
                      {it.hint && <span className="key relative">{it.hint}</span>}
                      {idx === i && <CornerDownLeft size={13} className="relative text-faint" />}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 border-t border-[var(--border)] px-5 py-2.5 text-[11.5px] text-faint"><span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> select</span><span className="ml-auto flex items-center gap-1"><UserIcon size={11} /> {me.name}</span></div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
void StatusChip;
