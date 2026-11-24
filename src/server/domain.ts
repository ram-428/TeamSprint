import mongoose from 'mongoose';
import { Issue, Project, User, Automation, Sprint } from './models';
import { AppError, forbidden, notFound, notify, logActivity } from './api';
import { can, type ProjectLike } from './rbac';
import type { AuthUser } from './auth';

export const WORKFLOWS: Record<string, { id: string; name: string; category: 'todo' | 'inprogress' | 'done'; color: string }[]> = {
  scrum: [
    { id: 'todo', name: 'To Do', category: 'todo', color: '#94a3b8' },
    { id: 'progress', name: 'In Progress', category: 'inprogress', color: '#7c5cff' },
    { id: 'review', name: 'In Review', category: 'inprogress', color: '#22d3ee' },
    { id: 'qa', name: 'QA', category: 'inprogress', color: '#fbbf24' },
    { id: 'done', name: 'Done', category: 'done', color: '#34d399' },
  ],
  kanban: [
    { id: 'todo', name: 'To Do', category: 'todo', color: '#94a3b8' },
    { id: 'progress', name: 'In Progress', category: 'inprogress', color: '#7c5cff' },
    { id: 'done', name: 'Done', category: 'done', color: '#34d399' },
  ],
  business: [
    { id: 'todo', name: 'Backlog', category: 'todo', color: '#94a3b8' },
    { id: 'progress', name: 'Doing', category: 'inprogress', color: '#7c5cff' },
    { id: 'review', name: 'Review', category: 'inprogress', color: '#22d3ee' },
    { id: 'done', name: 'Done', category: 'done', color: '#34d399' },
  ],
  service_desk: [
    { id: 'todo', name: 'Waiting for support', category: 'todo', color: '#94a3b8' },
    { id: 'progress', name: 'In progress', category: 'inprogress', color: '#7c5cff' },
    { id: 'customer', name: 'Waiting for customer', category: 'inprogress', color: '#fbbf24' },
    { id: 'done', name: 'Resolved', category: 'done', color: '#34d399' },
  ],
};

export const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'] as const;
export const ISSUE_TYPES = ['epic', 'story', 'task', 'bug', 'subtask'] as const;

export async function loadProject(user: AuthUser, key: string): Promise<any> {
  if (!user.orgId) throw notFound('Project not found');
  const filter: any = { key: key.toUpperCase(), orgId: user.orgId };
  const p = await Project.findOne(filter).lean<any>();
  if (!p || !can(user, 'project.view', p)) throw notFound('Project not found');
  return p;
}

export function requirePerm(user: AuthUser, perm: string, p: ProjectLike, owns = false) {
  if (!can(user, perm, p, owns)) throw forbidden();
}

export async function loadIssue(user: AuthUser, key: string) {
  const issue = user.orgId ? await Issue.findOne({ key: key.toUpperCase(), deletedAt: null, orgId: user.orgId }) : null;
  if (!issue) throw notFound('Issue not found');
  const project = await Project.findById(issue.projectId).lean<any>();
  if (!project || !can(user, 'project.view', project)) throw notFound('Issue not found');
  return { issue, project };
}

const FIELDS_DIFF = ['summary', 'description', 'status', 'priority', 'assigneeId', 'type', 'points', 'dueDate', 'startDate', 'sprintId', 'epicId', 'labels', 'components', 'fixVersion', 'flagged', 'estimate'] as const;

const norm = (v: any) => (v == null ? null : Array.isArray(v) ? v.map(String).join(',') : v instanceof Date ? v.toISOString() : String(v));

export async function applyIssueUpdate(user: AuthUser, issue: any, project: any, patch: Record<string, any>) {
  const before: Record<string, any> = {};
  for (const f of FIELDS_DIFF) before[f] = issue[f];

  if (patch.status && patch.status !== issue.status) {
    const st = project.statuses.find((s: any) => s.id === patch.status);
    if (!st) throw new AppError(400, 'BAD_STATUS', 'Unknown status for this project');
    const owns = String(issue.reporterId) === user.id || String(issue.assigneeId) === user.id;
    requirePerm(user, 'issue.transition', project, owns);
    // WIP-limit soft check is a UI warning only; hard rules: resolution required when entering Done
    issue.status = st.id;
    issue.statusCategory = st.category;
    issue.statusChangedAt = new Date();
    issue.resolvedAt = st.category === 'done' ? new Date() : undefined;
    issue.resolution = st.category === 'done' ? patch.resolution || 'Done' : undefined;
  }
  const simple = ['summary', 'description', 'priority', 'type', 'points', 'dueDate', 'startDate', 'labels', 'components', 'fixVersion', 'flagged', 'estimate'] as const;
  for (const f of simple) if (f in patch) issue[f] = patch[f] === '' ? undefined : patch[f];
  if ('assigneeId' in patch) {
    requirePerm(user, 'issue.assign', project, String(issue.reporterId) === user.id);
    if (patch.assigneeId) {
      const target = await User.findOne({ _id: patch.assigneeId, orgId: project.orgId, status: 'active' }).lean<any>();
      if (!target) throw new AppError(400, 'BAD_ASSIGNEE', 'Assignee is not an active member of this organization');
      const pm = can({ ...user, id: String(target._id), role: target.role, platformRole: target.platformRole, orgId: String(target.orgId) } as AuthUser, 'issue.create', project);
      if (!pm) throw new AppError(400, 'BAD_ASSIGNEE', `${target.name} cannot be assigned in this project`);
    }
    issue.assigneeId = patch.assigneeId || undefined;
  }
  if ('sprintId' in patch) issue.sprintId = patch.sprintId || undefined;
  if ('epicId' in patch) issue.epicId = patch.epicId || undefined;
  if ('rank' in patch) issue.rank = patch.rank;
  issue.version = (issue.version || 1) + 1;
  await issue.save();

  const diff: Record<string, { from: any; to: any }> = {};
  for (const f of FIELDS_DIFF) if (norm(before[f]) !== norm(issue[f]) && f !== 'description') diff[f] = { from: before[f] ?? null, to: issue[f] ?? null };
  if (norm(before.description) !== norm(issue.description)) diff.description = { from: '(edited)', to: '(edited)' };
  if (Object.keys(diff).length) {
    await logActivity(user, issue, 'updated', diff);
    const watchers = [issue.reporterId, issue.assigneeId, ...(issue.watchers || [])];
    if (diff.status) {
      const sName = project.statuses.find((s: any) => s.id === issue.status)?.name;
      await notify(watchers, user.id, 'status', `${user.name} moved ${issue.key} to ${sName}`, issue.key);
      await runAutomation(project, issue, 'status_changed', user);
    }
    if (diff.assigneeId && issue.assigneeId) await notify([issue.assigneeId], user.id, 'assigned', `${user.name} assigned you ${issue.key}: ${issue.summary}`, issue.key);
  }
  return { diff };
}

export async function runAutomation(project: any, issue: any, trigger: string, user: AuthUser) {
  const rules = await Automation.find({ projectId: project._id, enabled: true, trigger }).lean<any[]>();
  for (const r of rules) {
    const field = r.conditionField as string;
    const cond = !field || String(issue[field] ?? '').toLowerCase() === String(r.conditionValue ?? '').toLowerCase()
      || (field === 'status' && project.statuses.find((s: any) => s.id === issue.status)?.name?.toLowerCase() === String(r.conditionValue).toLowerCase());
    if (!cond) continue;
    if (r.actionType === 'assign_lead' && project.leadId) issue.assigneeId = project.leadId;
    if (r.actionType === 'set_priority') issue.priority = r.actionValue;
    if (r.actionType === 'add_label' && r.actionValue && !issue.labels.includes(r.actionValue)) issue.labels.push(r.actionValue);
    if (r.actionType === 'notify_lead' && project.leadId) await notify([String(project.leadId)], user.id, 'automation', `Automation "${r.name}" fired on ${issue.key}`, issue.key);
    await issue.save();
    await Automation.updateOne({ _id: r._id }, { $inc: { runCount: 1 }, lastRunAt: new Date() });
    await logActivity(user, issue, 'automation', { rule: r.name });
  }
}

export async function createIssue(user: AuthUser, project: any, data: Record<string, any>) {
  requirePerm(user, 'issue.create', project);
  const p = await Project.findOneAndUpdate({ _id: project._id }, { $inc: { issueCounter: 1 } }, { new: true }).lean<any>();
  const number = p.issueCounter;
  const first = project.statuses[0];
  const last = await Issue.findOne({ projectId: project._id }).sort({ rank: -1 }).select('rank').lean<any>();
  const issue = await Issue.create({
    orgId: project.orgId, projectId: project._id, projectKey: project.key, number, key: `${project.key}-${number}`,
    type: data.type || 'task', summary: data.summary, description: data.description, status: first.id, statusCategory: first.category,
    priority: data.priority || 'Medium', reporterId: user.id, assigneeId: data.assigneeId || (project.type === 'service_desk' ? undefined : undefined),
    labels: data.labels || [], components: data.components || [], fixVersion: data.fixVersion, epicId: data.epicId, parentId: data.parentId,
    sprintId: data.sprintId, points: data.points, estimate: data.estimate, dueDate: data.dueDate, startDate: data.startDate,
    rank: (last?.rank ?? 0) + 1000, watchers: [user.id], statusChangedAt: new Date(),
    slaDue: project.type === 'service_desk' ? new Date(Date.now() + 8 * 36e5) : undefined,
  });
  await logActivity(user, issue, 'created');
  if (issue.assigneeId) await notify([issue.assigneeId], user.id, 'assigned', `${user.name} assigned you ${issue.key}: ${issue.summary}`, issue.key);
  await runAutomation(project, issue, 'issue_created', user);
  return issue;
}

export const toId = (s: any) => (s ? new mongoose.Types.ObjectId(String(s)) : undefined);

export async function sprintSnapshot(sprintId: any) {
  const issues = await Issue.find({ sprintId, deletedAt: null }).select('points statusCategory').lean<any[]>();
  const total = issues.reduce((a, i) => a + (i.points || 0), 0);
  const done = issues.filter((i) => i.statusCategory === 'done').reduce((a, i) => a + (i.points || 0), 0);
  return { total, done, remaining: total - done };
}
export { Sprint };
