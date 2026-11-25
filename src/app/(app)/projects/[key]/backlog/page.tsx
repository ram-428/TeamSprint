'use client';
import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCorners, useDroppable, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Play, Wand2, Trash2, ChevronDown, GripVertical, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useProject } from '@/components/ProjectContext';
import { api, errMsg, invalidate, toast, useApi } from '@/lib/api';
import { Avatar, Card, ConfirmDialog, Field, Modal, Select, PriorityIcon, Skeleton, Spinner, StatusChip, TypeIcon, EmptyState } from '@/components/ui';
import { IssueDrawer } from '@/components/issue/IssueDrawer';
import { CreateIssueModal } from '@/components/issue/CreateIssueModal';

function Row({ issue, epic, disabled, onOpen, overlay, checked, onCheck }: { issue: any; epic?: string; disabled: boolean; onOpen: (k: string) => void; overlay?: boolean; checked?: boolean; onCheck?: (shift: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.key, disabled });
  return (
    <div ref={overlay ? undefined : setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...(overlay ? {} : attributes)}
      className={clsx('group flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2.5 last:border-0', checked && '!bg-[var(--accent-soft)]', isDragging && 'opacity-30', overlay && 'rounded-xl border !border-[var(--accent)] shadow-2xl')}>
      <span {...(overlay ? {} : listeners)} className={clsx('flex w-[17px] shrink-0 cursor-grab justify-center text-faint opacity-0 transition-opacity group-hover:opacity-100', disabled && 'hidden')} aria-label="Drag handle"><GripVertical size={15} /></span>
      {onCheck && !overlay && <input type="checkbox" aria-label={`Select ${issue.key}`} className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]" checked={!!checked} onPointerDown={(e) => e.stopPropagation()} onChange={() => {}} onClick={(e) => { e.stopPropagation(); onCheck(e.shiftKey); }} />}
      <TypeIcon type={issue.type} size={17} /><span className="key w-[60px] shrink-0 sm:w-[70px]">{issue.key}</span>
      <button className="min-w-0 flex-1 truncate text-left text-[13.5px] font-medium hover:text-accent2" onClick={() => onOpen(issue.key)}>{issue.summary}</button>
      {epic && <span className="hidden max-w-[140px] truncate rounded-md bg-[#a78bfa22] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#a78bfa] lg:block">{epic}</span>}
      <StatusChip status={issue.status} category={issue.statusCategory} small />
      <PriorityIcon priority={issue.priority} />
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--surface-2)] px-1.5 text-[11px] font-semibold text-muted" title="Story points">{issue.points ?? '–'}</span>
      <Avatar user={issue.assignee} size={22} />
    </div>
  );
}

function Section({ id, title, sub, keys, children, header, collapsed }: { id: string; title: string; sub?: React.ReactNode; keys: string[]; children: React.ReactNode; header?: React.ReactNode; collapsed: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `sec:${id}` });
  return (
    <Card className={clsx('overflow-hidden transition-shadow', isOver && 'shadow-[0_0_0_2px_var(--accent),var(--shadow)]')}>
      {header}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <SortableContext items={keys} strategy={verticalListSortingStrategy}>
              <div ref={setNodeRef} className="min-h-[56px]">{children}{keys.length === 0 && <div className="m-3 rounded-xl border border-dashed border-[var(--border-strong)] py-5 text-center text-[13px] text-faint">{sub || 'Drag issues here'}</div>}</div>
            </SortableContext>
          </motion.div>
        )}
      </AnimatePresence>
      <span className="hidden">{title}</span>
    </Card>
  );
}

export default function BacklogPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params); const { project, assignees } = useProject(); const ab = project.abilities;
  const router = useRouter(); const path = usePathname(); const sp = useSearchParams(); const selected = sp.get('selected');
  const { data, mutate, loading } = useApi<{ items: any[] }>(`/api/issues?project=${key}`);
  const { data: sprints, reload: reloadSprints, loading: sl } = useApi<any[]>(`/api/projects/${key}/sprints`);
  const [secs, setSecs] = useState<Record<string, string[]>>({}); const [active, setActive] = useState<string | null>(null); const dragging = useRef(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({}); const [q, setQ] = useState(''); const [epicF, setEpicF] = useState('');
  const [startFor, setStartFor] = useState<any>(null); const [delFor, setDelFor] = useState<any>(null); const [create, setCreate] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const all = useMemo(() => data?.items ?? [], [data]);
  const epics = useMemo(() => all.filter((i) => i.type === 'epic'), [all]);
  const epicName = (i: any) => epics.find((e) => e._id === i.epicId)?.summary;
  const planning = useMemo(() => (sprints || []).filter((s) => s.state !== 'closed'), [sprints]);
  const items = useMemo(() => all.filter((i) => i.type !== 'epic' && i.type !== 'subtask' && i.statusCategory !== 'done' || (i.type !== 'epic' && i.type !== 'subtask' && planning.some((s) => String(s._id) === String(i.sprintId)))), [all, planning]);
  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const match = (i: any) => (!q || (i.summary + i.key).toLowerCase().includes(q.toLowerCase())) && (!epicF || i.epicId === epicF) && (!assignees.length || assignees.includes(String(i.assigneeId)));

  const build = () => {
    const m: Record<string, string[]> = { backlog: [] };
    for (const s of planning) m[s._id] = [];
    for (const i of [...items].sort((a, b) => a.rank - b.rank)) { const sid = i.sprintId && m[i.sprintId] ? String(i.sprintId) : 'backlog'; if (i.statusCategory === 'done' && sid === 'backlog') continue; m[sid].push(i.key); }
    return m;
  };
  useEffect(() => { if (!dragging.current) setSecs(build()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [items, planning]);
  const secOf = (id: string) => (id.startsWith('sec:') ? id.slice(4) : Object.keys(secs).find((s) => secs[s].includes(id)));

  const onDragOver = (e: DragOverEvent) => {
    const { active: a, over } = e; if (!over) return; const from = secOf(String(a.id)), to = secOf(String(over.id));
    if (!from || !to || from === to) return;
    setSecs((c) => { const oi = c[to].indexOf(String(over.id)); const idx = oi >= 0 ? oi : c[to].length; return { ...c, [from]: c[from].filter((k) => k !== a.id), [to]: [...c[to].slice(0, idx), String(a.id), ...c[to].slice(idx)] }; });
  };
  const onDragEnd = async (e: DragEndEvent) => {
    const { active: a, over } = e; setActive(null); const key_ = String(a.id); const orig = byKey.get(key_);
    if (!over || !orig) { dragging.current = false; setSecs(build()); return; }
    const to = secOf(String(over.id)); if (!to) { dragging.current = false; setSecs(build()); return; }
    let next = secs;
    const from = Object.keys(secs).find((s) => secs[s].includes(key_));
    if (from === to && !String(over.id).startsWith('sec:')) { const oi = secs[to].indexOf(key_), ni = secs[to].indexOf(String(over.id)); if (oi !== ni && ni >= 0) { const arr = [...secs[to]]; arr.splice(oi, 1); arr.splice(ni, 0, key_); next = { ...secs, [to]: arr }; setSecs(next); } }
    const list = next[to]; const idx = list.indexOf(key_);
    const aboveKey = idx > 0 ? list[idx - 1] : null, belowKey = idx < list.length - 1 ? list[idx + 1] : null;
    const newSprint = to === 'backlog' ? null : to; const same = String(orig.sprintId ?? '') === String(newSprint ?? '');
    if (same && build()[to].join() === list.join()) { dragging.current = false; return; }
    const nb = (k: string | null) => (k ? byKey.get(k)?.rank : undefined);
    const rank = nb(aboveKey) !== undefined && nb(belowKey) !== undefined ? (nb(aboveKey)! + nb(belowKey)!) / 2 : nb(aboveKey) !== undefined ? nb(aboveKey)! + 500 : nb(belowKey) !== undefined ? nb(belowKey)! - 500 : orig.rank;
    const prev = { sprintId: orig.sprintId, rank: orig.rank };
    mutate({ items: all.map((i) => (i.key === key_ ? { ...i, sprintId: newSprint ?? undefined, rank } : i)) }); dragging.current = false;
    try { await api('/api/issues/rank', { body: { key: key_, sprintId: newSprint, aboveKey, belowKey } }); reloadSprints(); invalidate('/api/dashboard'); }
    catch (err) { mutate({ items: all.map((i) => (i.key === key_ ? { ...i, ...prev } : i)) }); setSecs(build()); toast.error(errMsg(err)); }
  };

  const setSel = (k: string | null) => { const p = new URLSearchParams(sp.toString()); k ? p.set('selected', k) : p.delete('selected'); router.replace(`${path}?${p}`, { scroll: false }); };
  const stats = (ks: string[]) => { const is = ks.map((k) => byKey.get(k)).filter(Boolean); const pts = (c: string) => is.filter((i) => i.statusCategory === c).reduce((a, i) => a + (i.points || 0), 0); return { total: is.reduce((a, i) => a + (i.points || 0), 0), todo: pts('todo'), prog: pts('inprogress'), done: pts('done') }; };
  const closed = (sprints || []).filter((s) => s.state === 'closed' && s.completed);
  const avgVelocity = closed.length ? Math.round(closed.slice(-3).reduce((a, s) => a + s.completed, 0) / Math.min(3, closed.length)) : 0;

  async function newSprint() { try { await api(`/api/projects/${key}/sprints`, { body: {} }); reloadSprints(); toast.success('Sprint created'); } catch (e) { toast.error(errMsg(e)); } }
  async function suggest(sprint: any) {
    // deterministic planning assistant: fill remaining capacity (avg velocity) from top of backlog by rank
    let cap = avgVelocity - stats(secs[sprint._id] || []).total; const picks: string[] = [];
    for (const k of secs.backlog) { const i = byKey.get(k)!; if (!i.points) continue; if (i.points <= cap) { picks.push(k); cap -= i.points; } if (cap <= 0) break; }
    if (!picks.length) { toast.info('No more backlog items fit the remaining capacity'); return; }
    try { for (const k of picks) await api('/api/issues/rank', { body: { key: k, sprintId: sprint._id } }); mutate(); reloadSprints(); toast.success(`Added ${picks.length} issues to fill ~${avgVelocity} pts capacity`); } catch (e) { toast.error(errMsg(e)); }
  }
  // ── Multi-select + bulk move ──
  const canBulk = !!ab['issue.edit_any'];
  const [sel, setSel_] = useState<string[]>([]); const lastClick = useRef<string | null>(null); const [moving, setMoving] = useState(false);
  const selected_ = sel.filter((k) => byKey.has(k));
  const toggle = (k: string, shift: boolean, list: string[]) => {
    if (shift && lastClick.current && list.includes(lastClick.current)) {
      const [a, b] = [list.indexOf(lastClick.current), list.indexOf(k)].sort((x, y) => x - y); const range = list.slice(a, b + 1);
      setSel_((c) => Array.from(new Set([...c, ...range])));
    } else setSel_((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
    lastClick.current = k;
  };
  const toggleAll = (list: string[]) => { const all_ = list.length > 0 && list.every((k) => sel.includes(k)); setSel_((c) => (all_ ? c.filter((k) => !list.includes(k)) : Array.from(new Set([...c, ...list])))); };
  const SelectAll = ({ list }: { list: string[] }) => canBulk && list.length > 0 ? <input type="checkbox" aria-label="Select all in section" title="Select all" className="h-4 w-4 cursor-pointer accent-[var(--accent)]" checked={list.every((k) => sel.includes(k))} ref={(el) => { if (el) el.indeterminate = list.some((k) => sel.includes(k)) && !list.every((k) => sel.includes(k)); }} onChange={() => toggleAll(list)} /> : null;
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSel_([]); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  async function moveSelected(dest: string) {
    if (!dest || !selected_.length) return; const sprintId = dest === 'backlog' ? null : dest;
    const keys = selected_.filter((k) => String(byKey.get(k)?.sprintId ?? '') !== String(sprintId ?? ''));
    if (!keys.length) { toast.info('Selected issues are already there'); return; }
    setMoving(true);
    try {
      const r = await api<{ succeeded: number; results: { ok: boolean; error?: string }[] }>('/api/issues/bulk', { body: { keys, patch: { sprintId } } });
      const name = sprintId ? planning.find((s) => String(s._id) === sprintId)?.name : 'Backlog';
      const failed = keys.length - r.succeeded;
      failed ? toast.error(`Moved ${r.succeeded}, ${failed} failed: ${r.results.find((x) => !x.ok)?.error ?? ''}`) : toast.success(`Moved ${r.succeeded} issue${r.succeeded === 1 ? '' : 's'} to ${name}`);
      setSel_([]); mutate(); reloadSprints(); invalidate('/api/dashboard');
    } catch (e) { toast.error(errMsg(e)); } finally { setMoving(false); }
  }

  const activeIssue = active ? byKey.get(active) : null;
  const hasFilters = !!q || !!epicF || assignees.length > 0;
  const visibleKeys = (ks: string[] = []) => ks.filter((k) => { const i = byKey.get(k); return !!i && match(i); });
  const backlogKeys = visibleKeys(secs.backlog);
  const noMatches = 'No issues match the current filters';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-auto"><Search size={15} className="absolute left-3 top-[11px] text-faint" /><input aria-label="Filter backlog" className="input !h-9 !w-full !pl-9 sm:!w-56" placeholder="Filter backlog" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select aria-label="Epic filter" className="!w-full sm:!w-56" value={epicF} onChange={setEpicF} options={[{ value: '', label: 'All epics' }, ...epics.map((e) => ({ value: e._id, label: e.summary }))]} />
        {avgVelocity > 0 && <span className="chip">Avg velocity · {avgVelocity} pts</span>}
        <div className="ml-auto flex flex-wrap gap-2">{ab['sprint.manage'] && <button className="btn btn-sm" onClick={newSprint}><Plus size={14} /> Create sprint</button>}{ab['issue.create'] && <button className="btn btn-primary btn-sm" onClick={() => setCreate('backlog')}><Plus size={14} /> Create issue</button>}</div>
      </div>
      {loading || sl ? <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-64" /></div> : (
        <DndContext id={`backlog-${key}`} sensors={sensors} collisionDetection={closestCorners} onDragStart={(e) => { dragging.current = true; setActive(String(e.active.id)); }} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { dragging.current = false; setActive(null); setSecs(build()); }}>
          <div className="space-y-4">
            {planning.map((s) => {
              const st = stats(secs[s._id] || []); const isCol = collapsed[s._id];
              const keys = visibleKeys(secs[s._id]);
              return (
                <Section key={s._id} id={s._id} title={s.name} keys={keys} collapsed={!!isCol} sub={hasFilters ? noMatches : 'Plan your sprint by dragging issues from the backlog'}
                  header={<div className="flex flex-wrap items-center gap-3 py-3 pl-3 pr-4">
                    <button aria-label="Toggle section" className="flex w-[17px] shrink-0 justify-center" onClick={() => setCollapsed({ ...collapsed, [s._id]: !isCol })}><ChevronDown size={17} className={clsx('transition-transform', isCol && '-rotate-90')} /></button>
                    <SelectAll list={keys} />
                    <div className="min-w-0"><div className="flex items-center gap-2"><h3 className="font-semibold">{s.name}</h3>{s.state === 'active' && <span className="chip !text-success">Active</span>}<span className="text-xs text-muted">{keys.length} issues</span></div>
                      {(s.startDate || s.goal) && <p className="truncate text-xs text-muted">{s.startDate && `${new Date(s.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(s.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}{s.goal && ` · ${s.goal}`}</p>}</div>
                    <div className="ml-auto flex flex-wrap items-center gap-2"><span title="To do" className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-500/25 px-2 text-[11px] font-bold text-slate-300">{st.todo}</span><span title="In progress" className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--accent-soft)] px-2 text-[11px] font-bold text-accent">{st.prog}</span><span title="Done" className="flex h-6 min-w-6 items-center justify-center rounded-full bg-success/20 px-2 text-[11px] font-bold text-success">{st.done}</span>
                      {avgVelocity > 0 && s.state === 'future' && <span className={clsx('text-xs', st.total > avgVelocity ? 'font-semibold text-warning' : 'text-muted')}>{st.total}/{avgVelocity} pts</span>}
                      {ab['sprint.manage'] && s.state === 'future' && <><button className="btn btn-sm" onClick={() => suggest(s)} title="Fill to team velocity"><Wand2 size={13} /> Suggest</button><button className="btn btn-primary btn-sm" onClick={() => setStartFor(s)}><Play size={13} /> Start sprint</button><button aria-label="Delete sprint" className="btn btn-ghost btn-sm btn-icon" onClick={() => setDelFor(s)}><Trash2 size={14} /></button></>}</div>
                  </div>}>
                  {keys.map((k) => <Row key={k} issue={byKey.get(k)} epic={epicName(byKey.get(k))} disabled={!ab['issue.edit_any']} onOpen={setSel} checked={sel.includes(k)} onCheck={canBulk ? (sh) => toggle(k, sh, keys) : undefined} />)}
                </Section>
              );
            })}
            <Section id="backlog" title="Backlog" keys={backlogKeys} collapsed={!!collapsed.backlog} sub={hasFilters ? noMatches : 'Backlog is empty — create an issue to get started'}
              header={<div className="flex items-center gap-3 py-3 pl-3 pr-4"><button aria-label="Toggle section" className="flex w-[17px] shrink-0 justify-center" onClick={() => setCollapsed({ ...collapsed, backlog: !collapsed.backlog })}><ChevronDown size={17} className={clsx('transition-transform', collapsed.backlog && '-rotate-90')} /></button><SelectAll list={backlogKeys} /><h3 className="font-semibold">Backlog</h3><span className="text-xs text-muted">{backlogKeys.length} issues · {stats(backlogKeys).total} pts</span>{ab['issue.create'] && <button className="btn btn-sm ml-auto" onClick={() => setCreate('backlog')}><Plus size={13} /> Create issue</button>}</div>}>
              {backlogKeys.map((k) => <Row key={k} issue={byKey.get(k)} epic={epicName(byKey.get(k))} disabled={!ab['issue.edit_any']} onOpen={setSel} checked={sel.includes(k)} onCheck={canBulk ? (sh) => toggle(k, sh, backlogKeys) : undefined} />)}
            </Section>
          </div>
          <DragOverlay>{activeIssue ? <Row issue={activeIssue} disabled onOpen={() => {}} overlay /> : null}</DragOverlay>
        </DndContext>
      )}
      <AnimatePresence>
        {selected_.length > 0 && (
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.18 }}
            className="fixed bottom-5 left-1/2 z-40 flex max-w-[calc(100vw-32px)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-solid)] px-3 py-2 text-[13px] shadow-2xl">
            <span className="font-semibold">{selected_.length} selected</span>
            <span className="text-muted">· {stats(selected_).total} pts</span>
            <span className="mx-1 h-5 w-px bg-[var(--border)]" />
            <span className="text-muted">Move to</span>
            {planning.map((s) => <button key={s._id} className="btn btn-sm" disabled={moving} onClick={() => moveSelected(String(s._id))}>{s.name}{s.state === 'active' && <span className="text-success"> ●</span>}</button>)}
            <button className="btn btn-sm" disabled={moving} onClick={() => moveSelected('backlog')}>Backlog</button>
            {moving && <Spinner />}
            <button className="btn btn-ghost btn-sm" onClick={() => setSel_([])} title="Esc">Clear</button>
          </motion.div>
        )}
      </AnimatePresence>
      {!loading && all.length === 0 &&<Card className="mt-4"><EmptyState title="No issues yet" text="Create issues and drag them into sprints." /></Card>}
      <StartSprint sprint={startFor} onClose={() => setStartFor(null)} projectKey={key} count={startFor ? (secs[startFor._id] || []).length : 0} onDone={() => { reloadSprints(); mutate(); }} />
      <ConfirmDialog open={!!delFor} onClose={() => setDelFor(null)} danger title="Delete sprint?" confirmLabel="Delete" message="Issues in this sprint move back to the backlog." onConfirm={async () => { try { await api(`/api/sprints/${delFor._id}`, { method: 'PATCH', body: { action: 'delete' } }); setDelFor(null); reloadSprints(); mutate(); } catch (e) { toast.error(errMsg(e)); } }} />
      <IssueDrawer issueKey={selected} onClose={() => setSel(null)} />
      <CreateIssueModal open={!!create} onClose={() => setCreate(null)} projectKey={key} onCreated={() => mutate()} />
    </div>
  );
}

function StartSprint({ sprint, onClose, count, projectKey, onDone }: { sprint: any; onClose: () => void; count: number; projectKey: string; onDone: () => void }) {
  const [name, setName] = useState(''); const [goal, setGoal] = useState(''); const [weeks, setWeeks] = useState(2); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (sprint) { setName(sprint.name); setGoal(sprint.goal || ''); setErr(''); } }, [sprint]);
  async function go() {
    setBusy(true); setErr('');
    try { const start = new Date(); const end = new Date(+start + weeks * 7 * 864e5); await api(`/api/sprints/${sprint._id}`, { method: 'PATCH', body: { action: 'start', name, goal, startDate: start.toISOString(), endDate: end.toISOString() } }); invalidate('/api/'); toast.success(`${name} started 🚀`); onClose(); onDone(); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  void projectKey;
  return (
    <Modal open={!!sprint} onClose={onClose} title="Start sprint" width={500} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={go}>{busy && <Spinner />}Start</button></>}>
      <p className="mb-4 text-muted">{count} issues will be included in this sprint.</p>
      <div className="space-y-4">{err && <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">{err}</div>}
        <Field label="Sprint name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Sprint name" /></Field>
        <Field label="Duration"><div className="flex gap-2">{[1, 2, 3, 4].map((w) => <button key={w} onClick={() => setWeeks(w)} className={clsx('btn flex-1', weeks === w && '!border-[var(--accent)] !bg-[var(--accent-soft)]')}>{w} week{w > 1 && 's'}</button>)}</div></Field>
        <Field label="Sprint goal"><textarea className="input" rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="What do we want to achieve?" aria-label="Sprint goal" /></Field></div>
    </Modal>
  );
}
