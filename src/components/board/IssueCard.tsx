'use client';
import { forwardRef } from 'react';
import { Flag, Calendar, MessageSquare, Link2 } from 'lucide-react';
import clsx from 'clsx';
import { Avatar, PriorityIcon, TypeIcon } from '../ui';

const LABEL_COLORS = ['#7c5cff', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#fb7185'];
export const labelColor = (s: string) => LABEL_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % LABEL_COLORS.length];

type Props = React.HTMLAttributes<HTMLDivElement> & { issue: any; epicName?: string; dragging?: boolean; overlay?: boolean; flash?: boolean; shake?: boolean; selected?: boolean; ageDays?: number };

export const IssueCard = forwardRef<HTMLDivElement, Props>(function IssueCard({ issue, epicName, dragging, overlay, flash, shake, selected, ageDays, className, style, ...rest }, ref) {
  const overdue = issue.dueDate && new Date(issue.dueDate) < new Date() && issue.statusCategory !== 'done';
  const stale = (ageDays ?? 0) >= 7 && issue.statusCategory === 'inprogress';
  return (
    <div ref={ref} {...rest} style={style}
      className={clsx(
        'group relative cursor-grab rounded-[10px] border bg-[var(--surface-solid)] px-2.5 py-2 text-left transition-[box-shadow,border-color,background] active:cursor-grabbing',
        'border-[var(--border)] hover:border-[var(--border-strong)] hover:shadow-[0_8px_26px_-12px_rgba(124,92,255,.55)]',
        issue.flagged && 'flagged-card !border-warning/50', dragging && 'opacity-35', overlay && 'rotate-[2.5deg] scale-[1.04] !border-[var(--accent)] shadow-[0_24px_50px_-12px_rgba(0,0,0,.7),0_0_0_1px_var(--accent)]',
        flash && 'ring-2 ring-[var(--success)] ring-offset-0', shake && 'animate-[shake_.4s]', selected && 'ring-2 ring-[var(--accent)]', className,
      )}>
      {epicName && <div className="mb-2 inline-flex max-w-full items-center gap-1 truncate rounded-md bg-[#a78bfa22] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#a78bfa]">{epicName}</div>}
      <div className="line-clamp-2 text-[13px] font-medium leading-snug">{issue.summary}</div>
      {issue.labels?.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{issue.labels.slice(0, 3).map((l: string) => <span key={l} className="rounded-md px-1.5 py-px text-[10.5px] font-semibold" style={{ background: `${labelColor(l)}22`, color: labelColor(l) }}>{l}</span>)}</div>}
      <div className="mt-1.5 flex items-center gap-2">
        <TypeIcon type={issue.type} size={16} />
        <span className="key font-medium">{issue.key}</span>
        {issue.flagged && <Flag size={12} className="text-warning" />}
        {overdue && <Calendar size={12} className="text-danger" aria-label="Overdue" />}
        {issue.links?.some((l: any) => l.type === 'is blocked by') && <Link2 size={12} className="text-danger" aria-label="Blocked" />}
        {stale && <span title={`${ageDays}d in this column`} className="rounded-full bg-warning/20 px-1.5 text-[10px] font-bold text-warning">{ageDays}d</span>}
        <span className="ml-auto flex items-center gap-2">
          {issue.points != null && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--surface-2)] px-1.5 text-[11px] font-semibold text-muted">{issue.points}</span>}
          <PriorityIcon priority={issue.priority} />
          <Avatar user={issue.assignee} size={22} />
        </span>
      </div>
    </div>
  );
});
void MessageSquare;
