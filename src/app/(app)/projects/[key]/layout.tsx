'use client';
import { use } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { KanbanSquare, ListTodo, Table2, GanttChartSquare, BarChart3, Settings2, Zap, Layers, Star, Lock } from 'lucide-react';
import clsx from 'clsx';
import { useApi, ErrorLike } from '@/lib/projectApi';
import { api } from '@/lib/api';
import { Skeleton, ErrorState } from '@/components/ui';
import { ProjectProvider } from '@/components/ProjectContext';

export default function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ key: string }> }) {
  const { key } = use(params); const path = usePathname();
  const { data: project, error, reload, mutate } = useApi<any>(`/api/projects/${key}`);
  if (error) return <ErrorState message={error.status === 404 ? 'Project not found, or you do not have access.' : (error as ErrorLike).message} onRetry={reload} />;
  if (!project) return <div className="mx-auto max-w-[1500px] space-y-4"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-10 w-2/3" /><Skeleton className="h-[480px]" /></div>;
  const ab = project.abilities;
  const tabs = [
    { slug: 'board', label: project.type === 'scrum' ? 'Active sprint' : 'Board', icon: KanbanSquare },
    ...(project.type === 'scrum' ? [{ slug: 'backlog', label: 'Backlog', icon: ListTodo }] : []),
    { slug: 'list', label: 'Issues', icon: Table2 },
    { slug: 'timeline', label: 'Timeline', icon: GanttChartSquare },
    { slug: 'reports', label: 'Reports', icon: BarChart3 },
    { slug: 'automation', label: 'Automation', icon: Zap },
    { slug: 'settings', label: 'Settings', icon: Settings2 },
  ];
  return (
    <ProjectProvider value={{ project, reload, mutate }}>
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-[15px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${project.color}, ${project.color}88)`, boxShadow: `0 10px 24px -10px ${project.color}` }}>{project.key.slice(0, 2)}</span>
            <div><div className="flex items-center gap-2"><h1 className="text-[24px] font-semibold leading-tight">{project.name}</h1>{project.visibility === 'private' && <Lock size={13} className="text-faint" />}
              <button aria-label={project.starred ? 'Unstar' : 'Star'} className="rounded-lg p-1 text-faint hover:text-warning" onClick={async () => { mutate({ ...project, starred: !project.starred }); await api(`/api/projects/${key}`, { method: 'PATCH', body: { starred: !project.starred } }).catch(() => mutate()); }}><Star size={16} className={project.starred ? 'fill-[var(--warning)] text-warning' : ''} /></button></div>
              <div className="flex items-center gap-2 text-[12.5px] text-muted"><span className="key font-semibold">{project.key}</span><span>·</span><span className="capitalize">{project.type.replace('_', ' ')}</span><span>·</span><span className="inline-flex items-center gap-1"><Layers size={12} />{project.members.length} members</span>{ab.role === 'viewer' && <span className="chip !h-5 !text-[10px]">read-only</span>}</div></div>
          </div>
        </div>
        <nav className="glass mb-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl p-1" aria-label="Project">
          {tabs.map((t) => {
            const active = path === `/projects/${key}/${t.slug}`;
            return <Link key={t.slug} href={`/projects/${key}/${t.slug}`} className={clsx('relative flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13.5px] font-medium transition-colors', active ? 'text-text' : 'text-muted hover:text-text')}>
              {active && <motion.span layoutId="proj-tab" className="absolute inset-0 rounded-xl bg-[var(--surface-2)] shadow-[0_0_0_1px_var(--border-strong),0_6px_18px_-8px_rgba(124,92,255,.6)]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <t.icon size={15} className={clsx('relative', active && 'text-accent2')} /><span className="relative">{t.label}</span></Link>;
          })}
        </nav>
        {children}
      </div>
    </ProjectProvider>
  );
}
