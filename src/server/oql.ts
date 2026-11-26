/**
 * OQL – Team Sprint Query Language (JQL-like).
 *   project = ACME AND assignee = currentUser() AND status IN ("In Progress","QA") AND created >= -7d ORDER BY updated DESC
 * tokenizer → recursive-descent parser → AST → whitelisted Mongo filter (never passes raw user objects to Mongo).
 */
export type Tok = { t: 'str' | 'id' | 'num' | 'op' | 'lp' | 'rp' | 'comma'; v: string };
export type Node =
  | { k: 'and'; l: Node; r: Node }
  | { k: 'or'; l: Node; r: Node }
  | { k: 'not'; e: Node }
  | { k: 'cmp'; field: string; op: string; value: Val[] };
export type Val = { kind: 'str' | 'num' | 'fn'; v: string; args?: string[] };
export type Query = { where: Node | null; order: { field: string; dir: 1 | -1 }[] };

export class OqlError extends Error {}

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== c) { s += src[j++]; }
      if (j >= src.length) throw new OqlError('Unterminated string');
      out.push({ t: 'str', v: s }); i = j + 1; continue;
    }
    if (c === '(') { out.push({ t: 'lp', v: c }); i++; continue; }
    if (c === ')') { out.push({ t: 'rp', v: c }); i++; continue; }
    if (c === ',') { out.push({ t: 'comma', v: c }); i++; continue; }
    const two = src.slice(i, i + 2);
    if (['>=', '<=', '!='].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    if (['=', '>', '<', '~'].includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    const m = /^-?[\w.\-@]+/.exec(src.slice(i));
    if (!m) throw new OqlError(`Unexpected character "${c}"`);
    out.push({ t: /^-?\d+(\.\d+)?$/.test(m[0]) ? 'num' : 'id', v: m[0] }); i += m[0].length;
  }
  return out;
}

export function parse(src: string): Query {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const kw = (w: string) => peek()?.t === 'id' && peek().v.toUpperCase() === w;
  const eat = () => toks[p++];

  const orderIdx = toks.findIndex((t, i) => t.t === 'id' && t.v.toUpperCase() === 'ORDER' && toks[i + 1]?.v.toUpperCase() === 'BY');
  const whereToks = orderIdx >= 0 ? toks.slice(0, orderIdx) : toks.slice();
  const orderToks = orderIdx >= 0 ? toks.slice(orderIdx + 2) : [];
  const all = toks; toks.length = 0; toks.push(...whereToks);
  void all;

  function or(): Node { let l = and(); while (kw('OR')) { eat(); l = { k: 'or', l, r: and() }; } return l; }
  function and(): Node { let l = not(); while (kw('AND')) { eat(); l = { k: 'and', l, r: not() }; } return l; }
  function not(): Node { if (kw('NOT')) { eat(); return { k: 'not', e: not() }; } return atom(); }
  function value(): Val {
    const t = eat();
    if (!t) throw new OqlError('Expected a value');
    if (t.t === 'str') return { kind: 'str', v: t.v };
    if (t.t === 'num') return { kind: 'num', v: t.v };
    if (t.t === 'id') {
      if (peek()?.t === 'lp') {
        eat(); const args: string[] = [];
        while (peek() && peek().t !== 'rp') { const a = eat(); if (a.t !== 'comma') args.push(a.v); }
        if (!peek()) throw new OqlError('Missing ")"');
        eat();
        return { kind: 'fn', v: t.v, args };
      }
      return { kind: 'str', v: t.v };
    }
    throw new OqlError(`Unexpected "${t.v}"`);
  }
  function atom(): Node {
    if (peek()?.t === 'lp') { eat(); const n = or(); if (peek()?.t !== 'rp') throw new OqlError('Missing ")"'); eat(); return n; }
    const f = eat();
    if (!f || f.t !== 'id') throw new OqlError('Expected a field name');
    const field = f.v.toLowerCase();
    const n = peek();
    if (!n) throw new OqlError(`Expected operator after "${f.v}"`);
    if (n.t === 'op') {
      eat();
      return { k: 'cmp', field, op: n.v, value: [value()] };
    }
    if (n.t === 'id') {
      const w = n.v.toUpperCase();
      if (w === 'IS') {
        eat(); let neg = false;
        if (kw('NOT')) { eat(); neg = true; }
        if (!kw('EMPTY')) throw new OqlError('Expected EMPTY');
        eat();
        return { k: 'cmp', field, op: neg ? 'notempty' : 'empty', value: [] };
      }
      if (w === 'IN' || (w === 'NOT' && toks[p + 1]?.v.toUpperCase() === 'IN')) {
        const neg = w === 'NOT'; eat(); if (neg) eat();
        if (peek()?.t !== 'lp') throw new OqlError('Expected "(" after IN');
        eat(); const vals: Val[] = [];
        while (peek() && peek().t !== 'rp') { if (peek().t === 'comma') { eat(); continue; } vals.push(value()); }
        if (!peek()) throw new OqlError('Missing ")"');
        eat();
        return { k: 'cmp', field, op: neg ? 'nin' : 'in', value: vals };
      }
    }
    throw new OqlError(`Unknown operator "${n.v}"`);
  }

  const where = whereToks.length ? or() : null;
  if (p < toks.length) throw new OqlError(`Unexpected "${toks[p].v}"`);

  const order: Query['order'] = [];
  for (let i = 0; i < orderToks.length; i++) {
    const t = orderToks[i];
    if (t.t === 'comma') continue;
    if (t.t !== 'id') throw new OqlError('Bad ORDER BY');
    const d = orderToks[i + 1]?.v.toUpperCase();
    if (d === 'ASC' || d === 'DESC') { order.push({ field: t.v.toLowerCase(), dir: d === 'ASC' ? 1 : -1 }); i++; } else order.push({ field: t.v.toLowerCase(), dir: 1 });
  }
  return { where, order };
}

export type Resolver = {
  userId: string;
  user: (nameOrEmail: string) => Promise<string | null>;
  project: (keyOrName: string) => Promise<string | null>;
  sprint: (name: string) => Promise<string[]>;
  team?: (name: string) => Promise<string | null>;
};

const FIELD: Record<string, string> = {
  status: 'status', priority: 'priority', type: 'type', issuetype: 'type', key: 'key', labels: 'labels', label: 'labels',
  created: 'createdAt', updated: 'updatedAt', due: 'dueDate', duedate: 'dueDate', resolved: 'resolvedAt', points: 'points',
  component: 'components', fixversion: 'fixVersion', summary: 'summary', description: 'description',
};
const DATE_FIELDS = new Set(['createdAt', 'updatedAt', 'dueDate', 'resolvedAt']);
const PRIORITY_ORDER = ['Lowest', 'Low', 'Medium', 'High', 'Highest'];
export const SORT_FIELD: Record<string, string> = { ...FIELD, rank: 'rank', assignee: 'assigneeId', reporter: 'reporterId' };

function relDate(v: string): Date | null {
  const m = /^([+-]?\d+)([dwhm])$/.exec(v);
  if (!m) { const d = new Date(v); return isNaN(+d) ? null : d; }
  const n = +m[1]; const unit = { d: 864e5, w: 6048e5, h: 36e5, m: 6e4 }[m[2] as 'd'];
  return new Date(Date.now() + n * unit);
}
function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function scalar(v: Val, r: Resolver, field: string): Promise<any> {
  if (v.kind === 'fn') {
    const f = v.v.toLowerCase();
    if (f === 'currentuser') return r.userId;
    if (f === 'now') return new Date();
    if (f === 'startofweek') { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
    if (f === 'startofday') { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
    throw new OqlError(`Unknown function ${v.v}()`);
  }
  if (DATE_FIELDS.has(field)) { const d = relDate(v.v); if (!d) throw new OqlError(`Bad date "${v.v}"`); return d; }
  if (v.kind === 'num') return Number(v.v);
  return v.v;
}

export async function compile(q: Query, r: Resolver): Promise<{ filter: Record<string, any>; sort: Record<string, 1 | -1> }> {
  async function walk(n: Node): Promise<Record<string, any>> {
    if (n.k === 'and') return { $and: [await walk(n.l), await walk(n.r)] };
    if (n.k === 'or') return { $or: [await walk(n.l), await walk(n.r)] };
    if (n.k === 'not') return { $nor: [await walk(n.e)] };
    const { field: f, op } = n;
    // text search
    if (f === 'text') {
      const s = String(n.value[0]?.v ?? '');
      const re = new RegExp(escapeRe(s), 'i');
      return { $or: [{ summary: re }, { description: re }, { key: re }] };
    }
    // people & project & sprint need id resolution
    if (['assignee', 'reporter', 'watcher'].includes(f)) {
      const mongoField = f === 'assignee' ? 'assigneeId' : f === 'reporter' ? 'reporterId' : 'watchers';
      if (op === 'empty') return { [mongoField]: null };
      if (op === 'notempty') return { [mongoField]: { $ne: null } };
      const ids: (string | null)[] = [];
      for (const v of n.value) {
        const s = await scalar(v, r, f);
        ids.push(String(s).toLowerCase() === 'unassigned' ? null : /^[a-f0-9]{24}$/.test(String(s)) ? s : await r.user(String(s)));
      }
      const clean = ids.filter((x) => x !== undefined);
      if (op === '=' || op === 'in') return { [mongoField]: { $in: clean.length ? clean : ['000000000000000000000000'] } };
      if (op === '!=' || op === 'nin') return { [mongoField]: { $nin: clean } };
      throw new OqlError(`Operator ${op} not valid for ${f}`);
    }
    if (f === 'project') {
      const ids: string[] = [];
      for (const v of n.value) { const id = await r.project(v.v); if (id) ids.push(id); }
      return op === '!=' || op === 'nin' ? { projectId: { $nin: ids } } : { projectId: { $in: ids.length ? ids : ['000000000000000000000000'] } };
    }
    if (f === 'sprint') {
      if (op === 'empty') return { sprintId: null };
      if (op === 'notempty') return { sprintId: { $ne: null } };
      const ids: string[] = [];
      for (const v of n.value) {
        if (v.kind === 'fn' && v.v.toLowerCase() === 'opensprints') ids.push(...(await r.sprint('__open__')));
        else ids.push(...(await r.sprint(v.v)));
      }
      return op === '!=' || op === 'nin' ? { sprintId: { $nin: ids } } : { sprintId: { $in: ids.length ? ids : ['000000000000000000000000'] } };
    }
    if (f === 'team') {
      if (op === 'empty') return { teamId: null };
      if (op === 'notempty') return { teamId: { $ne: null } };
      const ids: string[] = [];
      for (const v of n.value) { const id = /^[a-f0-9]{24}$/.test(v.v) ? v.v : await r.team?.(v.v); if (id) ids.push(id); }
      return op === '!=' || op === 'nin' ? { teamId: { $nin: ids } } : { teamId: { $in: ids.length ? ids : ['000000000000000000000000'] } };
    }
    if (f === 'statuscategory') {
      const m: Record<string, string> = { todo: 'todo', 'to do': 'todo', inprogress: 'inprogress', 'in progress': 'inprogress', done: 'done' };
      const vals = n.value.map((v) => m[v.v.toLowerCase()] ?? v.v);
      return op === '!=' || op === 'nin' ? { statusCategory: { $nin: vals } } : { statusCategory: { $in: vals } };
    }
    const mf = FIELD[f];
    if (!mf) throw new OqlError(`Unknown field "${f}"`);
    if (op === 'empty') return { $or: [{ [mf]: null }, { [mf]: [] }, { [mf]: '' }] };
    if (op === 'notempty') return { [mf]: { $nin: [null, '', []] } };
    const vals: any[] = [];
    for (const v of n.value) vals.push(await scalar(v, r, mf));
    const ciEq = (x: any) => (typeof x === 'string' && !DATE_FIELDS.has(mf) && !['key'].includes(mf) ? new RegExp(`^${escapeRe(x)}$`, 'i') : x);
    if (mf === 'priority' && ['>', '>=', '<', '<='].includes(op)) {
      const idx = PRIORITY_ORDER.findIndex((p) => p.toLowerCase() === String(vals[0]).toLowerCase());
      if (idx < 0) throw new OqlError(`Unknown priority "${vals[0]}"`);
      const sel = PRIORITY_ORDER.filter((_, i) => (op === '>' ? i > idx : op === '>=' ? i >= idx : op === '<' ? i < idx : i <= idx));
      return { priority: { $in: sel } };
    }
    switch (op) {
      case '=': return { [mf]: Array.isArray(ciEq(vals[0])) ? vals[0] : ciEq(vals[0]) };
      case '!=': return { [mf]: { $ne: vals[0] } };
      case '>': return { [mf]: { $gt: vals[0] } };
      case '>=': return { [mf]: { $gte: vals[0] } };
      case '<': return { [mf]: { $lt: vals[0] } };
      case '<=': return { [mf]: { $lte: vals[0] } };
      case '~': return { [mf]: new RegExp(escapeRe(String(vals[0])), 'i') };
      case 'in': return { [mf]: { $in: vals.map(ciEq) } };
      case 'nin': return { [mf]: { $nin: vals.map(ciEq) } };
    }
    throw new OqlError(`Unsupported operator ${op}`);
  }
  const filter = q.where ? await walk(q.where) : {};
  const sort: Record<string, 1 | -1> = {};
  for (const o of q.order) { const mf = SORT_FIELD[o.field]; if (!mf) throw new OqlError(`Cannot sort by "${o.field}"`); sort[mf] = o.dir; }
  return { filter, sort };
}
