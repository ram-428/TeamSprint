import clsx from 'clsx';
import { Avatar, Dropdown } from '@/components/ui';

export type ProjectMember = { _id: string; name: string; color?: string; avatarUrl?: string };

/** Header avatars that double as a multi-select assignee filter. First 5 members are inline, the rest live in a "+N" dropdown. */
export function ProjectAssigneeFilter({ members, selectedIds, onToggle, onClear }: {
  members: ProjectMember[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  onClear?: () => void;
}) {
  const shown = members.slice(0, 5);
  const overflow = members.slice(5);
  const selectedInOverflow = overflow.filter((member) => selectedIds.includes(member._id)).length;
  const anySelected = selectedIds.length > 0;

  return (
    <div role="group" aria-label="Filter issues by assignee" className="flex items-center">
      {shown.map((member, i) => {
        const on = selectedIds.includes(member._id); const dim = anySelected && !on;
        return (
          <button key={member._id} type="button" aria-label={`${on ? 'Remove filter' : 'Show only issues of'} ${member.name}`} title={`${member.name}${on ? ' (filtered)' : ''}`}
            aria-pressed={on} onClick={() => onToggle(member._id)} style={{ marginLeft: i ? -8 : 0 }}
            className={clsx('relative inline-flex rounded-full transition hover:z-10 hover:-translate-y-0.5', on ? 'z-[5] ring-2 ring-[var(--accent)]' : dim ? 'opacity-40 hover:opacity-100' : '')}>
            <Avatar user={member} size={28} ring />
          </button>
        );
      })}
      {overflow.length > 0 && (
        <Dropdown trigger={({ open, toggle }) => (
          <button type="button" aria-expanded={open} style={{ marginLeft: -8 }}
            aria-label={`Filter by more assignees${selectedInOverflow ? ` (${selectedInOverflow} selected)` : ''}`}
            title="More assignees" onClick={toggle}
            className={clsx('relative inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-[var(--border)] bg-surface-2 px-1 text-[10px] font-semibold text-muted', selectedInOverflow > 0 && 'ring-2 ring-[var(--accent)]')}>
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
      {anySelected && onClear && <button type="button" className="ml-2 text-xs font-semibold text-accent2 hover:underline" onClick={onClear}>Clear ({selectedIds.length})</button>}
    </div>
  );
}
