'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { Modal, Field, Select, Spinner } from '../ui';
import { api, ApiError, errMsg, invalidate, toast, useApi } from '@/lib/api';
import { parseCapture } from '@/lib/capture';

const TYPES = ['story', 'task', 'bug', 'epic'];
const PRIOS = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

export function CreateIssueModal({ open, onClose, projectKey, defaults, onCreated }: { open: boolean; onClose: () => void; projectKey?: string; defaults?: Record<string, any>; onCreated?: (key: string) => void }) {
  const router = useRouter();
  const { data: projects } = useApi<any[]>(open && !projectKey ? '/api/projects' : null);
  const creatable = useMemo(() => (projects || []).filter((p) => p.abilities?.['issue.create']), [projects]);
  const [pk, setPk] = useState(projectKey || '');
  const [f, setF] = useState<any>({ type: 'task', summary: '', description: '', priority: 'Medium', assigneeId: '', points: '', dueDate: '', epicId: '', sprintId: '' });
  const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  const [another, setAnother] = useState(false);

  useEffect(() => { if (open) { setPk(projectKey || ''); setErrs({}); setF((x: any) => ({ ...x, summary: '', description: '', ...defaults })); }   // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectKey, JSON.stringify(defaults ?? {})]);
  useEffect(() => { if (!pk && creatable.length) setPk(creatable[0].key); }, [creatable, pk]);

  const { data: users } = useApi<any[]>(open && pk ? `/api/users?project=${pk}` : null);
  const { data: epics } = useApi<{ items: any[] }>(open && pk ? `/api/issues?project=${pk}&type=epic` : null);
  const { data: sprints } = useApi<any[]>(open && pk ? `/api/projects/${pk}/sprints` : null);
  const project = (projects || []).find((p) => p.key === pk);
  const isScrum = project ? project.type === 'scrum' : true;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErrs({});
    const cap = parseCapture(f.summary);
    let assigneeId = f.assigneeId || undefined;
    if (cap.assigneeQuery && !assigneeId) assigneeId = users?.find((u) => u.name.toLowerCase().includes(cap.assigneeQuery!.toLowerCase()) || u.email.startsWith(cap.assigneeQuery!.toLowerCase()))?._id;
    try {
      const r = await api<{ key: string }>('/api/issues', { body: {
        project: pk, type: cap.type || f.type, summary: cap.summary, description: f.description || undefined, priority: cap.priority || f.priority, assigneeId: assigneeId || null,
        labels: cap.labels, points: f.points !== '' ? Number(f.points) : cap.points ?? null, dueDate: f.dueDate || null, epicId: f.epicId || null, sprintId: f.sprintId || null,
      } });
      invalidate('/api/issues'); invalidate('/api/projects'); invalidate('/api/dashboard');
      toast.success(`${r.key} created`, { label: 'Open', run: () => router.push(`/issues/${r.key}`) });
      onCreated?.(r.key);
      if (another) setF((x: any) => ({ ...x, summary: '', description: '' })); else onClose();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrs(err.fields); else toast.error(errMsg(err));
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create issue" width={680}
      footer={<><label className="mr-auto flex cursor-pointer items-center gap-2 text-[13px] text-muted"><input type="checkbox" checked={another} onChange={(e) => setAnother(e.target.checked)} className="accent-[var(--accent)]" />Create another</label><button type="button" className="btn" onClick={onClose}>Cancel</button><button form="create-issue" className="btn btn-primary" disabled={busy || !pk}>{busy && <Spinner />}Create</button></>}>
      <form id="create-issue" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          {!projectKey && <Field label="Project"><Select value={pk} onChange={setPk} options={creatable.length ? creatable.map((p) => ({ value: p.key, label: `${p.name} (${p.key})` })) : [{ value: '', label: 'Loading…' }]} aria-label="Project" /></Field>}
          <Field label="Issue type"><Select value={f.type} onChange={(v) => setF({ ...f, type: v })} options={TYPES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))} aria-label="Issue type" /></Field>
        </div>
        <Field label="Summary" error={errs.summary} hint="Quick capture: !high  @sara  #label  ^5 (points)  /bug">
          <input className={`input ${errs.summary ? 'err' : ''}`} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} placeholder="What needs to be done?" autoFocus aria-label="Summary" />
        </Field>
        {/@|!|#|\^/.test(f.summary) && <div className="-mt-2 flex items-center gap-1.5 text-xs text-accent2"><Sparkles size={12} /> Quick capture will parse: {JSON.stringify(parseCapture(f.summary)).replace(/[{}"]/g, ' ').slice(0, 120)}</div>}
        <Field label="Description"><textarea className="input min-h-[110px]" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Add context, acceptance criteria, links… Markdown supported (**bold**, `code`, - [ ] checklist)" aria-label="Description" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Priority"><Select value={f.priority} onChange={(v) => setF({ ...f, priority: v })} options={PRIOS.map((p) => ({ value: p, label: p }))} aria-label="Priority" /></Field>
          <Field label="Assignee"><Select value={f.assigneeId} onChange={(v) => setF({ ...f, assigneeId: v })} options={[{ value: '', label: 'Unassigned' }, ...(users || []).map((u) => ({ value: u._id, label: u.name }))]} aria-label="Assignee" /></Field>
          <Field label="Story points" error={errs.points}><input type="number" min={0} className="input" value={f.points} onChange={(e) => setF({ ...f, points: e.target.value })} placeholder="e.g. 3" aria-label="Story points" /></Field>
          <Field label="Due date"><input type="date" className="input" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} aria-label="Due date" /></Field>
          {(epics?.items?.length ?? 0) > 0 && <Field label="Epic"><Select value={f.epicId} onChange={(v) => setF({ ...f, epicId: v })} options={[{ value: '', label: 'None' }, ...(epics?.items || []).map((e) => ({ value: e._id, label: `${e.key} · ${e.summary}` }))]} aria-label="Epic" /></Field>}
          {isScrum && (sprints?.filter((s) => s.state !== 'closed').length ?? 0) > 0 && <Field label="Sprint"><Select value={f.sprintId} onChange={(v) => setF({ ...f, sprintId: v })} options={[{ value: '', label: 'Backlog' }, ...(sprints || []).filter((s) => s.state !== 'closed').map((s) => ({ value: s._id, label: s.name }))]} aria-label="Sprint" /></Field>}
        </div>
      </form>
    </Modal>
  );
}
