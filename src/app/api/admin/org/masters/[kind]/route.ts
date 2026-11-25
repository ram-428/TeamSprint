import { z } from 'zod';
import mongoose from 'mongoose';
import { route, AppError, audit, targetOrg } from '@/server/api';
import { Issue, IssueTypeMaster, StatusMaster } from '@/server/models';
import { orgIssueTypes, orgStatuses, kindOf, slug, colorSchema, nameSchema } from '@/server/masters';

/** All entries (including inactive ones) with how many issues use each, for the admin screen. */
export const GET = route(async (req, { user, params }) => {
  const orgId = targetOrg(user, req); const kind = kindOf(params.kind);
  const field = kind === 'types' ? 'type' : 'status';
  const [items, usage] = await Promise.all([
    kind === 'types' ? orgIssueTypes(orgId, { all: true }) : orgStatuses(orgId, { all: true }),
    Issue.aggregate([{ $match: { orgId: new mongoose.Types.ObjectId(orgId) } }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }]),
  ]);
  const used = new Map<string, number>(usage.map((u: any) => [String(u._id), u.n]));
  return (items as any[]).map((i) => ({ ...i, used: used.get(kind === 'types' ? i.key : i.id) ?? 0 }));
});

const createSchema = z.object({ name: nameSchema, color: colorSchema, category: z.enum(['todo', 'inprogress', 'done']).optional() });

export const POST = route(async (req, { user, params }) => {
  const orgId = targetOrg(user, req); const kind = kindOf(params.kind);
  const d = createSchema.parse(await req.json());
  const M: any = kind === 'types' ? IssueTypeMaster : StatusMaster; const idField = kind === 'types' ? 'key' : 'id';
  const existing = (await (kind === 'types' ? orgIssueTypes(orgId, { all: true }) : orgStatuses(orgId, { all: true }))) as any[];
  if (existing.some((x) => x.name.toLowerCase() === d.name.toLowerCase())) throw new AppError(409, 'DUPLICATE', 'That name already exists', { name: 'Already exists' });
  if (kind === 'statuses' && !d.category) throw new AppError(422, 'VALIDATION', 'Choose a category', { category: 'Choose a category' });
  let id = slug(d.name); const taken = new Set(existing.map((x) => x[idField]));
  for (let n = 2; taken.has(id); n++) id = `${slug(d.name).slice(0, 36)}_${n}`;
  const order = existing.reduce((m, x) => Math.max(m, x.order), -1) + 1;
  await M.create({ orgId, [idField]: id, name: d.name, color: d.color, active: true, order, ...(kind === 'types' ? { system: false } : { category: d.category }) });
  await audit({ ...user, orgId }, kind === 'types' ? 'master.issue_type_created' : 'master.status_created', d.name);
  return { [idField]: id };
});

/** Re-orders the list: body is `{ ids: [...] }` in the new order. */
export const PUT = route(async (req, { user, params }) => {
  const orgId = targetOrg(user, req); const kind = kindOf(params.kind);
  const { ids } = z.object({ ids: z.array(z.string()).min(1).max(200) }).parse(await req.json());
  const M: any = kind === 'types' ? IssueTypeMaster : StatusMaster; const idField = kind === 'types' ? 'key' : 'id';
  await M.bulkWrite(ids.map((id, order) => ({ updateOne: { filter: { orgId, [idField]: id }, update: { $set: { order } } } })));
  await audit({ ...user, orgId }, kind === 'types' ? 'master.issue_types_reordered' : 'master.statuses_reordered', String(ids.length));
  return { done: true };
});
