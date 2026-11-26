'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Plus, Search as SearchIcon, Users, X } from 'lucide-react';
import clsx from 'clsx';
import { api, ApiError, errMsg, invalidate, toast, useApi } from '@/lib/api';
import { Avatar, Field, Modal, Select, Spinner } from './ui';
import { useMe } from './UserContext';

export type TeamLite = { _id: string; name: string; color: string; description?: string; memberCount: number; includesMe: boolean; memberIds: string[]; leadId?: string; members: { _id: string; name: string; color?: string; avatarUrl?: string }[]; projects: { _id: string; key: string; name: string; color?: string }[]; canManage: boolean };

/** Square team badge (Jira style): coloured tile with a people glyph. */
export function TeamIcon({ color, size = 28 }: { color?: string; size?: number }) {
  return <span className="inline-flex shrink-0 items-center justify-center rounded-md text-white" style={{ width: size, height: size, background: color || '#7c5cff' }}><Users size={Math.round(size * 0.55)} /></span>;
}

export const memberLine = (t: Pick<TeamLite, 'memberCount' | 'includesMe'>) => `Team • ${t.memberCount} member${t.memberCount === 1 ? '' : 's'}${t.includesMe ? ', including you' : ''}`;

/**
 * Jira-like Team field: searchable list of the organization's teams showing member counts ("including you"),
 * an option to clear it, and "Create a team" at the bottom.
 */
export function TeamPicker({ value, onChange, disabled, className, compact, projectKey }: { value: string; onChange: (teamId: string) => void; disabled?: boolean; className?: string; compact?: boolean; projectKey?: string }) {
  const me = useMe();
  const { data: teams, reload } = useApi<TeamLite[]>('/api/teams');
  const [open, setOpen] = useState(false); const [q, setQ] = useState(''); const [idx, setIdx] = useState(0);
  const [creating, setCreating] = useState(false);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null);
  const trig = useRef<HTMLButtonElement>(null); const search = useRef<HTMLInputElement>(null);
  const selected = teams?.find((t) => t._id === value);
  // Teams that work on the issue's project are listed first (all teams stay pickable).
  const inProject = (t: TeamLite) => !!projectKey && (t.projects || []).some((p) => p.key === projectKey);
  const list = (teams || []).filter((t) => !q.trim() || t.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(inProject(b)) - Number(inProject(a)));
  const canCreate = me.role !== 'guest';

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = trig.current?.getBoundingClientRect(); if (!r) return;
      const below = window.innerHeight - r.bottom, above = r.top; const up = below < 320 && above > below;
      const w = Math.min(Math.max(r.width, 300), window.innerWidth - 16);
      setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), width: w, maxH: Math.min(380, (up ? above : below) - 16), top: up ? undefined : r.bottom + 6, bottom: up ? window.innerHeight - r.top + 6 : undefined });
    };
    const onScroll = (e: Event) => { if (!(e.target as HTMLElement)?.closest?.('[data-teampicker]')) place(); };
    const close = (e: Event) => { if (!(e.target as HTMLElement)?.closest?.('[data-teampicker]') && !trig.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); trig.current?.focus(); } };
    place(); setQ(''); setIdx(0); requestAnimationFrame(() => search.current?.focus());
    window.addEventListener('resize', place); window.addEventListener('scroll', onScroll, true);
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', onScroll, true); document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc, true); };
  }, [open]);

  const pick = (id: string) => { onChange(id); setOpen(false); trig.current?.focus(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open && ['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); setOpen(true); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(list.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (list[idx]) pick(list[idx]._id); }
  };

  return (
    <div className={clsx('relative', className || 'w-full')}>
      <button ref={trig} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-label="Team" disabled={disabled} onClick={() => setOpen((o) => !o)} onKeyDown={onKey}
        className={clsx('flex w-full items-center gap-2 rounded-lg border bg-[var(--surface)] px-3 text-left text-[14px] transition-all disabled:cursor-not-allowed disabled:opacity-50', compact ? 'h-9' : 'h-10', open ? 'border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]')}>
        {selected ? <><TeamIcon color={selected.color} size={20} /><span className="min-w-0 flex-1 truncate">{selected.name}</span></> : <><Users size={15} className="shrink-0 text-faint" /><span className="min-w-0 flex-1 truncate text-faint">None</span></>}
        {selected && !disabled && <span role="button" tabIndex={-1} aria-label="Clear team" onClick={(e) => { e.stopPropagation(); onChange(''); }} className="rounded p-0.5 text-faint hover:text-danger"><X size={13} /></span>}
        <ChevronDown size={15} className={clsx('shrink-0 text-faint transition-transform', open && 'rotate-180 text-accent')} />
      </button>
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div data-teampicker role="listbox" initial={{ opacity: 0, y: pos.bottom ? 6 : -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.14 }}
              style={{ position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, zIndex: 200 }} className="glass-solid flex flex-col overflow-hidden rounded-xl">
              <div className="border-b border-[var(--border)] p-2"><div className="relative"><SearchIcon size={14} className="absolute left-2.5 top-[9px] text-faint" /><input ref={search} aria-label="Search teams" value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={onKey} placeholder="Team" className="h-8 w-full rounded-lg border border-[var(--border)] bg-transparent pl-8 pr-2 text-[13px] outline-none focus:border-[var(--accent)]" /></div></div>
              <div className="min-h-0 flex-1 overflow-y-auto p-1" style={{ maxHeight: pos.maxH - 96 }}>
                {!teams && <div className="flex justify-center py-4"><Spinner /></div>}
                {teams && list.length === 0 && <div className="px-3 py-4 text-center text-[13px] text-faint">{teams.length ? 'No matching teams' : 'No teams yet'}</div>}
                {list.map((t, i) => (
                  <button key={t._id} type="button" role="option" aria-selected={t._id === value} onMouseEnter={() => setIdx(i)} onClick={() => pick(t._id)}
                    className={clsx('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors', i === idx && 'bg-[var(--accent-soft)]')}>
                    <TeamIcon color={t.color} size={30} />
                    <span className="min-w-0 flex-1"><span className={clsx('block truncate text-[13.5px]', t._id === value && 'font-semibold')}>{t.name}</span><span className="block truncate text-[12px] text-muted">{memberLine(t)}{inProject(t) && <span className="text-accent2"> • in {projectKey}</span>}</span></span>
                    {t._id === value && <Check size={14} className="shrink-0 text-accent" />}
                  </button>))}
              </div>
              {canCreate && <div className="border-t border-[var(--border)] p-1"><button type="button" onClick={() => { setOpen(false); setCreating(true); }} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-[13.5px] hover:bg-[var(--surface-2)]"><Plus size={16} /> Create a team</button></div>}
            </motion.div>)}
        </AnimatePresence>, document.body)}
      {/* Portalled so it is not inside a surrounding <form> (Enter must not submit "Create issue"). */}
      {typeof document !== 'undefined' && createPortal(<TeamFormModal open={creating} onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); reload(); if (id) onChange(id); }} />, document.body)}
    </div>
  );
}

/** Create a team, or edit one when `team` is given. Used by the Team picker and the Teams page. */
export function TeamFormModal({ open, team, onClose, onSaved }: { open: boolean; team?: TeamLite | null; onClose: () => void; onSaved: (id?: string) => void }) {
  const me = useMe();
  const { data: users } = useApi<any[]>(open ? '/api/users' : null);
  const { data: projects } = useApi<any[]>(open ? '/api/projects' : null);
  const [f, setF] = useState({ name: '', description: '', color: '#7c5cff', memberIds: [] as string[], leadId: '', projectIds: [] as string[] });
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return; setErrs({}); setQ('');
    setF(team ? { name: team.name, description: team.description || '', color: team.color || '#7c5cff', memberIds: team.memberIds, leadId: team.leadId || '', projectIds: (team.projects || []).map((p) => p._id) } : { name: '', description: '', color: '#7c5cff', memberIds: [me.id], leadId: me.id, projectIds: [] });
  }, [open, team, me.id]);
  // A super admin working inside another organization is not one of its people: don't pre-add them as member/lead.
  useEffect(() => {
    if (!open || team || !users) return;
    if (!users.some((u) => u._id === me.id)) setF((x) => ({ ...x, memberIds: x.memberIds.filter((m) => m !== me.id), leadId: x.leadId === me.id ? '' : x.leadId }));
  }, [open, team, users, me.id]);
  const toggle = (id: string) => setF((x) => { const has = x.memberIds.includes(id); const memberIds = has ? x.memberIds.filter((m) => m !== id) : [...x.memberIds, id]; return { ...x, memberIds, leadId: has && x.leadId === id ? '' : x.leadId }; });
  const shown = (users || []).filter((u) => !q.trim() || `${u.name} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  async function go() {
    setBusy(true); setErrs({});
    try {
      const body = { name: f.name, description: f.description, color: f.color, memberIds: f.memberIds, leadId: f.leadId || null, projectIds: f.projectIds };
      let id = team?._id;
      if (team) await api(`/api/teams/${team._id}`, { method: 'PATCH', body });
      else id = (await api<{ _id: string }>('/api/teams', { body }))._id;
      invalidate('/api/teams'); toast.success(team ? 'Team updated' : `Team "${f.name}" created`); onSaved(id);
    } catch (e) { if (e instanceof ApiError && e.fields) setErrs(e.fields); else toast.error(errMsg(e)); }
    finally { setBusy(false); }
  }
  const members = (users || []).filter((u) => f.memberIds.includes(u._id));
  return (
    <Modal open={open} onClose={onClose} title={team ? 'Edit team' : 'Create a team'} width={520} footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy} onClick={go}>{busy && <Spinner />}{team ? 'Save' : 'Create'}</button></>}>
      <div className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="flex-1"><Field label="Team name" error={errs.name}><input autoFocus className={`input ${errs.name ? 'err' : ''}`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Web Team" aria-label="Team name" /></Field></div>
          <Field label="Colour"><input type="color" className="h-10 w-14 cursor-pointer rounded border border-[var(--border)] bg-transparent p-1" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} aria-label="Team colour" /></Field>
        </div>
        <Field label="Description"><textarea className="input min-h-[64px]" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What does this team work on?" aria-label="Team description" /></Field>
        <Field label={`Members (${users ? users.filter((u) => f.memberIds.includes(u._id)).length : f.memberIds.length})`} error={errs.memberIds}>
          <input className="input mb-2" placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
          <div className="max-h-52 overflow-y-auto rounded-lg border border-[var(--border)] p-1">
            {!users ? <div className="flex justify-center py-3"><Spinner /></div> : shown.length === 0 ? <div className="py-3 text-center text-[13px] text-faint">No people found</div> : shown.map((u) => (
              <label key={u._id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-[var(--surface-2)]">
                <input type="checkbox" className="accent-[var(--accent)]" checked={f.memberIds.includes(u._id)} onChange={() => toggle(u._id)} aria-label={`Member ${u.name}`} />
                <Avatar user={u} size={22} /><span className="min-w-0 flex-1 truncate text-[13.5px]">{u.name}{u._id === me.id && <span className="ml-1 text-faint">(you)</span>}</span><span className="truncate text-xs text-faint">{u.email}</span>
              </label>))}
          </div>
        </Field>
        <Field label={`Projects (${f.projectIds.length})`} error={errs.projectIds} hint="Projects this team works on. A team can work on several projects.">
          <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--border)] p-1">
            {!projects ? <div className="flex justify-center py-3"><Spinner /></div> : projects.length === 0 ? <div className="py-3 text-center text-[13px] text-faint">No projects</div> : projects.map((p) => (
              <label key={p._id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-[var(--surface-2)]">
                <input type="checkbox" className="accent-[var(--accent)]" checked={f.projectIds.includes(p._id)} onChange={() => setF((x) => ({ ...x, projectIds: x.projectIds.includes(p._id) ? x.projectIds.filter((id) => id !== p._id) : [...x.projectIds, p._id] }))} aria-label={`Project ${p.name}`} />
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.color || 'var(--accent)' }} /><span className="min-w-0 flex-1 truncate text-[13.5px]">{p.name}</span><span className="key text-xs text-faint">{p.key}</span>
              </label>))}
          </div>
        </Field>
        <Field label="Team lead" error={errs.leadId} hint={members.length ? 'The lead is picked from the members ticked above.' : 'Tick members above first — the lead is chosen from them.'}><Select value={members.some((u) => u._id === f.leadId) ? f.leadId : ''} onChange={(v) => setF({ ...f, leadId: v })} options={[{ value: '', label: 'No lead' }, ...members.map((u) => ({ value: u._id, label: u.name }))]} aria-label="Team lead" /></Field>
      </div>
    </Modal>
  );
}
