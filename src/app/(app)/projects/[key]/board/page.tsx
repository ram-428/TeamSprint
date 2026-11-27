'use client';
import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { CheckCircle2, Flag, KanbanSquare, List, Plus, Search, Target, Users } from 'lucide-react';
import clsx from 'clsx';
import { useProject } from '@/components/ProjectContext';
import { Board } from '@/components/board/Board';
import { IssueDrawer } from '@/components/issue/IssueDrawer';
import { IssueTable } from '@/components/issue/IssueTable';
import { CreateIssueModal } from '@/components/issue/CreateIssueModal';
import { Avatar, Card, EmptyState, Modal, ProgressRing, Skeleton, Spinner, Select } from '@/components/ui';
import { api, errMsg, invalidate, toast, useApi } from '@/lib/api';
import { useMe } from '@/components/UserContext';

const PRIOS = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

export default function BoardPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params); const me = useMe(); const { project, assignees } = useProject();
  const router = useRouter(); const path = usePathname(); const sp = useSearchParams();
  const selected = sp.get('selected');
  const { data, mutate, loading } = useApi<{ items: any[] }>(`/api/issues?project=${key}`);
  const { data: sprints, reload: reloadSprints } = useApi<any[]>(project.type === 'scrum' ? `/api/projects/${key}/sprints` : null);
  const { data: users } = useApi<any[]>(`/api/users?project=${key}`);
  const { data: masters } = useApi<{ types: { key: string; name: string }[] }>('/api/masters');
  const [q, setQ] = useState(''); const [prio, setPrio] = useState(''); const [type, setType] = useState(''); const [mine, setMine] = useState(false); const [lanes, setLanes] = useState(false); const [view, setView] = useState<'board' | 'list'>('board');
  const [create, setCreate] = useState<{ open: boolean; status?: string }>({ open: false });
  const [complete, setComplete] = useState(false);
  const ab = project.abilities;
  const active = sprints?.find((s) => s.state === 'active');
  useEffect(() => { try { setLanes(localStorage.getItem(`orbit-lanes-${key}`) === '1'); setView(localStorage.getItem(`orbit-view-${key}`) === 'list' ? 'list' : 'board'); } catch { /* ignore */ } }, [key]);
  const pickView = (v: 'board' | 'list') => { setView(v); try { localStorage.setItem(`orbit-view-${key}`, v); } catch { /* ignore */ } };

  const all = useMemo(() => data?.items ?? [], [data]);
  const epics = useMemo(() => Object.fromEntries(all.filter((i) => i.type === 'epic').map((i) => [i._id, i.summary])), [all]);
  const visible = useMemo(() => {
    let l = all.filter((i) => i.type !== 'epic');
    if (project.type === 'scrum') l = active ? l.filter((i) => String(i.sprintId) === String(active._id)) : [];
    if (mine) l = l.filter((i) => i.assigneeId === me.id);
    if (assignees.length) l = l.filter((i) => assignees.includes(String(i.assigneeId)));
    if (prio) l = l.filter((i) => (i.priority || 'Medium') === prio);
    if (type) l = l.filter((i) => i.type === type);
    if (q) l = l.filter((i) => (i.summary + i.key).toLowerCase().includes(q.toLowerCase()));
    return l;
  }, [all, active, mine, assignees, prio, type, q, project.type, me.id]);
  const typeOptions = useMemo(() => [{ value: '', label: 'All types' }, ...(masters?.types || []).filter((t) => t.key !== 'epic').map((t) => ({ value: t.key, label: t.name }))], [masters]);
  const filtered = assignees.length > 0 || !!q || mine || !!prio || !!type;

  const setSel = (k: string | null) => { const p = new URLSearchParams(sp.toString()); k ? p.set('selected', k) : p.delete('selected'); router.replace(`${path}?${p}`, { scroll: false }); };
  const onChanged = (fn: (l: any[]) => any[]) => mutate({ items: fn(all) });
  const swimlanes = useMemo(() => {
    if (!lanes) return [{ id: 'all', label: '', issues: visible }];
    const map = new Map<string, any[]>();
    for (const i of visible) { const k = i.assignee?._id || 'none'; map.set(k, [...(map.get(k) || []), i]); }
    return [...map.entries()].map(([id, issues]) => ({ id, label: id === 'none' ? 'Unassigned' : issues[0].assignee.name, user: issues[0].assignee, issues }));
  }, [visible, lanes]);

  const total = visible.reduce((a, i) => a + (i.points || 0), 0), done = visible.filter((i) => i.statusCategory === 'done').reduce((a, i) => a + (i.points || 0), 0);
  const daysLeft = active ? Math.max(0, Math.ceil((+new Date(active.endDate) - Date.now()) / 864e5)) : 0;

  return (
    <div>
      {project.type === 'scrum' && (
        <Card className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          {!sprints ? <Skeleton className="h-9 w-full" /> : active ? (<>
            <ProgressRing value={total ? (done / total) * 100 : 0} size={36} stroke={4} label={<span className="text-[9.5px]">{Math.round(total ? (done / total) * 100 : 0)}%</span>} />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5"><h2 className="text-[15px] font-semibold">{active.name}</h2><span className="chip !text-success"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-success text-success" />Active</span>
              <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] text-muted"><Target size={13} className="shrink-0" /><span className="truncate">{active.goal || 'No sprint goal set'}</span></span></div>
            <div className="flex items-center gap-4 text-[13px] text-muted"><span><b className="text-[15px] font-semibold tabular-nums text-[var(--text)]">{daysLeft}</b> days left</span><span><b className="text-[15px] font-semibold tabular-nums text-[var(--text)]">{done}</b>/{total} pts</span></div>
            {ab['sprint.manage'] && <button className="btn btn-sm" onClick={() => setComplete(true)}><CheckCircle2 size={14} /> Complete sprint</button>}
          </>) : <div className="flex flex-1 flex-wrap items-center justify-between gap-4"><div><h2 className="text-[17px] font-semibold">No active sprint</h2><p className="text-[13px] text-muted">Plan a sprint in the backlog to see its board here.</p></div><Link href={`/projects/${key}/backlog`} className="btn btn-primary">Go to backlog</Link></div>}
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-auto"><Search size={15} className="absolute left-3 top-[11px] text-faint" /><input aria-label="Filter board" className="input !h-9 !w-full !pl-9 sm:!w-48" placeholder="Filter issues" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select aria-label="Priority filter" className="!w-full sm:!w-36" value={prio} onChange={setPrio} options={[{ value: '', label: 'All priorities' }, ...PRIOS.map((p) => ({ value: p, label: p }))]} />
        <Select aria-label="Type filter" className="!w-full sm:!w-32" value={type} onChange={setType} options={typeOptions} />
        <button aria-pressed={mine} onClick={() => setMine(!mine)} className={clsx('btn btn-sm', mine && '!border-[var(--accent)] !bg-[var(--accent-soft)]')}><Avatar user={me} size={18} /> Only my issues</button>
        {view === 'board' && <button aria-pressed={lanes} onClick={() => { setLanes(!lanes); try { localStorage.setItem(`orbit-lanes-${key}`, lanes ? '0' : '1'); } catch { /* ignore */ } }} className={clsx('btn btn-sm', lanes && '!border-[var(--accent)] !bg-[var(--accent-soft)]')}><Users size={14} /> Swimlanes by assignee</button>}
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border)]" role="group" aria-label="View">
          {([['board', 'Board', KanbanSquare], ['list', 'List', List]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => pickView(id)} className={clsx('flex h-8 items-center gap-1.5 px-3 text-[13px] font-medium', view === id ? 'bg-[var(--accent-soft)] text-accent' : 'text-muted hover:bg-[var(--surface-2)]')}><Icon size={14} />{label}</button>
          ))}
        </div>
        <span className="ml-auto flex items-center gap-3 text-[12.5px] text-muted"><span className="flex items-center gap-1"><Flag size={12} className="text-warning" />{visible.filter((i) => i.flagged).length} flagged</span><span>{visible.length} issues</span></span>
        {ab['issue.create'] && <button className="btn btn-primary btn-sm" onClick={() => setCreate({ open: true })}><Plus size={15} /> Create issue</button>}
      </div>

      {loading ? <div className="flex gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[420px] w-[min(300px,calc(100vw-4rem))] shrink-0" />)}</div>
        : visible.length === 0 && view === 'board' && filtered && (project.type !== 'scrum' || active) ? <Card><EmptyState title="No issues match the current filters" /></Card>
        : visible.length === 0 && (project.type !== 'scrum' || active) && !filtered ? <Card><EmptyState title="Nothing on the board yet" text="Create your first issue to get things moving." action={ab['issue.create'] && <button className="btn btn-primary" onClick={() => setCreate({ open: true })}><Plus size={15} />Create issue</button>} /></Card>
        : project.type === 'scrum' && !active ? null
        : view === 'list' ? (
          <Card className="overflow-hidden">{visible.length === 0 ? <EmptyState title="No matching issues" text="Adjust the filters or create a new issue." /> : <IssueTable items={visible} onOpen={setSel} statuses={project.statuses} users={users} canBulk={ab['issue.edit_any']} onChanged={() => mutate()} />}</Card>
        ) : (
          <div className="space-y-6">
            {swimlanes.map((l: any) => (
              <div key={l.id}>
                {lanes && <div className="mb-2 flex items-center gap-2.5 text-[13px] font-semibold"><Avatar user={l.user} size={24} />{l.label}<span className="chip">{l.issues.length}</span></div>}
                <Board dragId={`board-${key}-${l.id}`} project={project} issues={l.issues} epics={epics} canMove={ab['issue.transition']} onOpen={setSel} onChanged={onChanged} onCreate={ab['issue.create'] ? (s) => setCreate({ open: true, status: s }) : undefined} />
              </div>
            ))}
          </div>
        )}

      <IssueDrawer issueKey={selected} onClose={() => setSel(null)} />
      <CreateIssueModal open={create.open} onClose={() => setCreate({ open: false })} projectKey={key} defaults={{ sprintId: active?._id || '' }} onCreated={() => mutate()} />
      {active && <CompleteSprint open={complete} onClose={() => setComplete(false)} sprint={active} sprints={sprints || []} issues={all.filter((i) => String(i.sprintId) === String(active._id))} projectKey={key} onDone={() => { reloadSprints(); mutate(); }} />}
    </div>
  );
}

function CompleteSprint({ open, onClose, sprint, sprints, issues, projectKey, onDone }: { open: boolean; onClose: () => void; sprint: any; sprints: any[]; issues: any[]; projectKey: string; onDone: () => void }) {
  const [moveTo, setMoveTo] = useState('backlog'); const [busy, setBusy] = useState(false);
  const done = issues.filter((i) => i.statusCategory === 'done'); const open_ = issues.filter((i) => i.statusCategory !== 'done');
  const future = sprints.filter((s) => s.state === 'future');
  async function go() {
    setBusy(true);
    try { await api(`/api/sprints/${sprint._id}`, { method: 'PATCH', body: { action: 'complete', moveTo } }); invalidate('/api/'); toast.success(`${sprint.name} completed`); onClose(); onDone(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  void projectKey;
  return (
    <Modal open={open} onClose={onClose} title={`Complete ${sprint.name}`} width={500} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={go}>{busy && <Spinner />}Complete sprint</button></>}>
      <div className="mb-5 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-center"><div className="text-[28px] font-semibold text-success">{done.length}</div><div className="text-xs text-muted">completed issues</div></div><div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-center"><div className="text-[28px] font-semibold text-warning">{open_.length}</div><div className="text-xs text-muted">open issues</div></div></div>
      {open_.length > 0 ? (<><label className="label">Move open issues to</label><Select aria-label="Move open issues to" value={moveTo} onChange={setMoveTo} options={[{ value: 'backlog', label: 'Backlog' }, ...future.map((s) => ({ value: s._id, label: s.name }))]} /></>) : <p className="text-muted">Everything is done. Nice work! 🎉</p>}
    </Modal>
  );
}
