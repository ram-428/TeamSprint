'use client';
import { use, useMemo, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { useProject } from '@/components/ProjectContext';
import { useApi } from '@/lib/api';
import { Card, EmptyState, ListSkeleton, Select, Tabs } from '@/components/ui';
import { IssueTable } from '@/components/issue/IssueTable';
import { IssueDrawer } from '@/components/issue/IssueDrawer';
import { CreateIssueModal } from '@/components/issue/CreateIssueModal';

export default function ListPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params); const { project, assignees } = useProject(); const ab = project.abilities;
  const router = useRouter(); const path = usePathname(); const sp = useSearchParams(); const selected = sp.get('selected');
  const { data, loading, mutate } = useApi<{ items: any[] }>(`/api/issues?project=${key}`);
  const { data: users } = useApi<any[]>(`/api/users?project=${key}`);
  const { data: masters } = useApi<{ types: { key: string; name: string }[] }>('/api/masters');
  const [q, setQ] = useState(''); const [type, setType] = useState(''); const [cat, setCat] = useState<'all' | 'todo' | 'inprogress' | 'done'>('all'); const [create, setCreate] = useState(false);
  const items = useMemo(() => (data?.items || []).filter((i) => (!q || (i.summary + i.key).toLowerCase().includes(q.toLowerCase())) && (!type || i.type === type) && (cat === 'all' || i.statusCategory === cat) && (!assignees.length || assignees.includes(String(i.assigneeId)))), [data, q, type, cat, assignees]);
  const setSel = (k: string | null) => { const p = new URLSearchParams(sp.toString()); k ? p.set('selected', k) : p.delete('selected'); router.replace(`${path}?${p}`, { scroll: false }); };
  const count = (c: string) => (data?.items || []).filter((i) => i.statusCategory === c).length;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Tabs id="list-cat" value={cat} onChange={setCat} tabs={[{ id: 'all', label: 'All', count: data?.items.length }, { id: 'todo', label: 'To do', count: count('todo') }, { id: 'inprogress', label: 'In progress', count: count('inprogress') }, { id: 'done', label: 'Done', count: count('done') }]} />
        <div className="relative w-full sm:w-auto"><Search size={15} className="absolute left-3 top-[11px] text-faint" /><input aria-label="Search issues" className="input !h-9 !w-full !pl-9 sm:!w-56" placeholder="Search issues" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select aria-label="Type filter" className="!h-9 !w-36" value={type} onChange={setType} options={[{ value: '', label: 'All types' }, ...(masters?.types || []).map((t) => ({ value: t.key, label: t.name }))]} />
        {ab['issue.create'] && <button className="btn btn-primary btn-sm ml-auto" onClick={() => setCreate(true)}><Plus size={15} /> Create issue</button>}
      </div>
      <Card className="overflow-hidden">
        {loading ? <div className="p-4"><ListSkeleton /></div> : items.length === 0 ? <EmptyState title="No matching issues" text="Adjust the filters or create a new issue." /> : <IssueTable items={items} onOpen={setSel} statuses={project.statuses} users={users} canBulk={ab['issue.edit_any']} onChanged={() => mutate()} />}
      </Card>
      <IssueDrawer issueKey={selected} onClose={() => setSel(null)} />
      <CreateIssueModal open={create} onClose={() => setCreate(false)} projectKey={key} onCreated={() => mutate()} />
    </div>
  );
}
