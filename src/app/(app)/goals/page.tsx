'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Target, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { api, errMsg, toast, useApi, ApiError } from '@/lib/api';
import { Avatar, Card, EmptyState, Field, Modal, PageHeader, ProgressBar, ProgressRing, Skeleton, Spinner, Select } from '@/components/ui';
import { useMe } from '@/components/UserContext';

const ST: Record<string, [string, string]> = { on_track: ['On track', '#34d399'], at_risk: ['At risk', '#fbbf24'], off_track: ['Off track', '#f87171'] };

export default function Goals() {
  const me = useMe(); const { data, reload, loading } = useApi<any[]>('/api/goals'); const [open, setOpen] = useState(false);
  async function update(id: string, body: any) { try { await api('/api/goals', { method: 'PATCH', body: { id, ...body } }); reload(); } catch (e) { toast.error(errMsg(e)); } }
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Goals & OKRs" subtitle="Align the team on what matters this quarter" actions={<button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> New goal</button>} />
      {loading ? <div className="grid gap-5 md:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div> : !data?.length ? <Card><EmptyState title="No goals yet" text="Create an objective with measurable key results." icon={<Target size={28} />} /></Card> : (
        <div className="grid gap-5 lg:grid-cols-2">{data.map((g, i) => {
          const editable = g.ownerId === me.id || me.role === 'org_admin'; const [stLabel, stColor] = ST[g.status];
          return (
            <motion.div key={g._id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <Card spotlight className="p-6"><div className="flex items-start gap-4"><ProgressRing value={g.progress} size={74} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="chip">{g.period}</span>
                {editable ? <select aria-label="Status" value={g.status} onChange={(e) => update(g._id, { status: e.target.value })} className="chip cursor-pointer !pr-2 outline-none" style={{ color: stColor, borderColor: `${stColor}55`, background: `${stColor}1a` }}>{Object.entries(ST).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select> : <span className="chip" style={{ color: stColor }}>{stLabel}</span>}</div>
                <h3 className="mt-2 text-[17px] font-semibold leading-snug">{g.title}</h3><div className="mt-1 flex items-center gap-2 text-xs text-muted"><Avatar user={g.owner} size={18} />{g.owner?.name}</div></div></div>
                <div className="mt-5 space-y-4">{g.keyResults.map((k: any, idx: number) => { const pct = Math.min(100, (k.current / k.target) * 100); return (
                  <div key={idx}><div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]"><span className="truncate">{k.title}</span>
                    {editable ? <span className="flex shrink-0 items-center gap-1"><input placeholder="0" aria-label={`Current value for ${k.title}`} type="number" className="h-7 w-16 rounded-lg border border-[var(--border)] bg-transparent px-2 text-right text-[12.5px] outline-none focus:border-[var(--accent)]" defaultValue={k.current} onBlur={(e) => Number(e.target.value) !== k.current && update(g._id, { krIndex: idx, current: Number(e.target.value) })} /><span className="text-xs text-muted">/ {k.target}{k.unit}</span></span> : <span className="text-xs text-muted">{k.current} / {k.target}{k.unit}</span>}</div>
                    <ProgressBar value={pct} color={pct >= 100 ? 'var(--success)' : undefined} /></div>); })}</div></Card>
            </motion.div>); })}</div>)}
      <NewGoal open={open} onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload(); }} />
    </div>
  );
}

function NewGoal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(''); const [period, setPeriod] = useState('Q4'); const [krs, setKrs] = useState([{ title: '', target: '', unit: '' }]); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  async function save() {
    setBusy(true); setErrs({});
    try { await api('/api/goals', { body: { title, period, keyResults: krs.filter((k) => k.title).map((k) => ({ title: k.title, target: Number(k.target), current: 0, unit: k.unit })) } }); toast.success('Goal created'); setTitle(''); setKrs([{ title: '', target: '', unit: '' }]); onDone(); }
    catch (e) { if (e instanceof ApiError && e.fields) setErrs(e.fields); else toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="New goal" width={600} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={save}>{busy && <Spinner />}Create goal</button></>}>
      <div className="space-y-4"><Field label="Objective" error={errs.title}><input autoFocus className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Delight new customers in their first week" aria-label="Objective" /></Field>
        <Field label="Period"><Select aria-label="Period" value={period} onChange={setPeriod} options={['Q1', 'Q2', 'Q3', 'Q4'].map((q) => ({ value: q, label: q }))} /></Field>
        <div><label className="label">Key results {errs.keyResults && <span className="text-danger">— {errs.keyResults}</span>}</label><div className="space-y-2">{krs.map((k, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_72px_60px_32px] gap-2 sm:grid-cols-[1fr_90px_70px_32px]"><input aria-label={`Key result ${i + 1}`} className="input !h-9" placeholder="Measurable outcome" value={k.title} onChange={(e) => setKrs(krs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} /><input aria-label="Target" type="number" className="input !h-9" placeholder="Target" value={k.target} onChange={(e) => setKrs(krs.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))} /><input aria-label="Unit" className="input !h-9" placeholder="Unit" value={k.unit} onChange={(e) => setKrs(krs.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} />
            <button aria-label="Remove key result" className={clsx('btn btn-ghost btn-icon btn-sm', krs.length === 1 && 'invisible')} onClick={() => setKrs(krs.filter((_, j) => j !== i))}><Trash2 size={14} /></button></div>))}</div>
          <button className="btn btn-sm mt-2" onClick={() => setKrs([...krs, { title: '', target: '', unit: '' }])}><Plus size={13} /> Add key result</button></div></div>
    </Modal>
  );
}
