'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api, errMsg, toast, useApi, ApiError } from '@/lib/api';
import { Avatar, Card, Field, Modal, PageHeader, Select, Skeleton, Spinner, Tabs, relTime } from '@/components/ui';
import { useMe } from '@/components/UserContext';
import { Forbidden, AuditTab } from '@/components/AdminShared';

const ROLES = [{ value: 'org_admin', label: 'Org Admin' }, { value: 'member', label: 'Member' }, { value: 'guest', label: 'Guest' }];

export default function OrgAdmin() {
  const me = useMe(); const [tab, setTab] = useState<'members' | 'audit'>('members');
  if (me.role !== 'org_admin') return <Forbidden />;
  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader title={me.orgName || 'Organization'} subtitle="Members, roles and audit trail" />
      <div className="mb-5"><Tabs id="orgtabs" value={tab} onChange={setTab} tabs={[{ id: 'members', label: 'Members' }, { id: 'audit', label: 'Audit log' }]} /></div>
      {tab === 'members' ? <Members /> : <AuditTab scope="org" />}
    </div>
  );
}

function Members() {
  const me = useMe(); const { data, reload } = useApi<any[]>('/api/admin/org/members'); const [open, setOpen] = useState(false); const [created, setCreated] = useState<any>(null);
  async function patch(id: string, body: any) { try { await api(`/api/admin/org/members/${id}`, { method: 'PATCH', body }); reload(); toast.success('Member updated'); } catch (e) { toast.error(errMsg(e)); reload(); } }
  return (
    <div>
      <div className="mb-4 flex justify-end"><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Invite member</button></div>
      <Card className="overflow-x-auto"><table className="w-full min-w-[760px] text-[13.5px]"><thead className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-muted"><tr><th className="p-4">Member</th><th>Role</th><th>Projects</th><th>Last active</th><th>Status</th><th className="pr-4 text-right" /></tr></thead>
        <tbody>{!data ? <tr><td colSpan={6} className="p-6"><Skeleton className="h-20" /></td></tr> : data.map((u) => <tr key={u._id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"><td className="p-3"><div className="flex items-center gap-2.5"><Avatar user={u} size={32} /><div><div className="font-medium">{u.name}{u._id === me.id && <span className="chip ml-2">you</span>}</div><div className="text-xs text-faint">{u.email}</div></div></div></td>
          <td><Select aria-label={`Role for ${u.name}`} className="!h-8 !w-32" value={u.role} onChange={(v) => patch(u._id, { role: v })} options={ROLES} disabled={u.platformRole === 'super_admin'} /></td>
          <td><div className="flex flex-wrap gap-1">{u.projects.slice(0, 4).map((p: string) => <span key={p} className="chip key">{p}</span>)}{u.projects.length > 4 && <span className="chip">+{u.projects.length - 4}</span>}</div></td><td className="text-xs text-muted">{u.lastLoginAt ? relTime(u.lastLoginAt) : 'never'}</td><td><span className={`chip capitalize ${u.status === 'active' ? '!text-success' : '!text-danger'}`}>{u.status}</span></td>
          <td className="pr-3 text-right"><button className="btn btn-sm" disabled={u._id === me.id} onClick={() => patch(u._id, { status: u.status === 'active' ? 'deactivated' : 'active' })}>{u.status === 'active' ? 'Deactivate' : 'Reactivate'}</button></td></tr>)}</tbody></table></Card>
      <Invite open={open} onClose={() => setOpen(false)} onDone={(r) => { setOpen(false); setCreated(r); reload(); }} />
      <Modal open={!!created} onClose={() => setCreated(null)} title="Member invited" width={460} footer={<button className="btn btn-primary" onClick={() => setCreated(null)}>Done</button>}><p className="mb-3 text-[13.5px] text-muted">Share this temporary password securely — it is shown only once.</p><div className="rounded-xl border border-[var(--border)] p-3 font-mono text-accent2">{created?.temporaryPassword}</div></Modal>
    </div>
  );
}

function Invite({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (r: any) => void }) {
  const [f, setF] = useState({ name: '', email: '', role: 'member', title: '' }); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  async function go() { setBusy(true); setErrs({}); try { onDone(await api('/api/admin/org/members', { body: f })); setF({ name: '', email: '', role: 'member', title: '' }); } catch (e) { if (e instanceof ApiError && e.fields) setErrs(e.fields); else toast.error(errMsg(e)); } finally { setBusy(false); } }
  return <Modal open={open} onClose={onClose} title="Invite member" width={480} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={go}>{busy && <Spinner />}Send invite</button></>}>
    <div className="space-y-4"><Field label="Full name" error={errs.name}><input autoFocus className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Full name" /></Field><Field label="Email" error={errs.email}><input type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-label="Email" /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Role"><Select aria-label="Role" value={f.role} onChange={(v) => setF({ ...f, role: v })} options={ROLES} /></Field><Field label="Job title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Job title" /></Field></div></div></Modal>;
}
