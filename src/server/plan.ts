import { AppError } from './api';
import { Org, Project, User } from './models';
import { planLabel } from '../lib/plans';

/**
 * Plan usage of an organization. Seats are active users of the org (platform admins and deactivated users
 * don't take a seat); projects are the ones that are not archived.
 */
export async function planUsage(orgId: any) {
  const org = await Org.findById(orgId).lean<any>();
  if (!org) throw new AppError(404, 'NOT_FOUND', 'Organization not found');
  const [users, projects] = await Promise.all([
    User.countDocuments({ orgId: org._id, platformRole: { $ne: 'super_admin' }, status: { $ne: 'deactivated' } }),
    Project.countDocuments({ orgId: org._id, archived: { $ne: true } }),
  ]);
  return { plan: org.plan || 'pro', planLabel: planLabel(org.plan || 'pro'), users, projects, maxUsers: org.maxUsers ?? 100, maxProjects: org.maxProjects ?? 50 };
}

/** Throws a 402 when the org has no free seat left (applies to everyone, platform admins included). */
export async function assertSeat(orgId: any, adding = 1) {
  const u = await planUsage(orgId);
  if (u.users + adding > u.maxUsers)
    throw new AppError(402, 'PLAN_LIMIT', `Your ${u.planLabel} plan allows ${u.maxUsers} active users (${u.users} in use). Upgrade the plan or deactivate someone first.`);
}

/** Throws a 402 when the org cannot have another project. */
export async function assertProjectSlot(orgId: any) {
  const u = await planUsage(orgId);
  if (u.projects + 1 > u.maxProjects)
    throw new AppError(402, 'PLAN_LIMIT', `Your ${u.planLabel} plan allows ${u.maxProjects} projects (${u.projects} in use). Upgrade the plan or delete a project first.`);
}
