'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Flame, Plus, Star, Timer } from 'lucide-react';
import { useMe } from '@/components/UserContext';
import { useApi } from '@/lib/api';
import { statusName, Avatar, Card, CountUp, EmptyState, fmtDuration, ListSkeleton, PriorityIcon, ProgressRing, relTime, Skeleton, TypeIcon } from '@/components/ui';
import { FocusTimer } from '@/components/FocusTimer';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } } };

export default function Dashboard() {
  const me = useMe();
  const { data, loading, error, reload } = useApi<any>('/api/dashboard');
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const hour = now?.getHours() ?? 12;
  const greet = !now ? 'Welcome' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  if (error) return <EmptyState title="Could not load your dashboard" text={error.message} action={<button className="btn" onClick={reload}>Retry</button>} />;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="mx-auto max-w-[1280px]">
      <motion.div variants={item} className="mb-7">
        <p className="text-[13px] font-medium text-accent2">{now ? now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : ' '}</p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight sm:text-[34px]">{greet}, <span className="grad-text">{me.name.split(' ')[0]}</span></h1>
        <p className="mt-1 text-muted">{loading || !data ? 'Loading your day…' : data.stats.open === 0 ? 'Nothing assigned to you — enjoy the calm.' : `You have ${data.stats.open} open issue${data.stats.open === 1 ? '' : 's'}${data.stats.overdue ? `, ${data.stats.overdue} overdue` : ''}${data.stats.due ? ` and ${data.stats.due} due this week` : ''}.`}</p>
      </motion.div>

      <motion.div variants={item} className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[{ l: 'Open issues', v: data?.stats.open, i: Flame, c: '#7c5cff' }, { l: 'Due this week', v: data?.stats.due, i: CalendarClock, c: '#22d3ee' }, { l: 'Overdue', v: data?.stats.overdue, i: AlertTriangle, c: '#f87171' }, { l: 'Hours this week', v: data ? Math.round((data.stats.weekSeconds / 3600) * 10) / 10 : undefined, i: Clock, c: '#34d399', d: 1 }].map((s) => (
          <Card key={s.l} spotlight className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2"><span className="text-[13px] text-muted">{s.l}</span><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${s.c}22`, color: s.c }}><s.i size={18} /></span></div>
            <div className="mt-3 text-[28px] font-semibold leading-none sm:text-[36px]">{s.v === undefined ? <Skeleton className="h-9 w-16" /> : <CountUp value={s.v} decimals={s.d || 0} />}</div>
          </Card>
        ))}
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <motion.div variants={item}>
            <Card className="p-2">
              <div className="flex items-center justify-between px-4 pb-2 pt-3"><h2 className="text-[16px] font-semibold">Assigned to me</h2><Link href="/search?oql=assignee%20%3D%20currentUser()%20AND%20statusCategory%20!%3D%20done" className="text-[13px] font-semibold text-accent2 hover:underline">View all</Link></div>
              {loading || !data ? <div className="p-3"><ListSkeleton rows={5} /></div> : data.mine.length === 0 ? <EmptyState title="All clear" text="No open issues are assigned to you." icon={<CheckCircle2 size={28} />} /> : (
                <div className="p-1">
                  {data.mine.slice(0, 10).map((i: any, idx: number) => (
                    <motion.div key={i._id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + idx * 0.04 }}>
                      <Link href={`/issues/${i.key}`} className="group flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-colors hover:bg-[var(--surface-2)]">
                        <TypeIcon type={i.type} /><span className="key w-[64px] shrink-0 sm:w-[74px]">{i.key}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{i.summary}</span>
                        {i.dueDate && <span className={`hidden text-xs sm:inline ${new Date(i.dueDate) < new Date() ? 'font-semibold text-danger' : 'text-muted'}`}>{new Date(i.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                        <PriorityIcon priority={i.priority} />
                        <span className="hidden w-[88px] text-right text-[11px] font-semibold uppercase tracking-wide text-muted sm:block">{statusName(i.status)}</span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          <motion.div variants={item} className="grid gap-6 md:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-4 text-[16px] font-semibold">Active sprints</h2>
              {loading || !data ? <Skeleton className="h-24" /> : data.sprints.length === 0 ? <p className="text-muted">No active sprints.</p> : data.sprints.map((s: any) => (
                <Link key={s._id} href={`/projects/${s.project?.key}/board`} className="mb-3 flex items-center gap-4 rounded-2xl p-2 transition-colors last:mb-0 hover:bg-[var(--surface-2)]">
                  <ProgressRing value={s.total ? (s.done / s.total) * 100 : 0} size={62} />
                  <div className="min-w-0"><div className="truncate font-semibold">{s.name}</div><div className="text-[12.5px] text-muted">{s.project?.name}</div><div className="mt-0.5 text-xs text-faint">{s.done}/{s.total} pts · {s.daysLeft}d left</div></div>
                </Link>
              ))}
            </Card>
            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-[16px] font-semibold"><Star size={15} className="text-warning" /> Starred projects</h2>
              {loading || !data ? <Skeleton className="h-24" /> : data.starred.length === 0 ? <p className="text-muted">Star a project to pin it here.</p> : <div className="space-y-1.5">{data.starred.map((p: any) => <Link key={p._id} href={`/projects/${p.key}/board`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-[var(--surface-2)]"><span className="flex h-9 w-9 items-center justify-center rounded-xl text-[12px] font-bold text-white" style={{ background: p.color }}>{p.key.slice(0, 2)}</span><span className="font-medium">{p.name}</span></Link>)}</div>}
            </Card>
          </motion.div>
        </div>

        <div className="space-y-6">
          <motion.div variants={item}><FocusTimer issues={data?.mine || []} /></motion.div>
          <motion.div variants={item}>
            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-[16px] font-semibold"><Timer size={15} className="text-accent2" /> Recent activity</h2>
              {loading || !data ? <ListSkeleton rows={4} /> : data.activity.length === 0 ? <p className="text-muted">Nothing yet.</p> : (
                <div className="space-y-3.5">
                  {data.activity.slice(0, 9).map((a: any) => (
                    <div key={a._id} className="flex gap-3"><Avatar user={a.actor} size={28} />
                      <div className="min-w-0 text-[13px] leading-snug"><b>{a.actor?.name || 'Someone'}</b> <span className="text-muted">{a.action === 'created' ? 'created' : a.action === 'commented' ? 'commented on' : a.action === 'worklog' ? 'logged work on' : 'updated'}</span> {a.issue && <Link href={`/issues/${a.issue.key}`} className="font-semibold text-accent2 hover:underline">{a.issue.key}</Link>}<div className="truncate text-xs text-faint">{a.issue?.summary}</div><div className="text-[11px] text-faint">{relTime(a.createdAt)}</div></div></div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card className="p-5"><h2 className="mb-3 text-[16px] font-semibold">Recently touched</h2>
              {data?.recent.map((i: any) => <Link key={i._id} href={`/issues/${i.key}`} className="flex items-center gap-2.5 rounded-xl p-2 hover:bg-[var(--surface-2)]"><TypeIcon type={i.type} size={16} /><span className="key">{i.key}</span><span className="truncate text-[13px]">{i.summary}</span></Link>)}
              {!data && <Skeleton className="h-20" />}</Card>
          </motion.div>
        </div>
      </div>
      {me.role !== 'guest' && <div className="mt-6 text-center text-xs text-faint">Tip: press <kbd>C</kbd> to create an issue or <kbd>Ctrl</kbd> <kbd>K</kbd> to search anything. <Plus size={11} className="inline" /></div>}
    </motion.div>
  );
}
