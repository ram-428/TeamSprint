import { z } from 'zod';
import { route, AppError, audit, notify } from '@/server/api';
import { Project, User } from '@/server/models';
import { loadProject, requirePerm } from '@/server/domain';
import { PROJECT_ROLES } from '@/server/rbac';

const schema = z.object({ userId: z.string(), role: z.enum(PROJECT_ROLES as [string, ...string[]]).nullable() });

export const POST = route(async (req, { user, params }) => {
  const p = await loadProject(user, params.key);
  requirePerm(user, 'project.manage_members', p);
  const { userId, role } = schema.parse(await req.json());
  const target = await User.findOne({ _id: userId, orgId: p.orgId }).lean<any>();
  if (!target) throw new AppError(404, 'NOT_FOUND', 'User not found in this organization');
  const admins = p.members.filter((m: any) => m.role === 'project_admin');
  if ((role === null || role !== 'project_admin') && admins.length === 1 && String(admins[0].userId) === userId)
    throw new AppError(400, 'LAST_ADMIN', 'A project needs at least one Project Admin');
  await Project.updateOne({ _id: p._id }, { $pull: { members: { userId } } });
  if (role) {
    await Project.updateOne({ _id: p._id }, { $push: { members: { userId, role } } });
    await notify([userId], user.id, 'member', `${user.name} added you to ${p.name} as ${role.replace('_', ' ')}`);
  }
  await audit(user, 'project.member_changed', p.key, { userId, role });
  return { done: true };
});
