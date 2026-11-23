import { z } from 'zod';
import { route, AppError, audit } from '@/server/api';
import { Project, Issue, User, Org, Sprint } from '@/server/models';
import { WORKFLOWS } from '@/server/domain';
import { can, abilities } from '@/server/rbac';

export const GET = route(async (_req, { user }) => {
  const filter: any = user.platformRole === 'super_admin' ? {} : { orgId: user.orgId, archived: false };
  const projects = await Project.find(filter).sort({ name: 1 }).lean<any[]>();
  const visible = projects.filter((p) => can(user, 'project.view', p));
  const ids = visible.map((p) => p._id);
  const [counts, sprints, leads] = await Promise.all([
    Issue.aggregate([
      { $match: { projectId: { $in: ids }, deletedAt: null } },
      { $group: { _id: '$projectId', total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$statusCategory', 'done'] }, 1, 0] } } } },
    ]),
    Sprint.find({ projectId: { $in: ids }, state: 'active' }).select('projectId name endDate').lean<any[]>(),
    User.find({ _id: { $in: visible.map((p) => p.leadId).filter(Boolean) } }).select('name color').lean<any[]>(),
  ]);
  return visible.map((p) => {
    const c = counts.find((x) => String(x._id) === String(p._id));
    return {
      _id: p._id, key: p.key, name: p.name, description: p.description, type: p.type, color: p.color, icon: p.icon, visibility: p.visibility,
      lead: leads.find((l) => String(l._id) === String(p.leadId)), total: c?.total ?? 0, done: c?.done ?? 0,
      activeSprint: sprints.find((s) => String(s.projectId) === String(p._id)),
      starred: (p.starredBy || []).map(String).includes(user.id), abilities: abilities(user, p),
    };
  });
});

const schema = z.object({
  name: z.string().min(2, 'Name is required').max(60),
  key: z.string().regex(/^[A-Z][A-Z0-9]{1,9}$/, 'Use 2–10 uppercase letters/numbers, starting with a letter'),
  type: z.enum(['scrum', 'kanban', 'business', 'service_desk']),
  description: z.string().max(500).optional(),
  color: z.string().optional(), icon: z.string().optional(),
  visibility: z.enum(['private', 'org']).default('org'),
  memberIds: z.array(z.string()).default([]),
});

export const POST = route(async (req, { user }) => {
  if (!user.orgId || !(user.role === 'org_admin' || user.role === 'member')) throw new AppError(403, 'FORBIDDEN', 'You cannot create projects');
  const d = schema.parse(await req.json());
  const org = await Org.findById(user.orgId).lean<any>();
  if ((await Project.countDocuments({ orgId: user.orgId })) >= (org?.maxProjects ?? 50)) throw new AppError(402, 'PLAN_LIMIT', 'Project limit reached for your plan');
  if (await Project.exists({ orgId: user.orgId, key: d.key })) throw new AppError(409, 'KEY_TAKEN', 'That key is already used', { key: 'Key already in use' });
  const members = [{ userId: user.id, role: 'project_admin' }];
  const extra = await User.find({ _id: { $in: d.memberIds }, orgId: user.orgId }).select('_id role').lean<any[]>();
  for (const m of extra) if (String(m._id) !== user.id) members.push({ userId: String(m._id), role: m.role === 'guest' ? 'reporter' : 'developer' });
  const p = await Project.create({
    orgId: user.orgId, key: d.key, name: d.name, description: d.description, type: d.type, leadId: user.id, color: d.color || '#7c5cff', icon: d.icon || 'rocket',
    visibility: d.visibility, members, statuses: WORKFLOWS[d.type], components: [],
  });
  if (d.type === 'scrum') await Sprint.create({ orgId: user.orgId, projectId: p._id, name: `${d.key} Sprint 1`, state: 'future' });
  await audit(user, 'project.created', d.key);
  return { key: p.key };
});
