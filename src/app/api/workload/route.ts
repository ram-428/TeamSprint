import { route } from '@/server/api';
import { Issue, User } from '@/server/models';
import { visibleProjectIds } from '@/server/query';

/** Per-person open workload (points + hours) vs weekly capacity. */
export const GET = route(async (_req, { user }) => {
  const pids = await visibleProjectIds(user);
  const users = await User.find({ orgId: user.orgId, status: 'active', role: { $ne: 'guest' } }).select('name color title capacityHours avatarUrl').lean<any[]>();
  const open = await Issue.find({ projectId: { $in: pids }, deletedAt: null, statusCategory: { $ne: 'done' }, assigneeId: { $in: users.map((u) => u._id) } }).select('assigneeId points estimate dueDate priority key summary').lean<any[]>();
  const now = Date.now();
  return users.map((u) => {
    const mine = open.filter((i) => String(i.assigneeId) === String(u._id));
    const hours = mine.reduce((a, i) => a + (i.estimate ? i.estimate / 3600 : (i.points || 2) * 2), 0);
    const weeks = [0, 1, 2, 3].map((w) => {
      const from = now + w * 7 * 864e5, to = from + 7 * 864e5;
      const due = mine.filter((i) => i.dueDate && +i.dueDate >= from && +i.dueDate < to);
      return { week: w, hours: Math.round(due.reduce((a, i) => a + (i.estimate ? i.estimate / 3600 : (i.points || 2) * 2), 0)) };
    });
    return { _id: u._id, name: u.name, color: u.color, title: u.title, capacity: u.capacityHours, openCount: mine.length, points: mine.reduce((a, i) => a + (i.points || 0), 0), hours: Math.round(hours), weeks, load: Math.round((hours / (u.capacityHours * 2)) * 100) };
  }).sort((a, b) => b.load - a.load);
});
