import mongoose, { Schema, type Model } from 'mongoose';

const opts = { timestamps: true } as const;
function model<T>(name: string, schema: Schema): Model<T> {
  // In dev, hot reload re-runs this file: re-register so schema changes (new fields) apply without restarting.
  // Otherwise the cached model keeps the old schema and Mongoose silently drops the new fields on save.
  if (process.env.NODE_ENV !== 'production' && mongoose.models[name]) mongoose.deleteModel(name);
  return ((mongoose.models[name] as unknown) || (mongoose.model(name, schema as any) as unknown)) as Model<T>;
}
const oid = Schema.Types.ObjectId;
/** Untyped schema factory – avoids TypeScript's very expensive Mongoose schema inference (docs are typed as any). */
const S = (def: any, o?: any): Schema => new Schema(def, o);

export const User = model<any>('User', S({
  name: String, email: { type: String, unique: true, lowercase: true, index: true },
  passwordHash: String, orgId: { type: oid, index: true }, role: { type: String, default: 'member' }, // org_admin|member|guest
  platformRole: { type: String, default: 'user' }, status: { type: String, default: 'active' },
  title: String, color: String, avatarUrl: String, theme: { type: String, default: 'simple' },
  failed: { type: Number, default: 0 }, lockUntil: Date, lastLoginAt: Date, tokenVersion: { type: Number, default: 0 },
  teamIds: [oid], capacityHours: { type: Number, default: 30 },
  otpHash: String, otpExpires: Date, otpTries: { type: Number, default: 0 },
}, opts));

export const Org = model<any>('Org', S({
  name: String, slug: { type: String, unique: true }, plan: { type: String, default: 'pro' }, status: { type: String, default: 'active' },
  maxUsers: { type: Number, default: 100 }, maxProjects: { type: Number, default: 50 },
}, opts));

/**
 * Org-level teams (like Jira Teams). `memberIds` is the source of truth for membership; `projectIds` are the projects the team works on
 * (a team can work on many projects). An issue may optionally belong to one team via `Issue.teamId`.
 */
export const Team = model<any>('Team', S({ orgId: { type: oid, index: true }, name: String, description: String, color: String, leadId: oid, memberIds: [oid], projectIds: [oid], createdBy: oid }, opts));

/** Organization-level master lists. They feed Create issue, the board columns and issue validation for every project in the org. */
const issueTypeMasterSchema = S({ orgId: { type: oid, index: true }, key: String, name: String, color: String, active: { type: Boolean, default: true }, system: { type: Boolean, default: false }, order: { type: Number, default: 0 } }, opts);
issueTypeMasterSchema.index({ orgId: 1, key: 1 }, { unique: true });
export const IssueTypeMaster = model<any>('IssueTypeMaster', issueTypeMasterSchema);

const statusMasterSchema = S({ orgId: { type: oid, index: true }, id: String, name: String, category: String, color: String, active: { type: Boolean, default: true }, order: { type: Number, default: 0 } }, opts);
statusMasterSchema.index({ orgId: 1, id: 1 }, { unique: true });
export const StatusMaster = model<any>('StatusMaster', statusMasterSchema);

/** RBAC masters: the org's project roles and its permission schemes (see src/lib/permissions.ts). */
const projectRoleMasterSchema = S({ orgId: { type: oid, index: true }, key: String, name: String, description: String, system: { type: Boolean, default: false }, order: { type: Number, default: 0 } }, opts);
projectRoleMasterSchema.index({ orgId: 1, key: 1 }, { unique: true });
export const ProjectRoleMaster = model<any>('ProjectRoleMaster', projectRoleMasterSchema);

const GrantSub = S({ perm: String, holder: String, value: String, own: Boolean }, { _id: false });
const permissionSchemeSchema = S({ orgId: { type: oid, index: true }, name: String, description: String, isDefault: { type: Boolean, default: false }, grants: [GrantSub] }, opts);
export const PermissionScheme = model<any>('PermissionScheme', permissionSchemeSchema);

const StatusSub = S({ id: String, name: String, category: String, color: String }, { _id: false });
const projectSchema = S({
  orgId: { type: oid, index: true }, key: String, name: String, description: String,
  type: { type: String, default: 'scrum' }, // scrum|kanban|business|service_desk
  leadId: oid, color: String, icon: String, visibility: { type: String, default: 'org' }, // private|org
  issueCounter: { type: Number, default: 0 }, archived: { type: Boolean, default: false },
  members: [{ userId: oid, role: String, _id: false }], // role key from ProjectRoleMaster (project_admin|developer|tester|reporter|viewer|custom)
  permissionSchemeId: oid, // null = the org's default permission scheme
  statuses: [StatusSub], wip: { type: Map, of: Number, default: {} },
  components: [String], versions: [{ id: String, name: String, releaseDate: Date, released: Boolean, _id: false }],
  starredBy: [oid],
}, opts);
projectSchema.index({ orgId: 1, key: 1 }, { unique: true });
export const Project = model<any>('Project', projectSchema);

const issueSchema = S({
  orgId: { type: oid, index: true }, projectId: { type: oid, index: true }, projectKey: String, key: { type: String, index: true }, number: Number,
  type: { type: String, default: 'task' }, // epic|story|task|bug|subtask
  summary: String, description: String, status: String, statusCategory: { type: String, default: 'todo' },
  priority: { type: String, default: 'Medium' }, resolution: String,
  reporterId: oid, assigneeId: { type: oid, index: true }, labels: [String], components: [String], fixVersion: String,
  epicId: oid, parentId: oid, sprintId: { type: oid, index: true }, teamId: { type: oid, index: true }, points: Number,
  estimate: Number, timeSpent: { type: Number, default: 0 }, dueDate: Date, startDate: Date, rank: { type: Number, index: true },
  attachments: [{ id: String, name: String, url: String, publicId: String, resourceType: String, kind: String, format: String, bytes: Number, width: Number, height: Number, uploadedBy: String, createdAt: String, _id: false }],
  flagged: Boolean, watchers: [oid], votes: [oid], links: [{ type: { type: String }, targetKey: String, _id: false }],
  resolvedAt: Date, version: { type: Number, default: 1 }, deletedAt: Date, slaDue: Date, statusChangedAt: Date,
}, opts);
issueSchema.index({ summary: 'text', description: 'text' });
issueSchema.index({ projectId: 1, deletedAt: 1, rank: 1 });
issueSchema.index({ projectId: 1, sprintId: 1, deletedAt: 1 });
issueSchema.index({ assigneeId: 1, statusCategory: 1, deletedAt: 1, dueDate: 1 });
issueSchema.index({ projectId: 1, statusCategory: 1, resolvedAt: 1 });
issueSchema.index({ orgId: 1, key: 1 }, { unique: true });
issueSchema.index({ epicId: 1 }); issueSchema.index({ parentId: 1 });
export const Issue = model<any>('Issue', issueSchema);

const commentSchema = S({
  orgId: oid, issueId: { type: oid, index: true }, authorId: oid, body: String, internal: Boolean, mentions: [oid],
}, opts);
commentSchema.index({ issueId: 1, createdAt: 1 });
export const Comment = model<any>('Comment', commentSchema);

const worklogSchema = S({ orgId: oid, issueId: { type: oid, index: true }, userId: oid, seconds: Number, startedAt: Date, description: String }, opts);
worklogSchema.index({ userId: 1, startedAt: -1 });
export const Worklog = model<any>('Worklog', worklogSchema);

const sprintSchema = S({
  orgId: oid, projectId: { type: oid, index: true }, name: String, goal: String, state: { type: String, default: 'future' },
  startDate: Date, endDate: Date, completedAt: Date, committed: Number, completed: Number,
  snapshots: [{ date: Date, remaining: Number, done: Number, _id: false }],
  retro: { wentWell: [String], improve: [String], actions: [String] },
}, opts);
sprintSchema.index({ projectId: 1, state: 1 });
export const Sprint = model<any>('Sprint', sprintSchema);

const activitySchema = S({
  orgId: oid, projectId: { type: oid, index: true }, issueId: { type: oid, index: true }, actorId: oid, action: String,
  diff: Schema.Types.Mixed, meta: Schema.Types.Mixed,
}, opts);
activitySchema.index({ projectId: 1, createdAt: -1 }); activitySchema.index({ issueId: 1, createdAt: -1 });
export const Activity = model<any>('Activity', activitySchema);

const notifSchema = S({
  userId: { type: oid, index: true }, actorId: oid, type: String, message: String, issueKey: String, readAt: Date,
}, opts);
notifSchema.index({ userId: 1, createdAt: -1 }); notifSchema.index({ userId: 1, readAt: 1 });
export const Notification = model<any>('Notification', notifSchema);

const auditSchema = S({
  orgId: oid, actorId: oid, impersonatedBy: oid, action: String, target: String, ip: String, meta: Schema.Types.Mixed,
}, opts);
auditSchema.index({ orgId: 1, createdAt: -1 }); auditSchema.index({ action: 1, createdAt: -1 }); auditSchema.index({ createdAt: -1 });
export const Audit = model<any>('Audit', auditSchema);

export const Goal = model<any>('Goal', S({
  orgId: oid, title: String, ownerId: oid, period: String, status: { type: String, default: 'on_track' },
  keyResults: [{ title: String, target: Number, current: Number, unit: String }],
}, opts));

export const SavedFilter = model<any>('SavedFilter', S({ orgId: oid, ownerId: oid, name: String, oql: String, shared: Boolean }, opts));

export const Automation = model<any>('Automation', S({
  orgId: oid, projectId: oid, name: String, enabled: { type: Boolean, default: true },
  trigger: String, // issue_created|status_changed
  conditionField: String, conditionValue: String,
  actionType: String, actionValue: String, // assign_lead|set_priority|add_label
  runCount: { type: Number, default: 0 }, lastRunAt: Date,
}, opts));
