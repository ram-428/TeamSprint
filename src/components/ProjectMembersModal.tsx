'use client';
import { useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { api, errMsg, toast, useApi } from '@/lib/api';
import { Avatar, Modal, Select, Spinner } from '@/components/ui';
import { useMe } from '@/components/UserContext';

const ROLES = [{ value: 'project_admin', label: 'Project Admin' }, { value: 'developer', label: 'Developer' }, { value: 'tester', label: 'Tester' }, { value: 'reporter', label: 'Reporter' }, { value: 'viewer', label: 'Viewer' }];

/** Lists the members of a project and (for project admins) lets you add, re-role or remove them. */
export function ProjectMembersModal({ open, onClose, project, reload }: { open: boolean; onClose: () => void; project: any; reload: () => Promise<void> | void }) {
  const me = useMe();
  const canManage = !!project.abilities?.['project.manage_members'];
  const { data: users } = useApi<any[]>(open && canManage ? '/api/users' : null);
  const [addUser, setAddUser] = useState('');
  const [addRole, setAddRole] = useState('developer');
  const [busy, setBusy] = useState<string | null>(null);

  async function setRole(userId: string, role: string | null, msg: string) {
    setBusy(userId);
    try { await api(`/api/projects/${project.key}/members`, { body: { userId, role } }); await reload(); toast.success(msg); return true; }
    catch (e) { toast.error(errMsg(e)); return false; }
    finally { setBusy(null); }
  }

  const nonMembers = (users || []).filter((u) => !project.members.some((m: any) => m._id === u._id));

  return (
    <Modal open={open} onClose={onClose} title={`Members · ${project.name}`} width={600}>
      <div className="p-6">
        {canManage && (
          <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border)] p-4">
            <div className="min-w-[200px] flex-1">
              <label className="label">Add member</label>
              <Select aria-label="User to add" value={addUser} onChange={setAddUser}
                placeholder={users ? (nonMembers.length ? 'Select a person…' : 'Everyone is already a member') : 'Loading people…'}
                options={nonMembers.map((u) => ({ value: u._id, label: `${u.name} — ${u.title || u.role}` }))} />
            </div>
            <div className="w-44"><label className="label">Role</label><Select aria-label="Role" value={addRole} onChange={setAddRole} options={ROLES} /></div>
            <button className="btn btn-primary" disabled={!addUser || busy !== null}
              onClick={async () => { if (await setRole(addUser, addRole, 'Member added')) setAddUser(''); }}>
              {busy === addUser ? <Spinner size={14} /> : <UserPlus size={15} />} Add
            </button>
          </div>
        )}
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">{project.members.length} {project.members.length === 1 ? 'member' : 'members'}</div>
        <div className="max-h-[50vh] divide-y divide-[var(--border)] overflow-y-auto">
          {project.members.map((m: any) => (
            <div key={m._id} className="flex items-center gap-3 py-3">
              <Avatar user={m} size={36} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{m.name} {m._id === me.id && <span className="chip ml-1">you</span>}</div>
                <div className="truncate text-xs text-muted">{m.email}</div>
              </div>
              {busy === m._id && <Spinner size={14} />}
              {canManage ? <>
                <Select aria-label={`Role for ${m.name}`} className="!h-9 !w-40" disabled={busy !== null} value={m.projectRole} onChange={(v) => setRole(m._id, v, 'Role updated')} options={ROLES} />
                <button aria-label={`Remove ${m.name}`} disabled={busy !== null} className="btn btn-ghost btn-sm btn-icon" onClick={() => setRole(m._id, null, 'Member removed')}><Trash2 size={14} /></button>
              </> : <span className="chip capitalize">{m.projectRole.replace('_', ' ')}</span>}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
