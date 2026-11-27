import { z } from 'zod';
import { NextResponse } from 'next/server';
import { route, AppError } from '@/server/api';
import { Org, User } from '@/server/models';
import { hash, signSession, COOKIE } from '@/server/auth';
import { planLimits } from '@/lib/plans';

const schema = z.object({
  name: z.string().min(2, 'Enter your name'), email: z.string().email('Enter a valid email'), orgName: z.string().min(2, 'Name your workspace'),
  password: z.string().min(10, 'Use at least 10 characters').regex(/[A-Z]/, 'Add an uppercase letter').regex(/[0-9]/, 'Add a number'),
});
const COLORS = ['#7c5cff', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#60a5fa'];

export const POST = route(async (req) => {
  if (process.env.ALLOW_SELF_SIGNUP === 'false') throw new AppError(403, 'DISABLED', 'Self sign-up is disabled');
  const d = schema.parse(await req.json());
  if (await User.exists({ email: d.email.toLowerCase() })) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists', { email: 'Already registered' });
  let slug = d.orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
  if (await Org.exists({ slug })) slug += '-' + Math.random().toString(36).slice(2, 6);
  const org = await Org.create({ name: d.orgName, slug, plan: 'free', ...planLimits('free') }); // self sign-up starts on the Free plan
  const u = await User.create({ name: d.name, email: d.email, passwordHash: await hash(d.password), orgId: org._id, role: 'org_admin', color: COLORS[Math.floor(Math.random() * COLORS.length)] });
  const res = NextResponse.json({ ok: true, data: { id: String(u._id) } }, { status: 201 });
  res.cookies.set(COOKIE, await signSession({ uid: String(u._id), tv: 0 }), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 7 * 86400 });
  return res;
}, { auth: false });
