import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { connectDB } from './db';
import { User } from './models';

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me-in-production-32ch');
export const COOKIE = 'orbit_session';

export type Session = { uid: string; tv: number; imp?: string };

export async function signSession(s: Session, ttl = '7d') {
  return new SignJWT({ ...s }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(ttl).sign(secret());
}
export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export const hash = (pw: string) => bcrypt.hash(pw, 10);
export const compare = (pw: string, h: string) => bcrypt.compare(pw, h);

export type AuthUser = {
  id: string; name: string; email: string; orgId: string | null; role: string; platformRole: string;
  title?: string; color?: string; theme: string; impersonatedBy?: string;
};

const userCache = new Map<string, { at: number; u: AuthUser | null }>();
export const dropUserCache = (id?: string) => (id ? userCache.delete(id) : userCache.clear());

/** Resolves the logged-in user from the cookie (null if none / invalid / suspended). */
export async function getUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await verifySession(token);
  if (!s) return null;
  const ck = `${s.uid}:${s.tv ?? 0}:${s.imp ?? ''}`;
  const hit = userCache.get(ck);
  if (hit && Date.now() - hit.at < 10_000) return hit.u;
  await connectDB();
  const u = await User.findById(s.uid).select('name email orgId role platformRole title color theme status tokenVersion').lean<any>();
  if (!u || u.status !== 'active' || (u.tokenVersion ?? 0) !== (s.tv ?? 0)) { userCache.set(ck, { at: Date.now(), u: null }); return null; }
  const res: AuthUser = {
    id: String(u._id), name: u.name, email: u.email, orgId: u.orgId ? String(u.orgId) : null,
    role: u.role, platformRole: u.platformRole, title: u.title, color: u.color, theme: u.theme || 'simple',
    impersonatedBy: s.imp,
  };
  userCache.set(ck, { at: Date.now(), u: res });
  if (userCache.size > 500) userCache.clear();
  return res;
}
