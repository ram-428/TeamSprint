'use client';
import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, UserCheck, UserX } from 'lucide-react';
import { api, errMsg, toast, useApi, ApiError } from '@/lib/api';
import { Avatar, Card, ConfirmDialog, Field, Modal, PageHeader, Pagination, Select, Skeleton, Spinner, Tabs, relTime } from '@/components/ui';
import { useMe } from '@/components/UserContext';
import { Forbidden, AuditTab } from '@/components/AdminShared';
const ROLES = [{ value: 'member', label: 'Member' }, { value: 'guest', label: 'Guest' }];

export default function OrgAdmin() {
  const me = useMe(); const [tab, setTab] = useState<'members' | 'audit'>('members');
  const isSuper = me.platformRole === 'super_admin';
  if (me.role !== 'org_admin' && !isSuper) return <Forbidden />;
  // Always the organization chosen in the top bar (a super admin switches it there).
  const orgId = isSuper ? me.orgId || '' : '';
  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader title={me.orgName || 'Organization'} subtitle="Members, roles and audit trail" />
      <div className="mb-5"><Tabs id="orgtabs" value={tab} onChange={setTab} tabs={[{ id: 'members', label: 'Members' }, { id: 'audit', label: 'Audit log' }]} /></div>
      {isSuper && !orgId ? <Forbidden /> : tab === 'members' ? <Members key={orgId} orgId={orgId} /> : <AuditTab key={orgId} scope="org" orgId={orgId} />}
    </div>
  );
}

function Members({ orgId }: { orgId: string }) {
  const me = useMe(); const qs = orgId ? `?orgId=${orgId}` : ''; const { data, reload } = useApi<any[]>(`/api/admin/org/members${qs}`); const [open, setOpen] = useState(false); const [created, setCreated] = useState<any>(null); const [edit, setEdit] = useState<any>(null); const [del, setDel] = useState<any>(null);
  const [q, setQ] = useState(''); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10);
  const filtered = (data || []).filter((u) => !q.trim() || `${u.name} ${u.email} ${u.title || ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize)); const cur = Math.min(page, lastPage); const rows = filtered.slice((cur - 1) * pageSize, cur * pageSize);
  async function patch(id: string, body: any) { try { await api(`/api/admin/org/members/${id}${qs}`, { method: 'PATCH', body }); reload(); toast.success('Member updated'); } catch (e) { toast.error(errMsg(e)); reload(); } }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><input className="input !w-full sm:!w-72" placeholder="Search members…" aria-label="Search members" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Invite member</button></div>
      <Card className="overflow-x-auto"><table className="w-full min-w-[760px] text-[13.5px]"><thead className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-muted"><tr><th className="p-4">Member</th><th>Role</th><th>Projects</th><th>Created</th><th>Last active</th><th>Status</th><th className="pr-4 text-right">Action</th></tr></thead>
        <tbody>{!data ? <tr><td colSpan={7} className="p-6"><Skeleton className="h-20" /></td></tr> : rows.map((u) => <tr key={u._id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"><td className="p-3"><div className="flex items-center gap-2.5"><Avatar user={u} size={32} /><div><div className="font-medium">{u.name}{u._id === me.id && <span className="chip ml-2">you</span>}</div><div className="text-xs text-faint">{u.email}</div></div></div></td>
          <td><Select aria-label={`Role for ${u.name}`} className="!h-8 !w-32" value={u.role} onChange={(v) => patch(u._id, { role: v })} options={u.role === 'org_admin' ? [{ value: 'org_admin', label: 'Org Admin' }] : ROLES} disabled={u.platformRole === 'super_admin' || u.role === 'org_admin'} /></td>
          <td><div className="flex flex-wrap gap-1">{u.projects.slice(0, 4).map((p: string) => <span key={p} className="chip key">{p}</span>)}{u.projects.length > 4 && <span className="chip">+{u.projects.length - 4}</span>}</div></td><td className="whitespace-nowrap text-xs text-muted">{u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td><td className="text-xs text-muted">{u.lastLoginAt ? relTime(u.lastLoginAt) : 'never'}</td><td><span className={`chip capitalize ${u.status === 'active' ? '!text-success' : '!text-danger'}`}>{u.status}</span></td>
          <td className="pr-3 text-right"><div className="flex items-center justify-end gap-1.5"><button className="btn btn-sm gap-1.5" title={u.status === 'active' ? 'Deactivate' : 'Reactivate'} aria-label={u.status === 'active' ? 'Deactivate' : 'Reactivate'} disabled={u._id === me.id} onClick={() => patch(u._id, { status: u.status === 'active' ? 'deactivated' : 'active' })}>{u.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}</button><button className="btn btn-sm gap-1.5" title="Edit" aria-label="Edit" disabled={u.platformRole === 'super_admin'} onClick={() => setEdit(u)}><Pencil size={14} /></button><button className="btn btn-sm !text-danger gap-1.5" title="Delete" aria-label="Delete" disabled={u._id === me.id || u.platformRole === 'super_admin'} onClick={() => setDel(u)}><Trash2 size={14} /></button></div></td></tr>)}{data && rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted">No members found</td></tr>}</tbody></table>{data && <Pagination page={cur} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />}</Card>
      <EditMember qs={qs} m={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title="Delete member" confirmLabel="Delete member" message={<>Permanently delete <b>{del?.name}</b> ({del?.email})? Their issues become unassigned and they are removed from all projects.</>} onConfirm={async () => { try { await api(`/api/admin/org/members/${del._id}${qs}`, { method: 'DELETE' }); toast.success('Member deleted'); setDel(null); reload(); } catch (e) { toast.error(errMsg(e)); } }} />
      <Invite qs={qs} open={open} onClose={() => setOpen(false)} onDone={(r) => { setOpen(false); setCreated(r); reload(); }} />
      <Modal open={!!created} onClose={() => setCreated(null)} title="Member invited" width={460} footer={<button className="btn btn-primary" onClick={() => setCreated(null)}>Done</button>}><p className="mb-3 text-[13.5px] text-muted">{created?.emailed ? 'We emailed this one-time password to the new member. It is also shown here once.' : 'The email could not be sent. Share this temporary password securely — it is shown only once.'}</p><div className="rounded-xl border border-[var(--border)] p-3 font-mono text-accent2">{created?.temporaryPassword}</div></Modal>
    </div>
  );
}

function EditMember({ qs, m, onClose, onSaved }: { qs: string; m: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: '', email: '', title: '', role: 'member' }); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => { if (m) { setF({ name: m.name, email: m.email, title: m.title || '', role: m.role }); setErrs({}); } }, [m]);
  async function go() { setBusy(true); setErrs({}); try { await api(`/api/admin/org/members/${m._id}${qs}`, { method: 'PATCH', body: f }); toast.success('Member updated'); onSaved(); } catch (e) { if (e instanceof ApiError && e.fields) setErrs(e.fields); else toast.error(errMsg(e)); } finally { setBusy(false); } }
  return <Modal open={!!m} onClose={onClose} title="Edit member" width={480} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={go}>{busy && <Spinner />}Save</button></>}>
    <div className="space-y-4"><Field label="Full name" error={errs.name}><input autoFocus className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Full name" /></Field><Field label="Email" error={errs.email}><input type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-label="Email" /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Role"><Select aria-label="Role" value={f.role} onChange={(v) => setF({ ...f, role: v })} options={ROLES} /></Field><Field label="Job title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Job title" /></Field></div></div></Modal>;
}

function Invite({ qs, open, onClose, onDone }: { qs: string; open: boolean; onClose: () => void; onDone: (r: any) => void }) {
  const [f, setF] = useState({ name: '', email: '', role: 'member', title: '' }); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  async function go() { setBusy(true); setErrs({}); try { onDone(await api(`/api/admin/org/members${qs}`, { body: f })); setF({ name: '', email: '', role: 'member', title: '' }); } catch (e) { if (e instanceof ApiError && e.fields) setErrs(e.fields); else toast.error(errMsg(e)); } finally { setBusy(false); } }
  return <Modal open={open} onClose={onClose} title="Invite member" width={480} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={go}>{busy && <Spinner />}Send invite</button></>}>
    <div className="space-y-4"><Field label="Full name" error={errs.name}><input autoFocus className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Full name" /></Field><Field label="Email" error={errs.email}><input type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-label="Email" /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Role"><Select aria-label="Role" value={f.role} onChange={(v) => setF({ ...f, role: v })} options={ROLES} /></Field><Field label="Job title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Job title" /></Field></div></div></Modal>;
}
