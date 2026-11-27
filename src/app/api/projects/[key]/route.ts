import { z } from 'zod';
import { route, AppError, audit } from '@/server/api';
import { Project, User, Issue, PermissionScheme } from '@/server/models';
import { loadProject, requirePerm } from '@/server/domain';
import { abilities, can } from '@/server/rbac';
import { reloadAccess } from '@/server/access';

export const GET = route(async (_req, { user, params }) => {
  const p = await loadProject(user, params.key);
  const ids = [...p.members.map((m: any) => m.userId), p.leadId].filter(Boolean);
  const users = await User.find({ _id: { $in: ids } }).select('name email color title role avatarUrl').lean<any[]>();
  const members = p.members.map((m: any) => ({ ...users.find((u) => String(u._id) === String(m.userId)), projectRole: m.role }));
  const lead = users.find((u) => String(u._id) === String(p.leadId));
  return { ...p, members, lead: lead && { name: lead.name }, abilities: abilities(user, p), starred: (p.starredBy || []).map(String).includes(user.id) };
});

const patchSchema = z.object({
  name: z.string().min(2).max(60).optional(), description: z.string().max(500).optional(), color: z.string().optional(), icon: z.string().optional(),
  visibility: z.enum(['private', 'org']).optional(), leadId: z.string().regex(/^[0-9a-f]{24}$/i, 'Select a project member').optional(), archived: z.boolean().optional(),
  components: z.array(z.string()).optional(), wip: z.record(z.string(), z.number().int().min(0)).optional(),
  versions: z.array(z.object({ id: z.string(), name: z.string(), releaseDate: z.string().optional(), released: z.boolean().optional() })).optional(),
  starred: z.boolean().optional(),
  permissionSchemeId: z.string().regex(/^[0-9a-f]{24}$/i).nullable().optional(), // null = org default
});

export const PATCH = route(async (req, { user, params }) => {
  const p = await loadProject(user, params.key);
  const d = patchSchema.parse(await req.json());
  if (d.starred !== undefined) {
    await Project.updateOne({ _id: p._id }, d.starred ? { $addToSet: { starredBy: user.id } } : { $pull: { starredBy: user.id } });
    if (Object.keys(d).length === 1) return { done: true };
  }
  const { starred, permissionSchemeId, ...rest } = d; void starred;
  if (permissionSchemeId !== undefined) {
    // Choosing a project's permission scheme is an org-admin task, as in Jira.
    if (!can(user, 'org.manage_members')) throw new AppError(403, 'FORBIDDEN', 'Only organization admins can change the permission scheme');
    if (permissionSchemeId && !(await PermissionScheme.exists({ _id: permissionSchemeId, orgId: p.orgId }))) throw new AppError(400, 'BAD_SCHEME', 'Permission scheme not found');
    await Project.updateOne({ _id: p._id }, permissionSchemeId ? { permissionSchemeId } : { $unset: { permissionSchemeId: 1 } });
    await audit(user, 'project.permission_scheme_changed', p.key, { permissionSchemeId });
    await reloadAccess(String(p.orgId));
    if (!Object.keys(rest).length) return { done: true };
  }
  if (Object.keys(rest).length) {
    if (rest.wip) requirePerm(user, 'board.manage', p);
    if (!rest.wip || rest.leadId !== undefined) requirePerm(user, 'project.edit', p);
    const filter = { _id: p._id, ...(rest.leadId !== undefined && { 'members.userId': rest.leadId }) };
    const result = await Project.updateOne(filter, rest);
    if (rest.leadId !== undefined && !result.matchedCount) {
      throw new AppError(400, 'BAD_LEAD', 'The project lead must be a project member', { leadId: 'Select a project member' });
    }
    await audit(user, 'project.updated', p.key, rest);
  }
  return { done: true };
});

export const DELETE = route(async (_req, { user, params }) => {
  const p = await loadProject(user, params.key);
  requirePerm(user, 'project.edit', p);
  await Project.updateOne({ _id: p._id }, { archived: true });
  await Issue.updateMany({ projectId: p._id }, { deletedAt: new Date() });
  await audit(user, 'project.deleted', p.key);
  return { done: true };
});
