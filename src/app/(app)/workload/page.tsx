'use client';
import { motion } from 'framer-motion';
import { useApi } from '@/lib/api';
import { Avatar, Card, EmptyState, PageHeader, ProgressBar, Skeleton } from '@/components/ui';

const heat = (load: number) => (load > 100 ? '#f87171' : load > 75 ? '#fbbf24' : load > 40 ? '#34d399' : '#60a5fa');
export default function Workload() {
  const { data, loading } = useApi<any[]>('/api/workload');
  const weeks = ['This week', 'Next week', 'In 2 weeks', 'In 3 weeks'];
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Team workload" subtitle="Open assigned work compared with capacity (2-week horizon)" />
      {loading ? <Skeleton className="h-96" /> : !data?.length ? <Card><EmptyState title="No team members" /></Card> : (
        <Card className="overflow-hidden"><div className="grid grid-cols-[minmax(180px,1.2fr)_minmax(150px,1.4fr)_repeat(4,minmax(64px,.5fr))] gap-3 border-b border-[var(--border)] px-5 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-muted max-md:hidden"><span>Person</span><span>Load vs capacity</span>{weeks.map((w) => <span key={w} className="text-center">{w}</span>)}</div>
          {data.map((u, i) => (
            <motion.div key={u._id} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="grid grid-cols-[minmax(180px,1.2fr)_minmax(150px,1.4fr)_repeat(4,minmax(64px,.5fr))] items-center gap-3 border-b border-[var(--border)] px-5 py-3.5 last:border-0 max-md:grid-cols-1">
              <div className="flex items-center gap-3"><Avatar user={u} size={34} /><div className="min-w-0"><div className="truncate font-medium">{u.name}</div><div className="truncate text-xs text-muted">{u.title} · {u.openCount} open</div></div></div>
              <div><div className="mb-1 flex justify-between text-xs"><span className="text-muted">{u.hours}h of {u.capacity * 2}h</span><span className="font-semibold" style={{ color: heat(u.load) }}>{u.load}%{u.load > 100 && ' ⚠ overloaded'}</span></div><ProgressBar value={Math.min(100, u.load)} color={heat(u.load)} height={8} /></div>
              {u.weeks.map((w: any) => { const l = Math.round((w.hours / u.capacity) * 100); return <div key={w.week} className="flex h-9 items-center justify-center rounded-xl text-xs font-semibold max-md:hidden" style={{ background: w.hours ? `${heat(l)}${l > 100 ? '44' : '22'}` : 'var(--surface)', color: w.hours ? heat(l) : 'var(--text-faint)' }} title={`${w.hours}h due`}>{w.hours ? `${w.hours}h` : '–'}</div>; })}
            </motion.div>))}
        </Card>)}
      <p className="mt-3 text-xs text-faint">Estimates use time estimates when set, otherwise 2h per story point. Weekly capacity is configured per person.</p>
    </div>
  );
}
