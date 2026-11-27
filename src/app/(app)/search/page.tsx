'use client';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bookmark, ChevronDown, CircleHelp, Link2, ListFilter, Play, Save, Share2, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import { api, errMsg, toast, useApi, ApiError } from '@/lib/api';
import { Card, EmptyState, Field, ListSkeleton, Modal, Select, Spinner } from '@/components/ui';
import { IssueTable } from '@/components/issue/IssueTable';
import { IssueDrawer } from '@/components/issue/IssueDrawer';
import { BasicFilterBar, buildOql, isEmptyBasic, SORTS, type BasicState } from '@/components/filters/BasicFilters';

/** Jira's "Default filters", expressed as Basic filter states. */
const DEFAULTS: { id: string; label: string; s: BasicState }[] = [
  { id: 'my-open', label: 'My open work items', s: { assignee: ['me'], state: 'open', sort: 'priority DESC' } },
  { id: 'reported', label: 'Reported by me', s: { reporter: ['me'] } },
  { id: 'all', label: 'All work items', s: {} },
  { id: 'open', label: 'Open work items', s: { state: 'open' } },
  { id: 'done', label: 'Done work items', s: { state: 'done' } },
  { id: 'created', label: 'Created recently', s: { created: '-7d', sort: 'created DESC' } },
  { id: 'resolved', label: 'Resolved recently', s: { resolved: '-7d', sort: 'resolved DESC' } },
  { id: 'updated', label: 'Updated recently', s: { updated: '-7d' } },
  { id: 'unassigned', label: 'Unassigned work items', s: { assignee: ['none'], state: 'open' } },
  { id: 'overdue', label: 'Overdue work items', s: { due: 'overdue' } },
];
const EXAMPLES = ['type = bug AND priority >= High AND statusCategory != done', 'project = ACME AND sprint IN openSprints()', 'created >= -7d AND assignee IS EMPTY', 'text ~ "payment" ORDER BY created DESC', 'due < now() AND statusCategory != done'];
const FIELDS = ['project', 'status', 'statusCategory', 'assignee', 'reporter', 'priority', 'type', 'team', 'labels', 'sprint', 'created', 'updated', 'due', 'resolved', 'text'];
const OPERATORS = ['=', '!=', '>', '>=', '<', '<=', '~', 'IN', 'NOT IN', 'IS EMPTY'];
const FUNCTIONS = ['currentUser()', 'now()', 'openSprints()', 'startOfDay()', 'startOfWeek()'];

function parseBasic(raw: string | null): BasicState | null { if (!raw) return null; try { return JSON.parse(raw); } catch { return null; } }

function Search() {
  const router = useRouter(); const sp = useSearchParams(); const selected = sp.get('selected');
  const urlOql = sp.get('oql');
  const [mode, setMode] = useState<'basic' | 'oql'>(urlOql ? 'oql' : 'basic');
  const [basic, setBasic] = useState<BasicState>(() => parseBasic(sp.get('f')) ?? DEFAULTS[0].s);
  const [oql, setOql] = useState(urlOql ?? buildOql(basic));
  const [applied, setApplied] = useState('');
  const [title, setTitle] = useState<string | null>(null);
  const [res, setRes] = useState<{ items: any[]; total: number } | null>(null); const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);
  const { data: filters, reload: reloadFilters } = useApi<any[]>('/api/filters');
  const [save, setSave] = useState(false); const [name, setName] = useState(''); const [shared, setShared] = useState(false); const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  async function run(query: string) {
    const n = ++seq.current; setLoading(true); setErr(''); setApplied(query);
    try { const r = await api<{ items: any[]; total: number }>(`/api/issues?oql=${encodeURIComponent(query)}`); if (n === seq.current) setRes(r); }
    catch (e) { if (n === seq.current) { setErr(errMsg(e)); setRes(null); } }
    finally { if (n === seq.current) setLoading(false); }
  }
  /** Keep the URL shareable: ?f=<basic json> or ?oql=<query>. */
  function syncUrl(next: { f?: BasicState; oql?: string }) {
    const p = new URLSearchParams(); if (selected) p.set('selected', selected);
    if (next.oql !== undefined) p.set('oql', next.oql); else if (next.f) p.set('f', JSON.stringify(next.f));
    router.replace(`/search?${p}`, { scroll: false });
  }

  // Basic mode: every change re-runs the search (debounced so typing in the search box stays smooth).
  const basicOql = useMemo(() => buildOql(basic), [basic]);
  useEffect(() => {
    if (mode !== 'basic') return;
    const t = setTimeout(() => { setOql(basicOql); run(basicOql); syncUrl({ f: basic }); }, basic.text ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basicOql, mode]);
  useEffect(() => { if (mode === 'oql') run(oql); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const activeDefault = mode === 'basic' ? DEFAULTS.find((d) => buildOql(d.s) === basicOql) : undefined;
  const heading = activeDefault?.label ?? title ?? 'Search work items';

  const pickDefault = (s: BasicState) => { setTitle(null); setMode('basic'); setBasic(s); };
  const runOql = (q: string, t: string | null = null) => { setTitle(t); setMode('oql'); setOql(q); run(q); syncUrl({ oql: q }); };
  const switchMode = (m: 'basic' | 'oql') => {
    if (m === mode) return;
    if (m === 'oql') { setOql(basicOql); syncUrl({ oql: basicOql }); setMode('oql'); }
    else { setTitle(null); setMode('basic'); setBasic((b) => ({ ...b })); }
  };
  const setSel = (k: string | null) => { const p = new URLSearchParams(sp.toString()); k ? p.set('selected', k) : p.delete('selected'); router.replace(`/search?${p}`, { scroll: false }); };
  async function copyLink() { try { await navigator.clipboard.writeText(window.location.href); toast.success('Filter link copied'); } catch { toast.error('Could not copy the link'); } }
  async function saveFilter() { setBusy(true); try { await api('/api/filters', { body: { name, oql: applied || oql, shared } }); toast.success('Filter saved'); setSave(false); setTitle(name); setName(''); reloadFilters(); } catch (e) { toast.error(e instanceof ApiError && e.fields ? Object.values(e.fields)[0] : errMsg(e)); } finally { setBusy(false); } }

  const modeToggle = (
    <div className="inline-flex h-8 shrink-0 overflow-hidden rounded-lg border border-[var(--border)]" role="group" aria-label="Search mode">
      {(['basic', 'oql'] as const).map((m) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => switchMode(m)} className={clsx('px-3 text-[13px] font-medium', mode === m ? 'bg-[var(--accent-soft)] text-accent' : 'text-muted hover:bg-[var(--surface-2)]')}>{m === 'basic' ? 'Basic' : 'OQL'}</button>)}
    </div>
  );
  const navBtn = (on: boolean) => clsx('flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13.5px] transition-colors', on ? 'bg-[var(--accent-soft)] font-semibold text-accent' : 'text-muted hover:bg-[var(--surface-2)] hover:text-text');

  return (
    <div className="mx-auto grid max-w-[1600px] gap-5 lg:grid-cols-[230px_1fr]">
      {/* Default + saved filters (Jira's left panel) */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div>
          <div className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint">Default filters</div>
          <nav aria-label="Default filters" className="space-y-0.5">
            {DEFAULTS.map((d) => <button key={d.id} type="button" aria-current={activeDefault?.id === d.id ? 'true' : undefined} className={navBtn(activeDefault?.id === d.id)} onClick={() => pickDefault(d.s)}><ListFilter size={14} className="shrink-0" />{d.label}</button>)}
          </nav>
        </div>
        <div>
          <div className="mb-1 flex items-center px-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint"><Bookmark size={12} className="mr-1.5" />Saved filters{filters && filters.length > 0 && <span className="ml-auto normal-case tracking-normal">{filters.length}</span>}</div>
          {!filters ? <ListSkeleton rows={3} />
            : filters.length === 0 ? <p className="px-2.5 text-[12.5px] text-faint">No saved filters yet. Set up a search and click “Save filter”.</p>
            : <div className="space-y-0.5">{filters.map((f) => (
              <div key={f._id} className="group flex items-center">
                <button type="button" title={f.oql} className={clsx(navBtn(mode === 'oql' && applied === f.oql), 'min-w-0 flex-1')} onClick={() => runOql(f.oql, f.name)}>
                  <ListFilter size={14} className="shrink-0" /><span className="truncate">{f.name}</span>{f.shared && <Share2 size={11} className="shrink-0 text-faint" aria-label="Shared" />}</button>
                <button aria-label={`Delete ${f.name}`} className="rounded-md p-1.5 text-faint opacity-0 transition hover:text-danger focus:opacity-100 group-hover:opacity-100"
                  onClick={async () => { try { await api(`/api/filters?id=${f._id}`, { method: 'DELETE' }); reloadFilters(); } catch (e) { toast.error(errMsg(e)); } }}><Trash2 size={13} /></button>
              </div>))}</div>}
        </div>
      </aside>

      <div className="min-w-0 space-y-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="mr-auto truncate text-[20px] font-semibold">{heading}</h1>
          <button className="btn btn-sm" onClick={copyLink}><Link2 size={14} /> Copy filter</button>
          <button className="btn btn-sm" onClick={() => setSave(true)}><Save size={14} /> Save filter</button>
        </div>

        <div className="flex flex-wrap items-start gap-1.5">
          {mode === 'basic' ? (
            <BasicFilterBar value={basic} onChange={(s) => { setTitle(null); setBasic(s); }} leading={modeToggle}
              trailing={!isEmptyBasic(basic) && <button className="btn btn-ghost !h-8 !px-2 text-[13px] text-accent2" onClick={() => setBasic({ sort: basic.sort })}>Clear filters</button>} />
          ) : (<>{modeToggle}
            <div className={clsx('min-w-0 flex-1 rounded-xl border bg-[var(--surface-solid)] transition-all focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_4px_var(--accent-soft)]', err ? 'border-danger/60' : 'border-[var(--border)]')}>
              <textarea aria-label="OQL query" spellCheck={false} rows={2} value={oql} onChange={(e) => setOql(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runOql(oql, title); } }}
                placeholder='project = ACME AND status = "progress" ORDER BY updated DESC'
                className="block w-full resize-none bg-transparent px-3.5 pb-1 pt-2 font-mono text-[13.5px] leading-relaxed outline-none placeholder:text-faint" />
              {err && <p role="alert" className="px-3.5 pb-1.5 text-[13px] text-danger">⚠ {err}</p>}
              <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-2.5 py-2">
                <button className="btn btn-primary btn-sm" onClick={() => runOql(oql, title)} disabled={loading}>{loading ? <Spinner /> : <Play size={13} />} Search</button>
                <span className="hidden text-[12px] text-faint sm:inline"><kbd>Enter</kbd> to run · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line</span>
                <button className="btn btn-ghost btn-sm ml-auto text-muted" onClick={() => { setOql(''); setErr(''); }} disabled={!oql}><X size={13} /> Clear</button>
              </div>
            </div>
          </>)}
        </div>

        {mode === 'oql' && (
          <details className="group text-[13px]">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-muted hover:text-text"><CircleHelp size={14} /> Syntax help & examples<ChevronDown size={14} className="transition-transform group-open:rotate-180" /></summary>
            <div className="mt-2 space-y-2 rounded-xl border border-[var(--border)] p-3 text-xs leading-relaxed text-muted">
              <div><b className="text-text">Fields</b> <span className="ml-1 inline-flex flex-wrap gap-1">{FIELDS.map((x) => <code key={x}>{x}</code>)}</span></div>
              <div><b className="text-text">Operators</b> <span className="ml-1 inline-flex flex-wrap gap-1">{OPERATORS.map((x) => <code key={x}>{x}</code>)}</span></div>
              <div><b className="text-text">Functions</b> <span className="ml-1 inline-flex flex-wrap gap-1">{FUNCTIONS.map((x) => <code key={x}>{x}</code>)}</span></div>
              <p>Dates like <code>-7d</code> or <code>2025-01-31</code>. Join with <code>AND</code> / <code>OR</code>; sort with <code>ORDER BY field DESC</code>.</p>
              <div className="flex flex-wrap gap-1.5">{EXAMPLES.map((e) => <button key={e} onClick={() => runOql(e)} className="chip !h-auto cursor-pointer !py-1 font-mono !font-normal hover:!border-[var(--accent)] hover:text-text">{e}</button>)}</div>
            </div>
          </details>
        )}

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[13px]">
            <span className="inline-flex items-center gap-2 font-semibold">
              {res ? <><span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-accent">{res.total}</span> work item{res.total === 1 ? '' : 's'}</> : 'Results'}
              {loading && res && <Spinner />}
            </span>
            {res && res.total > res.items.length && <span className="text-muted">showing first {res.items.length}</span>}
            {mode === 'basic' && <Select aria-label="Sort by" className="!h-8 !w-40 text-[13px]" value={basic.sort || 'updated DESC'} onChange={(v) => setBasic({ ...basic, sort: v })} options={SORTS} />}
            <span className="key ml-auto max-w-full truncate rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11.5px] text-muted" title={applied}>{applied}</span>
          </div>
          {err && mode === 'basic' ? <p role="alert" className="p-4 text-[13px] text-danger">⚠ {err}</p>
            : loading && !res ? <div className="p-4"><ListSkeleton /></div>
            : res && res.items.length === 0 ? <EmptyState title="No work items match" text="Change or clear the filters to see more." />
            : res ? <IssueTable items={res.items} onOpen={setSel} onChanged={() => run(applied)} canBulk projectName />
            : !err && <div className="p-4"><ListSkeleton /></div>}
        </Card>
      </div>

      <IssueDrawer issueKey={selected} onClose={() => setSel(null)} />
      <Modal open={save} onClose={() => setSave(false)} title="Save filter" width={440} footer={<><button className="btn" onClick={() => setSave(false)}>Cancel</button><button className="btn btn-primary" disabled={busy || name.trim().length < 2} onClick={saveFilter}>{busy && <Spinner />}Save</button></>}>
        <div className="space-y-4"><Field label="Name"><input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Filter name" /></Field><Field label="Query"><div className="input !h-auto break-all py-2 font-mono text-[12.5px]">{applied || oql}</div></Field>
          <label className="flex cursor-pointer items-center gap-2 text-[13.5px]"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="accent-[var(--accent)]" /> Share with my organization</label></div></Modal>
    </div>
  );
}
export default function SearchPage() { return <Suspense><Search /></Suspense>; }
