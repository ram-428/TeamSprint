import { z } from 'zod';
import { route, AppError, audit, targetOrg, oid } from '@/server/api';
import { PermissionScheme, Project } from '@/server/models';
import { orgRoles, reloadAccess } from '@/server/access';
import { PERMISSION_KEYS, PERMISSIONS } from '@/lib/permissions';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const grant = z.object({ perm: z.string(), holder: z.enum(['role', 'lead']), value: z.string().optional(), own: z.boolean().optional() });
const patchSchema = z.object({
  name: z.string().trim().min(2, 'Name needs at least 2 characters').max(60).optional(), description: z.string().trim().max(300).optional(),
  grants: z.array(grant).max(2000).optional(), isDefault: z.literal(true).optional(),
});

export const PATCH = route(async (req, { user, params }) => {
  const orgId = targetOrg(user, req);
  const b = patchSchema.parse(await req.json());
  const s = await PermissionScheme.findOne({ _id: oid(params.id), orgId });
  if (!s) throw new AppError(404, 'NOT_FOUND', 'Permission scheme not found');
  if (b.name && b.name.toLowerCase() !== s.name.toLowerCase() && (await PermissionScheme.exists({ orgId, _id: { $ne: s._id }, name: new RegExp(`^${escapeRe(b.name)}$`, 'i') })))
    throw new AppError(409, 'DUPLICATE', 'A scheme with that name exists', { name: 'Already exists' });
  if (b.grants) {
    const roles = new Set((await orgRoles(orgId)).map((r: any) => r.key));
    const ownable = new Set(PERMISSIONS.filter((p) => p.ownable).map((p) => p.key));
    const seen = new Set<string>();
    s.grants = b.grants.filter((g) => {
      if (!PERMISSION_KEYS.includes(g.perm)) return false;
      if (g.holder === 'role' && (!g.value || !roles.has(g.value))) return false;
      const k = `${g.perm}|${g.holder}|${g.value ?? ''}`; if (seen.has(k)) return false; seen.add(k);
      return true;
    }).map((g) => ({ perm: g.perm, holder: g.holder, value: g.holder === 'role' ? g.value : undefined, own: g.holder === 'role' && ownable.has(g.perm) ? !!g.own : false }));
  }
  if (b.name) s.name = b.name; if (b.description !== undefined) s.description = b.description;
  if (b.isDefault && !s.isDefault) { await PermissionScheme.updateMany({ orgId, _id: { $ne: s._id } }, { isDefault: false }); s.isDefault = true; }
  await s.save(); await audit({ ...user, orgId }, 'rbac.scheme_updated', s.name, { name: b.name, isDefault: b.isDefault, grants: b.grants ? s.grants.length : undefined });
  await reloadAccess(orgId);
  return { done: true };
});

/** Projects using a deleted scheme fall back to the org default. The default scheme itself cannot be deleted. */
export const DELETE = route(async (req, { user, params }) => {
  const orgId = targetOrg(user, req);
  const s = await PermissionScheme.findOne({ _id: oid(params.id), orgId });
  if (!s) throw new AppError(404, 'NOT_FOUND', 'Permission scheme not found');
  if (s.isDefault) throw new AppError(400, 'DEFAULT', 'Make another scheme the default before deleting this one');
  await Project.updateMany({ orgId, permissionSchemeId: s._id }, { $unset: { permissionSchemeId: 1 } });
  await s.deleteOne(); await audit({ ...user, orgId }, 'rbac.scheme_deleted', s.name);
  await reloadAccess(orgId);
  return { deleted: true };
});
