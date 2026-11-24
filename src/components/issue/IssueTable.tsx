'use client';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import { Avatar, PriorityIcon, StatusChip, TypeIcon, relTime, Select, Pagination, usePaged } from '../ui';
import { api, errMsg, invalidate, toast } from '@/lib/api';

type SortKey = 'key' | 'summary' | 'priority' | 'status' | 'assignee' | 'updatedAt' | 'dueDate';
const PRIO = { Highest: 0, High: 1, Medium: 2, Low: 3, Lowest: 4 } as Record<string, number>;

export function IssueTable({ items, onOpen, statuses, users, onChanged, canBulk, projectName }: { items: any[]; onOpen: (key: string) => void; statuses?: { id: string; name: string }[]; users?: any[]; onChanged?: () => void; canBulk?: boolean; projectName?: boolean }) {
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 } | null>(null); const [sel, setSel] = useState<Set<string>>(new Set()); const [busy, setBusy] = useState(false);
  const rows = useMemo(() => {
    if (!sort) return items;
    const val = (i: any) => ({ key: i.number ?? i.key, summary: i.summary.toLowerCase(), priority: PRIO[i.priority], status: i.status, assignee: i.assignee?.name || 'zzz', updatedAt: +new Date(i.updatedAt), dueDate: i.dueDate ? +new Date(i.dueDate) : Infinity }[sort.k]);
    return [...items].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [items, sort]);
  const toggle = (k: string) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const pg = usePaged(rows, 25);
  const all = pg.rows.length > 0 && pg.rows.every((r) => sel.has(r.key));
  const th = (k: SortKey, label: string, cls = '') => (
    <th className={clsx('select-none p-3 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted', cls)}>
      <button className="inline-flex items-center gap-1 hover:text-text" onClick={() => setSort(sort?.k === k ? (sort.dir === 1 ? { k, dir: -1 } : null) : { k, dir: 1 })}>{label}{sort?.k === k && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</button>
    </th>
  );

  async function bulk(patch: any, del?: boolean) {
    setBusy(true);
    try { const r = await api<any>('/api/issues/bulk', { body: { keys: [...sel], patch, delete: del } }); const failed = r.results.filter((x: any) => !x.ok); invalidate('/api/'); toast[failed.length ? 'error' : 'success'](failed.length ? `${r.succeeded} updated, ${failed.length} failed: ${failed[0].error}` : `${r.succeeded} issues updated`); setSel(new Set()); onChanged?.(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-[13.5px]">
          <thead className="border-b border-[var(--border)]"><tr>
            {canBulk && <th className="w-10 p-3"><input type="checkbox" aria-label="Select all" checked={all} onChange={() => setSel(all ? new Set() : new Set(pg.rows.map((r) => r.key)))} className="accent-[var(--accent)]" /></th>}
            {th('key', 'Key')}{th('summary', 'Title')}{th('status', 'Status')}{th('priority', 'Priority')}{th('assignee', 'Assignee')}{th('dueDate', 'Due')}{th('updatedAt', 'Updated')}
          </tr></thead>
          <tbody>
            {pg.rows.map((i, idx) => (
              <motion.tr key={i._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(idx, 20) * 0.015 }} className={clsx('cursor-pointer border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--surface-2)]', sel.has(i.key) && 'bg-[var(--accent-soft)]')} onClick={() => onOpen(i.key)}>
                {canBulk && <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${i.key}`} checked={sel.has(i.key)} onChange={() => toggle(i.key)} className="accent-[var(--accent)]" /></td>}
                <td className="p-3"><span className="flex items-center gap-2"><TypeIcon type={i.type} size={17} /><span className="key font-semibold">{i.key}</span></span></td>
                <td className="max-w-[420px] p-3"><span className="line-clamp-1 font-medium">{i.summary}</span>{projectName && <span className="text-xs text-faint">{i.projectKey}</span>}</td>
                <td className="p-3"><StatusChip status={i.status} category={i.statusCategory} small project={statuses ? { statuses: statuses.map((s: any) => ({ ...s, color: s.color })) as any } : undefined} /></td>
                <td className="p-3"><PriorityIcon priority={i.priority} withLabel /></td>
                <td className="p-3"><span className="flex items-center gap-2"><Avatar user={i.assignee} size={22} /><span className="hidden xl:inline">{i.assignee?.name}</span></span></td>
                <td className={clsx('p-3 text-xs', i.dueDate && new Date(i.dueDate) < new Date() && i.statusCategory !== 'done' ? 'font-semibold text-danger' : 'text-muted')}>{i.dueDate ? new Date(i.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}</td>
                <td className="p-3 text-xs text-muted">{relTime(i.updatedAt)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {rows.length > 25 && <Pagination {...pg.bar} />}
      </div>
      <AnimatePresence>
        {sel.size > 0 && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 32 }} className="glass-solid fixed bottom-4 left-1/2 z-50 flex w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-2xl px-4 py-3 sm:bottom-6 shadow-[var(--glow)]">
            <span className="text-[13.5px] font-semibold">{sel.size} selected</span>
            {statuses && <Select aria-label="Bulk status" className="!h-9 !w-40" value="" onChange={(v) => v && bulk({ status: v })} options={[{ value: '', label: 'Set status…' }, ...statuses.map((s) => ({ value: s.id, label: s.name }))]} disabled={busy} />}
            {users && <Select aria-label="Bulk assignee" className="!h-9 !w-40" value="" onChange={(v) => v && bulk({ assigneeId: v === '__none' ? null : v })} options={[{ value: '', label: 'Assign to…' }, { value: '__none', label: 'Unassigned' }, ...users.map((u) => ({ value: u._id, label: u.name }))]} disabled={busy} />}
            <Select aria-label="Bulk priority" className="!h-9 !w-36" value="" onChange={(v) => v && bulk({ priority: v })} options={[{ value: '', label: 'Priority…' }, ...['Highest', 'High', 'Medium', 'Low', 'Lowest'].map((p) => ({ value: p, label: p }))]} disabled={busy} />
            <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => bulk({}, true)}><Trash2 size={13} /> Delete</button>
            <button className="btn btn-ghost btn-sm btn-icon" aria-label="Clear selection" onClick={() => setSel(new Set())}><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
