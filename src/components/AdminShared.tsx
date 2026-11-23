'use client';
import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useApi } from '@/lib/api';
import { Card, EmptyState, Skeleton } from '@/components/ui';

export function Forbidden() {
  return <div className="mx-auto max-w-md py-20 text-center"><div className="float mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-danger/15 text-danger"><ShieldAlert size={36} /></div><h1 className="text-2xl font-semibold">403 — Access denied</h1><p className="mt-2 text-muted">You do not have permission to view this page.</p></div>;
}

export function AuditTab({ scope }: { scope: 'platform' | 'org' }) {
  const [action, setAction] = useState(''); const { data } = useApi<any[]>(`/api/admin/org/audit?${scope === 'platform' ? 'scope=platform&' : ''}action=${encodeURIComponent(action)}`);
  return (
    <div><div className="mb-4 max-w-xs"><input aria-label="Filter by action" className="input" placeholder="Filter by action (e.g. auth, project)" value={action} onChange={(e) => setAction(e.target.value)} /></div>
      <Card className="overflow-x-auto"><table className="w-full min-w-[640px] text-[13.5px]"><thead className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-muted"><tr><th className="p-4">When</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead>
        <tbody>{!data ? <tr><td colSpan={4} className="p-6"><Skeleton className="h-16" /></td></tr> : data.length === 0 ? <tr><td colSpan={4}><EmptyState title="No audit entries" /></td></tr> : data.map((a) => <tr key={a._id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"><td className="whitespace-nowrap p-3 text-xs text-muted">{new Date(a.createdAt).toLocaleString()}</td><td>{a.actor}{a.impersonatedByName && <span className="chip ml-2 !text-warning">via {a.impersonatedByName}</span>}</td><td><span className="chip key">{a.action}</span></td><td className="max-w-[320px] truncate text-muted">{a.target}</td></tr>)}</tbody></table></Card></div>
  );
}
