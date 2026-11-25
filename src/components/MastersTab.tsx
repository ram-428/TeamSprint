'use client';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, errMsg, invalidate, toast, useApi, ApiError } from '@/lib/api';
import { Card, ConfirmDialog, Field, Modal, Select, Skeleton, Spinner, Tabs } from '@/components/ui';

type Kind = 'types' | 'statuses';
const CATEGORIES = [{ value: 'todo', label: 'To do' }, { value: 'inprogress', label: 'In progress' }, { value: 'done', label: 'Done' }];
const catLabel = (c: string) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

/** Org-admin screen for the Issue Type and Status masters that drive "Create issue", the board and issue pickers. */
export function MastersTab({ orgId }: { orgId: string }) {
  const [kind, setKind] = useState<Kind>('types');
  const qs = orgId ? `?orgId=${orgId}` : '';
  const base = `/api/admin/org/masters/${kind}`;
  const { data, reload } = useApi<any[]>(`${base}${qs}`);
  const [edit, setEdit] = useState<any>(null); // {} = new
  const [del, setDel] = useState<any>(null);
  const idOf = (i: any) => (kind === 'types' ? i.key : i.id);
  const changed = () => { reload(); invalidate('/api/masters'); invalidate('/api/projects'); };

  async function patch(i: any, body: any) { try { await api(`${base}/${idOf(i)}${qs}`, { method: 'PATCH', body }); changed(); } catch (e) { toast.error(errMsg(e)); changed(); } }
  async function move(idx: number, dir: -1 | 1) {
    if (!data) return; const ids = data.map(idOf); const j = idx + dir; if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    try { await api(`${base}${qs}`, { method: 'PUT', body: { ids } }); changed(); } catch (e) { toast.error(errMsg(e)); }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><Tabs id="mastertabs" value={kind} onChange={setKind} tabs={[{ id: 'types', label: 'Issue types' }, { id: 'statuses', label: 'Statuses' }]} /></div>
        <button className="btn btn-primary" onClick={() => setEdit({})}><Plus size={15} /> {kind === 'types' ? 'Add issue type' : 'Add status'}</button>
      </div>
      <p className="mb-3 text-[13px] text-muted">{kind === 'types' ? 'Issue types offered when creating or editing an issue in any project of this organization.' : 'Statuses used for issues and as board columns, in this order, in every project of this organization.'}</p>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-muted"><tr><th className="p-4">Name</th>{kind === 'statuses' && <th>Category</th>}<th>Issues</th><th>Active</th><th className="pr-4 text-right">Action</th></tr></thead>
          <tbody>
            {!data ? <tr><td colSpan={5} className="p-6"><Skeleton className="h-20" /></td></tr> : data.map((i, idx) => (
              <tr key={idOf(i)} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]">
                <td className="p-3"><div className="flex items-center gap-2.5"><span className="h-3 w-3 shrink-0 rounded-full" style={{ background: i.color }} /><span className={`font-medium ${i.active ? '' : 'text-faint line-through'}`}>{i.name}</span>{i.system && <span className="chip">built-in</span>}</div></td>
                {kind === 'statuses' && <td className="text-muted">{catLabel(i.category)}</td>}
                <td className="text-muted">{i.used}</td>
                <td><label className="inline-flex cursor-pointer items-center" title={i.system ? 'Built-in types are always active — the app relies on them' : i.active ? 'Disable (hide from Create issue)' : 'Enable'}><input type="checkbox" className="accent-[var(--accent)]" checked={i.active} disabled={!!i.system} aria-label={`${i.name} active`} onChange={(e) => patch(i, { active: e.target.checked })} /></label></td>
                <td className="pr-3"><div className="flex items-center justify-end gap-1.5">
                  <button className="btn btn-sm" title="Move up" aria-label="Move up" disabled={idx === 0} onClick={() => move(idx, -1)}><ArrowUp size={14} /></button>
                  <button className="btn btn-sm" title="Move down" aria-label="Move down" disabled={idx === data.length - 1} onClick={() => move(idx, 1)}><ArrowDown size={14} /></button>
                  <button className="btn btn-sm" title="Edit" aria-label="Edit" onClick={() => setEdit(i)}><Pencil size={14} /></button>
                  <button className="btn btn-sm !text-danger" title="Delete" aria-label="Delete" disabled={!!i.system} onClick={() => setDel(i)}><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <MasterForm key={`${kind}-${edit ? idOf(edit) ?? 'new' : 'none'}`} kind={kind} base={base} qs={qs} item={edit} idOf={idOf} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); changed(); }} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title={kind === 'types' ? 'Delete issue type' : 'Delete status'} confirmLabel="Delete"
        message={<>Delete <b>{del?.name}</b>? {del?.used ? `${del.used} issue(s) still use it, so this will be refused.` : 'This cannot be undone.'}</>}
        onConfirm={async () => { try { await api(`${base}/${idOf(del)}${qs}`, { method: 'DELETE' }); toast.success('Deleted'); setDel(null); changed(); } catch (e) { toast.error(errMsg(e)); setDel(null); } }} />
    </div>
  );
}

function MasterForm({ kind, base, qs, item, idOf, onClose, onSaved }: { kind: Kind; base: string; qs: string; item: any; idOf: (i: any) => string; onClose: () => void; onSaved: () => void }) {
  const isNew = !!item && idOf(item) === undefined;
  const [f, setF] = useState({ name: '', color: '#7c5cff', category: 'todo' });
  const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => { if (item) { setErrs({}); setF({ name: item.name ?? '', color: item.color ?? '#7c5cff', category: item.category ?? 'todo' }); } }, [item]);
  async function go() {
    setBusy(true); setErrs({});
    try {
      const body: any = { name: f.name, color: f.color, ...(kind === 'statuses' ? { category: f.category } : {}) };
      if (isNew) await api(`${base}${qs}`, { method: 'POST', body });
      else await api(`${base}/${idOf(item)}${qs}`, { method: 'PATCH', body });
      toast.success(isNew ? 'Added' : 'Saved'); onSaved();
    } catch (e) { if (e instanceof ApiError && e.fields) setErrs(e.fields); else toast.error(errMsg(e)); }
    finally { setBusy(false); }
  }
  const what = kind === 'types' ? 'issue type' : 'status';
  return (
    <Modal open={!!item} onClose={onClose} title={`${isNew ? 'Add' : 'Edit'} ${what}`} width={440} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={go}>{busy && <Spinner />}Save</button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); go(); }} noValidate>
        <Field label="Name" error={errs.name}><input className={`input ${errs.name ? 'err' : ''}`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus aria-label="Name" /></Field>
        {kind === 'statuses' && <Field label="Category" error={errs.category} hint="Decides whether issues in this status count as to do, in progress or done in reports."><Select value={f.category} onChange={(v) => setF({ ...f, category: v })} options={CATEGORIES} aria-label="Category" /></Field>}
        <Field label="Colour" error={errs.color}><input type="color" className="h-9 w-16 cursor-pointer rounded border border-[var(--border)] bg-transparent p-1" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} aria-label="Colour" /></Field>
      </form>
    </Modal>
  );
}
