'use client';
import { useMemo, useState } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import clsx from 'clsx';
import { useApi } from '@/lib/api';
import { Avatar, Dropdown, PriorityIcon, TypeIcon } from '@/components/ui';

/**
 * Jira-style "Basic" search: a row of field chips (Project, Assignee, Type, Status, Priority + "More filters").
 * The chosen values are turned into an OQL query, so Basic and OQL modes share one search engine.
 */
export type BasicState = {
  text?: string;
  project?: string[]; assignee?: string[]; type?: string[]; status?: string[]; priority?: string[];
  reporter?: string[]; team?: string[]; sprint?: string[];
  state?: '' | 'open' | 'done';
  created?: string; updated?: string; resolved?: string; due?: string;
  sort?: string;
};
type MultiKey = 'project' | 'assignee' | 'type' | 'status' | 'priority' | 'reporter' | 'team' | 'sprint';
type DateKey = 'created' | 'updated' | 'resolved' | 'due';
type Opt = { value: string; label: string; icon?: React.ReactNode };

export const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
const RECENT: Opt[] = [{ value: '-1d', label: 'In the last 24 hours' }, { value: '-7d', label: 'In the last 1 week' }, { value: '-14d', label: 'In the last 2 weeks' }, { value: '-30d', label: 'In the last 30 days' }, { value: '-90d', label: 'In the last 90 days' }];
const DUE: Opt[] = [{ value: 'overdue', label: 'Overdue' }, { value: 'today', label: 'Due today' }, { value: 'week', label: 'Due in the next 7 days' }, { value: 'month', label: 'Due in the next 30 days' }, { value: 'none', label: 'No due date' }];
const STATE: Opt[] = [{ value: 'open', label: 'Open (not done)' }, { value: 'done', label: 'Done' }];
export const SORTS: Opt[] = [{ value: 'updated DESC', label: 'Last updated' }, { value: 'created DESC', label: 'Newest created' }, { value: 'created ASC', label: 'Oldest created' }, { value: 'priority DESC', label: 'Priority' }, { value: 'due ASC', label: 'Due date' }, { value: 'resolved DESC', label: 'Recently resolved' }, { value: 'key ASC', label: 'Key' }];

/** Fields that live under "More filters" until they are added or have a value. */
const MORE: { key: MultiKey | DateKey | 'state'; label: string }[] = [
  { key: 'reporter', label: 'Reporter' }, { key: 'team', label: 'Team' }, { key: 'sprint', label: 'Sprint' }, { key: 'state', label: 'Work state' },
  { key: 'created', label: 'Created' }, { key: 'updated', label: 'Updated' }, { key: 'resolved', label: 'Resolved' }, { key: 'due', label: 'Due date' },
];

const q = (s: string) => `"${s.replace(/"/g, '')}"`;
const list = (vals: string[]) => `(${vals.map(q).join(', ')})`;

/** People fields: "me" → currentUser(), "none" → IS EMPTY, anything else is a user id. */
function people(field: string, vals: string[]) {
  const ids = vals.filter((v) => v !== 'me' && v !== 'none').map(q);
  if (vals.includes('me')) ids.unshift('currentUser()');
  const parts = [ids.length ? `${field} IN (${ids.join(', ')})` : '', vals.includes('none') ? `${field} IS EMPTY` : ''].filter(Boolean);
  return parts.length > 1 ? `(${parts.join(' OR ')})` : parts[0];
}

export function buildOql(s: BasicState): string {
  const w: string[] = [];
  const has = (a?: string[]) => !!a && a.length > 0;
  if (s.text?.trim()) w.push(`text ~ ${q(s.text.trim())}`);
  if (has(s.project)) w.push(`project IN ${list(s.project!)}`);
  if (has(s.assignee)) w.push(people('assignee', s.assignee!));
  if (has(s.reporter)) w.push(people('reporter', s.reporter!));
  if (has(s.type)) w.push(`type IN ${list(s.type!)}`);
  if (has(s.status)) w.push(`status IN ${list(s.status!)}`);
  if (has(s.priority)) w.push(`priority IN ${list(s.priority!)}`);
  if (has(s.team)) { const ids = s.team!.filter((t) => t !== 'none'); const p = [ids.length ? `team IN ${list(ids)}` : '', s.team!.includes('none') ? 'team IS EMPTY' : ''].filter(Boolean); w.push(p.length > 1 ? `(${p.join(' OR ')})` : p[0]); }
  if (has(s.sprint)) { const p = [s.sprint!.includes('open') ? 'sprint IN (openSprints())' : '', s.sprint!.includes('none') ? 'sprint IS EMPTY' : ''].filter(Boolean); w.push(p.length > 1 ? `(${p.join(' OR ')})` : p[0]); }
  if (s.state === 'open') w.push('statusCategory != done');
  if (s.state === 'done') w.push('statusCategory = done');
  for (const f of ['created', 'updated', 'resolved'] as const) if (s[f]) w.push(`${f} >= ${s[f]}`);
  if (s.due === 'overdue') w.push('due < now() AND statusCategory != done');
  if (s.due === 'today') w.push('due >= startOfDay() AND due < 1d');
  if (s.due === 'week') w.push('due >= startOfDay() AND due <= 7d');
  if (s.due === 'month') w.push('due >= startOfDay() AND due <= 30d');
  if (s.due === 'none') w.push('due IS EMPTY');
  return `${w.join(' AND ')}${w.length ? ' ' : ''}ORDER BY ${s.sort || 'updated DESC'}`;
}

export const isEmptyBasic = (s: BasicState) => buildOql({ ...s, sort: undefined }) === 'ORDER BY updated DESC';

/** A field chip with a searchable checkbox list (Jira's "Assignee ▾"). Turns blue and shows the selection once set. */
function MultiChip({ label, options, value, onChange, onRemove }: { label: string; options: Opt[]; value: string[]; onChange: (v: string[]) => void; onRemove?: () => void }) {
  const [term, setTerm] = useState('');
  const shown = term ? options.filter((o) => o.label.toLowerCase().includes(term.toLowerCase())) : options;
  const names = value.map((v) => options.find((o) => o.value === v)?.label ?? v);
  const on = value.length > 0;
  return (
    <Dropdown align="left" trigger={({ open, toggle }) => (
      <div className={clsx('inline-flex h-8 items-center rounded-lg border text-[13px] font-medium transition-colors', on ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-accent' : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]')}>
        <button type="button" aria-expanded={open} onClick={() => { setTerm(''); toggle(); }} className="flex h-full items-center gap-1 pl-2.5 pr-1.5">
          <span>{label}{on && ':'}</span>{on && <span className="max-w-[160px] truncate font-semibold">{names[0]}{names.length > 1 && ` +${names.length - 1}`}</span>}
          <ChevronDown size={14} className={clsx('transition-transform', open && 'rotate-180')} />
        </button>
        {(on || onRemove) && <button type="button" aria-label={`Clear ${label}`} onClick={() => (on ? onChange([]) : onRemove?.())} className="mr-1 rounded p-1 hover:bg-[var(--surface-2)]"><X size={13} /></button>}
      </div>
    )}>
      {() => (
        <div className="w-[260px]">
          {options.length > 6 && <div className="relative mb-1"><Search size={13} className="absolute left-2.5 top-[9px] text-faint" /><input autoFocus aria-label={`Search ${label}`} className="input !h-8 !pl-8 text-[13px]" placeholder={`Search ${label.toLowerCase()}`} value={term} onChange={(e) => setTerm(e.target.value)} /></div>}
          <div className="max-h-[280px] overflow-y-auto">
            {shown.length === 0 && <p className="px-3 py-3 text-[13px] text-muted">No matches</p>}
            {shown.map((o) => {
              const sel = value.includes(o.value);
              return (
                <button key={o.value} type="button" role="menuitemcheckbox" aria-checked={sel} onClick={() => onChange(sel ? value.filter((v) => v !== o.value) : [...value, o.value])}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13.5px] hover:bg-[var(--surface-2)]">
                  <span className={clsx('flex h-4 w-4 shrink-0 items-center justify-center rounded border', sel ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border-strong)]')}>{sel && <Check size={11} strokeWidth={3} />}</span>
                  {o.icon}<span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
          {on && <button type="button" onClick={() => onChange([])} className="mt-1 w-full border-t border-[var(--border)] px-2.5 pt-2 pb-1 text-left text-[13px] font-medium text-accent2 hover:underline">Clear selection</button>}
        </div>
      )}
    </Dropdown>
  );
}

/** Single-choice chip (date presets, work state). */
function SingleChip({ label, options, value, onChange, onRemove }: { label: string; options: Opt[]; value?: string; onChange: (v: string) => void; onRemove?: () => void }) {
  const cur = options.find((o) => o.value === value);
  return (
    <Dropdown align="left" trigger={({ open, toggle }) => (
      <div className={clsx('inline-flex h-8 items-center rounded-lg border text-[13px] font-medium transition-colors', cur ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-accent' : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]')}>
        <button type="button" aria-expanded={open} onClick={toggle} className="flex h-full items-center gap-1 pl-2.5 pr-1.5"><span>{label}{cur && ':'}</span>{cur && <span className="font-semibold">{cur.label}</span>}<ChevronDown size={14} className={clsx('transition-transform', open && 'rotate-180')} /></button>
        {(cur || onRemove) && <button type="button" aria-label={`Clear ${label}`} onClick={() => (cur ? onChange('') : onRemove?.())} className="mr-1 rounded p-1 hover:bg-[var(--surface-2)]"><X size={13} /></button>}
      </div>
    )}>
      {(close) => (
        <div className="w-[230px]">
          {options.map((o) => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value === value ? '' : o.value); close(); }} className={clsx('flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13.5px] hover:bg-[var(--surface-2)]', o.value === value && 'text-accent')}>
              {o.label}{o.value === value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </Dropdown>
  );
}

export function BasicFilterBar({ value, onChange, leading, trailing }: { value: BasicState; onChange: (s: BasicState) => void; leading?: React.ReactNode; trailing?: React.ReactNode }) {
  const { data: projects } = useApi<any[]>('/api/projects');
  const { data: users } = useApi<any[]>('/api/users');
  const { data: masters } = useApi<{ types: { key: string; name: string }[]; statuses: { id: string; name: string }[] }>('/api/masters');
  const { data: teams } = useApi<any[]>('/api/teams');
  const [added, setAdded] = useState<string[]>([]);
  const set = (patch: Partial<BasicState>) => onChange({ ...value, ...patch });

  const opts = useMemo(() => {
    const people: Opt[] = [{ value: 'me', label: 'Current user', icon: <Avatar size={18} user={{ name: 'Me' }} /> }, { value: 'none', label: 'Unassigned' },
      ...(users || []).map((u) => ({ value: String(u._id), label: u.name, icon: <Avatar size={18} user={u} /> }))];
    return {
      project: (projects || []).map((p) => ({ value: p.key, label: `${p.name} (${p.key})`, icon: <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: p.color }} /> })),
      assignee: people,
      reporter: [people[0], ...people.slice(2)],
      type: (masters?.types || []).map((t) => ({ value: t.key, label: t.name, icon: <TypeIcon type={t.key} /> })),
      status: (masters?.statuses || []).map((s) => ({ value: s.id, label: s.name })),
      priority: PRIORITIES.map((p) => ({ value: p, label: p, icon: <PriorityIcon priority={p} /> })),
      team: [{ value: 'none', label: 'No team' }, ...(teams || []).map((t) => ({ value: String(t._id), label: t.name, icon: <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} /> }))],
      sprint: [{ value: 'open', label: 'Open sprints' }, { value: 'none', label: 'No sprint (backlog)' }],
    } as Record<MultiKey, Opt[]>;
  }, [projects, users, masters, teams]);

  const hasVal = (k: string) => { const v = (value as any)[k]; return Array.isArray(v) ? v.length > 0 : !!v; };
  const extra = MORE.filter((m) => added.includes(m.key) || hasVal(m.key));
  const remove = (k: string) => { setAdded((a) => a.filter((x) => x !== k)); set({ [k]: undefined } as any); };
  const multi = (k: MultiKey, label: string, removable = false) => <MultiChip key={k} label={label} options={opts[k]} value={value[k] || []} onChange={(v) => set({ [k]: v } as any)} onRemove={removable ? () => remove(k) : undefined} />;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {leading}
      <div className="relative"><Search size={14} className="absolute left-2.5 top-[9px] text-faint" />
        <input aria-label="Search work items" className="input !h-8 !w-48 !pl-8 text-[13px]" placeholder="Search work items" value={value.text || ''} onChange={(e) => set({ text: e.target.value })} /></div>
      {multi('project', 'Project')}{multi('assignee', 'Assignee')}{multi('type', 'Type')}{multi('status', 'Status')}{multi('priority', 'Priority')}
      {extra.map((m) => m.key === 'state' ? <SingleChip key={m.key} label={m.label} options={STATE} value={value.state} onChange={(v) => set({ state: v as any })} onRemove={() => remove('state')} />
        : ['created', 'updated', 'resolved', 'due'].includes(m.key) ? <SingleChip key={m.key} label={m.label} options={m.key === 'due' ? DUE : RECENT} value={(value as any)[m.key]} onChange={(v) => set({ [m.key]: v || undefined } as any)} onRemove={() => remove(m.key)} />
        : multi(m.key as MultiKey, m.label, true))}
      {MORE.some((m) => !extra.includes(m)) && (
        <Dropdown align="left" trigger={({ toggle }) => <button type="button" className="btn !h-8 !px-2.5 text-[13px]" onClick={toggle}><Plus size={13} /> More filters</button>}>
          {(close) => <div className="w-[200px]">{MORE.filter((m) => !extra.includes(m)).map((m) => <button key={m.key} type="button" onClick={() => { setAdded((a) => [...a, m.key]); close(); }} className="flex w-full rounded-md px-2.5 py-1.5 text-left text-[13.5px] hover:bg-[var(--surface-2)]">{m.label}</button>)}</div>}
        </Dropdown>
      )}
      {trailing}
    </div>
  );
}

export { SingleChip };
