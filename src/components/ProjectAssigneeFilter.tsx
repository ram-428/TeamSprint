import clsx from 'clsx';
import { Avatar, Dropdown } from '@/components/ui';

export type ProjectMember = { _id: string; name: string; color?: string; avatarUrl?: string };

export function ProjectAssigneeFilter({ members, selectedIds, onToggle }: {
  members: ProjectMember[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
}) {
  const shown = members.slice(0, 5);
  const overflow = members.slice(5);
  const selectedInOverflow = overflow.filter((member) => selectedIds.includes(member._id)).length;

  return (
    <div role="group" aria-label="Filter issues by assignee" className="flex items-center gap-1">
      {shown.map((member) => (
        <button key={member._id} type="button" aria-label={`Filter by ${member.name}`} title={member.name}
          aria-pressed={selectedIds.includes(member._id)} onClick={() => onToggle(member._id)}
          className="inline-flex rounded-full transition-opacity aria-pressed:ring-2 aria-pressed:ring-[var(--accent)] hover:opacity-80">
          <Avatar user={member} size={28} />
        </button>
      ))}
      {overflow.length > 0 && (
        <Dropdown trigger={({ open, toggle }) => (
          <button type="button" aria-expanded={open}
            aria-label={`Filter by more assignees${selectedInOverflow ? ` (${selectedInOverflow} selected)` : ''}`}
            title="More assignees" onClick={toggle}
            className={clsx('inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-[var(--border)] bg-surface-2 px-1 text-[11px] font-semibold text-muted', selectedInOverflow > 0 && 'ring-2 ring-[var(--accent)]')}>
            +{overflow.length}
          </button>
        )}>
          {() => (
            <div className="max-h-64 overflow-y-auto">
              {overflow.map((member) => (
                <label key={member._id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--surface-2)]">
                  <input type="checkbox" aria-label={`Filter by ${member.name}`} checked={selectedIds.includes(member._id)} onChange={() => onToggle(member._id)} />
                  <Avatar user={member} size={22} />
                  <span>{member.name}</span>
                </label>
              ))}
            </div>
          )}
        </Dropdown>
      )}
    </div>
  );
}
