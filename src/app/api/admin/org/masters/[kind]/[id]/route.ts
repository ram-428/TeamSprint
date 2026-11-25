import { z } from 'zod';
import { route, AppError, audit, targetOrg } from '@/server/api';
import { Issue, IssueTypeMaster, StatusMaster } from '@/server/models';
import { kindOf, colorSchema, nameSchema } from '@/server/masters';

const patchSchema = z.object({ name: nameSchema.optional(), color: colorSchema.optional(), active: z.boolean().optional(), category: z.enum(['todo', 'inprogress', 'done']).optional() });

/** Every project needs somewhere for new issues to start (todo) and somewhere for finished ones to land (done). */
async function assertCategoryStillCovered(orgId: string, category: string, exceptId: string) {
  if (category === 'inprogress') return;
  if (!(await StatusMaster.exists({ orgId, active: true, category, id: { $ne: exceptId } })))
    throw new AppError(400, 'CATEGORY_NEEDED', `Keep at least one active ${category === 'todo' ? 'To do' : 'Done'} status`);
}

export const PATCH = route(async (req, { user, params }) => {
  const orgId = targetOrg(user, req); const kind = kindOf(params.kind);
  const b = patchSchema.parse(await req.json());
  if (kind === 'types') {
    const t = await IssueTypeMaster.findOne({ orgId, key: params.id });
    if (!t) throw new AppError(404, 'NOT_FOUND', 'Issue type not found');
    if (b.active === false && t.system) throw new AppError(400, 'SYSTEM', `${t.name} is built in and cannot be disabled`);
    if (b.name && b.name.toLowerCase() !== t.name.toLowerCase() && (await IssueTypeMaster.exists({ orgId, key: { $ne: t.key }, name: new RegExp(`^${b.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })))
      throw new AppError(409, 'DUPLICATE', 'That name already exists', { name: 'Already exists' });
    if (b.name) t.name = b.name; if (b.color) t.color = b.color; if (b.active !== undefined) t.active = b.active;
    await t.save(); await audit({ ...user, orgId }, 'master.issue_type_updated', t.name, b);
    return { done: true };
  }
  const s = await StatusMaster.findOne({ orgId, id: params.id });
  if (!s) throw new AppError(404, 'NOT_FOUND', 'Status not found');
  if (b.name && b.name.toLowerCase() !== s.name.toLowerCase() && (await StatusMaster.exists({ orgId, id: { $ne: s.id }, name: new RegExp(`^${b.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })))
    throw new AppError(409, 'DUPLICATE', 'That name already exists', { name: 'Already exists' });
  if (b.active === false && s.active) {
    const n = await Issue.countDocuments({ orgId, status: s.id, deletedAt: null });
    if (n) throw new AppError(400, 'IN_USE', `${n} issue${n > 1 ? 's use' : ' uses'} “${s.name}”. Move ${n > 1 ? 'them' : 'it'} to another status first`);
  }
  const leavingCategory = (b.active === false && s.active) || (b.category && b.category !== s.category);
  if (leavingCategory) await assertCategoryStillCovered(orgId, s.category, s.id);
  if (b.name) s.name = b.name; if (b.color) s.color = b.color; if (b.active !== undefined) s.active = b.active;
  if (b.category && b.category !== s.category) { s.category = b.category; await Issue.updateMany({ orgId, status: s.id }, { $set: { statusCategory: b.category } }); }
  await s.save(); await audit({ ...user, orgId }, 'master.status_updated', s.name, b);
  return { done: true };
});

export const DELETE = route(async (req, { user, params }) => {
  const orgId = targetOrg(user, req); const kind = kindOf(params.kind);
  if (kind === 'types') {
    const t = await IssueTypeMaster.findOne({ orgId, key: params.id });
    if (!t) throw new AppError(404, 'NOT_FOUND', 'Issue type not found');
    if (t.system) throw new AppError(400, 'SYSTEM', `${t.name} is built in and cannot be deleted`);
    const n = await Issue.countDocuments({ orgId, type: t.key });
    if (n) throw new AppError(400, 'IN_USE', `${n} issue${n > 1 ? 's use' : ' uses'} this type. Disable it instead, or change those issues first`);
    await t.deleteOne(); await audit({ ...user, orgId }, 'master.issue_type_deleted', t.name);
    return { deleted: true };
  }
  const s = await StatusMaster.findOne({ orgId, id: params.id });
  if (!s) throw new AppError(404, 'NOT_FOUND', 'Status not found');
  const n = await Issue.countDocuments({ orgId, status: s.id });
  if (n) throw new AppError(400, 'IN_USE', `${n} issue${n > 1 ? 's use' : ' uses'} “${s.name}”. Move ${n > 1 ? 'them' : 'it'} to another status first`);
  if (s.active) await assertCategoryStillCovered(orgId, s.category, s.id);
  await s.deleteOne(); await audit({ ...user, orgId }, 'master.status_deleted', s.name);
  return { deleted: true };
});
