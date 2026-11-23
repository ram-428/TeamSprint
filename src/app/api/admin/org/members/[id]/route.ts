import { z } from 'zod';
import { route, forbidden, AppError, audit, oid } from '@/server/api';
import { User, Issue } from '@/server/models';
import { can } from '@/server/rbac';

export const PATCH = route(async (req, { user, params }) => {
  if (!can(user, 'org.manage_members')) throw forbidden();
  const b = z.object({ role: z.enum(['org_admin', 'member', 'guest']).optional(), status: z.enum(['active', 'deactivated']).optional(), title: z.string().optional() }).parse(await req.json());
  const u = await User.findOne({ _id: oid(params.id), orgId: user.orgId });
  if (!u) throw new AppError(404, 'NOT_FOUND', 'Member not found');
  if (u.platformRole === 'super_admin') throw forbidden();
  if (String(u._id) === user.id && (b.role && b.role !== 'org_admin' || b.status === 'deactivated')) throw new AppError(400, 'SELF', 'You cannot demote or deactivate yourself');
  if (u.role === 'org_admin' && ((b.role && b.role !== 'org_admin') || b.status === 'deactivated') && (await User.countDocuments({ orgId: user.orgId, role: 'org_admin', status: 'active' })) <= 1)
    throw new AppError(400, 'LAST_ADMIN', 'The organization needs at least one admin');
  if (b.role) u.role = b.role;
  if (b.title !== undefined) u.title = b.title;
  if (b.status) {
    u.status = b.status; u.tokenVersion = (u.tokenVersion || 0) + 1;
    if (b.status === 'deactivated') await Issue.updateMany({ assigneeId: u._id, statusCategory: { $ne: 'done' } }, { $unset: { assigneeId: 1 } });
  }
  await u.save();
  await audit(user, 'org.member_updated', u.email, b);
  return { done: true };
});
