import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { connectDB } from './db';
import { getUser, type AuthUser } from './auth';
import { Audit, Notification, Activity } from './models';
import mongoose from 'mongoose';
import { can } from './rbac';
import { loadAccess } from './access';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) { super(message); }
}
export const forbidden = (m = 'You do not have permission to do that') => new AppError(403, 'FORBIDDEN', m);
export const notFound = (m = 'Not found') => new AppError(404, 'NOT_FOUND', m);
export const bad = (m: string, fields?: Record<string, string>) => new AppError(400, 'BAD_REQUEST', m, fields);

export const ok = (data: unknown, status = 200) => NextResponse.json({ ok: true, data }, { status });

type Ctx = { params: Promise<Record<string, string>> };
type Handler = (req: Request, ctx: { user: AuthUser; params: Record<string, string> }) => Promise<unknown>;

/** Thin route wrapper: DB connect → authenticate → run → normalise errors into the API envelope. */
export function route(handler: Handler, opts: { auth?: boolean } = {}) {
  return async (req: Request, ctx: Ctx) => {
    try {
      await connectDB();
      const params = await (ctx?.params ?? Promise.resolve({}));
      let user = null as AuthUser | null;
      if (opts.auth !== false) {
        user = await getUser();
        if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in');
        await loadAccess(user.orgId); // permission schemes for can()
      }
      const out = await handler(req, { user: user as AuthUser, params });
      if (out instanceof Response) return out as NextResponse;
      return ok(out ?? { done: true });
    } catch (e) {
      if (e instanceof AppError) return NextResponse.json({ ok: false, error: { code: e.code, message: e.message, fields: e.fields } }, { status: e.status });
      if (e instanceof ZodError) {
        const fields = Object.fromEntries(e.issues.map((i) => [i.path.join('.'), i.message]));
        return NextResponse.json({ ok: false, error: { code: 'VALIDATION', message: 'Please check the highlighted fields', fields } }, { status: 422 });
      }
      console.error('[api]', e);
      return NextResponse.json({ ok: false, error: { code: 'INTERNAL', message: 'Something went wrong' } }, { status: 500 });
    }
  };
}

export const oid = (s: string) => {
  if (!mongoose.isValidObjectId(s)) throw bad('Invalid id');
  return new mongoose.Types.ObjectId(s);
};

/**
 * Organization an org-level endpoint should act on. Org admins are fixed to their own organization;
 * a super admin chooses one with `?orgId=` (required).
 */
export function targetOrg(user: AuthUser, req: Request, perm = 'org.manage_members'): string {
  if (user.platformRole === 'super_admin') {
    const id = new URL(req.url).searchParams.get('orgId');
    if (!id || !mongoose.isValidObjectId(id)) throw bad('Select an organization');
    return id;
  }
  if (!can(user, perm) || !user.orgId) throw forbidden();
  return user.orgId;
}

export const audit = (u: AuthUser, action: string, target: string, meta?: unknown) =>
  Audit.create({ orgId: u.orgId, actorId: u.id, impersonatedBy: u.impersonatedBy, action, target, meta });

export const notify = async (userIds: (string | undefined | null)[], actorId: string, type: string, message: string, issueKey?: string) => {
  const ids = [...new Set(userIds.filter(Boolean).map(String))].filter((id) => id !== actorId);
  if (ids.length) await Notification.insertMany(ids.map((userId) => ({ userId, actorId, type, message, issueKey })));
};

export const logActivity = (u: AuthUser, issue: any, action: string, diff?: unknown) =>
  Activity.create({ orgId: u.orgId, projectId: issue.projectId, issueId: issue._id, actorId: u.id, action, diff });
