'use client';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { api, errMsg, invalidate, toast, useApi } from '@/lib/api';
import { Select } from '@/components/ui';

/** Org admins choose which permission scheme a project uses (Jira: Project settings → Permissions). */
export function PermissionSchemePanel({ projectKey, schemeId, orgId, onSaved }: { projectKey: string; schemeId?: string | null; orgId?: string; onSaved: () => void }) {
  const qs = orgId ? `?orgId=${orgId}` : '';
  const { data: schemes } = useApi<any[]>(`/api/admin/org/rbac/schemes${qs}`);
  const def = schemes?.find((s) => s.isDefault);
  const value = schemeId ? String(schemeId) : '';
  async function pick(v: string) {
    try { await api(`/api/projects/${projectKey}`, { method: 'PATCH', body: { permissionSchemeId: v || null } }); invalidate('/api/admin/org/rbac/schemes'); toast.success('Permission scheme updated'); onSaved(); }
    catch (e) { toast.error(errMsg(e)); }
  }
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border)] p-4">
      <div className="min-w-[240px] flex-1">
        <label className="label flex items-center gap-1.5"><ShieldCheck size={14} /> Permission scheme</label>
        <Select aria-label="Permission scheme" value={value} onChange={pick} disabled={!schemes}
          options={[{ value: '', label: `Organization default${def ? ` (${def.name})` : ''}` }, ...(schemes || []).filter((s) => !s.isDefault).map((s) => ({ value: s._id, label: s.name }))]} />
        <p className="mt-1.5 text-xs text-muted">Decides what each project role can do in this project.</p>
      </div>
      <Link href="/admin/permissions" className="btn">Manage schemes</Link>
    </div>
  );
}
