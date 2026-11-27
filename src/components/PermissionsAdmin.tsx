'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Pencil, Plus, Star, Trash2, User } from 'lucide-react';
import clsx from 'clsx';
import { api, errMsg, invalidate, toast, useApi, ApiError } from '@/lib/api';
import { Card, ConfirmDialog, Field, Modal, Skeleton, Spinner, Tabs } from '@/components/ui';
import { ADMIN_ROLE, PERMISSIONS, type Grant } from '@/lib/permissions';

type Role = { key: string; name: string; description: string; system: boolean; used?: number };
type Scheme = { _id: string; name: string; description?: string; isDefault: boolean; grants: Grant[]; projects: { key: string; name: string; color: string }[] };
type Cell = 'none' | 'all' | 'own';

/** Org-admin screen: project roles and permission schemes (Jira: Project roles + Permission schemes). */
export function PermissionsAdmin({ orgId }: { orgId: string }) {
  const [tab, setTab] = useState<'schemes' | 'roles'>('schemes');
  const qs = orgId ? `?orgId=${orgId}` : '';
  const { data: roles, reload: reloadRoles } = useApi<Role[]>(`/api/admin/org/rbac/roles${qs}`);
  const { data: schemes, reload: reloadSchemes } = useApi<Scheme[]>(`/api/admin/org/rbac/schemes${qs}`);
  return (
    <div>
      <div className="mb-4"><Tabs id="permtabs" value={tab} onChange={setTab} tabs={[{ id: 'schemes', label: 'Permission schemes' }, { id: 'roles', label: 'Project roles' }]} /></div>
      {tab === 'roles' ? <RolesTab roles={roles} qs={qs} reload={() => { reloadRoles(); reloadSchemes(); invalidate('/api/masters'); }} />
        : <SchemesTab schemes={schemes} roles={roles} qs={qs} reload={reloadSchemes} />}
    </div>
  );
}

function RolesTab({ roles, qs, reload }: { roles?: Role[]; qs: string; reload: () => void }) {
  const [edit, setEdit] = useState<Partial<Role> | null>(null); const [del, setDel] = useState<Role | null>(null);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">Each project member holds one role. Permission schemes decide what each role can do.</p>
        <button className="btn btn-primary" onClick={() => setEdit({})}><Plus size={15} /> Add role</button>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-[13.5px]">
          <thead className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-muted"><tr><th className="p-4">Role</th><th>Description</th><th className="text-right">Members</th><th className="pr-4 text-right">Action</th></tr></thead>
          <tbody>
            {!roles ? <tr><td colSpan={4} className="p-6"><Skeleton className="h-20" /></td></tr> : roles.map((r) => (
              <tr key={r.key} className="border-b border-[var(--border)] last:border-0">
                <td className="p-4"><span className="font-medium">{r.name}</span>{r.system && <span className="chip ml-2">built-in</span>}{r.key === ADMIN_ROLE && <span className="chip ml-1 !text-accent">all permissions</span>}</td>
                <td className="text-muted">{r.description || '—'}</td>
                <td className="text-right tabular-nums">{r.used ?? 0}</td>
                <td className="pr-4"><div className="flex justify-end gap-1.5">
                  <button className="btn btn-sm" aria-label={`Edit ${r.name}`} title="Edit" onClick={() => setEdit(r)}><Pencil size={14} /></button>
                  <button className="btn btn-sm !text-danger" aria-label={`Delete ${r.name}`} title={r.system ? 'Built-in roles cannot be deleted' : 'Delete'} disabled={r.system} onClick={() => setDel(r)}><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <RoleModal role={edit} qs={qs} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title="Delete role?" confirmLabel="Delete" message={`“${del?.name}” will be removed from every permission scheme.`}
        onConfirm={async () => { try { await api(`/api/admin/org/rbac/roles/${del!.key}${qs}`, { method: 'DELETE' }); toast.success('Role deleted'); setDel(null); reload(); } catch (e) { toast.error(errMsg(e)); } }} />
    </>
  );
}

function RoleModal({ role, qs, onClose, onSaved }: { role: Partial<Role> | null; qs: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: '', description: '' }); const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (role) { setF({ name: role.name || '', description: role.description || '' }); setErrs({}); } }, [role]);
  const isNew = !role?.key;
  async function go() {
    setBusy(true); setErrs({});
    try { await api(isNew ? `/api/admin/org/rbac/roles${qs}` : `/api/admin/org/rbac/roles/${role!.key}${qs}`, { method: isNew ? 'POST' : 'PATCH', body: f }); toast.success(isNew ? 'Role added' : 'Role saved'); onSaved(); }
    catch (e) { if (e instanceof ApiError && e.fields) setErrs(e.fields); else toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Modal open={!!role} onClose={onClose} title={isNew ? 'Add project role' : 'Edit project role'} width={440} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || f.name.trim().length < 2} onClick={go}>{busy && <Spinner />}{isNew ? 'Add' : 'Save'}</button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <Field label="Name" error={errs.name}><input autoFocus placeholder="e.g. Business Analyst" className={`input ${errs.name ? 'err' : ''}`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Role name" /></Field>
        <Field label="Description" error={errs.description}><input placeholder="What this role does (optional)" className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} aria-label="Role description" /></Field>
      </form>
    </Modal>
  );
}

const cellOf = (grants: Grant[], perm: string, role: string): Cell => {
  const g = grants.filter((x) => x.perm === perm && x.holder === 'role' && x.value === role);
  return g.some((x) => !x.own) ? 'all' : g.some((x) => x.own) ? 'own' : 'none';
};

function SchemesTab({ schemes, roles, qs, reload }: { schemes?: Scheme[]; roles?: Role[]; qs: string; reload: () => void }) {
  const [selId, setSelId] = useState<string | null>(null);
  const sel = schemes?.find((s) => s._id === selId) ?? schemes?.[0];
  const [grants, setGrants] = useState<Grant[]>([]); const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false);
  const [create, setCreate] = useState<{ copyFrom?: string } | null>(null); const [rename, setRename] = useState(false); const [del, setDel] = useState(false);
  useEffect(() => { if (sel) { setGrants(sel.grants || []); setDirty(false); } }, [sel?._id, sel?.grants]); // eslint-disable-line react-hooks/exhaustive-deps
  const cols = useMemo(() => (roles || []).filter((r) => r.key !== ADMIN_ROLE), [roles]);
  const groups = useMemo(() => [...new Set(PERMISSIONS.map((p) => p.group))], []);

  function cycle(perm: string, role: string, ownable?: boolean) {
    const cur = cellOf(grants, perm, role);
    const next: Cell = cur === 'none' ? 'all' : cur === 'all' && ownable ? 'own' : 'none';
    const rest = grants.filter((x) => !(x.perm === perm && x.holder === 'role' && x.value === role));
    setGrants(next === 'none' ? rest : [...rest, { perm, holder: 'role', value: role, ...(next === 'own' && { own: true }) }]); setDirty(true);
  }
  function toggleLead(perm: string) {
    const has = grants.some((x) => x.perm === perm && x.holder === 'lead');
    setGrants(has ? grants.filter((x) => !(x.perm === perm && x.holder === 'lead')) : [...grants, { perm, holder: 'lead' }]); setDirty(true);
  }
  async function patch(body: any, msg: string) {
    if (!sel) return; setBusy(true);
    try { await api(`/api/admin/org/rbac/schemes/${sel._id}${qs}`, { method: 'PATCH', body }); toast.success(msg); setDirty(false); reload(); invalidate('/api/projects'); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  if (!schemes || !roles) return <Skeleton className="h-96" />;
  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <div className="space-y-2">
        <button className="btn btn-primary w-full" onClick={() => setCreate({})}><Plus size={15} /> New scheme</button>
        {schemes.map((s) => (
          <button key={s._id} type="button" onClick={() => setSelId(s._id)} className={clsx('w-full rounded-xl border px-3 py-2.5 text-left transition-colors', sel?._id === s._id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]')}>
            <div className="flex items-center gap-1.5 text-[13.5px] font-medium">{s.isDefault && <Star size={13} className="shrink-0 fill-[#e2b203] text-[#e2b203]" />}<span className="truncate">{s.name}</span></div>
            <div className="mt-0.5 text-xs text-muted">{s.isDefault ? 'Default · ' : ''}{s.projects.length} project{s.projects.length === 1 ? '' : 's'}</div>
          </button>
        ))}
      </div>

      {sel && <Card className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-start gap-3 border-b border-[var(--border)] p-4">
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-2 text-[16px] font-semibold">{sel.name}{sel.isDefault && <span className="chip">Default</span>}</h3>
            <p className="mt-0.5 text-[13px] text-muted">{sel.description || 'No description'}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">{sel.projects.length ? sel.projects.map((p) => <span key={p.key} className="chip"><span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />{p.name}</span>) : <span className="text-faint">Not used by any project</span>}</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button className="btn btn-sm" onClick={() => setRename(true)}><Pencil size={13} /> Edit</button>
            <button className="btn btn-sm" onClick={() => setCreate({ copyFrom: sel._id })}><Copy size={13} /> Copy</button>
            {!sel.isDefault && <button className="btn btn-sm" disabled={busy} onClick={() => patch({ isDefault: true }, `${sel.name} is now the default`)}><Star size={13} /> Make default</button>}
            {!sel.isDefault && <button className="btn btn-sm !text-danger" onClick={() => setDel(true)}><Trash2 size={13} /> Delete</button>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="flex h-5 w-5 items-center justify-center rounded bg-[var(--accent)] text-white"><Check size={12} strokeWidth={3} /></span> Granted</span>
          <span className="inline-flex items-center gap-1.5"><span className="flex h-5 items-center rounded bg-[var(--accent-soft)] px-1 text-[10px] font-semibold text-accent">OWN</span> Only on issues they reported or are assigned</span>
          <span>Click a cell to change it. Administrators always have every permission.</span>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead className="text-xs text-muted"><tr>
              <th className="pb-2 text-left font-semibold">Permission</th>
              <th className="px-1 pb-2 text-center font-semibold">Administrator</th>
              {cols.map((r) => <th key={r.key} className="px-1 pb-2 text-center font-semibold">{r.name}</th>)}
              <th className="px-1 pb-2 text-center font-semibold"><span className="inline-flex items-center gap-1"><User size={12} />Project lead</span></th>
            </tr></thead>
            <tbody>
              {groups.map((grp) => [
                <tr key={grp}><td colSpan={cols.length + 3} className="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-faint">{grp}</td></tr>,
                ...PERMISSIONS.filter((p) => p.group === grp).map((p) => (
                  <tr key={p.key} className="border-t border-[var(--border)]">
                    <td className="py-2 pr-3"><div className="font-medium">{p.label}</div><div className="text-xs text-muted">{p.help}</div></td>
                    <td className="px-1 text-center"><span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[var(--accent)] text-white opacity-50" title="Always granted"><Check size={13} strokeWidth={3} /></span></td>
                    {cols.map((r) => {
                      const c = cellOf(grants, p.key, r.key);
                      return <td key={r.key} className="px-1 text-center">
                        <button type="button" onClick={() => cycle(p.key, r.key, p.ownable)} aria-label={`${p.label} for ${r.name}: ${c === 'all' ? 'granted' : c === 'own' ? 'own issues only' : 'not granted'}`}
                          className={clsx('inline-flex h-6 min-w-6 items-center justify-center rounded border px-0.5 transition-colors', c === 'all' ? 'border-transparent bg-[var(--accent)] text-white' : c === 'own' ? 'border-transparent bg-[var(--accent-soft)] text-[10px] font-semibold text-accent' : 'border-[var(--border-strong)] hover:border-[var(--accent)]')}>
                          {c === 'all' ? <Check size={13} strokeWidth={3} /> : c === 'own' ? 'OWN' : null}
                        </button></td>;
                    })}
                    <td className="px-1 text-center">{(() => { const on = grants.some((x) => x.perm === p.key && x.holder === 'lead'); return (
                      <button type="button" onClick={() => toggleLead(p.key)} aria-label={`${p.label} for project lead: ${on ? 'granted' : 'not granted'}`} className={clsx('inline-flex h-6 w-6 items-center justify-center rounded border transition-colors', on ? 'border-transparent bg-[var(--accent)] text-white' : 'border-[var(--border-strong)] hover:border-[var(--accent)]')}>{on && <Check size={13} strokeWidth={3} />}</button>); })()}</td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
        <div className={clsx('sticky bottom-0 flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-solid)] px-4 py-3', !dirty && 'hidden')}>
          <span className="mr-auto text-[13px] text-muted">Unsaved changes</span>
          <button className="btn" disabled={busy} onClick={() => { setGrants(sel.grants || []); setDirty(false); }}>Discard</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => patch({ grants }, 'Permissions saved')}>{busy && <Spinner />}Save changes</button>
        </div>
      </Card>}

      <SchemeModal open={!!create} copyFrom={create?.copyFrom} copyName={schemes.find((s) => s._id === create?.copyFrom)?.name} qs={qs} onClose={() => setCreate(null)} onSaved={(id) => { setCreate(null); setSelId(id); reload(); }} />
      {sel && <SchemeModal open={rename} scheme={sel} qs={qs} onClose={() => setRename(false)} onSaved={() => { setRename(false); reload(); }} />}
      <ConfirmDialog open={del} onClose={() => setDel(false)} danger title="Delete permission scheme?" confirmLabel="Delete" message={`Projects using “${sel?.name}” will switch to the default scheme.`}
        onConfirm={async () => { try { await api(`/api/admin/org/rbac/schemes/${sel!._id}${qs}`, { method: 'DELETE' }); toast.success('Scheme deleted'); setDel(false); setSelId(null); reload(); } catch (e) { toast.error(errMsg(e)); } }} />
    </div>
  );
}

function SchemeModal({ open, scheme, copyFrom, copyName, qs, onClose, onSaved }: { open: boolean; scheme?: Scheme; copyFrom?: string; copyName?: string; qs: string; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState({ name: '', description: '' }); const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setF(scheme ? { name: scheme.name, description: scheme.description || '' } : { name: copyName ? `Copy of ${copyName}` : '', description: '' }); setErrs({}); } }, [open, scheme, copyName]);
  async function go() {
    setBusy(true); setErrs({});
    try {
      if (scheme) { await api(`/api/admin/org/rbac/schemes/${scheme._id}${qs}`, { method: 'PATCH', body: f }); toast.success('Scheme saved'); onSaved(scheme._id); }
      else { const r = await api<{ _id: string }>(`/api/admin/org/rbac/schemes${qs}`, { body: { ...f, ...(copyFrom && { copyFrom }) } }); toast.success('Scheme created'); onSaved(r._id); }
    } catch (e) { if (e instanceof ApiError && e.fields) setErrs(e.fields); else toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title={scheme ? 'Edit permission scheme' : copyFrom ? 'Copy permission scheme' : 'New permission scheme'} width={460} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || f.name.trim().length < 2} onClick={go}>{busy && <Spinner />}{scheme ? 'Save' : 'Create'}</button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); go(); }}>
        {!scheme && <p className="text-[13px] text-muted">{copyFrom ? `Starts with the same permissions as “${copyName}”.` : 'Starts with the standard permissions; adjust them after creating it.'}</p>}
        <Field label="Name" error={errs.name}><input autoFocus placeholder="e.g. Client projects" className={`input ${errs.name ? 'err' : ''}`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Scheme name" /></Field>
        <Field label="Description" error={errs.description}><input placeholder="When to use this scheme (optional)" className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} aria-label="Scheme description" /></Field>
      </form>
    </Modal>
  );
}
