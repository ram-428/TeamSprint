import { z } from 'zod';
import mongoose from 'mongoose';
import { route, AppError, audit } from '@/server/api';
import { User } from '@/server/models';
import { compare, hash, verifySession } from '@/server/auth';

const schema = z.object({
  challenge: z.string().min(10),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  password: z.string().min(10, 'Use at least 10 characters').regex(/[A-Z]/, 'Add an uppercase letter').regex(/[0-9]/, 'Add a number'),
});

/** Step 2 of "forgot password": checks the emailed code and sets the new password. Does not sign the user in. */
export const POST = route(async (req) => {
  const { challenge, code, password } = schema.parse(await req.json());
  const s = await verifySession(challenge);
  if (!s || s.tv !== -2 || !mongoose.isValidObjectId(s.uid)) throw new AppError(401, 'CHALLENGE_EXPIRED', 'This reset request expired. Please start again.');
  const u = await User.findById(s.uid);
  const invalid = new AppError(401, 'BAD_CODE', 'Incorrect or expired code', { code: 'Incorrect or expired code' });
  if (!u || u.status !== 'active' || !u.otpHash || !u.otpExpires || u.otpExpires < new Date()) throw invalid;
  if ((u.otpTries || 0) >= 5) { u.otpHash = undefined; u.otpExpires = undefined; await u.save(); throw new AppError(429, 'TOO_MANY', 'Too many wrong codes. Please request a new one.'); }
  if (!(await compare(code, u.otpHash))) { u.otpTries = (u.otpTries || 0) + 1; await u.save(); throw invalid; }
  u.passwordHash = await hash(password);
  u.tokenVersion = (u.tokenVersion || 0) + 1; // signs out every existing session
  u.otpHash = undefined; u.otpExpires = undefined; u.otpTries = 0; u.failed = 0; u.lockUntil = undefined;
  await u.save();
  await audit({ id: String(u._id), orgId: u.orgId ? String(u.orgId) : null } as any, 'auth.password_reset', u.email);
  return { done: true };
}, { auth: false });
