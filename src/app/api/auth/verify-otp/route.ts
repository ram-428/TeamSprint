import { z } from 'zod';
import { NextResponse } from 'next/server';
import { route, AppError, audit } from '@/server/api';
import { User } from '@/server/models';
import { compare, signSession, verifySession, COOKIE } from '@/server/auth';

const schema = z.object({ challenge: z.string().min(10), code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') });

export const POST = route(async (req) => {
  const { challenge, code } = schema.parse(await req.json());
  const s = await verifySession(challenge);
  if (!s || s.tv !== -1) throw new AppError(401, 'CHALLENGE_EXPIRED', 'Your sign-in expired. Please start again.');
  const u = await User.findById(s.uid);
  if (!u || u.status !== 'active' || !u.otpHash || !u.otpExpires || u.otpExpires < new Date()) throw new AppError(401, 'CODE_EXPIRED', 'The code has expired. Please sign in again.');
  if ((u.otpTries || 0) >= 5) { u.otpHash = undefined; await u.save(); throw new AppError(429, 'TOO_MANY', 'Too many wrong codes. Please sign in again.'); }
  if (!(await compare(code, u.otpHash))) { u.otpTries = (u.otpTries || 0) + 1; await u.save(); throw new AppError(401, 'BAD_CODE', 'Incorrect code'); }
  u.otpHash = undefined; u.otpExpires = undefined; u.otpTries = 0; u.failed = 0; u.lockUntil = undefined; u.lastLoginAt = new Date(); await u.save();
  const token = await signSession({ uid: String(u._id), tv: u.tokenVersion || 0 });
  await audit({ id: String(u._id), orgId: u.orgId ? String(u.orgId) : null } as any, 'auth.login', u.email);
  const res = NextResponse.json({ ok: true, data: { role: u.role, platformRole: u.platformRole } });
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 7 * 86400 });
  return res;
}, { auth: false });
