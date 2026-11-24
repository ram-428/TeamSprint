import { z } from 'zod';
import { NextResponse } from 'next/server';
import { route, forbidden, AppError, audit, oid } from '@/server/api';
import { Org } from '@/server/models';
import { ORG_COOKIE } from '@/server/auth';

const guard = (u: any) => { if (u.platformRole !== 'super_admin' || u.impersonatedBy) throw forbidden(); };

/** Every organization, for the super admin's "working organization" switcher. */
export const GET = route(async (_req, { user }) => {
  guard(user);
  const orgs = await Org.find({}).select('name status').sort({ name: 1 }).collation({ locale: 'en' }).lean<any[]>();
  return { orgs: orgs.map((o) => ({ _id: String(o._id), name: o.name, status: o.status })), current: user.orgId, home: user.homeOrgId ?? null };
});

/** Switch the organization the super admin is working in. Picking their own organization returns them to normal. */
export const POST = route(async (req, { user }) => {
  guard(user);
  const { orgId } = z.object({ orgId: z.string() }).parse(await req.json());
  const org = await Org.findById(oid(orgId)).select('name').lean<any>();
  if (!org) throw new AppError(404, 'NOT_FOUND', 'Organization not found');
  const res = NextResponse.json({ ok: true, data: { orgId, name: org.name } });
  if (orgId === user.homeOrgId) res.cookies.set(ORG_COOKIE, '', { path: '/', maxAge: 0 });
  else {
    res.cookies.set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 7 * 86400 });
    await audit(user, 'platform.org_switch', org.name);
  }
  return res;
});
