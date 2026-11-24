import { z } from 'zod';
import { NextResponse } from 'next/server';
import { route, AppError, audit } from '@/server/api';
import { User } from '@/server/models';
import { compare, hash, signSession, COOKIE } from '@/server/auth';

const schema = z.object({
  current: z.string().min(1),
  next: z.string().min(10, 'Use at least 10 characters').regex(/[A-Z]/, 'Add an uppercase letter').regex(/[0-9]/, 'Add a number'),
});

export const POST = route(async (req, { user }) => {
  const { current, next } = schema.parse(await req.json());
  const u = await User.findById(user.id);
  if (!u || !(await compare(current, u.passwordHash))) throw new AppError(400, 'BAD_PASSWORD', 'Current password is incorrect', { current: 'Incorrect password' });
  if (await compare(next, u.passwordHash)) throw new AppError(400, 'SAME_PASSWORD', 'New password must be different from the current one', { next: 'Choose a different password' });
  u.passwordHash = await hash(next);
  u.tokenVersion = (u.tokenVersion || 0) + 1; // revokes every other session
  await u.save();
  await audit(user, 'auth.password_changed', u.email);
  const res = NextResponse.json({ ok: true, data: { done: true } });
  res.cookies.set(COOKIE, await signSession({ uid: user.id, tv: u.tokenVersion }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 7 * 86400 });
  return res;
});
