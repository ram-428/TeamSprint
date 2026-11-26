'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Crown, ListFilter, LogIn, LogOut, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { api, errMsg, invalidate, toast, useApi } from '@/lib/api';
import { AvatarStack, Card, ConfirmDialog, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { useMe } from '@/components/UserContext';
import { TeamFormModal, TeamIcon, memberLine, type TeamLite } from '@/components/TeamPicker';

/** Organization teams: browse, create, edit, join/leave and delete (Jira "Teams"). */
export default function TeamsPage() {
  const me = useMe();
  const { data, reload } = useApi<TeamLite[]>('/api/teams');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<TeamLite | null | undefined>(undefined); // null = new team
  const [del, setDel] = useState<TeamLite | null>(null);
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
                    <div className="min-w-0 flex-1"><h3 className="truncate text-[13.5px] font-semibold leading-tight">{t.name}</h3><div className="truncate text-[11px] text-muted">{memberLine(t)}</div></div>
                    {t.canManage && <div className="-mr-1 -mt-0.5 flex shrink-0"><button className={`${iconBtn} hover:text-[var(--text)]`} aria-label={`Edit ${t.name}`} title="Edit" onClick={() => setEdit(t)}><Pencil size={12} /></button><button className={`${iconBtn} hover:text-danger`} aria-label={`Delete ${t.name}`} title="Delete" onClick={() => setDel(t)}><Trash2 size={12} /></button></div>}
                  </div>
                  <p className="mt-1.5 truncate text-[11.5px] text-muted" title={t.description}>{t.description || ' '}</p>
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
      <TeamFormModal open={edit !== undefined} team={edit} onClose={() => setEdit(undefined)} onSaved={() => { setEdit(undefined); changed(); }} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title="Delete team" confirmLabel="Delete team"
        message={<>Delete <b>{del?.name}</b>? Issues tagged with this team keep everything else; only their Team field is cleared.</>}
        onConfirm={async () => { try { await api(`/api/teams/${del!._id}`, { method: 'DELETE' }); toast.success('Team deleted'); setDel(null); changed(); } catch (e) { toast.error(errMsg(e)); } }} />
    </div>
  );
}
