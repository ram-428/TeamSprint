'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCorners, useDroppable, type DragEndEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import { IssueCard } from './IssueCard';
import { api, errMsg, invalidate, toast } from '@/lib/api';

type Props = { project: any; issues: any[]; epics: Record<string, string>; canMove: boolean; onOpen: (key: string) => void; onChanged: (patch: (list: any[]) => any[]) => void; onCreate?: (status: string) => void; dragId: string };

function SortableCard({ issue, epics, disabled, onOpen, flash, shake, selected }: { issue: any; epics: Record<string, string>; disabled: boolean; onOpen: (k: string) => void; flash: boolean; shake: boolean; selected: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.key, disabled });
  const age = issue.statusChangedAt ? Math.floor((Date.now() - +new Date(issue.statusChangedAt)) / 864e5) : 0;
  return (
    <IssueCard ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} issue={issue} epicName={issue.epicId ? epics[issue.epicId] : undefined} dragging={isDragging} ageDays={age}
      flash={flash} shake={shake} selected={selected} {...attributes} {...listeners} onClick={() => onOpen(issue.key)} tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(issue.key); else listeners?.onKeyDown?.(e as any); }} className={flash ? 'flash-done' : undefined} />
  );
}

function Column({ status, items, wip, children, count, canCreate, onCreate }: { status: any; items: string[]; wip?: number; children: React.ReactNode; count: number; canCreate: boolean; onCreate?: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status.id}` });
  const over = wip ? count > wip : false; const atLimit = wip ? count === wip : false;
  return (
    <div className={clsx('flex w-[min(240px,calc(100vw-4rem))] shrink-0 flex-col rounded-[14px] border p-1.5 transition-colors', isOver ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] bg-[var(--surface)]', over && 'border-danger/70 shadow-[0_0_0_1px_var(--danger),0_0_32px_-8px_var(--danger)]')}>
      <div className="mb-1.5 flex items-center gap-1.5 px-1.5 pt-1">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: status.color, boxShadow: `0 0 8px ${status.color}` }} />
        <h3 className="truncate text-[11.5px] font-bold uppercase tracking-wide">{status.name}</h3>
        <span className={clsx('rounded-full px-2 text-[11px] font-semibold', over ? 'bg-danger/20 text-danger' : 'bg-[var(--surface-2)] text-muted')}>{count}{wip ? ` / ${wip}` : ''}</span>
        {over && <span className="text-[10.5px] font-semibold text-danger">WIP exceeded</span>}{atLimit && <span className="text-[10.5px] font-semibold text-warning">at limit</span>}
        {canCreate && <button aria-label={`Create issue in ${status.name}`} onClick={onCreate} className="btn btn-ghost btn-sm btn-icon ml-auto !h-7 !w-7 opacity-60 hover:opacity-100"><Plus size={14} /></button>}
      </div>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-[72px] flex-1 flex-col gap-1.5 px-0.5 pb-0.5">
          {children}
          {items.length === 0 && <div className="flex flex-1 items-center justify-center rounded-[10px] border border-dashed border-[var(--border)] py-4 text-[11px] text-faint">Drop issues here</div>}
        </div>
      </SortableContext>
    </div>
  );
}

export function Board({ project, issues, epics, canMove, onOpen, onChanged, onCreate, dragId }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const byKey = useMemo(() => new Map(issues.map((i) => [i.key, i])), [issues]);
  const build = () => Object.fromEntries(project.statuses.map((s: any) => [s.id, issues.filter((i) => i.status === s.id).sort((a, b) => a.rank - b.rank).map((i) => i.key)])) as Record<string, string[]>;
  const [cols, setCols] = useState<Record<string, string[]>>(build);
  const [active, setActive] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null); const [shake, setShake] = useState<string | null>(null);
  const dragging = useRef(false);
  useEffect(() => { if (!dragging.current) setCols(build()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [issues, project.statuses]);

  const findCol = (id: string) => (id.startsWith('col:') ? id.slice(4) : Object.keys(cols).find((c) => cols[c].includes(id)));

  const onDragStart = (e: DragStartEvent) => { dragging.current = true; setActive(String(e.active.id)); };
  const onDragOver = (e: DragOverEvent) => {
    const { active: a, over } = e; if (!over) return;
    const from = findCol(String(a.id)), to = findCol(String(over.id));
    if (!from || !to || from === to) return;
    setCols((c) => {
      const overIdx = c[to].indexOf(String(over.id));
      const idx = overIdx >= 0 ? overIdx : c[to].length;
      return { ...c, [from]: c[from].filter((k) => k !== a.id), [to]: [...c[to].slice(0, idx), String(a.id), ...c[to].slice(idx)] };
    });
  };
  const onDragEnd = async (e: DragEndEvent) => {
    const { active: a, over } = e; setActive(null);
    const key = String(a.id); const original = byKey.get(key);
    if (!over || !original) { dragging.current = false; setCols(build()); return; }
    const to = findCol(String(over.id)); const from = findCol(key);
    if (!to || !from) { dragging.current = false; setCols(build()); return; }
    let next = cols;
    if (from === to && !String(over.id).startsWith('col:')) {
      const oi = cols[to].indexOf(key), ni = cols[to].indexOf(String(over.id));
      if (oi !== ni && ni >= 0) { const arr = [...cols[to]]; arr.splice(oi, 1); arr.splice(ni, 0, key); next = { ...cols, [to]: arr }; setCols(next); }
    }
    const list = next[to]; const idx = list.indexOf(key);
    const aboveKey = idx > 0 ? list[idx - 1] : null; const belowKey = idx < list.length - 1 ? list[idx + 1] : null;
    if (original.status === to && build()[to].join() === list.join()) { dragging.current = false; return; }
    const st = project.statuses.find((s: any) => s.id === to);
    const prev = { status: original.status, rank: original.rank, statusCategory: original.statusCategory };
    const nb = (k: string | null) => (k ? byKey.get(k)?.rank : undefined);
    const newRank = nb(aboveKey) !== undefined && nb(belowKey) !== undefined ? (nb(aboveKey)! + nb(belowKey)!) / 2 : nb(aboveKey) !== undefined ? nb(aboveKey)! + 500 : nb(belowKey) !== undefined ? nb(belowKey)! - 500 : original.rank;
    onChanged((l) => l.map((i) => (i.key === key ? { ...i, status: to, statusCategory: st.category, rank: newRank, statusChangedAt: new Date().toISOString() } : i)));
    dragging.current = false;
    try {
      await api('/api/issues/rank', { body: { key, status: to !== original.status ? to : undefined, aboveKey, belowKey } });
      invalidate('/api/dashboard');
      if (st.category === 'done' && original.statusCategory !== 'done') { setFlash(key); setTimeout(() => setFlash(null), 1000); toast.success(`${key} done 🎉`); }
    } catch (err) {
      onChanged((l) => l.map((i) => (i.key === key ? { ...i, ...prev } : i)));
      setCols(build()); setShake(key); setTimeout(() => setShake(null), 500); toast.error(errMsg(err));
    }
  };

  const activeIssue = active ? byKey.get(active) : null;
  return (
    <DndContext id={dragId} sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { dragging.current = false; setActive(null); setCols(build()); }}>
      <div className="flex gap-2.5 overflow-x-auto pb-3">
        {project.statuses.map((s: any, i: number) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Column status={s} items={cols[s.id] || []} count={(cols[s.id] || []).length} wip={project.wip?.[s.id]} canCreate={!!onCreate} onCreate={() => onCreate?.(s.id)}>
              {(cols[s.id] || []).map((k) => byKey.get(k) && <SortableCard key={k} issue={byKey.get(k)} epics={epics} disabled={!canMove} onOpen={onOpen} flash={flash === k} shake={shake === k} selected={false} />)}
            </Column>
          </motion.div>
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' }}>{activeIssue ? <IssueCard issue={activeIssue} epicName={activeIssue.epicId ? epics[activeIssue.epicId] : undefined} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
