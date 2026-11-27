import { z } from 'zod';
import { route, forbidden, AppError, audit, oid, targetOrg } from '@/server/api';
import { User, Issue, Project } from '@/server/models';
import { assertSeat } from '@/server/plan';

export const PATCH = route(async (req, { user, params }) => {
  const orgId = targetOrg(user, req);
  const b = z.object({ role: z.enum(['member', 'guest']).optional(), status: z.enum(['active', 'deactivated']).optional(), title: z.string().optional(), name: z.string().trim().min(2, 'Name is required').max(80).optional(), email: z.string().email('Enter a valid email').optional() }).parse(await req.json());
  const u = await User.findOne({ _id: oid(params.id), orgId });
  if (!u) throw new AppError(404, 'NOT_FOUND', 'Member not found');
  if (u.platformRole === 'super_admin') throw forbidden();
  // Each organization has exactly one Org Admin: nobody else can be promoted, and the admin's role cannot be changed.
  if (u.role === 'org_admin' && b.role) throw new AppError(400, 'ONE_ADMIN', 'Each organization has exactly one Org Admin; their role cannot be changed');
  if (String(u._id) === user.id && b.status === 'deactivated') throw new AppError(400, 'SELF', 'You cannot demote or deactivate yourself');
  if (u.role === 'org_admin' && b.status === 'deactivated' && (await User.countDocuments({ orgId, role: 'org_admin', status: 'active' })) <= 1)
    throw new AppError(400, 'LAST_ADMIN', 'The organization needs at least one admin');
  if (b.email && b.email.toLowerCase() !== u.email) { if (await User.exists({ email: b.email.toLowerCase(), _id: { $ne: u._id } })) throw new AppError(409, 'EMAIL_TAKEN', 'This email is already registered', { email: 'Already registered' }); u.email = b.email.toLowerCase(); u.tokenVersion = (u.tokenVersion || 0) + 1; }
  if (b.name) u.name = b.name;
  if (b.role) u.role = b.role;
  if (b.title !== undefined) u.title = b.title;
  if (b.status === 'active' && u.status === 'deactivated') await assertSeat(orgId);
  if (b.status) {
    u.status = b.status; u.tokenVersion = (u.tokenVersion || 0) + 1;
    if (b.status === 'deactivated') await Issue.updateMany({ assigneeId: u._id, statusCategory: { $ne: 'done' } }, { $unset: { assigneeId: 1 } });
  }
  await u.save();
  await audit({ ...user, orgId }, 'org.member_updated', u.email, b);
  return { done: true };
});

/** Permanently removes a member from the organization. Their issues are unassigned and they leave all projects. */
export const DELETE = route(async (req, { user, params }) => {
  const orgId = targetOrg(user, req);
  const u = await User.findOne({ _id: oid(params.id), orgId });
  if (!u) throw new AppError(404, 'NOT_FOUND', 'Member not found');
  if (u.platformRole === 'super_admin') throw forbidden();
  if (String(u._id) === user.id) throw new AppError(400, 'SELF', 'You cannot delete yourself');
  if (u.role === 'org_admin' && (await User.countDocuments({ orgId, role: 'org_admin', status: 'active', _id: { $ne: u._id } })) < 1)
    throw new AppError(400, 'LAST_ADMIN', 'The organization needs at least one admin');
  await Issue.updateMany({ assigneeId: u._id }, { $unset: { assigneeId: 1 } });
  await Project.updateMany({ orgId }, { $pull: { members: { userId: u._id }, starredBy: u._id } });
  await User.deleteOne({ _id: u._id });
  await audit({ ...user, orgId }, 'org.member_deleted', u.email);
  return { deleted: true };
});
