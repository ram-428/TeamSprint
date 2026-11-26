'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Crown, LogIn, LogOut, Pencil, Plus, Trash2, Users } from 'lucide-react';
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
      {!data ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>
        : shown.length === 0 ? <Card><EmptyState icon={<Users size={28} />} title={data.length ? 'No matching teams' : 'No teams yet'} text={data.length ? undefined : 'Create a team, then pick it in the Team field when you create or edit an issue.'} action={canCreate && !data.length ? <button className="btn btn-primary" onClick={() => setEdit(null)}><Plus size={15} /> Create a team</button> : undefined} /></Card>
        : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((t) => {
              const lead = t.members.find((m) => m._id === t.leadId);
              return (
                <Card key={t._id} className="flex flex-col p-4">
                  <div className="flex items-start gap-3">
                    <TeamIcon color={t.color} size={40} />
                    <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-semibold">{t.name}</div><div className="text-[12.5px] text-muted">{memberLine(t)}</div></div>
                    {t.canManage && <div className="flex gap-1"><button className="btn btn-sm btn-ghost btn-icon" aria-label={`Edit ${t.name}`} title="Edit" onClick={() => setEdit(t)}><Pencil size={14} /></button><button className="btn btn-sm btn-ghost btn-icon !text-danger" aria-label={`Delete ${t.name}`} title="Delete" onClick={() => setDel(t)}><Trash2 size={14} /></button></div>}
                  </div>
                  {t.description && <p className="mt-3 line-clamp-2 text-[13px] text-muted">{t.description}</p>}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                    <div className="flex min-w-0 items-center gap-2">{t.members.length ? <AvatarStack users={t.members} max={5} size={24} /> : <span className="text-xs text-faint">No members</span>}{lead && <span className="flex min-w-0 items-center gap-1 truncate text-xs text-muted" title="Team lead"><Crown size={12} className="shrink-0 text-warning" />{lead.name}</span>}</div>
                    <div className="flex shrink-0 gap-1.5">
                      <Link className="btn btn-sm" href={`/search?oql=${encodeURIComponent(`team = "${t.name}"`)}`}>Issues</Link>
                      {canCreate && (t.includesMe ? <button className="btn btn-sm" onClick={() => join(t, false)}><LogOut size={13} /> Leave</button> : <button className="btn btn-sm" onClick={() => join(t, true)}><LogIn size={13} /> Join</button>)}
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
