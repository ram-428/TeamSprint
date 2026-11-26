'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Crown, Eye, ListFilter, LogIn, LogOut, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { api, errMsg, invalidate, toast, useApi } from '@/lib/api';
import { Avatar, AvatarStack, Card, ConfirmDialog, EmptyState, Modal, PageHeader, Skeleton } from '@/components/ui';
import { useMe } from '@/components/UserContext';
import { TeamFormModal, TeamIcon, memberLine, type TeamLite } from '@/components/TeamPicker';

/** Organization teams: browse, create, edit, join/leave and delete (Jira "Teams"). */
export default function TeamsPage() {
  const me = useMe();
  const { data, reload } = useApi<TeamLite[]>('/api/teams');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<TeamLite | null | undefined>(undefined); // null = new team
  const [del, setDel] = useState<TeamLite | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const viewing = (data || []).find((t) => t._id === viewId) || null; // read from live data so it refreshes after edit/join
  const canCreate = me.role !== 'guest';
  const shown = (data || []).filter((t) => !q.trim() || `${t.name} ${t.description || ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const changed = () => { reload(); invalidate('/api/teams'); invalidate('/api/issues'); };

  async function join(t: TeamLite, yes: boolean) {
    try { await api(`/api/teams/${t._id}`, { method: 'PATCH', body: { join: yes } }); toast.success(yes ? `You joined ${t.name}` : `You left ${t.name}`); changed(); } catch (e) { toast.error(errMsg(e)); }
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader title="Teams" subtitle="Group people into teams and tag issues with the team that owns them" actions={canCreate && <button className="btn btn-primary" onClick={() => setEdit(null)}><Plus size={15} /> Create a team</button>} />
      <div className="mb-4"><input className="input !w-full sm:!w-72" placeholder="Search teams…" aria-label="Search teams" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {!data ? <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />)}</div>
        : shown.length === 0 ? <Card><EmptyState icon={<Users size={28} />} title={data.length ? 'No matching teams' : 'No teams yet'} text={data.length ? undefined : 'Create a team, then pick it in the Team field when you create or edit an issue.'} action={canCreate && !data.length ? <button className="btn btn-primary" onClick={() => setEdit(null)}><Plus size={15} /> Create a team</button> : undefined} /></Card>
        : (
          <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {shown.map((t) => {
              const lead = t.members.find((m) => m._id === t.leadId);
              const iconBtn = 'shrink-0 rounded-md p-1 text-faint transition-colors hover:bg-[var(--surface-2)]';
              return (
                <Card key={t._id} className="group flex h-full flex-col p-2.5">
                  {/* icon, name and member count share one row to keep the card compact (same size as project cards) */}
                  <div className="flex items-start gap-2">
                    <TeamIcon color={t.color} size={28} />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setViewId(t._id)} title="View team"><h3 className="truncate text-[13.5px] font-semibold leading-tight hover:text-accent2 hover:underline">{t.name}</h3><div className="truncate text-[11px] text-muted">{memberLine(t)}</div></button>
                    <div className="-mr-1 -mt-0.5 flex shrink-0"><button className={`${iconBtn} hover:text-accent2`} aria-label={`View ${t.name}`} title="View" onClick={() => setViewId(t._id)}><Eye size={12} /></button></div>
                    {t.canManage && <div className="-mr-1 -mt-0.5 flex shrink-0"><button className={`${iconBtn} hover:text-[var(--text)]`} aria-label={`Edit ${t.name}`} title="Edit" onClick={() => setEdit(t)}><Pencil size={12} /></button><button className={`${iconBtn} hover:text-danger`} aria-label={`Delete ${t.name}`} title="Delete" onClick={() => setDel(t)}><Trash2 size={12} /></button></div>}
                  </div>
                  <p className="mt-1.5 truncate text-[11.5px] text-muted" title={t.description}>{t.description || ' '}</p>
                  {/* projects this team works on */}
                  <div className="mt-1.5 flex min-h-[18px] flex-wrap items-center gap-1" title={t.projects.map((p) => p.name).join(', ')}>
                    {t.projects.length ? <>{t.projects.slice(0, 3).map((p) => <Link key={p._id} href={`/projects/${p.key}`} className="chip key !py-0 !text-[10.5px]">{p.key}</Link>)}{t.projects.length > 3 && <span className="chip !py-0 !text-[10.5px]">+{t.projects.length - 3}</span>}</> : <span className="text-[11px] text-faint">No projects</span>}
                  </div>
                  {/* footer: members + lead on the left; issues / join-leave on the right */}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-1.5 text-[11px] text-muted">
                    <div className="flex min-w-0 items-center gap-1.5">{t.members.length ? <AvatarStack users={t.members} max={4} size={16} /> : <span className="text-faint">No members</span>}{lead && <span className="flex min-w-0 items-center gap-0.5 truncate" title="Team lead"><Crown size={10} className="shrink-0 text-warning" /><span className="truncate">{lead.name}</span></span>}</div>
                    <div className="flex shrink-0 items-center">
                      <Link className={`${iconBtn} hover:text-accent2`} href={`/search?oql=${encodeURIComponent(`team = "${t.name}"`)}`} title="View issues" aria-label={`Issues of ${t.name}`}><ListFilter size={13} /></Link>
                      {canCreate && (t.includesMe
                        ? <button className={`${iconBtn} hover:text-danger`} onClick={() => join(t, false)} title="Leave team" aria-label={`Leave ${t.name}`}><LogOut size={13} /></button>
                        : <button className={`${iconBtn} hover:text-accent2`} onClick={() => join(t, true)} title="Join team" aria-label={`Join ${t.name}`}><LogIn size={13} /></button>)}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      <TeamViewModal team={viewing} onClose={() => setViewId(null)} onEdit={(t) => { setViewId(null); setEdit(t); }} />
      <TeamFormModal open={edit !== undefined} team={edit} onClose={() => setEdit(undefined)} onSaved={() => { setEdit(undefined); changed(); }} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title="Delete team" confirmLabel="Delete team"
        message={<>Delete <b>{del?.name}</b>? Issues tagged with this team keep everything else; only their Team field is cleared.</>}
        onConfirm={async () => { try { await api(`/api/teams/${del!._id}`, { method: 'DELETE' }); toast.success('Team deleted'); setDel(null); changed(); } catch (e) { toast.error(errMsg(e)); } }} />
    </div>
  );
}

/** Read-only team details: description, lead, members and the projects the team works on. */
function TeamViewModal({ team, onClose, onEdit }: { team: TeamLite | null; onClose: () => void; onEdit: (t: TeamLite) => void }) {
  const me = useMe();
  const lead = team?.members.find((m) => m._id === team.leadId);
  const members = team ? [...team.members].sort((a, b) => Number(b._id === team.leadId) - Number(a._id === team.leadId) || a.name.localeCompare(b.name)) : [];
  return (
    <Modal open={!!team} onClose={onClose} width={520} scroll
      title={team && <span className="flex min-w-0 items-center gap-2.5"><TeamIcon color={team.color} size={30} /><span className="min-w-0"><span className="block truncate">{team.name}</span><span className="block text-[12px] font-normal text-muted">{memberLine(team)}</span></span></span>}
      footer={team && <>
        <Link className="btn mr-auto" href={`/search?oql=${encodeURIComponent(`team = "${team.name}"`)}`}><ListFilter size={14} /> View issues</Link>
        {team.canManage && <button className="btn" onClick={() => onEdit(team)}><Pencil size={14} /> Edit</button>}
        <button className="btn btn-primary" onClick={onClose}>Close</button>
      </>}>
      {team && (
        <div className="space-y-5 text-[13.5px]">
          <section><div className="label">Description</div><p className={team.description ? 'whitespace-pre-wrap' : 'text-faint'}>{team.description || 'No description'}</p></section>
          <section><div className="label">Team lead</div>{lead ? <div className="flex items-center gap-2"><Avatar user={lead} size={24} /><span>{lead.name}</span><Crown size={13} className="text-warning" /></div> : <span className="text-faint">No lead</span>}</section>
          <section>
            <div className="label">Projects ({team.projects.length})</div>
            {team.projects.length ? <div className="flex flex-wrap gap-1.5">{team.projects.map((p) => (
              <Link key={p._id} href={`/projects/${p.key}`} className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2 py-1 hover:bg-[var(--surface-2)]"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color || 'var(--accent)' }} /><span>{p.name}</span><span className="key text-xs text-faint">{p.key}</span></Link>))}</div>
              : <span className="text-faint">Not assigned to any project</span>}
          </section>
          <section>
            <div className="label">Members ({members.length})</div>
            {members.length ? <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">{members.map((m) => (
              <div key={m._id} className="flex items-center gap-2.5 px-3 py-2"><Avatar user={m} size={24} /><span className="min-w-0 flex-1 truncate">{m.name}{m._id === me.id && <span className="ml-1 text-faint">(you)</span>}</span>{m._id === team.leadId && <span className="chip !text-[11px]"><Crown size={11} className="text-warning" /> Lead</span>}</div>))}</div>
              : <span className="text-faint">No members</span>}
          </section>
        </div>
      )}
    </Modal>
  );
}
