import { route, forbidden, targetOrg } from '@/server/api';
import { Audit, User } from '@/server/models';

export const GET = route(async (req, { user }) => {
  const sp = new URL(req.url).searchParams;
  const platform = sp.get('scope') === 'platform';
  if (platform && user.platformRole !== 'super_admin') throw forbidden();
  const filter: any = platform ? {} : { orgId: targetOrg(user, req, 'org.view_audit') };
  const org = sp.get('orgId');
  if (platform && org === 'none') filter.orgId = null; else if (platform && org && /^[a-f0-9]{24}$/i.test(org)) filter.orgId = org;
  if (sp.get('action')) filter.action = new RegExp('^' + sp.get('action')!.replace(/[^\w.]/g, ''), 'i');
  const items = await Audit.find(filter).sort({ createdAt: -1 }).limit(200).lean<any[]>();
  const users = await User.find({ _id: { $in: items.flatMap((i) => [i.actorId, i.impersonatedBy]).filter(Boolean) } }).select('name').lean<any[]>();
  const n = (id: any) => users.find((u) => String(u._id) === String(id))?.name;
  return items.map((i) => ({ ...i, actor: n(i.actorId) || 'System', impersonatedByName: n(i.impersonatedBy) }));
});
