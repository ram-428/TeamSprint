'use client';

import { useState } from 'react';
import { Crown, Plus, Trash2 } from 'lucide-react';
import { TeamIcon, type TeamLite } from '@/components/TeamPicker';
import { Avatar, Card, ErrorState, Field, Select, Spinner } from '@/components/ui';
import { api, errMsg, invalidate, toast, useApi } from '@/lib/api';

export function ProjectTeamsSettings({ projectId, projectKey, canEdit }: { projectId: string; projectKey: string; canEdit: boolean }) {
  const { data, error, reload } = useApi<TeamLite[]>('/api/teams');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);

  async function setLinked(team: TeamLite, linked: boolean) {
    setBusy(true);
    try {
      await api(`/api/projects/${projectKey}/teams`, { method: 'PATCH', body: { teamId: team._id, linked } });
      if (linked) setSelected('');
      invalidate('/api/teams');
      toast.success(linked ? `${team.name} added to the project` : `${team.name} removed from the project`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState message={errMsg(error)} onRetry={reload} />;
  if (!data) return <Card className="flex justify-center p-6"><Spinner /></Card>;

  const linked = (team: TeamLite) => team.projects.some((p) => p._id === projectId);
  const assigned = data.filter(linked);
  const available = data.filter((t) => !linked(t));
  const selectedTeam = available.find((t) => t._id === selected);

  return (
    <Card className="space-y-5 p-6">
      {canEdit && available.length > 0 && <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Field label="Add team">
            <Select aria-label="Team to add" value={selectedTeam?._id ?? ''} onChange={setSelected} disabled={busy} options={available.map((t) => ({ value: t._id, label: t.name }))} placeholder="Select a team" />
          </Field>
        </div>
        <button type="button" className="btn btn-primary" disabled={!selectedTeam || busy} onClick={() => selectedTeam && setLinked(selectedTeam, true)}><Plus size={15} /> Add team</button>
      </div>}
      {assigned.length === 0 ? <p className="text-sm text-muted">No teams are assigned to this project.</p> : (
        <ul className="divide-y divide-[var(--border)]">
          {assigned.map((team) => {
            const lead = team.members.find((m) => m._id === team.leadId);
            return <li key={team._id} className="space-y-3 py-4 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <TeamIcon color={team.color} />
                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-semibold">{team.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted"><Crown size={13} className="shrink-0 text-warning" />{lead ? `Team lead · ${lead.name}` : 'No team lead'}</div>
                </div>
                {canEdit && <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Remove ${team.name} from project`} title="Remove from project" disabled={busy} onClick={() => setLinked(team, false)}><Trash2 size={15} /></button>}
              </div>
              <div>
                <div className="label">Members ({team.members.length})</div>
                {team.members.length ? <ul className="flex flex-wrap gap-2">
                  {team.members.map((member) => <li key={member._id} className="chip gap-1.5"><span aria-hidden="true" className="inline-flex"><Avatar user={member} size={18} /></span><span>{member.name}</span></li>)}
                </ul> : <p className="text-xs text-muted">No members</p>}
              </div>
            </li>;
          })}
        </ul>
      )}
    </Card>
  );
}
