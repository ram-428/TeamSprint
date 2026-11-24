import { route } from '@/server/api';
import { Issue, Project, Sprint, Activity, User, Worklog, Notification } from '@/server/models';
import { hydrate, visibleProjectIds } from '@/server/query';

export const GET = route(async (_req, { user }) => {
  const pids = await visibleProjectIds(user);
  const base = { deletedAt: null, projectId: { $in: pids } };
  const now = new Date();
  const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const [mine, due, overdue, recent, starred, sprints, acts, week, unread] = await Promise.all([
    Issue.find({ ...base, assigneeId: user.id, statusCategory: { $ne: 'done' } }).sort({ priority: 1, dueDate: 1 }).limit(30).lean<any[]>(),
    Issue.countDocuments({ ...base, assigneeId: user.id, statusCategory: { $ne: 'done' }, dueDate: { $gte: now, $lte: new Date(+now + 7 * 864e5) } }),
    Issue.countDocuments({ ...base, assigneeId: user.id, statusCategory: { $ne: 'done' }, dueDate: { $lt: now } }),
    Issue.find({ ...base, $or: [{ reporterId: user.id }, { assigneeId: user.id }] }).sort({ updatedAt: -1 }).limit(6).lean<any[]>(),
    Project.find({ _id: { $in: pids }, starredBy: user.id }).select('key name color').lean<any[]>(),
    Sprint.find({ projectId: { $in: pids }, state: 'active' }).lean<any[]>(),
    Activity.find({ projectId: { $in: pids } }).sort({ createdAt: -1 }).limit(14).lean<any[]>(),
    Worklog.aggregate([{ $match: { userId: new (await import('mongoose')).default.Types.ObjectId(user.id), startedAt: { $gte: weekStart } } }, { $group: { _id: null, s: { $sum: '$seconds' } } }]),
    Notification.countDocuments({ userId: user.id, readAt: null }),
  ]);
  const priorityRank: Record<string, number> = { Highest: 0, High: 1, Medium: 2, Low: 3, Lowest: 4 };
  mine.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
  const [sprintIssues, sprintProjects, actIssues, actors] = await Promise.all([
    sprints.length ? Issue.find({ sprintId: { $in: sprints.map((s) => s._id) }, deletedAt: null }).select('sprintId points statusCategory').lean<any[]>() : [],
    Project.find({ _id: { $in: sprints.map((s) => s.projectId) } }).select('key name color').lean<any[]>(),
    Issue.find({ _id: { $in: acts.map((a) => a.issueId) } }).select('key summary').lean<any[]>(),
    User.find({ _id: { $in: acts.map((a) => a.actorId) } }).select('name color').lean<any[]>(),
  ]);
  const sprintStats = sprints.map((s) => {
    const items = sprintIssues.filter((i) => String(i.sprintId) === String(s._id));
    const total = items.reduce((a, i) => a + (i.points || 0), 0), done = items.filter((i) => i.statusCategory === 'done').reduce((a, i) => a + (i.points || 0), 0);
    const p = sprintProjects.find((x) => String(x._id) === String(s.projectId));
    return { _id: s._id, name: s.name, project: p, total, done, endDate: s.endDate, daysLeft: Math.max(0, Math.ceil((+s.endDate - Date.now()) / 864e5)) };
  });
  return {
    mine: await hydrate(mine), recent: await hydrate(recent), starred, sprints: sprintStats, unread,
    stats: { open: mine.length, due, overdue, weekSeconds: week[0]?.s || 0 },
    activity: acts.map((a) => ({ ...a, issue: actIssues.find((i) => String(i._id) === String(a.issueId)), actor: actors.find((u) => String(u._id) === String(a.actorId)) })),
  };
});
