'use client';
import { use } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { useApi } from '@/lib/api';
import { Card, CountUp, EmptyState, Skeleton, ErrorState } from '@/components/ui';
import { useProject } from '@/components/ProjectContext';

const PAL = ['#7c5cff', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#fb7185'];
const tip = { contentStyle: { background: 'var(--surface-solid)', border: '1px solid var(--border-strong)', borderRadius: 14, boxShadow: 'var(--shadow)', color: 'var(--text)', fontSize: 12.5 }, cursor: { stroke: 'var(--border-strong)' }, labelStyle: { color: 'var(--text-muted)' } };
const axis = { stroke: 'var(--text-faint)', tickLine: false, axisLine: false, fontSize: 11 } as const;

function Chart({ title, sub, children, h = 260 }: { title: string; sub?: string; children: React.ReactElement; h?: number }) {
  return <Card className="p-5"><h3 className="text-[15px] font-semibold">{title}</h3>{sub && <p className="mb-3 text-xs text-muted">{sub}</p>}<div style={{ height: h }} className={sub ? '' : 'mt-3'}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></Card>;
}

export default function ReportsPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params); const { project } = useProject();
  const { data: r, error, reload } = useApi<any>(`/api/projects/${key}/reports`);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!r) return <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /><Skeleton className="h-72" /><Skeleton className="h-72" /></div>;
  if (!r.stats.total) return <Card><EmptyState title="No data yet" text="Reports appear once the project has issues." /></Card>;
  const gradId = (n: string) => `g-${n}`;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {[['Total', r.stats.total], ['Open', r.stats.open], ['Done', r.stats.done], ['Overdue', r.stats.overdue], ['Open bugs', r.stats.bugsOpen], ['Median cycle (d)', r.stats.cycleP50]].map(([l, v]: any) => <Card key={l} spotlight className="p-4"><div className="text-xs text-muted">{l}</div><div className="mt-1 text-[28px] font-semibold"><CountUp value={v} decimals={l.includes('cycle') ? 1 : 0} /></div></Card>)}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {project.type === 'scrum' && (r.burndown.length ? <Chart title="Burndown" sub={`${r.activeSprint?.name} · remaining story points vs ideal`}>
          <AreaChart data={r.burndown}><defs><linearGradient id={gradId('bd')} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c5cff" stopOpacity={0.5} /><stop offset="100%" stopColor="#7c5cff" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} width={30} /><Tooltip {...tip} />
            <Area type="monotone" dataKey="ideal" stroke="#98a2c3" strokeDasharray="5 5" fill="none" name="Ideal" dot={false} />
            <Area type="monotone" dataKey="actual" stroke="#7c5cff" strokeWidth={2.5} fill={`url(#${gradId('bd')})`} name="Remaining" connectNulls={false} animationDuration={1200} /></AreaChart></Chart>
          : <Card><EmptyState title="No sprint to chart" text="Start a sprint to see the burndown." /></Card>)}
        {project.type === 'scrum' && r.velocity.length > 0 && <Chart title="Velocity" sub="Committed vs completed points per sprint">
          <BarChart data={r.velocity} barGap={4}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="sprint" {...axis} /><YAxis {...axis} width={30} /><Tooltip {...tip} cursor={{ fill: 'var(--surface)' }} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="committed" fill="#98a2c3" fillOpacity={0.45} radius={[6, 6, 0, 0]} name="Committed" animationDuration={900} /><Bar dataKey="completed" radius={[6, 6, 0, 0]} name="Completed" animationDuration={1100}>{r.velocity.map((_: any, i: number) => <Cell key={i} fill="#22d3ee" />)}</Bar></BarChart></Chart>}
        <Chart title="Created vs resolved" sub="Last 30 days">
          <LineChart data={r.flow}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" {...axis} interval={4} /><YAxis {...axis} width={30} allowDecimals={false} /><Tooltip {...tip} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="created" stroke="#f472b6" strokeWidth={2.5} dot={false} name="Created" animationDuration={1200} /><Line type="monotone" dataKey="resolved" stroke="#34d399" strokeWidth={2.5} dot={false} name="Resolved" animationDuration={1400} /></LineChart></Chart>
        <Chart title="Cumulative flow" sub="Open vs done over time">
          <AreaChart data={r.cfd}><defs><linearGradient id={gradId('done')} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.6} /><stop offset="100%" stopColor="#34d399" stopOpacity={0.05} /></linearGradient><linearGradient id={gradId('open')} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c5cff" stopOpacity={0.6} /><stop offset="100%" stopColor="#7c5cff" stopOpacity={0.05} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" {...axis} interval={4} /><YAxis {...axis} width={30} /><Tooltip {...tip} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" stackId="1" dataKey="done" stroke="#34d399" fill={`url(#${gradId('done')})`} name="Done" animationDuration={1200} /><Area type="monotone" stackId="1" dataKey="open" stroke="#7c5cff" fill={`url(#${gradId('open')})`} name="Open" animationDuration={1200} /></AreaChart></Chart>
        {[['By status', r.byStatus], ['By type', r.byType], ['By priority', r.byPriority]].map(([t, d]: any) => (
          <Chart key={t} title={t} h={230}><PieChart><Pie data={d} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} cornerRadius={6} stroke="none" animationDuration={1000}>{d.map((_: any, i: number) => <Cell key={i} fill={PAL[i % PAL.length]} />)}</Pie><Tooltip {...tip} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} /></PieChart></Chart>
        ))}
        <Chart title="Workload by assignee" sub="All issues"><BarChart data={r.byAssignee} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" {...axis} allowDecimals={false} /><YAxis type="category" dataKey="name" {...axis} width={90} /><Tooltip {...tip} cursor={{ fill: 'var(--surface)' }} /><Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#7c5cff" name="Issues" animationDuration={1000} /></BarChart></Chart>
      </div>
    </div>
  );
}
