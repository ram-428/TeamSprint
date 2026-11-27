import mongoose from 'mongoose';
import { Issue, Project, User, Automation, Sprint, Team } from './models';
import { AppError, forbidden, notFound, notify, logActivity } from './api';
import { can, type ProjectLike } from './rbac';
import type { AuthUser } from './auth';

import { STATUSES, type StatusDef } from '../lib/statuses';
import { ensureProjectStatuses } from './migrate';
import { applyMasters, activeTypeKeys } from './masters';
import { assertTeam } from './teams';
export { STATUSES, type StatusDef };

/** Every project type now uses the same shared status set. */
export const WORKFLOWS: Record<string, StatusDef[]> = { scrum: STATUSES, kanban: STATUSES, business: STATUSES, service_desk: STATUSES };

export const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'] as const;
export const ISSUE_TYPES = ['epic', 'story', 'task', 'bug', 'subtask'] as const;

export async function loadProject(user: AuthUser, key: string): Promise<any> {
  if (!user.orgId) throw notFound('Project not found');
  const filter: any = { key: key.toUpperCase(), orgId: user.orgId };
  const p = await Project.findOne(filter).lean<any>();
  if (!p || !can(user, 'project.view', p)) throw notFound('Project not found');
  await ensureProjectStatuses(p); // a project still on an old status list is converted the first time it's opened
  return applyMasters(p); // the org's Status master decides the columns/choices
}

/** Rejects an issue type that is not (or no longer) in the organization's Issue Type master. An issue may keep a retired type it already has. */
async function assertIssueType(orgId: any, type: string, current?: string) {
  if (type === current) return;
  if (!(await activeTypeKeys(orgId)).includes(type)) throw new AppError(400, 'BAD_TYPE', 'This issue type is not available. Ask your admin to enable it.', { type: 'Not an available issue type' });
}

/**
 * Hierarchy rule: Epic → Story / Task / Bug. Only those can be put under an epic; an epic (or a sub-task) cannot,
 * and the target must be a live epic in the same project. An item may also have no epic at all.
 */
async function assertEpicLink(project: any, type: string, epicId: any, selfId?: any) {
  if (!epicId) return;
  if (type === 'epic') throw new AppError(400, 'BAD_EPIC', 'An epic cannot be placed under another epic', { epicId: 'Epics cannot have an epic' });
  if (type === 'subtask') throw new AppError(400, 'BAD_EPIC', 'A sub-task follows its parent issue and cannot be linked to an epic', { epicId: 'Not allowed for sub-tasks' });
  if (!mongoose.isValidObjectId(String(epicId)) || (selfId && String(epicId) === String(selfId))) throw new AppError(400, 'BAD_EPIC', 'Epic not found', { epicId: 'Epic not found' });
  const e = await Issue.exists({ _id: epicId, projectId: project._id, type: 'epic', deletedAt: null });
  if (!e) throw new AppError(400, 'BAD_EPIC', 'Epic not found in this project', { epicId: 'Epic not found' });
}

export function requirePerm(user: AuthUser, perm: string, p: ProjectLike, owns = false) {
  if (!can(user, perm, p, owns)) throw forbidden();
}

export async function loadIssue(user: AuthUser, key: string) {
  const find = () => (user.orgId ? Issue.findOne({ key: key.toUpperCase(), deletedAt: null, orgId: user.orgId }) : null);
  let issue = await find();
  if (!issue) throw notFound('Issue not found');
  const project = await Project.findById(issue.projectId).lean<any>();
  if (!project || !can(user, 'project.view', project)) throw notFound('Issue not found');
  // Convert a project still on an old status list, then reload the issue so it carries its new status.
  if (await ensureProjectStatuses(project)) { issue = await find(); if (!issue) throw notFound('Issue not found'); }
  await applyMasters(project);
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
    issue.resolution = st.category === 'done' ? patch.resolution || (st.id === 'cancelled' ? "Won't Do" : 'Done') : undefined;
  }
  if (patch.type) await assertIssueType(project.orgId, patch.type, issue.type);
  // Hierarchy checks, using the type the issue will have after this update.
  const nextType = patch.type || issue.type;
  if (patch.type && patch.type !== issue.type && issue.type === 'epic') {
    const kids = await Issue.countDocuments({ epicId: issue._id, deletedAt: null });
    if (kids) throw new AppError(400, 'BAD_TYPE', `This epic has ${kids} work item${kids > 1 ? 's' : ''}. Move ${kids > 1 ? 'them' : 'it'} out of the epic before changing its type`);
  }
  if ('epicId' in patch) await assertEpicLink(project, nextType, patch.epicId, issue._id);
  else if (nextType === 'epic' && issue.epicId) patch = { ...patch, epicId: null }; // becoming an epic: it leaves its parent epic
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
  // Team is optional. Its history entry stores team names (not ids) so the History tab reads naturally.
  let teamDiff: { from: any; to: any } | undefined;
  if ('teamId' in patch && String(patch.teamId || '') !== String(issue.teamId || '')) {
    const [from, to] = await Promise.all([
      issue.teamId ? Team.findById(issue.teamId).select('name').lean<any>() : null,
      patch.teamId ? assertTeam(project.orgId, patch.teamId) : null,
    ]);
    issue.teamId = patch.teamId || undefined;
    teamDiff = { from: from?.name ?? null, to: to?.name ?? null };
  }
  if ('rank' in patch) issue.rank = patch.rank;
  issue.version = (issue.version || 1) + 1;
  await issue.save();

  const diff: Record<string, { from: any; to: any }> = {};
  for (const f of FIELDS_DIFF) if (norm(before[f]) !== norm(issue[f]) && f !== 'description') diff[f] = { from: before[f] ?? null, to: issue[f] ?? null };
  if (norm(before.description) !== norm(issue.description)) diff.description = { from: '(edited)', to: '(edited)' };
  if (teamDiff) diff.team = teamDiff;
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
  await assertIssueType(project.orgId, data.type || 'task');
  // Validate links before reserving an issue number, so a rejected create doesn't skip a key.
  if (data.teamId) await assertTeam(project.orgId, data.teamId);
  await assertEpicLink(project, data.type || 'task', data.epicId);
  const p = await Project.findOneAndUpdate({ _id: project._id }, { $inc: { issueCounter: 1 } }, { new: true }).lean<any>();
  const number = p.issueCounter;
  const first = (data.status && project.statuses.find((s: any) => s.id === data.status)) || project.statuses[0];
  if (data.status && first.id !== data.status) throw new AppError(400, 'BAD_STATUS', 'Unknown status for this project');
  const last = await Issue.findOne({ projectId: project._id }).sort({ rank: -1 }).select('rank').lean<any>();
  const issue = await Issue.create({
    orgId: project.orgId, projectId: project._id, projectKey: project.key, number, key: `${project.key}-${number}`,
    type: data.type || 'task', summary: data.summary, description: data.description, status: first.id, statusCategory: first.category,
    priority: data.priority || 'Medium', reporterId: user.id, assigneeId: data.assigneeId || (project.type === 'service_desk' ? undefined : undefined),
    attachments: data.attachments || [], labels: data.labels || [], components: data.components || [], fixVersion: data.fixVersion, epicId: data.epicId, parentId: data.parentId,
    sprintId: data.sprintId, teamId: data.teamId, points: data.points, estimate: data.estimate, dueDate: data.dueDate, startDate: data.startDate,
    rank: (last?.rank ?? 0) + 1000, watchers: [user.id], statusChangedAt: new Date(),
    ...(first.category === 'done' ? { resolvedAt: new Date(), resolution: first.id === 'cancelled' ? "Won't Do" : 'Done' } : {}),
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
