'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, UserPlus } from 'lucide-react';
import { api, errMsg, invalidate, toast, useApi } from '@/lib/api';
import { Avatar, Card, ConfirmDialog, Field, Select, Spinner, Tabs } from '@/components/ui';
import { useProject } from '@/components/ProjectContext';
import { useMe } from '@/components/UserContext';
import { ProjectTeamsSettings } from './ProjectTeamsSettings';

const ROLES = [{ value: 'project_admin', label: 'Project Admin' }, { value: 'developer', label: 'Developer' }, { value: 'tester', label: 'Tester' }, { value: 'reporter', label: 'Reporter' }, { value: 'viewer', label: 'Viewer' }];

export default function ProjectSettings({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params); const { project, reload } = useProject(); const ab = project.abilities; const me = useMe(); const router = useRouter();
  const [tab, setTab] = useState<'details' | 'access' | 'teams' | 'board' | 'danger'>('details');
  const [f, setF] = useState({ name: project.name, description: project.description || '', visibility: project.visibility }); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  const [leadDraft, setLeadDraft] = useState<string | null>(null);
  const [del, setDel] = useState(false); const [wip, setWip] = useState<Record<string, string>>({});
  const { data: users } = useApi<any[]>(tab === 'access' ? '/api/users' : null);
  const [addUser, setAddUser] = useState(''); const [addRole, setAddRole] = useState('developer');
  useEffect(() => setWip(Object.fromEntries(project.statuses.map((s: any) => [s.id, String(project.wip?.[s.id] ?? '')]))), [project]);
  const canEdit = ab['project.edit'];
  const leadId = leadDraft ?? project.leadId ?? '';
  const leadOptions = project.members.filter((m: { _id?: string }) => m._id).map((m: { _id: string; name: string }) => ({ value: m._id, label: m.name }));

  async function save(body: any, msg = 'Saved') { setBusy(true); setErrs({}); try { await api(`/api/projects/${key}`, { method: 'PATCH', body }); await reload(); invalidate('/api/projects'); toast.success(msg); return true; } catch (e: any) { setErrs(e.fields || {}); toast.error(errMsg(e)); return false; } finally { setBusy(false); } }
  async function saveDetails() {
    const leadChanged = leadDraft !== null && leadDraft !== project.leadId;
    if (await save({ ...f, ...(leadChanged && { leadId: leadDraft }) })) setLeadDraft(null);
  }
  async function setRole(userId: string, role: string | null) { try { await api(`/api/projects/${key}/members`, { body: { userId, role } }); await reload(); toast.success(role ? 'Role updated' : 'Member removed'); } catch (e) { toast.error(errMsg(e)); } }

  const nonMembers = (users || []).filter((u) => !project.members.some((m: any) => m._id === u._id));
  return (
    <div className="max-w-[900px]">
      <div className="mb-5"><Tabs id="settings-tabs" value={tab} onChange={setTab} tabs={[{ id: 'details', label: 'Details' }, { id: 'access', label: 'Access', count: project.members.length }, { id: 'teams', label: 'Teams' }, ...(project.type !== 'scrum' || true ? [{ id: 'board' as const, label: 'Board & WIP' }] : []), { id: 'danger', label: 'Danger zone' }]} /></div>
      {!canEdit && <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-[13px] text-warning">You have read-only access to these settings.</div>}
      {tab === 'details' && <Card className="space-y-4 p-6">
        <Field label="Name" error={errs.name}><input className="input" disabled={!canEdit} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Name" /></Field>
        <Field label="Key" hint="Keys cannot be changed after creation"><input className="input key" disabled value={project.key} aria-label="Key" /></Field>
        <Field label="Description"><textarea className="input" rows={3} disabled={!canEdit} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} aria-label="Description" /></Field>
        <Field label="Visibility"><Select aria-label="Visibility" disabled={!canEdit} value={f.visibility} onChange={(v) => setF({ ...f, visibility: v })} options={[{ value: 'org', label: 'Everyone in the organization can view' }, { value: 'private', label: 'Private — members only' }]} /></Field>
        <Field label="Project lead" error={errs.leadId}>
          <Select aria-label="Project lead" disabled={!canEdit || busy || !leadOptions.length} value={leadId} onChange={setLeadDraft} options={leadOptions} placeholder={project.lead?.name ?? (project.leadId ? 'Unavailable' : 'Select a project member')} />
        </Field>
        <div className="flex justify-end"><button className="btn btn-primary" disabled={!canEdit || busy} onClick={saveDetails}>{busy && <Spinner />}Save changes</button></div></Card>}
      {tab === 'access' && <Card className="p-6">
        {ab['project.manage_members'] && <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border)] p-4"><div className="min-w-[200px] flex-1"><label className="label">Add member</label><Select aria-label="User to add" value={addUser} onChange={setAddUser} options={[{ value: '', label: 'Select a person…' }, ...nonMembers.map((u) => ({ value: u._id, label: `${u.name} — ${u.title || u.role}` }))]} /></div><div className="w-44"><label className="label">Role</label><Select aria-label="Role" value={addRole} onChange={setAddRole} options={ROLES} /></div><button className="btn btn-primary" disabled={!addUser} onClick={async () => { await setRole(addUser, addRole); setAddUser(''); }}><UserPlus size={15} /> Add</button></div>}
        <div className="divide-y divide-[var(--border)]">{project.members.map((m: any) => (
          <div key={m._id} className="flex items-center gap-3 py-3"><Avatar user={m} size={36} /><div className="min-w-0 flex-1"><div className="font-medium">{m.name} {m._id === me.id && <span className="chip ml-1">you</span>}</div><div className="truncate text-xs text-muted">{m.email}</div></div>
            {ab['project.manage_members'] ? <><Select aria-label={`Role for ${m.name}`} className="!h-9 !w-40" value={m.projectRole} onChange={(v) => setRole(m._id, v)} options={ROLES} /><button aria-label={`Remove ${m.name}`} className="btn btn-ghost btn-sm btn-icon" onClick={() => setRole(m._id, null)}><Trash2 size={14} /></button></> : <span className="chip capitalize">{m.projectRole.replace('_', ' ')}</span>}</div>))}</div>
        <p className="mt-4 text-xs text-faint">Organization admins always have admin access. Everyone else sees the project only if it's visible to the organization or they're a member.</p></Card>}
      {tab === 'teams' && <ProjectTeamsSettings projectId={project._id} projectKey={project.key} canEdit={canEdit && !project.archived} />}
      {tab === 'board' && <Card className="p-6"><h3 className="mb-1 font-semibold">WIP limits</h3><p className="mb-4 text-[13px] text-muted">Columns glow red when they exceed the limit. Leave blank for no limit.</p>
        <div className="grid gap-4 sm:grid-cols-2">{project.statuses.filter((s: any) => s.category !== 'done').map((s: any) => <Field key={s.id} label={s.name}><input type="number" min={0} className="input" disabled={!ab['board.manage']} value={wip[s.id] ?? ''} onChange={(e) => setWip({ ...wip, [s.id]: e.target.value })} aria-label={`WIP limit for ${s.name}`} /></Field>)}</div>
        <div className="mt-5 flex justify-end"><button className="btn btn-primary" disabled={!ab['board.manage'] || busy} onClick={() => save({ wip: Object.fromEntries(Object.entries(wip).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)])) }, 'WIP limits saved')}>Save limits</button></div></Card>}
      {tab === 'danger' && <Card className="border-danger/40 p-6"><h3 className="font-semibold text-danger">Delete this project</h3><p className="mb-4 mt-1 text-[13px] text-muted">The project and all of its issues are hidden for everyone. This can only be reversed by an administrator.</p><button className="btn btn-danger" disabled={!canEdit} onClick={() => setDel(true)}><Trash2 size={15} /> Delete project</button></Card>}
      <ConfirmDialog open={del} onClose={() => setDel(false)} danger typeToConfirm={project.key} title="Delete project" confirmLabel="Delete project" message={<>This will remove <b>{project.name}</b> and all its issues.</>} onConfirm={async () => { try { await api(`/api/projects/${key}`, { method: 'DELETE' }); invalidate('/api/projects'); toast.success('Project deleted'); router.push('/projects'); } catch (e) { toast.error(errMsg(e)); } }} />
    </div>
  );
}
