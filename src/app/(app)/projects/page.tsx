'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Search, Star, Rocket, Smartphone, LifeBuoy, Megaphone, Server, Globe, LayoutGrid, List, Lock, ArrowRight, Check } from 'lucide-react';
import clsx from 'clsx';
import { api, errMsg, invalidate, toast, useApi, ApiError } from '@/lib/api';
import { Avatar, Card, EmptyState, Field, Modal, Select, PageHeader, ProgressBar, Skeleton, Spinner, Pagination, usePaged } from '@/components/ui';
import { useMe } from '@/components/UserContext';

const ICONS: Record<string, any> = { rocket: Rocket, smartphone: Smartphone, 'life-buoy': LifeBuoy, megaphone: Megaphone, server: Server, globe: Globe };
const TYPE_LABEL: Record<string, string> = { scrum: 'Scrum', kanban: 'Kanban', business: 'Business', service_desk: 'Service desk' };

export default function ProjectsPage() {
  const me = useMe(); const { data, loading, mutate } = useApi<any[]>('/api/projects');
  const [q, setQ] = useState(''); const [view, setView] = useState<'grid' | 'table'>('grid'); const [create, setCreate] = useState(false);
  const list = useMemo(() => (data || []).filter((p) => (p.name + p.key).toLowerCase().includes(q.toLowerCase())).sort((a, b) => Number(b.starred) - Number(a.starred)), [data, q]);

  const pg = usePaged(list, 12);

  async function star(p: any, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    mutate((data || []).map((x) => (x._id === p._id ? { ...x, starred: !x.starred } : x)));
    try { await api(`/api/projects/${p.key}`, { method: 'PATCH', body: { starred: !p.starred } }); invalidate('/api/dashboard'); } catch (err) { toast.error(errMsg(err)); mutate(); }
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader title="Projects" subtitle={`${data?.length ?? '…'} projects you can access`} actions={<>
        <div className="relative"><Search size={15} className="absolute left-3 top-[11px] text-faint" /><input aria-label="Search projects" className="input !h-9 !w-56 !pl-9" placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="glass flex rounded-xl p-0.5">{(['grid', 'table'] as const).map((v) => <button key={v} aria-label={`${v} view`} onClick={() => setView(v)} className={clsx('rounded-[10px] p-1.5', view === v ? 'bg-[var(--surface-2)] text-text' : 'text-muted')}>{v === 'grid' ? <LayoutGrid size={16} /> : <List size={16} />}</button>)}</div>
        {me.role !== 'guest' && <button className="btn btn-primary" onClick={() => setCreate(true)}><Plus size={16} /> New project</button>}
      </>} />
      {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-44" />)}</div>
        : list.length === 0 ? <Card><EmptyState title={q ? 'No projects match' : 'No projects yet'} text={q ? 'Try a different search.' : 'Create your first project to start planning work.'} action={!q && me.role !== 'guest' && <button className="btn btn-primary" onClick={() => setCreate(true)}><Plus size={16} />New project</button>} /></Card>
        : view === 'grid' ? (
          <><motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pg.rows.map((p) => {
              const I = ICONS[p.icon] || Rocket; const pct = p.total ? (p.done / p.total) * 100 : 0;
              return (
                <motion.div key={p._id} variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
                  <Link href={`/projects/${p.key}/${p.type === 'scrum' ? 'board' : 'board'}`}>
                    <Card spotlight className="group h-full p-5">
                      <div className="flex items-start justify-between"><span className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}88)`, boxShadow: `0 10px 24px -10px ${p.color}` }}><I size={22} /></span>
                        <button aria-label={p.starred ? 'Unstar' : 'Star'} onClick={(e) => star(p, e)} className="rounded-lg p-1.5 text-faint transition-colors hover:text-warning"><Star size={17} className={p.starred ? 'fill-[var(--warning)] text-warning' : ''} /></button></div>
                      <div className="mt-4 flex items-center gap-2"><h3 className="text-[17px] font-semibold">{p.name}</h3>{p.visibility === 'private' && <Lock size={12} className="text-faint" />}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted"><span className="key font-semibold">{p.key}</span><span>·</span><span>{TYPE_LABEL[p.type]}</span></div>
                      <p className="mt-2 line-clamp-2 min-h-[40px] text-[13px] text-muted">{p.description}</p>
                      <div className="mt-4"><div className="mb-1.5 flex justify-between text-xs text-muted"><span>{p.done}/{p.total} done</span><span>{Math.round(pct)}%</span></div><ProgressBar value={pct} color={p.color} /></div>
                      <div className="mt-4 flex items-center justify-between"><div className="flex items-center gap-2 text-xs text-muted"><Avatar user={p.lead} size={22} />{p.lead?.name}</div>
                        {p.activeSprint ? <span className="chip !text-accent2"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent2 text-accent2" />{p.activeSprint.name.replace(/^.*Sprint /, 'Sprint ')}</span> : <ArrowRight size={15} className="text-faint transition-transform group-hover:translate-x-1" />}</div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
          <Card className="mt-4"><Pagination {...pg.bar} /></Card></>
        ) : (
          <Card className="overflow-hidden"><table className="w-full text-left text-[13.5px]"><thead className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-muted"><tr><th className="p-4">Name</th><th>Key</th><th>Type</th><th>Lead</th><th>Progress</th><th /></tr></thead>
            <tbody>{pg.rows.map((p) => <tr key={p._id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"><td className="p-4"><Link href={`/projects/${p.key}/board`} className="flex items-center gap-2.5 font-semibold"><span className="h-3 w-3 rounded" style={{ background: p.color }} />{p.name}</Link></td><td className="key">{p.key}</td><td>{TYPE_LABEL[p.type]}</td><td><div className="flex items-center gap-2"><Avatar user={p.lead} size={22} />{p.lead?.name}</div></td><td className="w-48"><ProgressBar value={p.total ? (p.done / p.total) * 100 : 0} color={p.color} /></td><td><button onClick={(e) => star(p, e)} aria-label="Star"><Star size={15} className={p.starred ? 'fill-[var(--warning)] text-warning' : 'text-faint'} /></button></td></tr>)}</tbody></table><Pagination {...pg.bar} /></Card>
        )}
      <CreateProject open={create} onClose={() => setCreate(false)} />
    </div>
  );
}

const TEMPLATES = [
  { id: 'scrum', name: 'Scrum', desc: 'Sprints, backlog, burndown & velocity', icon: Rocket, flow: ['To Do', 'In Progress', 'In Review', 'QA', 'Done'] },
  { id: 'kanban', name: 'Kanban', desc: 'Continuous flow with WIP limits', icon: LayoutGrid, flow: ['To Do', 'In Progress', 'Done'] },
  { id: 'business', name: 'Business', desc: 'Simple task tracking for any team', icon: Megaphone, flow: ['Backlog', 'Doing', 'Review', 'Done'] },
  { id: 'service_desk', name: 'Service desk', desc: 'Support tickets with SLA timers', icon: LifeBuoy, flow: ['Waiting for support', 'In progress', 'Waiting for customer', 'Resolved'] },
];
const COLORS = ['#7c5cff', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#60a5fa'];

function CreateProject({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter(); const [step, setStep] = useState(0);
  const [f, setF] = useState({ type: 'scrum', name: '', key: '', description: '', color: COLORS[0], visibility: 'org', memberIds: [] as string[] });
  const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [keyTouched, setKeyTouched] = useState(false);
  const { data: users } = useApi<any[]>(open ? '/api/users' : null);
  const me = useMe();
  const suggest = (n: string) => n.replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 4) || n.slice(0, 3).toUpperCase();

  async function submit() {
    setBusy(true); setErrs({});
    try { const r = await api<{ key: string }>('/api/projects', { body: f }); invalidate('/api/projects'); toast.success(`Project ${r.key} created`); onClose(); setStep(0); router.push(`/projects/${r.key}/board`); }
    catch (e) { if (e instanceof ApiError && e.fields) { setErrs(e.fields); setStep(1); } else toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={() => { onClose(); setStep(0); }} title={`New project · step ${step + 1} of 3`} width={700}
      footer={<>{step > 0 && <button className="btn mr-auto" onClick={() => setStep(step - 1)}>Back</button>}<button className="btn" onClick={onClose}>Cancel</button>
        {step < 2 ? <button className="btn btn-primary" disabled={step === 1 && (!f.name || !f.key)} onClick={() => setStep(step + 1)}>Continue</button> : <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy && <Spinner />}Create project</button>}</>}>
      <div className="mb-5 flex gap-1.5">{[0, 1, 2].map((i) => <motion.span key={i} className="h-1 flex-1 rounded-full" animate={{ background: i <= step ? 'var(--accent)' : 'var(--border)' }} />)}</div>
      <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
        {step === 0 && <div className="grid gap-3 sm:grid-cols-2">{TEMPLATES.map((t) => (
          <button key={t.id} onClick={() => setF({ ...f, type: t.id })} className={clsx('relative rounded-2xl border p-4 text-left transition-all', f.type === t.id ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--glow)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]')}>
            {f.type === t.id && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white"><Check size={12} /></span>}
            <t.icon size={22} className="mb-2 text-accent2" /><div className="font-semibold">{t.name}</div><div className="mb-3 text-xs text-muted">{t.desc}</div>
            <div className="flex flex-wrap gap-1">{t.flow.map((s) => <span key={s} className="chip !h-5 !text-[10px]">{s}</span>)}</div>
          </button>))}</div>}
        {step === 1 && <div className="space-y-4">
          <Field label="Project name" error={errs.name}><input autoFocus className={clsx('input', errs.name && 'err')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, key: keyTouched ? f.key : suggest(e.target.value) })} placeholder="e.g. Customer Portal" aria-label="Project name" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Key" error={errs.key} hint="Prefix for issue keys, e.g. PORT-12"><input className={clsx('input key', errs.key && 'err')} value={f.key} onChange={(e) => { setKeyTouched(true); setF({ ...f, key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }); }} maxLength={10} aria-label="Project key" /></Field>
            <Field label="Visibility"><Select aria-label="Visibility" value={f.visibility} onChange={(v) => setF({ ...f, visibility: v })} options={[{ value: 'org', label: 'Everyone in the organization' }, { value: 'private', label: 'Private — members only' }]} /></Field>
          </div>
          <Field label="Description"><textarea className="input" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} aria-label="Description" /></Field>
          <div><label className="label">Colour</label><div className="flex gap-2">{COLORS.map((c) => <button key={c} aria-label={`Colour ${c}`} onClick={() => setF({ ...f, color: c })} className="h-8 w-8 rounded-full transition-transform hover:scale-110" style={{ background: c, boxShadow: f.color === c ? `0 0 0 2px var(--bg), 0 0 0 4px ${c}` : undefined }} />)}</div></div>
        </div>}
        {step === 2 && <div><p className="mb-3 text-muted">Add teammates. You'll be the Project Admin. Everyone added gets Developer access (guests become Reporters).</p>
          <div className="grid max-h-[300px] gap-1.5 overflow-y-auto sm:grid-cols-2">{(users || []).filter((u) => u._id !== me.id).map((u) => { const on = f.memberIds.includes(u._id); return (
            <button key={u._id} onClick={() => setF({ ...f, memberIds: on ? f.memberIds.filter((x) => x !== u._id) : [...f.memberIds, u._id] })} className={clsx('flex items-center gap-2.5 rounded-xl border p-2.5 text-left', on ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] hover:bg-[var(--surface-2)]')}><Avatar user={u} size={30} /><span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium">{u.name}</span><span className="block truncate text-xs text-faint">{u.title}</span></span>{on && <Check size={15} className="text-accent" />}</button>); })}</div></div>}
      </motion.div>
    </Modal>
  );
}
