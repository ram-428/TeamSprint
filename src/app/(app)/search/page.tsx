'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlarmClock, Bookmark, Bug, CalendarPlus, ChevronDown, CircleHelp, Filter, Flame, Play, Save, Share2, Trash2, User, UserX, X } from 'lucide-react';
import clsx from 'clsx';
import { api, errMsg, toast, useApi, ApiError } from '@/lib/api';
import { Card, EmptyState, Field, ListSkeleton, Modal, PageHeader, Spinner } from '@/components/ui';
import { IssueTable } from '@/components/issue/IssueTable';
import { IssueDrawer } from '@/components/issue/IssueDrawer';

const DEFAULT = 'assignee = currentUser() AND statusCategory != done ORDER BY priority DESC';
const QUICK = [
  { label: 'My open issues', I: User, q: DEFAULT },
  { label: 'Open bugs', I: Bug, q: 'type = bug AND statusCategory != done ORDER BY priority DESC' },
  { label: 'High priority', I: Flame, q: 'priority >= High AND statusCategory != done ORDER BY priority DESC' },
  { label: 'Created this week', I: CalendarPlus, q: 'created >= -7d ORDER BY created DESC' },
  { label: 'Unassigned', I: UserX, q: 'assignee IS EMPTY AND statusCategory != done' },
  { label: 'Overdue', I: AlarmClock, q: 'due < now() AND statusCategory != done' },
];
const EXAMPLES = ['type = bug AND priority >= High AND statusCategory != done', 'project = ACME AND sprint IN openSprints()', 'status IN ("In Progress", "QA") ORDER BY updated DESC', 'created >= -7d AND assignee IS EMPTY', 'text ~ "payment" ORDER BY created DESC', 'due < now() AND statusCategory != done'];
const FIELDS = ['project', 'status', 'assignee', 'reporter', 'priority', 'type', 'labels', 'sprint', 'created', 'updated', 'due', 'resolved', 'text'];
const OPERATORS = ['=', '!=', '>', '>=', '<', '<=', '~', 'IN', 'IS EMPTY'];
const FUNCTIONS = ['currentUser()', 'now()', 'openSprints()', 'startOfWeek()'];

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
      <PageHeader
        icon={<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white shadow-lg shadow-[var(--accent)]/25"><Filter size={20} /></span>}
        title="Filters" subtitle="Find any issue with OQL, Team Sprint's JQL-style query language" />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5">
          {/* query bar */}
          <div className={clsx('rounded-2xl border bg-[var(--surface-solid)] shadow-[var(--shadow)] transition-all focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_4px_var(--accent-soft)]', err ? 'border-danger/60' : 'border-[var(--border)]')}>
            <div className="flex items-center justify-between px-4 pt-3 text-[11px] font-semibold uppercase tracking-wider text-faint">
              <span>Query</span>
              <span className="hidden normal-case tracking-normal sm:inline"><kbd>Enter</kbd> to run · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line</span>
            </div>
            <textarea aria-label="OQL query" spellCheck={false} rows={2} value={oql} onChange={(e) => setOql(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } }}
              placeholder='project = ACME AND status = "In Progress"'
              className="block w-full resize-none bg-transparent px-4 pb-2 pt-1.5 font-mono text-[14px] leading-relaxed outline-none placeholder:text-faint" />
            {err && <p role="alert" className="px-4 pb-2 text-[13px] text-danger">⚠ {err}</p>}
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-3 py-2.5">
              <button className="btn btn-primary !h-9" onClick={() => run()} disabled={loading}>{loading ? <Spinner /> : <Play size={14} />} Search</button>
              <button className="btn !h-9" onClick={() => setSave(true)} disabled={!oql.trim()}><Save size={14} /> Save filter</button>
              <button className="btn btn-ghost !h-9 ml-auto text-muted" onClick={() => { setOql(''); setErr(''); }} disabled={!oql}><X size={14} /> Clear</button>
            </div>
          </div>

          {/* quick filters */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Quick filters</div>
            <div className="flex flex-wrap gap-2">
              {QUICK.map((f) => {
                const on = applied === f.q;
                return (
                  <button key={f.label} onClick={() => { setOql(f.q); run(f.q); }} aria-pressed={on}
                    className={clsx('inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-all hover:-translate-y-px',
                      on ? 'border-transparent bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/30' : 'border-[var(--border)] bg-[var(--surface)] text-muted hover:border-[var(--accent)] hover:text-text')}>
                    <f.I size={14} />{f.label}
                  </button>
                );
              })}
            </div>
            <details className="group mt-3 text-[13px]">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-muted hover:text-text"><ChevronDown size={14} className="transition-transform group-open:rotate-180" />More examples</summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EXAMPLES.map((e) => <button key={e} onClick={() => { setOql(e); run(e); }} className="chip !h-auto cursor-pointer !py-1 font-mono !font-normal hover:!border-[var(--accent)] hover:text-text">{e.length > 56 ? e.slice(0, 56) + '…' : e}</button>)}
              </div>
            </details>
          </div>

          {/* results */}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[13px]">
              <span className="inline-flex items-center gap-2 font-semibold">
                {res ? <><span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-accent">{res.total}</span> result{res.total === 1 ? '' : 's'}</> : 'Results'}
                {loading && res && <Spinner />}
              </span>
              <span className="key ml-auto max-w-full truncate rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11.5px] text-muted" title={applied}>{applied}</span>
            </div>
            {loading && !res ? <div className="p-4"><ListSkeleton /></div>
              : res && res.items.length === 0 ? <EmptyState title="No issues match" text="Loosen the query or try one of the quick filters." />
              : res ? <IssueTable items={res.items} onOpen={setSel} onChanged={() => run(applied)} canBulk projectName />
              : !err && <div className="p-4"><ListSkeleton /></div>}
          </Card>
        </div>

        {/* saved filters + syntax help */}
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-[14px] font-semibold"><Bookmark size={15} className="text-accent2" /> Saved filters{filters && filters.length > 0 && <span className="chip ml-auto">{filters.length}</span>}</h3>
            {!filters ? <ListSkeleton rows={4} />
              : filters.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--border)] px-3 py-5 text-center text-[13px] text-muted">No saved filters yet.<br /><span className="text-faint">Run a search and click “Save filter”.</span></div>
              : <div className="space-y-2">{filters.map((f) => (
                <div key={f._id} className="group flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-colors hover:border-[var(--accent)]">
                  <button className="min-w-0 flex-1 px-3 py-2.5 text-left" onClick={() => { setOql(f.oql); run(f.oql); }}>
                    <div className="flex items-center gap-1.5 truncate text-[13.5px] font-medium">{f.name}{f.shared && <Share2 size={11} className="shrink-0 text-faint" aria-label="Shared" />}</div>
                    <div className="mt-0.5 truncate font-mono text-[10.5px] text-faint">{f.oql}</div>
                  </button>
                  <button aria-label={`Delete ${f.name}`} className="mr-1.5 rounded-lg p-1.5 text-faint opacity-0 transition hover:text-danger focus:opacity-100 group-hover:opacity-100"
                    onClick={async () => { try { await api(`/api/filters?id=${f._id}`, { method: 'DELETE' }); reloadFilters(); } catch (e) { toast.error(errMsg(e)); } }}><Trash2 size={14} /></button>
                </div>))}</div>}
          </Card>
          <Card className="p-0">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[14px] font-semibold"><CircleHelp size={15} className="text-accent2" /> Syntax help<ChevronDown size={15} className="ml-auto text-faint transition-transform group-open:rotate-180" /></summary>
              <div className="space-y-2.5 border-t border-[var(--border)] px-4 py-3 text-xs leading-relaxed text-muted">
                <div><b className="text-text">Fields</b><div className="mt-1 flex flex-wrap gap-1">{FIELDS.map((x) => <code key={x}>{x}</code>)}</div></div>
                <div><b className="text-text">Operators</b><div className="mt-1 flex flex-wrap gap-1">{OPERATORS.map((x) => <code key={x}>{x}</code>)}</div></div>
                <div><b className="text-text">Functions</b><div className="mt-1 flex flex-wrap gap-1">{FUNCTIONS.map((x) => <code key={x}>{x}</code>)}</div></div>
                <p>Dates like <code>-7d</code> or <code>2025-01-31</code>. Join with <code>AND</code> / <code>OR</code>; sort with <code>ORDER BY field DESC</code>.</p>
              </div>
            </details>
          </Card>
        </aside>
      </div>
      <IssueDrawer issueKey={selected} onClose={() => setSel(null)} />
      <Modal open={save} onClose={() => setSave(false)} title="Save filter" width={440} footer={<><button className="btn" onClick={() => setSave(false)}>Cancel</button><button className="btn btn-primary" disabled={busy || name.trim().length < 2} onClick={saveFilter}>{busy && <Spinner />}Save</button></>}>
        <div className="space-y-4"><Field label="Name"><input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Filter name" /></Field><Field label="Query"><div className="input !h-auto break-all py-2 font-mono text-[12.5px]">{oql}</div></Field>
          <label className="flex cursor-pointer items-center gap-2 text-[13.5px]"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="accent-[var(--accent)]" /> Share with my organization</label></div></Modal>
    </div>
  );
}
export default function SearchPage() { return <Suspense><Search /></Suspense>; }
