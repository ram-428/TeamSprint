'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { KanbanSquare, ListTodo, Table2, GanttChartSquare, BarChart3, Settings2, Zap, Layers, Star, Lock, UserPlus, Users } from 'lucide-react';
import clsx from 'clsx';
import { useApi, ErrorLike } from '@/lib/projectApi';
import { api } from '@/lib/api';
import { Skeleton, ErrorState, Avatar } from '@/components/ui';
import { ProjectMembersModal } from '@/components/ProjectMembersModal';
import { ProjectProvider } from '@/components/ProjectContext';

export default function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ key: string }> }) {
  const { key } = use(params); const activeTab = useSelectedLayoutSegment();
  const { data: project, error, reload, mutate } = useApi<any>(`/api/projects/${key}`);
  const [membersOpen, setMembersOpen] = useState(false);
  // Member avatars in the header double as a multi-select assignee filter for the board, backlog and issue list.
  const [assignees, setAssignees] = useState<string[]>([]);
  useEffect(() => { setAssignees([]); }, [key]);
  const toggleAssignee = (id: string) => setAssignees((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const clearAssignees = () => setAssignees([]);
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
    <ProjectProvider value={{ project, reload, mutate, assignees, toggleAssignee, clearAssignees }}>
      <div className="mx-auto max-w-[1600px]">
        {/* breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-1.5 flex min-w-0 items-center gap-1.5 text-[14px] text-muted">
          <Link href="/projects" className="hover:text-text hover:underline">Projects</Link><span className="text-faint">/</span>
          <span className="flex min-w-0 items-center gap-1.5"><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] text-[8px] font-bold text-white" style={{ background: project.color }}>{project.key.slice(0, 2)}</span><span className="truncate">{project.name}</span></span><span className="text-faint">/</span>
        </nav>
        {/* title row */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-[22px] font-semibold leading-tight sm:text-[24px]">{project.name}</h1>
            {project.visibility === 'private' && <Lock size={14} className="shrink-0 text-faint" />}
            <button aria-label="View project members" title="Project members" className="btn btn-sm btn-icon" onClick={() => setMembersOpen(true)}><Users size={15} /></button>
            <button aria-label={project.starred ? 'Unstar' : 'Star'} title={project.starred ? 'Unstar' : 'Star'} className="btn btn-ghost btn-sm btn-icon" onClick={async () => { mutate({ ...project, starred: !project.starred }); await api(`/api/projects/${key}`, { method: 'PATCH', body: { starred: !project.starred } }).catch(() => mutate()); }}><Star size={16} className={project.starred ? 'fill-[#e2b203] text-[#e2b203]' : ''} /></button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden items-center gap-x-2 text-[12.5px] text-muted md:flex"><span className="key font-semibold">{project.key}</span><span>·</span><span className="capitalize">{project.type.replace('_', ' ')}</span><span>·</span><button className="inline-flex items-center gap-1 hover:text-text hover:underline" onClick={() => setMembersOpen(true)}><Layers size={12} />{project.members.length} {project.members.length === 1 ? 'member' : 'members'}</button>{ab.role === 'viewer' && <span className="chip !h-5 !text-[10px]">read-only</span>}</span>
            <div className="flex items-center" role="group" aria-label="Filter issues by member">
              {project.members.slice(0, 6).map((m: any, i: number) => {
                const on = assignees.includes(m._id); const dim = assignees.length > 0 && !on;
                return (
                  <button key={m._id} type="button" aria-pressed={on} aria-label={`${on ? 'Remove filter' : 'Show only issues of'} ${m.name}`} title={`${m.name}${on ? ' (filtered)' : ''}`}
                    onClick={() => toggleAssignee(m._id)} style={{ marginLeft: i ? -8 : 0 }}
                    className={clsx('relative rounded-full transition hover:z-10 hover:-translate-y-0.5', on ? 'z-[5] ring-2 ring-[var(--accent)]' : dim ? 'opacity-40 hover:opacity-100' : '')}>
                    <Avatar user={m} size={28} ring />
                  </button>
                );
              })}
              {project.members.length > 6 && <button type="button" title="All members" aria-label="View project members" style={{ marginLeft: -8, width: 28, height: 28 }} className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-surface-2 text-[10px] font-semibold text-muted" onClick={() => setMembersOpen(true)}>+{project.members.length - 6}</button>}
              {assignees.length > 0 && <button type="button" className="ml-2 text-xs font-semibold text-accent2 hover:underline" onClick={clearAssignees}>Clear ({assignees.length})</button>}
            </div>
            {ab['project.manage_members']
              ? <button className="btn btn-sm" onClick={() => setMembersOpen(true)}><UserPlus size={15} /> Add member</button>
              : <button className="btn btn-sm" onClick={() => setMembersOpen(true)}><Users size={15} /> Members</button>}
          </div>
        </div>
        <ProjectMembersModal open={membersOpen} onClose={() => setMembersOpen(false)} project={project} reload={reload} />
        {/* underlined tabs */}
        <nav className="mb-5 flex max-w-full gap-1 overflow-x-auto border-b border-[var(--border)]" aria-label="Project">
          {tabs.map((t) => {
            const active = activeTab === t.slug;
            return <Link key={t.slug} href={`/projects/${key}/${t.slug}`} aria-current={active ? 'page' : undefined} className={clsx('flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-md border-b-2 px-2 pb-2 pt-1.5 text-[14px] transition-colors', active ? 'border-[var(--accent)] bg-[var(--accent-soft)] font-semibold text-[var(--accent)]' : 'border-transparent font-medium text-muted hover:border-[var(--border-strong)] hover:text-text')}>
              <t.icon size={16} /><span>{t.label}</span></Link>;
          })}
        </nav>
        {children}
      </div>
    </ProjectProvider>
  );
}
