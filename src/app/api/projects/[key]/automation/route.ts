import { z } from 'zod';
import { route, AppError, audit } from '@/server/api';
import { Automation } from '@/server/models';
import { loadProject, requirePerm } from '@/server/domain';

export const GET = route(async (_req, { user, params }) => {
  const p = await loadProject(user, params.key);
  requirePerm(user, 'project.view', p);
  return Automation.find({ projectId: p._id }).sort({ createdAt: 1 }).lean();
});

const schema = z.object({
  name: z.string().trim().min(3).max(80), trigger: z.enum(['issue_created', 'status_changed']),
  conditionField: z.string().optional(), conditionValue: z.string().optional(),
  actionType: z.enum(['assign_lead', 'set_priority', 'add_label', 'notify_lead']), actionValue: z.string().optional(),
});
export const POST = route(async (req, { user, params }) => {
  const p = await loadProject(user, params.key);
  requirePerm(user, 'project.manage_automation', p);
  const b = schema.parse(await req.json());
  const r = await Automation.create({ ...b, orgId: p.orgId, projectId: p._id });
  await audit(user, 'automation.created', b.name);
  return r;
});

export const PATCH = route(async (req, { user, params }) => {
  const p = await loadProject(user, params.key);
  requirePerm(user, 'project.manage_automation', p);
  const b = z.object({ id: z.string(), enabled: z.boolean() }).parse(await req.json());
  await Automation.updateOne({ _id: b.id, projectId: p._id }, { enabled: b.enabled });
  return { done: true };
});

export const DELETE = route(async (req, { user, params }) => {
  const p = await loadProject(user, params.key);
  requirePerm(user, 'project.manage_automation', p);
  const r = await Automation.deleteOne({ _id: new URL(req.url).searchParams.get('id'), projectId: p._id });
  if (!r.deletedCount) throw new AppError(404, 'NOT_FOUND', 'Rule not found');
  return { done: true };
});
