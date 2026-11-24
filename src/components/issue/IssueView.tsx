'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreHorizontal, Eye, EyeOff, ThumbsUp, Flag, Trash2, Link2, Clock, X, ChevronRight, Send, GitBranch, Zap, Plus, Check, Lock } from 'lucide-react';
import clsx from 'clsx';
import { api, errMsg, invalidate, toast, useApi } from '@/lib/api';
import { Avatar, ConfirmDialog, Dropdown, MenuItem, PriorityIcon, ProgressBar, Select, Skeleton, Spinner, StatusChip, Tabs, TypeIcon, fmtDuration, relTime, ErrorState } from '../ui';
import { mdToHtml } from '@/lib/md';
import { useMe } from '../UserContext';
import { AttachmentGallery, AttachmentPicker } from '../Attachments';

const PRIOS = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
const TYPES = ['epic', 'story', 'task', 'bug', 'subtask'];

export function IssueView({ issueKey, onClose, embedded }: { issueKey: string; onClose?: () => void; embedded?: boolean }) {
  const me = useMe(); const router = useRouter();
  const { data, error, loading, reload } = useApi<any>(`/api/issues/${issueKey}`);
  const pk = data?.project?.key;
  const { data: users } = useApi<any[]>(pk ? `/api/users?project=${pk}` : null);
  const { data: sprints } = useApi<any[]>(pk && data?.project?.type === 'scrum' ? `/api/projects/${pk}/sprints` : null);
  const { data: epics } = useApi<{ items: any[] }>(pk ? `/api/issues?project=${pk}&type=epic` : null);
  const [tab, setTab] = useState<'comments' | 'history' | 'work'>('comments');
  const [confirmDel, setConfirmDel] = useState(false);

  async function patch(body: Record<string, any>, ok?: string) {
    try { await api(`/api/issues/${issueKey}`, { method: 'PATCH', body: { ...body, ...('status' in body || 'watch' in body || 'vote' in body ? {} : {}) } }); await reload(); invalidate('/api/issues'); invalidate('/api/dashboard'); invalidate('/api/projects'); if (ok) toast.success(ok); }
    catch (e) { toast.error(errMsg(e)); await reload(); }
  }

  if (error) return <div className="p-8"><ErrorState message={error.status === 404 ? 'Issue not found, or you do not have access.' : error.message} onRetry={reload} /></div>;
  if (loading || !data) return <div className="space-y-4 p-8"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-12 w-2/3" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;
  const { issue, project, abilities: ab } = data;
  const canEdit = ab.edit; const canTransition = ab.transition;
  const doneLike = (id: string) => project.statuses.find((s: any) => s.id === id)?.category === 'done';

  // Field controls, shared by the full-page sidebar and the compact grid used in the modal.
  const statusPicker = canTransition ? (
    <Dropdown align="left" trigger={({ toggle }) => <button onClick={toggle} className="flex items-center gap-2" aria-label="Change status"><StatusChip project={project} status={issue.status} /><span className="text-xs text-faint">▾</span></button>}>
      {(close) => <div className="w-52">{project.statuses.map((s: any) => <MenuItem key={s.id} active={s.id === issue.status} onClick={() => { close(); if (s.id !== issue.status) patch({ status: s.id }, doneLike(s.id) ? `${issue.key} marked done 🎉` : `Moved to ${s.name}`); }}><StatusChip project={project} status={s.id} small />{s.id === issue.status && <Check size={14} className="ml-auto" />}</MenuItem>)}</div>}
    </Dropdown>
  ) : <StatusChip project={project} status={issue.status} />;
  const assigneeField = <>
    {canEdit && ab['issue.assign'] ? <Select aria-label="Assignee" className="!h-9" value={issue.assigneeId || ''} onChange={(v) => patch({ assigneeId: v || null })} options={[{ value: '', label: 'Unassigned' }, ...(users || []).map((u) => ({ value: u._id, label: u.name }))]} /> : <div className="flex items-center gap-2"><Avatar user={issue.assignee} size={24} />{issue.assignee?.name || 'Unassigned'}</div>}
    {canEdit && issue.assigneeId !== me.id && <button className="mt-1 text-xs font-semibold text-accent2 hover:underline" onClick={() => patch({ assigneeId: me.id }, 'Assigned to you')}>Assign to me</button>}
  </>;
  const reporterField = <div className="flex h-9 items-center gap-2"><Avatar user={issue.reporter} size={24} /><span className="truncate">{issue.reporter?.name || '—'}</span></div>;
  const priorityField = canEdit ? <Select aria-label="Priority" className="!h-9" value={issue.priority} onChange={(v) => patch({ priority: v })} options={PRIOS.map((p) => ({ value: p, label: p }))} /> : <PriorityIcon priority={issue.priority} withLabel />;
  const typeField = canEdit && issue.type !== 'subtask' ? <Select aria-label="Type" className="!h-9" value={issue.type} onChange={(v) => patch({ type: v })} options={TYPES.filter((t) => t !== 'subtask').map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))} /> : <span className="capitalize">{issue.type}</span>;
  const sprintField = data.project.type === 'scrum' ? (canEdit ? <Select aria-label="Sprint" className="!h-9" value={issue.sprintId || ''} onChange={(v) => patch({ sprintId: v || null })} options={[{ value: '', label: 'Backlog' }, ...(sprints || []).filter((s) => s.state !== 'closed' || s._id === issue.sprintId).map((s) => ({ value: s._id, label: s.name }))]} /> : <span>{data.sprint?.name || 'Backlog'}</span>) : null;
  const epicField = issue.type !== 'epic' && (epics?.items?.length ?? 0) > 0 ? (canEdit ? <Select aria-label="Epic" className="!h-9" value={issue.epicId || ''} onChange={(v) => patch({ epicId: v || null })} options={[{ value: '', label: 'None' }, ...(epics?.items || []).map((e) => ({ value: e._id, label: `${e.key} · ${e.summary}`.slice(0, 40) }))]} /> : <span>{data.epic?.key || 'None'}</span>) : null;
  const dueField = <>
    {canEdit ? <input aria-label="Due date" type="date" className="input !h-9" value={issue.dueDate ? issue.dueDate.slice(0, 10) : ''} onChange={(e) => patch({ dueDate: e.target.value || null })} /> : <span>{issue.dueDate ? new Date(issue.dueDate).toLocaleDateString() : '—'}</span>}
    {issue.dueDate && new Date(issue.dueDate) < new Date() && issue.statusCategory !== 'done' && <div className="mt-1 text-xs font-semibold text-danger">Overdue</div>}
  </>;
  const timeTracking = <>
    <div className="label flex items-center gap-1.5"><Clock size={12} /> Time tracking</div>
    <div className="mb-2 flex justify-between text-[13px]"><span>{fmtDuration(issue.timeSpent)} logged</span><span className="text-muted">{issue.estimate ? `of ${fmtDuration(issue.estimate)}` : 'no estimate'}</span></div>
    <ProgressBar value={issue.estimate ? (issue.timeSpent / issue.estimate) * 100 : 0} color={issue.estimate && issue.timeSpent > issue.estimate ? 'var(--danger)' : undefined} />
    {canEdit && <EstimateEditor value={issue.estimate} onSave={(sec) => patch({ estimate: sec })} />}
  </>;
  const activity = (
    <section>
      <Tabs id="issue-tabs" value={tab} onChange={setTab} tabs={[{ id: 'comments', label: 'Comments', count: data.comments.length }, { id: 'history', label: 'History', count: data.activity.length }, { id: 'work', label: 'Work log', count: data.worklogs.length }]} />
      <div className="mt-4">
        {tab === 'comments' && <Comments data={data} issueKey={issueKey} reload={reload} users={users || []} />}
        {tab === 'history' && <History data={data} />}
        {tab === 'work' && <Worklogs data={data} issueKey={issueKey} reload={reload} />}
      </div>
    </section>
  );

  return (
    <div className={clsx('flex flex-col', embedded ? 'min-h-full' : '')}>
      {/* header */}
      <div className={clsx('flex items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4', embedded && 'sticky top-0 z-10 bg-[var(--surface-solid)]')}>
        <div className="flex min-w-0 items-center gap-2 text-[13px] text-muted">
          <Link href={`/projects/${project.key}/board`} className="hover:text-text">{project.name}</Link><ChevronRight size={13} />
          {data.epic && <><Link href={`/issues/${data.epic.key}`} className="max-w-[160px] truncate hover:text-text">{data.epic.key}</Link><ChevronRight size={13} /></>}
          <TypeIcon type={issue.type} size={18} /><span className="key font-semibold text-text">{issue.key}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Dropdown trigger={({ toggle }) => <button onClick={toggle} className="btn btn-sm btn-ghost" aria-label="Actions"><MoreHorizontal size={17} /></button>}>
            {(close) => (
              <div className="w-52">
                <MenuItem icon={data.watching ? <EyeOff size={15} /> : <Eye size={15} />} onClick={() => { close(); patch({ watch: !data.watching }, data.watching ? 'Stopped watching' : 'Watching this issue'); }}>{data.watching ? 'Stop watching' : 'Watch'} ({data.watcherCount})</MenuItem>
                <MenuItem icon={<ThumbsUp size={15} />} onClick={() => { close(); patch({ vote: !(issue.votes || []).includes(me.id) }); }}>{(issue.votes || []).includes(me.id) ? 'Remove vote' : 'Vote'} ({(issue.votes || []).length})</MenuItem>
                {canEdit && <MenuItem icon={<Flag size={15} />} onClick={() => { close(); patch({ flagged: !issue.flagged }, issue.flagged ? 'Flag removed' : 'Flagged as impediment'); }}>{issue.flagged ? 'Remove flag' : 'Flag impediment'}</MenuItem>}
                <MenuItem icon={<Link2 size={15} />} onClick={() => { close(); navigator.clipboard?.writeText(`${location.origin}/issues/${issue.key}`); toast.success('Link copied'); }}>Copy link</MenuItem>
                {ab.delete && <MenuItem danger icon={<Trash2 size={15} />} onClick={() => { close(); setConfirmDel(true); }}>Delete</MenuItem>}
              </div>
            )}
          </Dropdown>
          {onClose && <button className="btn btn-sm btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={17} /></button>}
        </div>
      </div>

      <div className={clsx(embedded ? 'flex flex-col gap-4 px-6 py-5' : 'grid gap-8 p-6 lg:grid-cols-[1fr_300px]')}>
        {/* main column */}
        <div className={clsx(embedded ? 'contents' : 'min-w-0 space-y-7')}>
          {embedded ? (
            <div className="order-1 space-y-1.5">
              <InlineText value={issue.summary} disabled={!canEdit} onSave={(v) => patch({ summary: v })} className="text-[22px] font-semibold leading-tight" label="Title" />
              {issue.flagged && <div className="flagged-card flex items-center gap-2 rounded-xl border border-warning/40 px-3 py-2 text-[13px] text-warning"><Flag size={14} /> Flagged as an impediment</div>}
              <Description compact value={issue.description || ''} disabled={!canEdit} onSave={(v) => patch({ description: v })} />
              <Attachments issueKey={issueKey} items={issue.attachments || []} canEdit={canEdit} reload={reload} />
            </div>
          ) : (
            <>
              <InlineText value={issue.summary} disabled={!canEdit} onSave={(v) => patch({ summary: v })} className="text-[24px] font-semibold leading-snug" label="Title" />
              {issue.flagged && <div className="flagged-card flex items-center gap-2 rounded-xl border border-warning/40 px-3 py-2 text-[13px] text-warning"><Flag size={14} /> Flagged as an impediment</div>}
              <Description value={issue.description || ''} disabled={!canEdit} onSave={(v) => patch({ description: v })} />
              <Attachments issueKey={issueKey} items={issue.attachments || []} canEdit={canEdit} reload={reload} />
            </>
          )}

          {(data.children.length > 0 || canEdit) && issue.type !== 'subtask' && (
            <section className={embedded ? 'order-3' : undefined}>
              <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{issue.type === 'epic' ? 'Child issues' : 'Sub-tasks'}</h3>
                {data.children.length > 0 && <span className="text-xs text-muted">{data.children.filter((c: any) => c.statusCategory === 'done').length}/{data.children.length} done</span>}</div>
              {data.children.length > 0 && <div className="mb-3"><ProgressBar value={(data.children.filter((c: any) => c.statusCategory === 'done').length / data.children.length) * 100} /></div>}
              <div className="space-y-1.5">
                {data.children.map((c: any) => (
                  <Link key={c._id} href={`/issues/${c.key}`} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]">
                    <TypeIcon type={c.type} size={16} /><span className="key">{c.key}</span><span className={clsx('flex-1 truncate', c.statusCategory === 'done' && 'text-muted line-through')}>{c.summary}</span>
                    <StatusChip project={project} status={c.status} small /><Avatar user={c.assignee} size={22} />
                  </Link>
                ))}
              </div>
              {canEdit && <AddSubtask parent={issue} project={project} />}
            </section>
          )}

          {issue.links?.length > 0 && (
            <section className={embedded ? 'order-4' : undefined}><h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-muted">Linked issues</h3>
              <div className="space-y-1.5">{issue.links.map((l: any, i: number) => <Link key={i} href={`/issues/${l.targetKey}`} className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface-2)]"><GitBranch size={14} className="text-muted" /><span className="text-xs text-muted">{l.type}</span><span className="key font-semibold text-accent2">{l.targetKey}</span></Link>)}</div></section>
          )}

          {!embedded && activity}
        </div>

        {/* sidebar */}
        {embedded ? (
          <aside className="order-2 glass rounded-2xl p-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
              <Prop label="Status" grid>{statusPicker}{issue.resolution && <div className="mt-1 text-xs text-muted">Resolution: {issue.resolution}</div>}</Prop>
              <Prop label="Assignee" grid>{assigneeField}</Prop>
              <Prop label="Reporter" grid>{reporterField}</Prop>
              <Prop label="Priority" grid>{priorityField}</Prop>
              <Prop label="Type" grid>{typeField}</Prop>
              <Prop label="Story points" grid><InlineNumber value={issue.points} disabled={!canEdit} onSave={(v) => patch({ points: v })} /></Prop>
              {sprintField && <Prop label="Sprint" grid>{sprintField}</Prop>}
              {epicField && <Prop label="Epic" grid>{epicField}</Prop>}
              <Prop label="Due date" grid>{dueField}</Prop>
              {project.versions?.length > 0 && <Prop label="Fix version" grid><span>{issue.fixVersion || '—'}</span></Prop>}
              {issue.slaDue && issue.statusCategory !== 'done' && <Prop label="SLA" grid><Sla due={issue.slaDue} /></Prop>}
              <Prop label="Labels" grid><Labels value={issue.labels || []} disabled={!canEdit} onSave={(v) => patch({ labels: v })} /></Prop>
              <div className="col-span-2 md:col-span-3">{timeTracking}</div>
            </div>
            <p className="mt-3 text-xs text-faint">Created {relTime(issue.createdAt)} · Updated {relTime(issue.updatedAt)}</p>
          </aside>
        ) : (
        <aside className="space-y-4">
          <div className="glass rounded-2xl p-4">
            <div className="mb-4">
              <div className="label">Status</div>
              {statusPicker}
              {issue.resolution && <div className="mt-1.5 text-xs text-muted">Resolution: {issue.resolution}</div>}
            </div>
            <Prop label="Assignee">{assigneeField}</Prop>
            <Prop label="Reporter">{reporterField}</Prop>
            <Prop label="Priority">{priorityField}</Prop>
            <Prop label="Type">{typeField}</Prop>
          </div>
          <div className="glass rounded-2xl p-4">
            <Prop label="Story points"><InlineNumber value={issue.points} disabled={!canEdit} onSave={(v) => patch({ points: v })} /></Prop>
            {sprintField && <Prop label="Sprint">{sprintField}</Prop>}
            {epicField && <Prop label="Epic">{epicField}</Prop>}
            <Prop label="Due date">{dueField}</Prop>
            <Prop label="Labels"><Labels value={issue.labels || []} disabled={!canEdit} onSave={(v) => patch({ labels: v })} /></Prop>
            {project.versions?.length > 0 && <Prop label="Fix version"><span>{issue.fixVersion || '—'}</span></Prop>}
            {issue.slaDue && issue.statusCategory !== 'done' && <Prop label="SLA"><Sla due={issue.slaDue} /></Prop>}
          </div>
          <div className="glass rounded-2xl p-4">{timeTracking}</div>
          <p className="px-1 text-xs text-faint">Created {relTime(issue.createdAt)} · Updated {relTime(issue.updatedAt)}</p>
        </aside>
        )}
        {embedded && <div className="order-5">{activity}</div>}
      </div>
      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} danger title={`Delete ${issue.key}?`} confirmLabel="Delete issue" message="This also removes its sub-tasks. This can be undone only by an administrator." onConfirm={async () => { try { await api(`/api/issues/${issueKey}`, { method: 'DELETE' }); invalidate('/api/issues'); invalidate('/api/projects'); toast.success(`${issue.key} deleted`); setConfirmDel(false); if (onClose) onClose(); else router.push(`/projects/${project.key}/board`); } catch (e) { toast.error(errMsg(e)); } }} />
    </div>
  );
}

function Prop({ label, children, grid }: { label: string; children: React.ReactNode; grid?: boolean }) {
  return <div className={clsx('min-w-0', !grid && 'mb-3.5 last:mb-0')}><div className={clsx('label', grid ? '!mb-1' : '!mb-1.5')}>{label}</div><div className="text-[13.5px]">{children}</div></div>;
}

function Sla({ due }: { due: string }) {
  const ms = +new Date(due) - Date.now(); const breached = ms < 0; const risk = ms < 2 * 36e5;
  const h = Math.floor(Math.abs(ms) / 36e5), m = Math.floor((Math.abs(ms) % 36e5) / 6e4);
  const c = breached ? 'var(--danger)' : risk ? 'var(--warning)' : 'var(--success)';
  return <span className="inline-flex items-center gap-2 font-semibold" style={{ color: c }}><span className={clsx('h-2 w-2 rounded-full', (breached || risk) && 'pulse-dot')} style={{ background: c, color: c }} />{breached ? `Breached ${h}h ${m}m ago` : `${h}h ${m}m left`}</span>;
}

function InlineText({ value, onSave, disabled, className, label }: { value: string; onSave: (v: string) => void; disabled?: boolean; className?: string; label: string }) {
  const [edit, setEdit] = useState(false); const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  if (edit) return <input aria-label={label} autoFocus className={clsx('input !h-auto !py-1.5', className)} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { setEdit(false); if (v.trim() && v !== value) onSave(v.trim()); else setV(value); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setV(value); setEdit(false); } }} />;
  return <h2 onClick={() => !disabled && setEdit(true)} className={clsx(className, !disabled && 'cursor-text rounded-lg px-2 py-1 -mx-2 hover:bg-[var(--surface)]')} tabIndex={disabled ? undefined : 0} onKeyDown={(e) => e.key === 'Enter' && !disabled && setEdit(true)}>{value}</h2>;
}
function InlineNumber({ value, onSave, disabled }: { value?: number; onSave: (v: number | null) => void; disabled?: boolean }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => setV(value ?? ''), [value]);
  if (disabled) return <span>{value ?? '—'}</span>;
  return <input aria-label="Story points" type="number" min={0} className="input !h-9" value={v} placeholder="—" onChange={(e) => setV(e.target.value as any)} onBlur={() => { const n = v === '' ? null : Number(v); if (n !== (value ?? null)) onSave(n); }} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />;
}
function EstimateEditor({ value, onSave }: { value?: number; onSave: (s: number) => void }) {
  const [v, setV] = useState(''); const [edit, setEdit] = useState(false);
  if (!edit) return <button className="mt-3 text-xs font-semibold text-accent2 hover:underline" onClick={() => setEdit(true)}>{value ? 'Change estimate' : 'Set estimate'}</button>;
  return <input autoFocus aria-label="Estimate" className="input !h-9 mt-3" placeholder="e.g. 1d 4h" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { setEdit(false); const m = [...v.matchAll(/(\d+(?:\.\d+)?)\s*([wdhm])/gi)]; const s = m.reduce((a, x) => a + Number(x[1]) * ({ w: 144000, d: 28800, h: 3600, m: 60 } as any)[x[2].toLowerCase()], 0); if (s > 0) onSave(Math.round(s)); }} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />;
}

function Description({ value, onSave, disabled, compact }: { value: string; onSave: (v: string) => void; disabled?: boolean; compact?: boolean }) {
  const [edit, setEdit] = useState(false); const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const html = useMemo(() => mdToHtml(value), [value]);
  return (
    <section>
      <h3 className={clsx(compact ? 'mb-0.5' : 'mb-2', 'text-[13px] font-semibold uppercase tracking-wider text-muted')}>Description</h3>
      {edit ? (
        <div><textarea autoFocus aria-label="Description" className={clsx('input', compact ? 'min-h-[120px]' : 'min-h-[170px]')} value={v} onChange={(e) => setV(e.target.value)} />
          <div className="mt-2 flex gap-2"><button className="btn btn-primary btn-sm" onClick={() => { setEdit(false); if (v !== value) onSave(v); }}>Save</button><button className="btn btn-sm" onClick={() => { setV(value); setEdit(false); }}>Cancel</button></div></div>
      ) : value ? (
        <div className={clsx('prose-orbit text-[14.5px] text-[var(--text)]', compact ? 'rounded-lg leading-snug [&_p]:mb-1 [&_p:last-child]:mb-0' : 'rounded-xl leading-relaxed', !disabled && 'cursor-text -mx-2 px-2 hover:bg-[var(--surface)]', compact ? 'py-0.5' : 'py-1')} onClick={(e) => { if ((e.target as HTMLElement).closest('a')) return; !disabled && setEdit(true); }} dangerouslySetInnerHTML={{ __html: html }} />
      ) : <button disabled={disabled} className="w-full rounded-xl border border-dashed border-[var(--border-strong)] px-4 py-6 text-left text-muted hover:bg-[var(--surface)]" onClick={() => setEdit(true)}>{disabled ? 'No description' : 'Add a description…'}</button>}
    </section>
  );
}

function Attachments({ issueKey, items, canEdit, reload }: { issueKey: string; items: any[]; canEdit: boolean; reload: () => void }) {
  const [adding, setAdding] = useState(false); const [del, setDel] = useState<any>(null);
  async function attach(files: any[]) {
    try {
      await api(`/api/issues/${issueKey}/attachments`, { body: { attachments: files.map(({ name, url, publicId, resourceType, format, bytes, width, height }) => ({ name, url, publicId, resourceType, format, bytes, width, height })) } });
      await reload(); invalidate('/api/issues'); toast.success(files.length === 1 ? 'File attached' : `${files.length} files attached`);
    } catch (e) { toast.error(errMsg(e)); }
  }
  async function remove(a: any) { try { await api(`/api/issues/${issueKey}/attachments?id=${a.id}`, { method: 'DELETE' }); await reload(); toast.success('Attachment removed'); } catch (e) { toast.error(errMsg(e)); } }
  if (!items.length && !canEdit) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2"><h3 className="text-[13px] font-semibold uppercase tracking-wider text-muted">Attachments{items.length > 0 && <span className="ml-1.5 normal-case text-faint">({items.length})</span>}</h3>
        {canEdit && <button type="button" className="btn btn-sm ml-auto" onClick={() => setAdding((v) => !v)}>{adding ? 'Close' : <><Plus size={13} /> Add</>}</button>}</div>
      {adding && canEdit && <div className="mb-3"><AttachmentPicker compact files={[]} max={Math.max(0, 20 - items.length)} onUploaded={attach} /></div>}
      {items.length > 0 ? <AttachmentGallery items={items} canDelete={canEdit} onDelete={setDel} /> : !adding && <p className="rounded-xl border border-dashed border-[var(--border-strong)] px-4 py-4 text-[13px] text-muted">No attachments yet. Add photos, videos or documents.</p>}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title="Remove attachment" confirmLabel="Remove" message={<>Remove <b>{del?.name}</b> from this issue? The file is deleted.</>} onConfirm={async () => { await remove(del); setDel(null); }} />
    </div>
  );
}

function Labels({ value, onSave, disabled }: { value: string[]; onSave: (v: string[]) => void; disabled?: boolean }) {
  const [v, setV] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((l) => <span key={l} className="chip">{l}{!disabled && <button aria-label={`Remove ${l}`} onClick={() => onSave(value.filter((x) => x !== l))} className="text-faint hover:text-danger"><X size={11} /></button>}</span>)}
      {!disabled && <input aria-label="Add label" className="h-6 w-20 rounded-md bg-transparent px-1 text-xs outline-none placeholder:text-faint" placeholder="+ label" value={v} onChange={(e) => setV(e.target.value.replace(/\s/g, '-'))} onKeyDown={(e) => { if (e.key === 'Enter' && v.trim()) { if (!value.includes(v)) onSave([...value, v.trim()]); setV(''); } }} />}
      {disabled && value.length === 0 && <span className="text-muted">—</span>}
    </div>
  );
}

function AddSubtask({ parent, project }: { parent: any; project: any }) {
  const [open, setOpen] = useState(false); const [s, setS] = useState(''); const [busy, setBusy] = useState(false);
  const router = useRouter(); void router;
  async function add() {
    if (s.trim().length < 3) return; setBusy(true);
    try {
      await api('/api/issues', { body: { project: project.key, type: parent.type === 'epic' ? 'story' : 'subtask', summary: s.trim(), ...(parent.type === 'epic' ? { epicId: parent._id } : { parentId: parent._id, sprintId: parent.sprintId || null }) } });
      setS(''); invalidate('/api/issues'); toast.success('Added');
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  if (!open) return <button className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-accent2 hover:underline" onClick={() => setOpen(true)}><Plus size={14} />Add {parent.type === 'epic' ? 'child issue' : 'sub-task'}</button>;
  return <div className="mt-2 flex gap-2"><input autoFocus aria-label="New sub-task summary" className="input !h-9" placeholder="What needs to be done?" value={s} onChange={(e) => setS(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setOpen(false); }} /><button className="btn btn-primary btn-sm" disabled={busy} onClick={add}>{busy ? <Spinner size={13} /> : 'Add'}</button></div>;
}

function Comments({ data, issueKey, reload, users }: { data: any; issueKey: string; reload: () => void; users: any[] }) {
  const me = useMe(); const [body, setBody] = useState(''); const [busy, setBusy] = useState(false); const [mention, setMention] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const canAdd = data.abilities['comment.add'];
  const matches = mention !== null ? users.filter((u) => u.name.toLowerCase().includes(mention.toLowerCase())).slice(0, 5) : [];
  const onChange = (v: string) => { setBody(v); const m = /@([A-Za-z]*)$/.exec(v); setMention(m ? m[1] : null); };
  async function post() {
    if (!body.trim()) return; setBusy(true);
    try { await api(`/api/issues/${issueKey}/comments`, { body: { body } }); setBody(''); await reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      {canAdd ? (
        <div className="flex gap-3"><Avatar user={me} size={32} />
          <div className="relative min-w-0 flex-1">
            <textarea ref={ta} aria-label="Add a comment" className="input min-h-[74px]" placeholder="Add a comment… use @ to mention a teammate" value={body} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') post(); }} />
            <AnimatePresence>{matches.length > 0 && <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass-solid absolute z-20 mt-1 w-60 rounded-xl p-1">{matches.map((u) => <button key={u._id} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--surface-2)]" onClick={() => { onChange(body.replace(/@[A-Za-z]*$/, `@${u.name} `)); ta.current?.focus(); }}><Avatar user={u} size={22} />{u.name}</button>)}</motion.div>}</AnimatePresence>
            <div className="mt-2 flex items-center justify-between"><span className="text-xs text-faint">Ctrl + Enter to send</span><button className="btn btn-primary btn-sm" disabled={busy || !body.trim()} onClick={post}>{busy ? <Spinner size={13} /> : <><Send size={13} /> Comment</>}</button></div>
          </div>
        </div>
      ) : <p className="flex items-center gap-2 text-muted"><Lock size={13} /> You have read-only access to this project.</p>}
      <AnimatePresence initial={false}>
        {data.comments.length === 0 && <p className="py-6 text-center text-muted">No comments yet. Start the conversation.</p>}
        {[...data.comments].reverse().map((c: any) => (
          <motion.div key={c._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="group flex gap-3">
            <Avatar user={c.author} size={32} />
            <div className="min-w-0 flex-1"><div className="flex items-baseline gap-2"><span className="font-semibold">{c.author?.name || 'Former member'}</span><span className="text-xs text-faint">{relTime(c.createdAt)}</span>
              {c.canDelete && <button className="ml-auto text-xs text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100" onClick={async () => { try { await api(`/api/issues/${issueKey}/comments?id=${c._id}`, { method: 'DELETE' }); reload(); } catch (e) { toast.error(errMsg(e)); } }}>Delete</button>}</div>
              <div className="prose-orbit mt-1 text-[14px]" dangerouslySetInnerHTML={{ __html: mdToHtml(c.body) }} /></div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function fmtVal(v: any) { if (v === null || v === undefined || v === '') return '—'; if (Array.isArray(v)) return v.join(', ') || '—'; if (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v)) return new Date(v).toLocaleDateString(); return String(v); }
function History({ data }: { data: any }) {
  const nameOf = (field: string, v: any) => (field === 'status' ? data.project.statuses.find((s: any) => s.id === v)?.name || v : fmtVal(v));
  if (!data.activity.length) return <p className="py-6 text-center text-muted">No history yet.</p>;
  return (
    <div className="relative space-y-4 pl-6 before:absolute before:bottom-1 before:left-[11px] before:top-1 before:w-px before:bg-[var(--border)]">
      {data.activity.map((a: any) => (
        <div key={a._id} className="relative">
          <span className="absolute -left-6 top-1"><Avatar user={a.actor} size={22} /></span>
          <div className="text-[13.5px]"><b>{a.actor?.name || 'System'}</b> <span className="text-muted">{a.action === 'created' ? 'created this issue' : a.action === 'commented' ? 'added a comment' : a.action === 'worklog' ? 'logged work' : a.action === 'attached' ? <>attached {(a.diff?.files || []).join(', ')}</> : a.action === 'detached' ? <>removed attachment <i>{a.diff?.file}</i></> : a.action === 'automation' ? <>ran automation <i>{a.diff?.rule}</i></> : 'updated'}</span> <span className="text-xs text-faint">· {relTime(a.createdAt)}</span></div>
          {a.action === 'updated' && a.diff && Object.entries(a.diff).map(([f, d]: any) => <div key={f} className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px]"><span className="chip">{f.replace('Id', '')}</span><span className="text-muted line-through">{nameOf(f, d.from)}</span><span className="text-faint">→</span><span className="font-medium">{nameOf(f, d.to)}</span></div>)}
        </div>
      ))}
    </div>
  );
}

function Worklogs({ data, issueKey, reload }: { data: any; issueKey: string; reload: () => void }) {
  const [t, setT] = useState(''); const [d, setD] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const total = data.worklogs.reduce((a: number, w: any) => a + w.seconds, 0);
  async function log() {
    setBusy(true); setErr('');
    try { await api(`/api/issues/${issueKey}/worklogs`, { body: { time: t, description: d } }); setT(''); setD(''); await reload(); toast.success('Work logged'); invalidate('/api/dashboard'); }
    catch (e: any) { setErr(e.fields?.time || errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      {data.abilities['worklog.add'] && (
        <div className="glass rounded-2xl p-4"><div className="grid gap-3 sm:grid-cols-[140px_1fr_auto]">
          <div><input aria-label="Time spent" className={clsx('input', err && 'err')} placeholder="2h 30m" value={t} onChange={(e) => setT(e.target.value)} />{err && <p className="field-err">{err}</p>}</div>
          <input aria-label="Work description" className="input" placeholder="What did you work on?" value={d} onChange={(e) => setD(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || !t} onClick={log}>{busy ? <Spinner size={14} /> : 'Log work'}</button></div></div>
      )}
      <div className="text-[13px] text-muted">Total logged: <b className="text-text">{fmtDuration(total)}</b></div>
      {data.worklogs.map((w: any) => <div key={w._id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2"><Avatar user={w.user} size={26} /><div className="min-w-0 flex-1"><div className="truncate text-[13.5px]">{w.description || 'Work logged'}</div><div className="text-xs text-faint">{w.user?.name} · {new Date(w.startedAt).toLocaleDateString()}</div></div><span className="font-semibold tabular-nums">{fmtDuration(w.seconds)}</span></div>)}
      {!data.worklogs.length && <p className="py-4 text-center text-muted">No work logged yet.</p>}
    </div>
  );
}
void Zap;
