import mongoose from 'mongoose';
import { Issue, Project, User, Sprint } from './models';
import { compile, parse, OqlError, type Resolver } from './oql';
import { AppError } from './api';
import { can } from './rbac';
import type { AuthUser } from './auth';

/** Attach lightweight assignee/reporter objects to issues for the UI. */
export async function hydrate(issues: any[]) {
  const ids = new Set<string>();
  for (const i of issues) { if (i.assigneeId) ids.add(String(i.assigneeId)); if (i.reporterId) ids.add(String(i.reporterId)); }
  const users = await User.find({ _id: { $in: [...ids] } }).select('name color title').lean<any[]>();
  const map = new Map(users.map((u) => [String(u._id), { _id: String(u._id), name: u.name, color: u.color }]));
  return issues.map((i) => ({ ...i, assignee: i.assigneeId ? map.get(String(i.assigneeId)) : undefined, reporter: i.reporterId ? map.get(String(i.reporterId)) : undefined }));
}

/** IDs of projects the user may view. */
export async function visibleProjectIds(user: AuthUser): Promise<mongoose.Types.ObjectId[]> {
  const ps = await Project.find(user.platformRole === 'super_admin' ? {} : { orgId: user.orgId, archived: false }).lean<any[]>();
  return ps.filter((p) => can(user, 'project.view', p)).map((p) => p._id);
}

export function resolver(user: AuthUser): Resolver {
  return {
    userId: user.id,
    user: async (s) => {
      const u = await User.findOne({ orgId: user.orgId, $or: [{ email: s.toLowerCase() }, { name: new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }] }).select('_id').lean<any>();
      return u ? String(u._id) : null;
    },
    project: async (s) => {
      const p = await Project.findOne({ orgId: user.orgId, $or: [{ key: s.toUpperCase() }, { name: new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }] }).select('_id').lean<any>();
      return p ? String(p._id) : null;
    },
    sprint: async (s) => {
      const q: any = s === '__open__' ? { state: 'active' } : { name: new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
      return (await Sprint.find({ orgId: user.orgId, ...q }).select('_id').lean<any[]>()).map((x) => String(x._id));
    },
  };
}

export async function runOql(user: AuthUser, oql: string, opts: { limit?: number; skip?: number } = {}) {
  let compiled;
  try { compiled = await compile(parse(oql), resolver(user)); } catch (e) {
    if (e instanceof OqlError) throw new AppError(400, 'OQL', e.message);
    throw e;
  }
  const pids = await visibleProjectIds(user);
  const filter = { $and: [{ deletedAt: null, projectId: { $in: pids } }, compiled.filter] };
  const sort = Object.keys(compiled.sort).length ? compiled.sort : { updatedAt: -1 as const };
  const [items, total] = await Promise.all([
    Issue.find(filter).select('-description -watchers -votes -orgId').sort(sort).skip(opts.skip ?? 0).limit(Math.min(opts.limit ?? 100, 500)).lean<any[]>(),
    Issue.countDocuments(filter),
  ]);
  return { items: await hydrate(items), total };
}
