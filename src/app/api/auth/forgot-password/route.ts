import { z } from 'zod';
import { randomInt } from 'node:crypto';
import mongoose from 'mongoose';
import { route, AppError } from '@/server/api';
import { User } from '@/server/models';
import { hash, signSession } from '@/server/auth';
import { sendResetCode, smtpConfigured } from '@/server/mail';
import { maskEmail } from '@/server/otp';

const schema = z.object({ email: z.string().trim().email('Enter a valid email') });
const TTL = 10 * 60_000, COOLDOWN = 60_000;
const hits = new Map<string, { n: number; t: number }>();

/** Step 1 of "forgot password": emails a 6-digit code. Always answers the same way so it can't be used to probe which emails exist. */
export const POST = route(async (req) => {
  const { email } = schema.parse(await req.json());
  const ip = req.headers.get('x-forwarded-for') || 'local';
  const h = hits.get(ip); const fresh = h && Date.now() - h.t < 15 * 60_000;
  if (fresh && h.n >= 10) throw new AppError(429, 'RATE_LIMIT', 'Too many requests. Please try again in a few minutes.');
  hits.set(ip, { n: fresh ? h.n + 1 : 1, t: fresh ? h.t : Date.now() });

  const dev = process.env.NODE_ENV !== 'production';
  if (!smtpConfigured() && !dev) throw new AppError(503, 'MAIL_UNAVAILABLE', 'Password reset by email is not available right now. Contact your administrator.');

  const u = await User.findOne({ email: email.toLowerCase() });
  let uid = String(new mongoose.Types.ObjectId()); // decoy id for unknown / suspended accounts
  if (u && u.status === 'active') {
    uid = String(u._id);
    // resend cooldown: otpExpires - TTL is when the last code was sent
    const sentAt = u.otpExpires ? +u.otpExpires - TTL : 0;
    if (Date.now() - sentAt < COOLDOWN) throw new AppError(429, 'TOO_SOON', `Please wait ${Math.ceil((COOLDOWN - (Date.now() - sentAt)) / 1000)}s before requesting another code.`);
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    u.otpHash = await hash(code); u.otpExpires = new Date(Date.now() + TTL); u.otpTries = 0; await u.save();
    if (dev) console.log(`[dev] password reset code for ${u.email}: ${code}`);
    if (smtpConfigured()) {
      try { await sendResetCode(u.email, u.name || 'there', code); }
      catch (e) { console.error('[mail] reset code failed', e); throw new AppError(502, 'MAIL_FAILED', 'Could not send the email. Try again shortly.'); }
    }
  }
  const challenge = await signSession({ uid, tv: -2 }, '15m');
  return { challenge, email: maskEmail(email) };
}, { auth: false });
