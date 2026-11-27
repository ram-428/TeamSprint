import { z } from 'zod';
import { route, AppError } from '@/server/api';
import { Issue, Comment, Activity, Worklog, User, Project, Sprint } from '@/server/models';
import { loadIssue, applyIssueUpdate, requirePerm } from '@/server/domain';
import { hydrate } from '@/server/query';
import { abilities, can } from '@/server/rbac';

export const GET = route(async (_req, { user, params }) => {
  const { issue, project } = await loadIssue(user, params.key);
  const [h] = await hydrate([issue.toObject()]);
  const [comments, activity, worklogs, children, epic, sprint] = await Promise.all([
    Comment.find({ issueId: issue._id }).sort({ createdAt: 1 }).lean<any[]>(),
    Activity.find({ issueId: issue._id }).sort({ createdAt: -1 }).limit(100).lean<any[]>(),
    Worklog.find({ issueId: issue._id }).sort({ startedAt: -1 }).lean<any[]>(),
    Issue.find({ deletedAt: null, $or: [{ parentId: issue._id }, { epicId: issue._id }] }).sort({ rank: 1 }).select('key summary type status statusCategory assigneeId points priority').lean<any[]>(),
    issue.epicId ? Issue.findById(issue.epicId).select('key summary').lean<any>() : null,
    issue.sprintId ? Sprint.findById(issue.sprintId).select('name state').lean<any>() : null,
  ]);
  const ids = [...comments.map((c) => c.authorId), ...activity.map((a) => a.actorId), ...worklogs.map((w) => w.userId), ...(issue.watchers || [])];
  const users = await User.find({ _id: { $in: ids } }).select('name color avatarUrl').lean<any[]>();
  const u = (id: any) => users.find((x) => String(x._id) === String(id));
  const owns = String(issue.reporterId) === user.id;
  const ab = abilities(user, project);
  return {
    issue: h, project: { _id: project._id, key: project.key, name: project.name, type: project.type, statuses: project.statuses, components: project.components, versions: project.versions },
    comments: comments.filter((c) => !c.internal || ab.role !== 'viewer').map((c) => ({ ...c, author: u(c.authorId), canDelete: can(user, 'comment.delete_any', project) || String(c.authorId) === user.id, canEdit: String(c.authorId) === user.id && can(user, 'comment.add', project) })),
    activity: activity.map((a) => ({ ...a, actor: u(a.actorId) })),
    worklogs: worklogs.map((w) => ({ ...w, user: u(w.userId) })),
    children: await hydrate(children), epic, sprint,
    watching: (issue.watchers || []).map(String).includes(user.id), watcherCount: (issue.watchers || []).length,
    abilities: { ...ab, edit: can(user, 'issue.edit_any', project, owns), transition: can(user, 'issue.transition', project, owns || String(issue.assigneeId) === user.id), delete: can(user, 'issue.delete_any', project) },
  };
});

const patchSchema = z.object({
  summary: z.string().trim().min(3).max(200).optional(), description: z.string().max(20000).optional(),
  status: z.string().optional(), resolution: z.string().optional(), priority: z.enum(['Highest', 'High', 'Medium', 'Low', 'Lowest']).optional(),
  type: z.string().trim().min(1).max(40).optional(), assigneeId: z.string().nullable().optional(),
  labels: z.array(z.string().max(40)).max(20).optional(), components: z.array(z.string()).optional(), fixVersion: z.string().optional(),
  points: z.number().min(0).max(100).nullable().optional(), estimate: z.number().min(0).nullable().optional(),
  dueDate: z.string().nullable().optional(), startDate: z.string().nullable().optional(), sprintId: z.string().nullable().optional(), epicId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  flagged: z.boolean().optional(), version: z.number().optional(),
  watch: z.boolean().optional(), vote: z.boolean().optional(),
});

export const PATCH = route(async (req, { user, params }) => {
  const { issue, project } = await loadIssue(user, params.key);
  const b = patchSchema.parse(await req.json());
  const owns = String(issue.reporterId) === user.id;
  if (b.watch !== undefined) {
    const set = new Set((issue.watchers || []).map(String));
    b.watch ? set.add(user.id) : set.delete(user.id);
    issue.watchers = [...set] as any; await issue.save();
    if (Object.keys(b).length === 1) return { done: true };
  }
  if (b.vote !== undefined) {
    const set = new Set((issue.votes || []).map(String));
    b.vote ? set.add(user.id) : set.delete(user.id);
    issue.votes = [...set] as any; await issue.save();
    if (Object.keys(b).length === 1) return { done: true };
  }
  const { watch, vote, version, ...patch } = b; void watch; void vote;
  if (version !== undefined && version !== issue.version) throw new AppError(409, 'CONFLICT', 'Someone else updated this issue. Reload to see their changes.');
  const touchesContent = Object.keys(patch).some((k) => k !== 'status' && k !== 'resolution');
  if (touchesContent) requirePerm(user, 'issue.edit_any', project, owns);
  const p: Record<string, any> = { ...patch };
  if ('dueDate' in p) p.dueDate = p.dueDate ? new Date(p.dueDate) : undefined;
  if ('startDate' in p) p.startDate = p.startDate ? new Date(p.startDate) : undefined;
  if (p.points === null) p.points = undefined;
  if (p.estimate === null) p.estimate = undefined;
  if (p.sprintId) { const s = await Sprint.findOne({ _id: p.sprintId, projectId: project._id }).lean(); if (!s) throw new AppError(400, 'BAD_SPRINT', 'Sprint not found in this project'); }
  if (p.epicId) { const e = await Issue.findOne({ _id: p.epicId, projectId: project._id, type: 'epic' }).lean(); if (!e) throw new AppError(400, 'BAD_EPIC', 'Epic not found'); }
  if (p.type === 'epic' && issue.parentId) throw new AppError(400, 'BAD_TYPE', 'A sub-task cannot be converted to an epic');
  return applyIssueUpdate(user, issue, project, p);
});

export const DELETE = route(async (_req, { user, params }) => {
  const { issue, project } = await loadIssue(user, params.key);
  requirePerm(user, 'issue.delete_any', project);
  issue.deletedAt = new Date(); await issue.save();
  await Issue.updateMany({ parentId: issue._id }, { deletedAt: new Date() });
  return { done: true };
});

void Project;
