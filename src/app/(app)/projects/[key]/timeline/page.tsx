'use client';
import { use, useMemo, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useProject } from '@/components/ProjectContext';
import { useApi } from '@/lib/api';
import { Card, EmptyState, Skeleton, Tabs } from '@/components/ui';
import { IssueDrawer } from '@/components/issue/IssueDrawer';

const DAY = 864e5;
export default function TimelinePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params); const { project } = useProject();
  const router = useRouter(); const path = usePathname(); const sp = useSearchParams(); const selected = sp.get('selected');
  const { data } = useApi<{ items: any[] }>(`/api/issues?project=${key}`);
  const { data: sprints } = useApi<any[]>(project.type === 'scrum' ? `/api/projects/${key}/sprints` : null);
  const [zoom, setZoom] = useState<'week' | 'month' | 'quarter'>('month');
  const px = { week: 46, month: 18, quarter: 8 }[zoom];

  const model = useMemo(() => {
    if (!data) return null;
    const all = data.items; const epics = all.filter((i) => i.type === 'epic');
    const rows = epics.map((e) => {
      const kids = all.filter((i) => i.epicId === e._id);
      const starts = [e.startDate, e.createdAt, ...kids.map((k) => k.createdAt)].filter(Boolean).map((d) => +new Date(d));
      const ends = [e.dueDate, ...kids.map((k) => k.resolvedAt || k.dueDate)].filter(Boolean).map((d) => +new Date(d));
      const start = Math.min(...starts); let end = ends.length ? Math.max(...ends) : start + 30 * DAY; if (end < Date.now() && e.statusCategory !== 'done') end = Date.now() + 14 * DAY;
      const done = kids.filter((k) => k.statusCategory === 'done').length;
      return { epic: e, kids, start, end: Math.max(end, start + 7 * DAY), pct: kids.length ? (done / kids.length) * 100 : e.statusCategory === 'done' ? 100 : 0 };
    });
    const min = Math.min(...rows.map((r) => r.start), Date.now() - 20 * DAY, ...(sprints || []).map((s) => (s.startDate ? +new Date(s.startDate) : Infinity))) - 7 * DAY;
    const max = Math.max(...rows.map((r) => r.end), Date.now() + 40 * DAY, ...(sprints || []).map((s) => (s.endDate ? +new Date(s.endDate) : 0))) + 7 * DAY;
    return { rows, min, max };
  }, [data, sprints]);
  const setSel = (k: string | null) => { const p = new URLSearchParams(sp.toString()); k ? p.set('selected', k) : p.delete('selected'); router.replace(`${path}?${p}`, { scroll: false }); };

  if (!model) return <Skeleton className="h-[420px]" />;
  if (!model.rows.length) return <Card><EmptyState title="No epics yet" text="Create epics to see them plotted on the timeline." /></Card>;
  const days = Math.ceil((model.max - model.min) / DAY); const width = days * px; const x = (t: number) => ((t - model.min) / DAY) * px;
  const months: { label: string; left: number }[] = [];
  for (let d = new Date(model.min); +d < model.max; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push({ label: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), left: x(+new Date(d.getFullYear(), d.getMonth(), 1)) });
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><Tabs id="tl-zoom" value={zoom} onChange={setZoom} tabs={[{ id: 'week', label: 'Weeks' }, { id: 'month', label: 'Months' }, { id: 'quarter', label: 'Quarters' }]} /><span className="text-[12.5px] text-muted">Epic bars show child-issue completion</span></div>
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[230px_1fr]">
          <div className="border-r border-[var(--border)]"><div className="h-10 border-b border-[var(--border)] px-4 pt-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-muted">Epic</div>
            {model.rows.map((r) => <button key={r.epic._id} onClick={() => setSel(r.epic.key)} className="block h-14 w-full truncate border-b border-[var(--border)] px-4 text-left last:border-0 hover:bg-[var(--surface-2)]"><div className="truncate text-[13.5px] font-semibold">{r.epic.summary}</div><div className="text-xs text-muted">{r.epic.key} · {r.kids.length} issues</div></button>)}</div>
          <div className="overflow-x-auto"><div className="relative" style={{ width }}>
            <div className="relative h-10 border-b border-[var(--border)]">{months.map((m) => <span key={m.label + m.left} className="absolute top-2.5 border-l border-[var(--border)] pl-2 text-[11.5px] font-semibold text-muted" style={{ left: m.left, height: '100%' }}>{m.label}</span>)}</div>
            {(sprints || []).filter((s) => s.startDate).map((s) => <div key={s._id} title={s.name} className="absolute top-10 bottom-0 border-x border-dashed border-[var(--border)] bg-[var(--accent-soft)]/30" style={{ left: x(+new Date(s.startDate)), width: x(+new Date(s.endDate)) - x(+new Date(s.startDate)), opacity: s.state === 'closed' ? 0.35 : 0.8 }}><span className="absolute bottom-1 left-1 text-[10px] font-semibold text-faint">{s.name.replace(/^.*Sprint /, 'S')}</span></div>)}
            <div className="today-line" style={{ left: x(Date.now()), top: 0 }} title="Today"><span className="absolute -left-4 top-1 rounded bg-accent2 px-1 text-[9px] font-bold text-black">TODAY</span></div>
            {model.rows.map((r, i) => (
              <div key={r.epic._id} className="relative h-14 border-b border-[var(--border)] last:border-0">
                <motion.button initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} style={{ left: x(r.start), width: Math.max(24, x(r.end) - x(r.start)), originX: 0, background: `${project.color}33`, borderColor: `${project.color}88` }} onClick={() => setSel(r.epic.key)} className="absolute top-3.5 h-8 overflow-hidden rounded-lg border text-left" aria-label={`${r.epic.summary} ${Math.round(r.pct)}% complete`}>
                  <span className="absolute inset-y-0 left-0 grad-bar opacity-80" style={{ width: `${r.pct}%` }} /><span className="relative z-10 truncate px-2.5 text-[11.5px] font-semibold leading-8">{r.epic.summary} · {Math.round(r.pct)}%</span></motion.button>
              </div>))}
          </div></div>
        </div>
      </Card>
      <IssueDrawer issueKey={selected} onClose={() => setSel(null)} />
    </div>
  );
}
