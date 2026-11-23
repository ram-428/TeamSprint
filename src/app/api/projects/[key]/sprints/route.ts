import { z } from 'zod';
import { route } from '@/server/api';
import { Sprint, Issue } from '@/server/models';
import { loadProject, requirePerm } from '@/server/domain';

export const GET = route(async (_req, { user, params }) => {
  const p = await loadProject(user, params.key);
  const sprints = await Sprint.find({ projectId: p._id }).sort({ createdAt: 1 }).lean<any[]>();
  const agg = await Issue.aggregate([
    { $match: { projectId: p._id, sprintId: { $ne: null }, deletedAt: null } },
    { $group: { _id: '$sprintId', count: { $sum: 1 }, points: { $sum: { $ifNull: ['$points', 0] } }, donePoints: { $sum: { $cond: [{ $eq: ['$statusCategory', 'done'] }, { $ifNull: ['$points', 0] }, 0] } } } },
  ]);
  return sprints.map((s) => { const a = agg.find((x) => String(x._id) === String(s._id)); return { ...s, count: a?.count ?? 0, points: a?.points ?? 0, donePoints: a?.donePoints ?? 0 }; });
});

export const POST = route(async (req, { user, params }) => {
  const p = await loadProject(user, params.key);
  requirePerm(user, 'sprint.manage', p);
  const b = z.object({ name: z.string().min(1).optional(), goal: z.string().optional() }).parse(await req.json());
  const n = await Sprint.countDocuments({ projectId: p._id });
  const s = await Sprint.create({ orgId: p.orgId, projectId: p._id, name: b.name || `${p.key} Sprint ${n + 1}`, goal: b.goal, state: 'future' });
  return s;
});
