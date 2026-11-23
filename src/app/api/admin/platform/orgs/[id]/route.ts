import { z } from 'zod';
import { route, forbidden, AppError, audit, oid } from '@/server/api';
import { Org, User } from '@/server/models';

export const PATCH = route(async (req, { user, params }) => {
  if (user.platformRole !== 'super_admin') throw forbidden();
  const b = z.object({ status: z.enum(['active', 'suspended']).optional(), plan: z.enum(['free', 'pro', 'enterprise']).optional(), maxUsers: z.number().int().min(1).optional(), maxProjects: z.number().int().min(1).optional() }).parse(await req.json());
  const o = await Org.findByIdAndUpdate(oid(params.id), b, { new: true });
  if (!o) throw new AppError(404, 'NOT_FOUND', 'Organization not found');
  if (b.status === 'suspended') await User.updateMany({ orgId: o._id, platformRole: { $ne: 'super_admin' } }, { $inc: { tokenVersion: 1 } }); // kicks everyone out
  await audit(user, 'platform.org_updated', o.name, b);
  return o;
});
