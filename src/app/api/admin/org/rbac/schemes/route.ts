import { z } from 'zod';
import mongoose from 'mongoose';
import { route, AppError, audit, targetOrg } from '@/server/api';
import { PermissionScheme, Project } from '@/server/models';
import { ensureAccessMasters, reloadAccess } from '@/server/access';
import { DEFAULT_GRANTS } from '@/lib/permissions';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** All permission schemes of the org, each with its grants and the projects that use it. */
export const GET = route(async (req, { user }) => {
  const orgId = targetOrg(user, req);
  await ensureAccessMasters(orgId);
  const [schemes, projects] = await Promise.all([
    PermissionScheme.find({ orgId }).sort({ isDefault: -1, name: 1 }).lean<any[]>(),
    Project.find({ orgId: new mongoose.Types.ObjectId(orgId), archived: { $ne: true } }).select('key name color permissionSchemeId').sort({ name: 1 }).lean<any[]>(),
  ]);
  const def = schemes.find((s) => s.isDefault);
  return schemes.map((s) => ({
    ...s, _id: String(s._id),
    projects: projects.filter((p) => (p.permissionSchemeId ? String(p.permissionSchemeId) === String(s._id) : String(s._id) === String(def?._id))).map((p) => ({ key: p.key, name: p.name, color: p.color })),
  }));
});

const createSchema = z.object({ name: z.string().trim().min(2, 'Name needs at least 2 characters').max(60), description: z.string().trim().max(300).optional(), copyFrom: z.string().regex(/^[0-9a-f]{24}$/i).optional() });

export const POST = route(async (req, { user }) => {
  const orgId = targetOrg(user, req);
  const d = createSchema.parse(await req.json());
  if (await PermissionScheme.exists({ orgId, name: new RegExp(`^${escapeRe(d.name)}$`, 'i') })) throw new AppError(409, 'DUPLICATE', 'A scheme with that name exists', { name: 'Already exists' });
  const src = d.copyFrom ? await PermissionScheme.findOne({ _id: d.copyFrom, orgId }).lean<any>() : null;
  const s = await PermissionScheme.create({ orgId, name: d.name, description: d.description || '', isDefault: false, grants: src?.grants ?? DEFAULT_GRANTS });
  await audit({ ...user, orgId }, 'rbac.scheme_created', d.name);
  await reloadAccess(orgId);
  return { _id: String(s._id) };
});
