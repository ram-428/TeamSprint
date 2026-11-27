'use client';
import { use, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, Plus, Trash2, Zap } from 'lucide-react';
import { api, errMsg, toast, useApi, ApiError } from '@/lib/api';
import { Card, EmptyState, Field, Modal, Select, Skeleton, Spinner, relTime } from '@/components/ui';
import { useProject } from '@/components/ProjectContext';

const TRIGGERS = [{ value: 'issue_created', label: 'Issue is created' }, { value: 'status_changed', label: 'Issue status changes' }];
const FIELDS = [{ value: '', label: 'Always (no condition)' }, { value: 'priority', label: 'Priority is…' }, { value: 'status', label: 'New status is…' }, { value: 'type', label: 'Type is…' }];
const ACTIONS = [{ value: 'assign_lead', label: 'Assign to project lead' }, { value: 'set_priority', label: 'Set priority to…' }, { value: 'add_label', label: 'Add label…' }, { value: 'notify_lead', label: 'Notify project lead' }];
const lab = (arr: { value: string; label: string }[], v: string) => arr.find((a) => a.value === v)?.label || v;

export default function AutomationPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params); const { project } = useProject(); const can = project.abilities['project.manage_automation'];
  const { data, mutate, reload, loading } = useApi<any[]>(`/api/projects/${key}/automation`);
  const [open, setOpen] = useState(false);
  const toggle = async (r: any) => { mutate((data || []).map((x) => (x._id === r._id ? { ...x, enabled: !x.enabled } : x))); try { await api(`/api/projects/${key}/automation`, { method: 'PATCH', body: { id: r._id, enabled: !r.enabled } }); } catch (e) { toast.error(errMsg(e)); reload(); } };
  const remove = async (r: any) => { try { await api(`/api/projects/${key}/automation?id=${r._id}`, { method: 'DELETE' }); reload(); toast.success('Rule deleted'); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="max-w-[900px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[18px] font-semibold">Automation rules</h2><p className="text-[13px] text-muted">No-code rules that react to what happens in this project.</p></div>{can && <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Create rule</button>}</div>
      {loading ? <Skeleton className="h-40" /> : !data?.length ? <Card><EmptyState title="No automation yet" text="Create a rule to auto-assign, label or notify." icon={<Zap size={28} />} /></Card> : (
        <div className="space-y-3"><AnimatePresence>{data.map((r) => (
          <motion.div key={r._id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
            <Card className="p-5"><div className="flex flex-wrap items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-accent"><Zap size={17} /></span><div className="min-w-0 flex-1"><h3 className="font-semibold">{r.name}</h3><p className="text-xs text-muted">Ran {r.runCount} times{r.lastRunAt && ` · last ${relTime(r.lastRunAt)}`}</p></div>
              <button role="switch" aria-checked={r.enabled} aria-label={`Toggle ${r.name}`} disabled={!can} onClick={() => toggle(r)} className={`relative h-6 w-11 rounded-full transition-colors ${r.enabled ? 'bg-success' : 'bg-[var(--border-strong)]'}`}><motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" style={{ left: r.enabled ? 22 : 2 }} /></button>
              {can && <button aria-label={`Delete ${r.name}`} className="btn btn-ghost btn-sm btn-icon" onClick={() => remove(r)}><Trash2 size={15} /></button>}</div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px]"><span className="chip !h-7 !px-3">When: {lab(TRIGGERS, r.trigger)}</span><ArrowDown size={14} className="-rotate-90 text-faint" /><span className="chip !h-7 !px-3">If: {r.conditionField ? `${r.conditionField} = ${r.conditionValue}` : 'always'}</span><ArrowDown size={14} className="-rotate-90 text-faint" /><span className="chip !h-7 !border-[var(--accent)] !px-3 !text-accent">Then: {lab(ACTIONS, r.actionType).replace('…', '')}{r.actionValue ? ` “${r.actionValue}”` : ''}</span></div></Card>
          </motion.div>))}</AnimatePresence></div>)}
      <RuleModal open={open} onClose={() => setOpen(false)} projectKey={key} statuses={project.statuses} onDone={() => { setOpen(false); reload(); }} />
    </div>
  );
}

function RuleModal({ open, onClose, projectKey, statuses, onDone }: { open: boolean; onClose: () => void; projectKey: string; statuses: any[]; onDone: () => void }) {
  const [f, setF] = useState({ name: '', trigger: 'issue_created', conditionField: '', conditionValue: '', actionType: 'assign_lead', actionValue: '' }); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  async function save() { setBusy(true); setErrs({}); try { await api(`/api/projects/${projectKey}/automation`, { body: { ...f, conditionField: f.conditionField || undefined, conditionValue: f.conditionField ? f.conditionValue : undefined, actionValue: ['set_priority', 'add_label'].includes(f.actionType) ? f.actionValue : undefined } }); toast.success('Rule created'); setF({ ...f, name: '' }); onDone(); } catch (e) { if (e instanceof ApiError && e.fields) setErrs(e.fields); else toast.error(errMsg(e)); } finally { setBusy(false); } }
  return (
    <Modal open={open} onClose={onClose} title="Create automation rule" footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={save}>{busy && <Spinner />}Create rule</button></>}>
      <div className="space-y-4"><Field label="Rule name" error={errs.name}><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Escalate highest-priority bugs" aria-label="Rule name" /></Field>
        <Field label="When"><Select aria-label="Trigger" value={f.trigger} onChange={(v) => setF({ ...f, trigger: v })} options={TRIGGERS} /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Condition"><Select aria-label="Condition" value={f.conditionField} onChange={(v) => setF({ ...f, conditionField: v, conditionValue: '' })} options={FIELDS} /></Field>
          {f.conditionField && <Field label="Value">{f.conditionField === 'status' ? <Select aria-label="Condition value" value={f.conditionValue} onChange={(v) => setF({ ...f, conditionValue: v })} options={[{ value: '', label: 'Select…' }, ...statuses.map((s) => ({ value: s.name, label: s.name }))]} /> : f.conditionField === 'priority' ? <Select aria-label="Condition value" value={f.conditionValue} onChange={(v) => setF({ ...f, conditionValue: v })} options={[{ value: '', label: 'Select…' }, ...['Highest', 'High', 'Medium', 'Low', 'Lowest'].map((p) => ({ value: p, label: p }))]} /> : <Select aria-label="Condition value" value={f.conditionValue} onChange={(v) => setF({ ...f, conditionValue: v })} options={[{ value: '', label: 'Select…' }, ...['epic', 'story', 'task', 'bug'].map((p) => ({ value: p, label: p }))]} />}</Field>}</div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Then"><Select aria-label="Action" value={f.actionType} onChange={(v) => setF({ ...f, actionType: v })} options={ACTIONS} /></Field>
          {f.actionType === 'set_priority' && <Field label="Priority"><Select aria-label="Action value" value={f.actionValue} onChange={(v) => setF({ ...f, actionValue: v })} options={[{ value: '', label: 'Select…' }, ...['Highest', 'High', 'Medium', 'Low', 'Lowest'].map((p) => ({ value: p, label: p }))]} /></Field>}
          {f.actionType === 'add_label' && <Field label="Label"><input placeholder="e.g. needs-review" className="input" value={f.actionValue} onChange={(e) => setF({ ...f, actionValue: e.target.value.replace(/\s/g, '-') })} aria-label="Label" /></Field>}</div></div>
    </Modal>
  );
}
