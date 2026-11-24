import { z } from 'zod';
import { route, AppError, notFound, notify, audit, oid } from '@/server/api';
import { Sprint, Issue, Project } from '@/server/models';
import { requirePerm, sprintSnapshot } from '@/server/domain';
import { can } from '@/server/rbac';

async function load(user: any, id: string) {
  const s = await Sprint.findById(oid(id));
  if (!s) throw notFound();
  const p = await Project.findById(s.projectId).lean<any>();
  if (!p || !can(user, 'project.view', p)) throw notFound();
  return { s, p };
}

const schema = z.object({
  action: z.enum(['start', 'complete', 'update', 'delete']),
  name: z.string().optional(), goal: z.string().optional(), startDate: z.string().optional(), endDate: z.string().optional(),
  moveTo: z.string().optional(), // 'backlog' | sprint id for incomplete issues
  retro: z.object({ wentWell: z.array(z.string()), improve: z.array(z.string()), actions: z.array(z.string()) }).optional(),
});

export const PATCH = route(async (req, { user, params }) => {
  const { s, p } = await load(user, params.id);
  requirePerm(user, 'sprint.manage', p);
  const b = schema.parse(await req.json());

  if (b.action === 'update') {
    if (b.name) s.name = b.name;
    if (b.goal !== undefined) s.goal = b.goal;
    if (b.retro) s.retro = b.retro;
    await s.save();
    return s;
  }
  if (b.action === 'delete') {
    if (s.state === 'active') throw new AppError(400, 'ACTIVE', 'Complete the sprint before deleting it');
    await Issue.updateMany({ sprintId: s._id }, { $unset: { sprintId: 1 } });
    await s.deleteOne();
    return { done: true };
  }
  if (b.action === 'start') {
    if (s.state !== 'future') throw new AppError(400, 'STATE', 'Only future sprints can be started');
    if (await Sprint.exists({ projectId: s.projectId, state: 'active' })) throw new AppError(409, 'ACTIVE_EXISTS', 'Another sprint is already active. Complete it first.');
    if (!(await Issue.exists({ sprintId: s._id, deletedAt: null }))) throw new AppError(400, 'EMPTY', 'Add at least one issue to the sprint before starting');
    const start = b.startDate ? new Date(b.startDate) : new Date();
    const end = b.endDate ? new Date(b.endDate) : new Date(+start + 14 * 864e5);
    if (end <= start) throw new AppError(400, 'DATES', 'End date must be after the start date', { endDate: 'Must be after start' });
    s.state = 'active'; s.startDate = start; s.endDate = end;
    if (b.name) s.name = b.name; if (b.goal !== undefined) s.goal = b.goal;
    const snap = await sprintSnapshot(s._id);
    s.committed = snap.total;
    s.snapshots = [{ date: start, remaining: snap.total, done: 0 }];
    await s.save();
    const users = await Issue.distinct('assigneeId', { sprintId: s._id });
    await notify(users, user.id, 'sprint', `${s.name} has started`);
    await audit(user, 'sprint.started', s.name);
    return s;
  }
  if (b.action === 'complete') {
    if (s.state !== 'active') throw new AppError(400, 'STATE', 'Only active sprints can be completed');
    const snap = await sprintSnapshot(s._id);
    s.completed = snap.done; s.state = 'closed'; s.completedAt = new Date();
    s.snapshots.push({ date: new Date(), remaining: snap.remaining, done: snap.done });
    const target = b.moveTo && b.moveTo !== 'backlog' ? b.moveTo : undefined;
    await Issue.updateMany({ sprintId: s._id, statusCategory: { $ne: 'done' } }, target ? { sprintId: target } : { $unset: { sprintId: 1 } });
    await s.save();
    await audit(user, 'sprint.completed', s.name);
    return s;
  }
});
