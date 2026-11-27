import { route } from '@/server/api';
import { Issue, Sprint, Team, User } from '@/server/models';
import { loadProject } from '@/server/domain';

const day = (d: Date) => d.toISOString().slice(0, 10);

export const GET = route(async (_req, { user, params }) => {
  const p = await loadProject(user, params.key);
  const issues = await Issue.find({ projectId: p._id, deletedAt: null }).lean<any[]>();
  const sprints = await Sprint.find({ projectId: p._id }).sort({ createdAt: 1 }).lean<any[]>();

  // Burndown for the active sprint (ideal vs actual, derived from resolvedAt)
  const active = sprints.find((s) => s.state === 'active') || [...sprints].reverse().find((s) => s.state === 'closed');
  let burndown: any[] = [];
  if (active?.startDate && active?.endDate) {
    const si = issues.filter((i) => String(i.sprintId) === String(active._id) || (active.state === 'closed' && i.resolvedAt && i.resolvedAt >= active.startDate && i.resolvedAt <= active.completedAt));
    const total = si.reduce((a, i) => a + (i.points || 0), 0) || active.committed || 0;
    const days = Math.max(1, Math.round((+active.endDate - +active.startDate) / 864e5));
    const now = Math.min(Date.now(), +active.endDate);
    for (let d = 0; d <= days; d++) {
      const date = new Date(+active.startDate + d * 864e5);
      const doneBy = si.filter((i) => i.statusCategory === 'done' && i.resolvedAt && +i.resolvedAt <= +date + 864e5 - 1).reduce((a, i) => a + (i.points || 0), 0);
      burndown.push({ day: day(date), label: `D${d}`, ideal: Math.round((total - (total / days) * d) * 10) / 10, actual: +date <= now + 864e5 ? total - doneBy : null });
    }
  }
  const velocity = sprints.filter((s) => s.state !== 'future').map((s) => ({ sprint: s.name.replace(/^.*Sprint /, 'S'), committed: s.committed || 0, completed: s.state === 'closed' ? s.completed || 0 : issues.filter((i) => String(i.sprintId) === String(s._id) && i.statusCategory === 'done').reduce((a, i) => a + (i.points || 0), 0), state: s.state }));

  // Created vs resolved (last 30 days)
  const flow = [];
  for (let d = 29; d >= 0; d--) {
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - d);
    const end = new Date(+start + 864e5);
    flow.push({ day: day(start).slice(5), created: issues.filter((i) => i.createdAt >= start && i.createdAt < end).length, resolved: issues.filter((i) => i.resolvedAt && i.resolvedAt >= start && i.resolvedAt < end).length });
  }
  const by = (f: (i: any) => string) => Object.entries(issues.reduce((m: Record<string, number>, i) => { const k = f(i); m[k] = (m[k] || 0) + 1; return m; }, {})).map(([name, value]) => ({ name, value }));
  const statusName = (id: string) => p.statuses.find((s: any) => s.id === id)?.name || id;
  const users = await User.find({ _id: { $in: [...new Set(issues.map((i) => String(i.assigneeId)).filter((x) => x && x !== 'undefined' && x !== 'null'))] } }).select('name color avatarUrl').lean<any[]>();

  // Cumulative flow (weekly-ish, last 30 days) – approximated from created/resolved
  const cfd = flow.map((_, i) => {
    const upTo = new Date(); upTo.setHours(0, 0, 0, 0); upTo.setDate(upTo.getDate() - (29 - i)); const end = new Date(+upTo + 864e5);
    const created = issues.filter((x) => x.createdAt < end);
    const done = created.filter((x) => x.resolvedAt && x.resolvedAt < end).length;
    return { day: day(upTo).slice(5), done, open: created.length - done };
  });

  const resolved = issues.filter((i) => i.resolvedAt);

  // ── Work-item summaries (sprint / epic / team / user). Epics are containers, not work items. ──
  const work = issues.filter((i) => i.type !== 'epic');
  const sum = (list: any[]) => {
    const pts = (l: any[]) => l.reduce((a, i) => a + (i.points || 0), 0);
    const todo = list.filter((i) => i.statusCategory === 'todo'), prog = list.filter((i) => i.statusCategory === 'inprogress'), done = list.filter((i) => i.statusCategory === 'done');
    const points = pts(list), donePoints = pts(done);
    return { total: list.length, todo: todo.length, inProgress: prog.length, done: done.length, points, donePoints, pct: list.length ? Math.round((points ? donePoints / points : done.length / list.length) * 100) : 0 };
  };
  const sprintSummary = [...sprints].reverse().map((s) => {
    const r = sum(work.filter((i) => String(i.sprintId) === String(s._id)));
    // A completed sprint's unfinished items went back to the backlog, so use the points recorded at start / completion.
    if (s.state === 'closed') { r.points = s.committed || r.points; r.donePoints = s.completed ?? r.donePoints; r.pct = r.points ? Math.round((r.donePoints / r.points) * 100) : 100; }
    return { id: String(s._id), name: s.name, state: s.state, startDate: s.startDate, endDate: s.endDate, ...r };
  });
  const epicSummary = issues.filter((i) => i.type === 'epic').map((e) => ({ id: String(e._id), key: e.key, name: e.summary, status: statusName(e.status), ...sum(work.filter((i) => String(i.epicId) === String(e._id))) }))
    .sort((a, b) => b.total - a.total);
  const teamIds = [...new Set(work.map((i) => i.teamId && String(i.teamId)).filter(Boolean))];
  const teams = await Team.find({ $or: [{ projectIds: p._id }, { _id: { $in: teamIds } }] }).select('name color').lean<any[]>();
  const teamSummary = [...teams.map((t) => ({ id: String(t._id), name: t.name, color: t.color, ...sum(work.filter((i) => String(i.teamId) === String(t._id))) })),
    { id: 'none', name: 'No team', color: undefined, ...sum(work.filter((i) => !i.teamId || !teams.some((t) => String(t._id) === String(i.teamId)))) }]
    .filter((r) => r.total > 0 || r.id !== 'none').sort((a, b) => b.total - a.total);
  const userSummary = [...users.map((u) => ({ id: String(u._id), name: u.name, user: { name: u.name, color: u.color, avatarUrl: u.avatarUrl }, ...sum(work.filter((i) => String(i.assigneeId) === String(u._id))) })),
    { id: 'none', name: 'Unassigned', user: null, ...sum(work.filter((i) => !i.assigneeId)) }]
    .filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  const cycle = resolved.map((i) => (+i.resolvedAt - +i.createdAt) / 864e5).sort((a, b) => a - b);
  const pct = (q: number) => (cycle.length ? Math.round(cycle[Math.min(cycle.length - 1, Math.floor(cycle.length * q))] * 10) / 10 : 0);
  return {
    burndown, activeSprint: active ? { name: active.name, state: active.state, goal: active.goal, endDate: active.endDate } : null,
    velocity, flow, cfd, sprintSummary, epicSummary, teamSummary, userSummary,
    byStatus: by((i) => statusName(i.status)), byType: by((i) => i.type), byPriority: by((i) => i.priority),
    byAssignee: by((i) => users.find((u) => String(u._id) === String(i.assigneeId))?.name || 'Unassigned').sort((a, b) => b.value - a.value).slice(0, 8),
    stats: { total: issues.length, open: issues.filter((i) => i.statusCategory !== 'done').length, done: resolved.length, overdue: issues.filter((i) => i.statusCategory !== 'done' && i.dueDate && i.dueDate < new Date()).length, bugsOpen: issues.filter((i) => i.type === 'bug' && i.statusCategory !== 'done').length, cycleP50: pct(0.5), cycleP90: pct(0.9) },
  };
});
