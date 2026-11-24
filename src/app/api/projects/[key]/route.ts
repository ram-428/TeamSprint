import { z } from 'zod';
import { route, audit } from '@/server/api';
import { Project, User, Issue } from '@/server/models';
import { loadProject, requirePerm } from '@/server/domain';
import { abilities } from '@/server/rbac';

export const GET = route(async (_req, { user, params }) => {
  const p = await loadProject(user, params.key);
  const ids = [...p.members.map((m: any) => m.userId), p.leadId].filter(Boolean);
  const users = await User.find({ _id: { $in: ids } }).select('name email color title role').lean<any[]>();
  const members = p.members.map((m: any) => ({ ...users.find((u) => String(u._id) === String(m.userId)), projectRole: m.role }));
  // org-wide users that can be assigned (everyone with at least developer/reporter role)
  return { ...p, members, abilities: abilities(user, p), starred: (p.starredBy || []).map(String).includes(user.id) };
});

const patchSchema = z.object({
  name: z.string().min(2).max(60).optional(), description: z.string().max(500).optional(), color: z.string().optional(), icon: z.string().optional(),
  visibility: z.enum(['private', 'org']).optional(), leadId: z.string().optional(), archived: z.boolean().optional(),
  components: z.array(z.string()).optional(), wip: z.record(z.string(), z.number().int().min(0)).optional(),
  versions: z.array(z.object({ id: z.string(), name: z.string(), releaseDate: z.string().optional(), released: z.boolean().optional() })).optional(),
  starred: z.boolean().optional(),
});

export const PATCH = route(async (req, { user, params }) => {
  const p = await loadProject(user, params.key);
  const d = patchSchema.parse(await req.json());
  if (d.starred !== undefined) {
    await Project.updateOne({ _id: p._id }, d.starred ? { $addToSet: { starredBy: user.id } } : { $pull: { starredBy: user.id } });
    if (Object.keys(d).length === 1) return { done: true };
  }
  const { starred, ...rest } = d; void starred;
  if (Object.keys(rest).length) {
    requirePerm(user, rest.wip ? 'board.manage' : 'project.edit', p);
    await Project.updateOne({ _id: p._id }, rest);
    await audit(user, 'project.updated', p.key, rest);
  }
  return { done: true };
});

export const DELETE = route(async (_req, { user, params }) => {
  const p = await loadProject(user, params.key);
  requirePerm(user, 'project.edit', p);
  await Project.updateOne({ _id: p._id }, { archived: true });
  await Issue.updateMany({ projectId: p._id }, { deletedAt: new Date() });
  await audit(user, 'project.deleted', p.key);
  return { done: true };
});
