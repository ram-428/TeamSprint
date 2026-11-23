import { z } from 'zod';
import { route, forbidden, AppError, audit, oid } from '@/server/api';
import { Org, User, Team, Project, Issue, Comment, Worklog, Sprint, Activity, Notification, Goal, SavedFilter, Automation } from '@/server/models';

export const PATCH = route(async (req, { user, params }) => {
  if (user.platformRole !== 'super_admin') throw forbidden();
  const b = z.object({ name: z.string().trim().min(2, 'Name is required').max(80).optional(), status: z.enum(['active', 'suspended']).optional(), plan: z.enum(['free', 'pro', 'enterprise']).optional(), maxUsers: z.number().int().min(1).optional(), maxProjects: z.number().int().min(1).optional() }).parse(await req.json());
  const o = await Org.findByIdAndUpdate(oid(params.id), b, { new: true });
  if (!o) throw new AppError(404, 'NOT_FOUND', 'Organization not found');
  if (b.status === 'suspended') await User.updateMany({ orgId: o._id, platformRole: { $ne: 'super_admin' } }, { $inc: { tokenVersion: 1 } }); // kicks everyone out
  await audit(user, 'platform.org_updated', o.name, b);
  return o;
});

/** Permanently deletes an organization and everything in it. Platform admins who belonged to it are kept, detached from the org. */
export const DELETE = route(async (_req, { user, params }) => {
  if (user.platformRole !== 'super_admin') throw forbidden();
  const id = oid(params.id);
  const o = await Org.findById(id).lean<any>();
  if (!o) throw new AppError(404, 'NOT_FOUND', 'Organization not found');
  const f = { orgId: id };
  await Promise.all([Issue, Comment, Worklog, Sprint, Activity, Notification, Goal, SavedFilter, Automation, Project, Team].map((m: any) => m.deleteMany(f)));
  await User.deleteMany({ orgId: id, platformRole: { $ne: 'super_admin' } });
  await User.updateMany({ orgId: id }, { $unset: { orgId: 1 }, role: 'member', $inc: { tokenVersion: 1 } });
  await Org.deleteOne({ _id: id });
  await audit(user, 'platform.org_deleted', o.name);
  return { deleted: true };
});
