import { route, forbidden } from '@/server/api';
import { User, Org } from '@/server/models';

export const GET = route(async (req, { user }) => {
  if (user.platformRole !== 'super_admin') throw forbidden();
  const q = new URL(req.url).searchParams.get('q');
  const re = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
  const users = await User.find(re ? { $or: [{ name: re }, { email: re }] } : {}).sort({ createdAt: -1 }).limit(200).select('-passwordHash').lean<any[]>();
  const orgs = await Org.find({ _id: { $in: users.map((u) => u.orgId).filter(Boolean) } }).select('name').lean<any[]>();
  return users.map((u) => ({ ...u, orgName: orgs.find((o) => String(o._id) === String(u.orgId))?.name }));
});
