import { z } from 'zod';
import { route, forbidden, AppError, audit } from '@/server/api';
import { User, Org, Project } from '@/server/models';
import { hash } from '@/server/auth';
import { can } from '@/server/rbac';

export const GET = route(async (_req, { user }) => {
  if (!can(user, 'org.manage_members')) throw forbidden();
  const users = await User.find({ orgId: user.orgId }).select('-passwordHash').sort({ name: 1 }).lean<any[]>();
  const projects = await Project.find({ orgId: user.orgId, archived: false }).select('key members').lean<any[]>();
  return users.map((u) => ({ ...u, projects: projects.filter((p) => p.members.some((m: any) => String(m.userId) === String(u._id))).map((p) => p.key) }));
});

const schema = z.object({ name: z.string().trim().min(2, 'Name is required'), email: z.string().email('Enter a valid email'), role: z.enum(['org_admin', 'member', 'guest']).default('member'), title: z.string().optional() });
const COLORS = ['#7c5cff', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#fb7185', '#a78bfa'];

/** "Invite": creates the account with a one-time temporary password (shown once to the admin; no SMTP needed). */
export const POST = route(async (req, { user }) => {
  if (!can(user, 'org.manage_members')) throw forbidden();
  const d = schema.parse(await req.json());
  const org = await Org.findById(user.orgId).lean<any>();
  if ((await User.countDocuments({ orgId: user.orgId })) >= (org?.maxUsers ?? 100)) throw new AppError(402, 'PLAN_LIMIT', 'User limit reached for your plan');
  if (await User.exists({ email: d.email.toLowerCase() })) throw new AppError(409, 'EMAIL_TAKEN', 'This email is already registered', { email: 'Already registered' });
  const tmp = 'Welcome-' + Math.random().toString(36).slice(2, 8) + '1A';
  const u = await User.create({ ...d, passwordHash: await hash(tmp), orgId: user.orgId, color: COLORS[Math.floor(Math.random() * COLORS.length)] });
  await audit(user, 'org.member_invited', d.email, { role: d.role });
  return { id: u._id, temporaryPassword: tmp };
});
