import { z } from 'zod';
import { route, AppError, audit, notify } from '@/server/api';
import { Project, User } from '@/server/models';
import { loadProject, requirePerm } from '@/server/domain';
import { orgRoles } from '@/server/access';
import { ADMIN_ROLE } from '@/lib/permissions';

const schema = z.object({ userId: z.string(), role: z.string().min(1).max(40).nullable() });

export const POST = route(async (req, { user, params }) => {
  const p = await loadProject(user, params.key);
  requirePerm(user, 'project.manage_members', p);
  const { userId, role } = schema.parse(await req.json());
  const roles = await orgRoles(p.orgId);
  if (role && !roles.some((r: any) => r.key === role)) throw new AppError(400, 'BAD_ROLE', 'Unknown project role', { role: 'Pick a role' });
  const target = await User.findOne({ _id: userId, orgId: p.orgId }).lean<any>();
  if (!target) throw new AppError(404, 'NOT_FOUND', 'User not found in this organization');
  const admins = p.members.filter((m: any) => m.role === ADMIN_ROLE);
  if ((role === null || role !== ADMIN_ROLE) && admins.length === 1 && String(admins[0].userId) === userId)
    throw new AppError(400, 'LAST_ADMIN', 'A project needs at least one Project Admin');
  await Project.updateOne({ _id: p._id }, { $pull: { members: { userId } } });
  if (role) {
    await Project.updateOne({ _id: p._id }, { $push: { members: { userId, role } } });
    await notify([userId], user.id, 'member', `${user.name} added you to ${p.name} as ${roles.find((r: any) => r.key === role)?.name ?? role}`);
  }
  await audit(user, 'project.member_changed', p.key, { userId, role });
  return { done: true };
});
