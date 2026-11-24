import { route, forbidden } from '@/server/api';
import { User, Org } from '@/server/models';

export const GET = route(async (req, { user }) => {
  if (user.platformRole !== 'super_admin') throw forbidden();
  const sp = new URL(req.url).searchParams; const q = sp.get('q'); const orgId = sp.get('orgId');
  const re = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
  const filter: any = {};
  if (re) filter.$or = [{ name: re }, { email: re }];
  if (orgId === 'none') filter.orgId = null; else if (orgId && /^[a-f0-9]{24}$/i.test(orgId)) filter.orgId = orgId;
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(500).select('-passwordHash').lean<any[]>();
  const orgs = await Org.find({ _id: { $in: users.map((u) => u.orgId).filter(Boolean) } }).select('name').lean<any[]>();
  const rank = (u: any) => (u.platformRole === 'super_admin' ? 0 : u.role === 'org_admin' ? 1 : 2);
  // grouped by organization, with each organization's single Org Admin first
  return users.map((u) => ({ ...u, orgName: orgs.find((o) => String(o._id) === String(u.orgId))?.name }))
    .sort((a, b) => (a.orgName || '').localeCompare(b.orgName || '') || rank(a) - rank(b) || a.name.localeCompare(b.name));
});
