import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { connectDB } from './db';
import { User, Org } from './models';

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me-in-production-32ch');
export const COOKIE = 'orbit_session';
/** Super admin's "working organization": when set, every org-scoped API acts inside that organization. */
export const ORG_COOKIE = 'orbit_org';

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
  title?: string; color?: string; avatarUrl?: string; theme: string; impersonatedBy?: string;
  /** super admin only: their own organization, and whether they are currently working inside a different one */
  homeOrgId?: string | null; actingOrg?: boolean;
};

const userCache = new Map<string, { at: number; u: AuthUser | null }>();
/** Forget cached copies of a user (cache keys are `uid:tv:imp:org`) so profile changes show up immediately. */
export const dropUserCache = (id?: string) => { if (!id) return userCache.clear(); for (const k of userCache.keys()) if (k.startsWith(id + ':')) userCache.delete(k); };

/** Resolves the logged-in user from the cookie (null if none / invalid / suspended). */
export async function getUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const s = await verifySession(token);
  if (!s) return null;
  const oc = s.imp ? '' : store.get(ORG_COOKIE)?.value || '';
  const ck = `${s.uid}:${s.tv ?? 0}:${s.imp ?? ''}:${oc}`;
  const hit = userCache.get(ck);
  if (hit && Date.now() - hit.at < 10_000) return hit.u;
  await connectDB();
  const u = await User.findById(s.uid).select('name email orgId role platformRole title color avatarUrl theme status tokenVersion').lean<any>();
  if (!u || u.status !== 'active' || (u.tokenVersion ?? 0) !== (s.tv ?? 0)) { userCache.set(ck, { at: Date.now(), u: null }); return null; }
  const res: AuthUser = {
    id: String(u._id), name: u.name, email: u.email, orgId: u.orgId ? String(u.orgId) : null,
    role: u.role, platformRole: u.platformRole, title: u.title, color: u.color, avatarUrl: u.avatarUrl, theme: u.theme || 'simple',
    impersonatedBy: s.imp,
  };
  if (u.platformRole === 'super_admin') {
    res.homeOrgId = res.orgId;
    if (/^[a-f0-9]{24}$/i.test(oc) && oc !== res.orgId && (await Org.exists({ _id: oc }))) { res.orgId = oc; res.role = 'org_admin'; res.actingOrg = true; }
  }
  userCache.set(ck, { at: Date.now(), u: res });
  if (userCache.size > 500) userCache.clear();
  return res;
}
