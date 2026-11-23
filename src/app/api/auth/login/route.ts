import { z } from 'zod';
import { NextResponse } from 'next/server';
import { route, AppError, audit } from '@/server/api';
import { User } from '@/server/models';
import { compare, signSession, COOKIE } from '@/server/auth';

const schema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Password is required'), next: z.string().optional() });

const attempts = new Map<string, { n: number; t: number }>();

export const POST = route(async (req) => {
  const { email, password } = schema.parse(await req.json());
  const ip = req.headers.get('x-forwarded-for') || 'local';
  const rl = attempts.get(ip);
  if (rl && Date.now() - rl.t < 60_000 && rl.n >= 30) throw new AppError(429, 'RATE_LIMIT', 'Too many attempts, slow down');
  attempts.set(ip, { n: rl && Date.now() - rl.t < 60_000 ? rl.n + 1 : 1, t: rl && Date.now() - rl.t < 60_000 ? rl.t : Date.now() });

  const u = await User.findOne({ email: email.toLowerCase() });
  const generic = new AppError(401, 'BAD_CREDENTIALS', 'Incorrect email or password');
  if (!u) throw generic;
  if (u.lockUntil && u.lockUntil > new Date()) throw new AppError(423, 'LOCKED', `Account locked. Try again in ${Math.ceil((+u.lockUntil - Date.now()) / 60000)} min`);
  if (!(await compare(password, u.passwordHash))) {
    u.failed = (u.failed || 0) + 1;
    if (u.failed >= 5) { u.lockUntil = new Date(Date.now() + 15 * 60_000); u.failed = 0; await audit({ id: String(u._id), orgId: u.orgId } as any, 'auth.locked', u.email); }
    await u.save();
    throw generic;
  }
  if (u.status !== 'active') throw new AppError(403, 'SUSPENDED', 'This account is suspended. Contact your administrator.');
  u.failed = 0; u.lockUntil = undefined; u.lastLoginAt = new Date(); await u.save();
  const token = await signSession({ uid: String(u._id), tv: u.tokenVersion || 0 });
  await audit({ id: String(u._id), orgId: u.orgId ? String(u.orgId) : null } as any, 'auth.login', u.email);
  const res = NextResponse.json({ ok: true, data: { role: u.role, platformRole: u.platformRole } });
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 7 * 86400 });
  return res;
}, { auth: false });
