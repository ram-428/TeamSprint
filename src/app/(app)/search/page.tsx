'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bookmark, Play, Save, Trash2, TerminalSquare } from 'lucide-react';
import { api, errMsg, toast, useApi, ApiError } from '@/lib/api';
import { Card, EmptyState, Field, ListSkeleton, Modal, PageHeader, Spinner } from '@/components/ui';
import { IssueTable } from '@/components/issue/IssueTable';
import { IssueDrawer } from '@/components/issue/IssueDrawer';

const DEFAULT = 'assignee = currentUser() AND statusCategory != done ORDER BY priority DESC';
const EXAMPLES = ['type = bug AND priority >= High AND statusCategory != done', 'project = ACME AND sprint IN openSprints()', 'status IN ("In Progress", "QA") ORDER BY updated DESC', 'created >= -7d AND assignee IS EMPTY', 'text ~ "payment" ORDER BY created DESC', 'due < now() AND statusCategory != done'];

function Search() {
  const router = useRouter(); const sp = useSearchParams(); const selected = sp.get('selected');
  const initial = sp.get('oql') ?? DEFAULT;
  const [oql, setOql] = useState(initial); const [applied, setApplied] = useState(initial);
  const [res, setRes] = useState<{ items: any[]; total: number } | null>(null); const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);
  const { data: filters, reload: reloadFilters } = useApi<any[]>('/api/filters');
  const [save, setSave] = useState(false); const [name, setName] = useState(''); const [shared, setShared] = useState(false); const [busy, setBusy] = useState(false);

  async function run(q = oql) {
    setLoading(true); setErr(''); setApplied(q);
    try { setRes(await api(`/api/issues?oql=${encodeURIComponent(q)}`)); } catch (e) { setErr(errMsg(e)); setRes(null); } finally { setLoading(false); }
  }
  useEffect(() => { run(initial); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const setSel = (k: string | null) => { const p = new URLSearchParams(sp.toString()); k ? p.set('selected', k) : p.delete('selected'); router.replace(`/search?${p}`, { scroll: false }); };

  async function saveFilter() { setBusy(true); try { await api('/api/filters', { body: { name, oql, shared } }); toast.success('Filter saved'); setSave(false); setName(''); reloadFilters(); } catch (e) { toast.error(e instanceof ApiError && e.fields ? Object.values(e.fields)[0] : errMsg(e)); } finally { setBusy(false); } }
  return (
    <div className="mx-auto max-w-[1380px]">
      <PageHeader title="Search & filters" subtitle="Query everything with OQL — Team Sprint's JQL-style language" />
      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap"><TerminalSquare size={18} className="mt-2.5 hidden shrink-0 text-accent2 sm:block" />
              <textarea aria-label="OQL query" spellCheck={false} rows={2} className={`input !font-mono !text-[13.5px] ${err ? 'err' : ''}`} value={oql} onChange={(e) => setOql(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } }} placeholder='project = ACME AND status = "In Progress"' />
              <div className="flex w-full gap-2 sm:w-auto sm:flex-col"><button className="btn btn-primary" onClick={() => run()} disabled={loading}>{loading ? <Spinner /> : <Play size={14} />} Search</button><button className="btn btn-sm" onClick={() => setSave(true)}><Save size={13} /> Save</button></div></div>
            {err && <p role="alert" className="mt-2 text-[13px] text-danger">⚠ {err}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">{EXAMPLES.map((e) => <button key={e} onClick={() => { setOql(e); run(e); }} className="chip !h-auto cursor-pointer !py-1 font-mono !font-normal hover:!border-[var(--accent)] hover:text-text">{e.length > 52 ? e.slice(0, 52) + '…' : e}</button>)}</div>
          </Card>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 text-[13px] text-muted"><span className="shrink-0">{res ? <><b className="text-text">{res.total}</b> result{res.total === 1 ? '' : 's'}</> : 'Results'}</span><span className="key min-w-0 truncate">{applied}</span></div>
            {loading && !res ? <div className="p-4"><ListSkeleton /></div> : res && res.items.length === 0 ? <EmptyState title="No issues match" text="Loosen the query or try one of the examples." /> : res ? <IssueTable items={res.items} onOpen={setSel} onChanged={() => run(applied)} canBulk projectName /> : !err && <div className="p-4"><ListSkeleton /></div>}
          </Card>
        </div>
        <aside><Card className="p-4"><h3 className="mb-3 flex items-center gap-2 text-[14px] font-semibold"><Bookmark size={14} className="text-accent2" /> Saved filters</h3>
          {!filters ? <ListSkeleton rows={4} /> : filters.length === 0 ? <p className="text-[13px] text-muted">No saved filters yet.</p> : <div className="space-y-1">{filters.map((f) => (
            <div key={f._id} className="group flex items-center gap-1 rounded-xl hover:bg-[var(--surface-2)]"><button className="min-w-0 flex-1 px-3 py-2 text-left" onClick={() => { setOql(f.oql); run(f.oql); }}><div className="truncate text-[13.5px] font-medium">{f.name}</div><div className="truncate font-mono text-[10.5px] text-faint">{f.oql}</div></button>
              <button aria-label={`Delete ${f.name}`} className="mr-1 hidden rounded-lg p-1.5 text-faint hover:text-danger group-hover:block" onClick={async () => { try { await api(`/api/filters?id=${f._id}`, { method: 'DELETE' }); reloadFilters(); } catch (e) { toast.error(errMsg(e)); } }}><Trash2 size={13} /></button></div>))}</div>}
          <div className="mt-4 border-t border-[var(--border)] pt-3 text-xs leading-relaxed text-faint"><b className="text-muted">Syntax:</b> fields <code>project status assignee reporter priority type labels sprint created updated due resolved text</code>; operators <code>= != &gt; &gt;= &lt; &lt;= ~ IN IS EMPTY</code>; functions <code>currentUser() now() openSprints() startOfWeek()</code>; dates like <code>-7d</code>.</div></Card></aside>
      </div>
      <IssueDrawer issueKey={selected} onClose={() => setSel(null)} />
      <Modal open={save} onClose={() => setSave(false)} title="Save filter" width={440} footer={<><button className="btn" onClick={() => setSave(false)}>Cancel</button><button className="btn btn-primary" disabled={busy || name.trim().length < 2} onClick={saveFilter}>{busy && <Spinner />}Save</button></>}>
        <div className="space-y-4"><Field label="Name"><input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Filter name" /></Field><Field label="Query"><div className="input !h-auto break-all py-2 font-mono text-[12.5px]">{oql}</div></Field>
          <label className="flex cursor-pointer items-center gap-2 text-[13.5px]"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="accent-[var(--accent)]" /> Share with my organization</label></div></Modal>
    </div>
  );
}
export default function SearchPage() { return <Suspense><Search /></Suspense>; }
