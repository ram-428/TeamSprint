import { z } from 'zod';
import { route, AppError, audit, targetOrg } from '@/server/api';
import { PermissionScheme, Project, ProjectRoleMaster } from '@/server/models';
import { reloadAccess } from '@/server/access';
import { nameSchema } from '@/server/masters';

const patchSchema = z.object({ name: nameSchema.optional(), description: z.string().trim().max(200).optional() });
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const PATCH = route(async (req, { user, params }) => {
  const orgId = targetOrg(user, req);
  const b = patchSchema.parse(await req.json());
  const r = await ProjectRoleMaster.findOne({ orgId, key: params.key });
  if (!r) throw new AppError(404, 'NOT_FOUND', 'Role not found');
  if (b.name && b.name.toLowerCase() !== r.name.toLowerCase() && (await ProjectRoleMaster.exists({ orgId, key: { $ne: r.key }, name: new RegExp(`^${escapeRe(b.name)}$`, 'i') })))
    throw new AppError(409, 'DUPLICATE', 'That role already exists', { name: 'Already exists' });
  if (b.name) r.name = b.name; if (b.description !== undefined) r.description = b.description;
  await r.save(); await audit({ ...user, orgId }, 'rbac.role_updated', r.name, b);
  return { done: true };
});

/** Custom roles only, and only when no project member holds them. Their grants are removed from every scheme. */
export const DELETE = route(async (req, { user, params }) => {
  const orgId = targetOrg(user, req);
  const r = await ProjectRoleMaster.findOne({ orgId, key: params.key });
  if (!r) throw new AppError(404, 'NOT_FOUND', 'Role not found');
  if (r.system) throw new AppError(400, 'SYSTEM', `${r.name} is built in and cannot be deleted`);
  const n = await Project.countDocuments({ orgId, archived: { $ne: true }, 'members.role': r.key });
  if (n) throw new AppError(400, 'IN_USE', `${n} project${n > 1 ? 's have' : ' has'} members with this role. Change their role first`);
  await PermissionScheme.updateMany({ orgId }, { $pull: { grants: { holder: 'role', value: r.key } } });
  await r.deleteOne(); await audit({ ...user, orgId }, 'rbac.role_deleted', r.name);
  await reloadAccess(orgId);
  return { deleted: true };
});
