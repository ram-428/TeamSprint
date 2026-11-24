import { z } from 'zod';
import { NextResponse } from 'next/server';
import { route, forbidden, AppError, audit } from '@/server/api';
import { User } from '@/server/models';
import { signSession, COOKIE } from '@/server/auth';

export const POST = route(async (req, { user }) => {
  if (user.platformRole !== 'super_admin' || user.impersonatedBy) throw forbidden();
  const b = z.object({ userId: z.string(), reason: z.string().trim().min(5, 'Give a short reason') }).parse(await req.json());
  const t = await User.findById(b.userId);
  if (!t || t.status !== 'active') throw new AppError(404, 'NOT_FOUND', 'User not found or not active');
  if (t.platformRole === 'super_admin') throw new AppError(400, 'NOPE', 'Cannot impersonate another Super Admin');
  await audit(user, 'platform.impersonate_start', t.email, { reason: b.reason });
  const res = NextResponse.json({ ok: true, data: { done: true } });
  // short-lived impersonation session; `imp` carries the real super admin id for the exit path + audit trail
  res.cookies.set(COOKIE, await signSession({ uid: String(t._id), tv: t.tokenVersion || 0, imp: user.id }, '2h'), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 7200 });
  return res;
});

export const DELETE = route(async (_req, { user }) => {
  if (!user.impersonatedBy) throw new AppError(400, 'NOT_IMPERSONATING', 'Not impersonating');
  const sa = await User.findById(user.impersonatedBy);
  await audit(user, 'platform.impersonate_end', user.email);
  const res = NextResponse.json({ ok: true, data: { done: true } });
  res.cookies.set(COOKIE, await signSession({ uid: String(sa._id), tv: sa.tokenVersion || 0 }), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 7 * 86400 });
  return res;
});
