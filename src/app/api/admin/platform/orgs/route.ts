import { z } from 'zod';
import { route, forbidden, AppError, audit } from '@/server/api';
import { Org, User, Project, Issue } from '@/server/models';
import { hash } from '@/server/auth';
import { sendInviteMail, siteUrl } from '@/server/mail';
import { planLimits } from '@/lib/plans';

const guard = (u: any) => { if (u.platformRole !== 'super_admin') throw forbidden(); };

export const GET = route(async (_req, { user }) => {
  guard(user);
  const orgs = await Org.find({}).sort({ createdAt: -1 }).lean<any[]>();
  return Promise.all(orgs.map(async (o) => ({
    ...o, users: await User.countDocuments({ orgId: o._id, platformRole: { $ne: 'super_admin' }, status: { $ne: 'deactivated' } }), projects: await Project.countDocuments({ orgId: o._id, archived: { $ne: true } }), issues: await Issue.countDocuments({ orgId: o._id, deletedAt: null }),
  })));
});

const schema = z.object({
  name: z.string().trim().min(2, 'Name is required'), slug: z.string().regex(/^[a-z0-9-]{2,40}$/, 'lowercase letters, numbers, dashes').optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).default('pro'), adminName: z.string().min(2), adminEmail: z.string().email(),
});
export const POST = route(async (req, { user }) => {
  guard(user);
  const d = schema.parse(await req.json());
  const slug = d.slug || d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (await Org.exists({ slug })) throw new AppError(409, 'SLUG_TAKEN', 'Slug already used', { slug: 'Already used' });
  if (await User.exists({ email: d.adminEmail.toLowerCase() })) throw new AppError(409, 'EMAIL_TAKEN', 'Email already registered', { adminEmail: 'Already registered' });
  const limits = planLimits(d.plan);
  const org = await Org.create({ name: d.name, slug, plan: d.plan, ...limits });
  const tmp = 'Welcome-' + Math.random().toString(36).slice(2, 8) + '1A';
  await User.create({ name: d.adminName, email: d.adminEmail, passwordHash: await hash(tmp), orgId: org._id, role: 'org_admin', color: '#7c5cff' });
  await audit(user, 'platform.org_created', d.name);
  const emailed = await sendInviteMail(d.adminEmail, d.adminName, tmp, user.name, d.name, siteUrl(req));
  return { id: org._id, adminEmail: d.adminEmail, temporaryPassword: tmp, emailed };
});
