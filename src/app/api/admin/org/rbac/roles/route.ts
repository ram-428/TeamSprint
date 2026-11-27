import { z } from 'zod';
import mongoose from 'mongoose';
import { route, AppError, audit, targetOrg } from '@/server/api';
import { Project, ProjectRoleMaster } from '@/server/models';
import { orgRoles } from '@/server/access';
import { nameSchema, slug } from '@/server/masters';

/** Project roles of the org, with how many project memberships use each (admin screen). */
export const GET = route(async (req, { user }) => {
  const orgId = targetOrg(user, req);
  const [roles, usage] = await Promise.all([
    orgRoles(orgId),
    Project.aggregate([{ $match: { orgId: new mongoose.Types.ObjectId(orgId), archived: { $ne: true } } }, { $unwind: '$members' }, { $group: { _id: '$members.role', n: { $sum: 1 } } }]),
  ]);
  const used = new Map<string, number>(usage.map((u: any) => [String(u._id), u.n]));
  return roles.map((r: any) => ({ ...r, used: used.get(r.key) ?? 0 }));
});

const createSchema = z.object({ name: nameSchema, description: z.string().trim().max(200).optional() });

export const POST = route(async (req, { user }) => {
  const orgId = targetOrg(user, req);
  const d = createSchema.parse(await req.json());
  const existing = await orgRoles(orgId);
  if (existing.some((r: any) => r.name.toLowerCase() === d.name.toLowerCase())) throw new AppError(409, 'DUPLICATE', 'That role already exists', { name: 'Already exists' });
  let key = slug(d.name); const taken = new Set(existing.map((r: any) => r.key));
  for (let n = 2; taken.has(key); n++) key = `${slug(d.name).slice(0, 36)}_${n}`;
  await ProjectRoleMaster.create({ orgId, key, name: d.name, description: d.description || '', system: false, order: existing.reduce((m: number, r: any) => Math.max(m, r.order), -1) + 1 });
  await audit({ ...user, orgId }, 'rbac.role_created', d.name);
  return { key };
});
