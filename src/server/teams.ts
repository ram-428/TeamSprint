import mongoose from 'mongoose';
import { z } from 'zod';
import { Team, User, Project } from './models';
import { AppError } from './api';
import { can } from './rbac';
import type { AuthUser } from './auth';

export const teamColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour');
export const teamNameSchema = z.string().trim().min(2, 'Name needs at least 2 characters').max(60, 'Keep the name under 60 characters');

export type TeamSummary = {
  _id: string; name: string; description?: string; color: string; leadId?: string; createdBy?: string;
  memberIds: string[]; memberCount: number; includesMe: boolean;
  members: { _id: string; name: string; color?: string; avatarUrl?: string }[];
  /** Projects the team works on that the caller can see. */
  projects: { _id: string; key: string; name: string; color?: string }[];
  canManage: boolean;
};

/** Org admins, the team lead and whoever created the team may edit or delete it (like Jira, anyone can create one). */
export function canManageTeam(user: AuthUser, team: any) {
  return user.role === 'org_admin' || user.platformRole === 'super_admin' || String(team.leadId) === user.id || String(team.createdBy) === user.id;
}

/** Every team of the organization, with light member objects for pickers. Deactivated users are left out of the member list. */
export async function listTeams(user: AuthUser): Promise<TeamSummary[]> {
  if (!user.orgId) return [];
  const teams = await Team.find({ orgId: user.orgId }).sort({ name: 1 }).lean<any[]>();
  const ids = [...new Set(teams.flatMap((t) => (t.memberIds || []).map(String)))];
  const pids = [...new Set(teams.flatMap((t) => (t.projectIds || []).map(String)))];
  const [users, projects] = await Promise.all([
    User.find({ _id: { $in: ids }, orgId: user.orgId, status: 'active' }).select('name color avatarUrl').lean<any[]>(),
    pids.length ? Project.find({ _id: { $in: pids }, orgId: user.orgId, archived: false }).select('key name color visibility members orgId').lean<any[]>() : Promise.resolve([] as any[]),
  ]);
  const byId = new Map(users.map((u) => [String(u._id), { _id: String(u._id), name: u.name, color: u.color, avatarUrl: u.avatarUrl }]));
  const projById = new Map(projects.filter((p) => can(user, 'project.view', p)).map((p) => [String(p._id), { _id: String(p._id), key: p.key, name: p.name, color: p.color }]));
  return teams.map((t) => {
    const members = (t.memberIds || []).map(String).map((id: string) => byId.get(id)).filter(Boolean) as TeamSummary['members'];
    return {
      _id: String(t._id), name: t.name, description: t.description, color: t.color || '#7c5cff',
      leadId: t.leadId ? String(t.leadId) : undefined, createdBy: t.createdBy ? String(t.createdBy) : undefined,
      memberIds: members.map((m) => m._id), memberCount: members.length, includesMe: members.some((m) => m._id === user.id),
      members, canManage: canManageTeam(user, t),
      projects: (t.projectIds || []).map(String).map((id: string) => projById.get(id)).filter(Boolean) as TeamSummary['projects'],
    };
  });
}

/**
 * Validates the projects a team works on: each must be an active project of the org that the caller can see.
 * Projects already linked that the caller cannot see are kept, so editing a team never silently unlinks them.
 */
export async function cleanProjectIds(user: AuthUser, ids: string[], existing: any[] = []): Promise<mongoose.Types.ObjectId[]> {
  const uniq = [...new Set(ids)].filter((id) => mongoose.isValidObjectId(id));
  const all = await Project.find({ orgId: user.orgId, archived: false, _id: { $in: [...uniq, ...existing.map(String)] } }).select('visibility members orgId').lean<any[]>();
  const visible = new Set(all.filter((p) => can(user, 'project.view', p)).map((p) => String(p._id)));
  if (uniq.some((id) => !visible.has(id))) throw new AppError(400, 'BAD_PROJECT', 'Some projects were not found', { projectIds: 'Pick projects you can access' });
  const hiddenKept = existing.map(String).filter((id) => !visible.has(id) && all.some((p) => String(p._id) === id));
  return [...new Set([...uniq, ...hiddenKept])].map((id) => new mongoose.Types.ObjectId(id));
}

/** Keeps only ids of active users in the organization; rejects anything else. */
export async function cleanMemberIds(orgId: string, ids: string[]): Promise<mongoose.Types.ObjectId[]> {
  const uniq = [...new Set(ids)].filter((id) => mongoose.isValidObjectId(id));
  const found = await User.find({ _id: { $in: uniq }, orgId, status: 'active' }).select('_id').lean<any[]>();
  if (found.length !== uniq.length) throw new AppError(400, 'BAD_MEMBER', 'Some members are not active in this organization', { memberIds: 'Pick active members only' });
  return found.map((u) => u._id);
}

/** Validates a team id for an issue: it must belong to the issue's organization. */
export async function assertTeam(orgId: any, teamId: string) {
  if (!mongoose.isValidObjectId(teamId)) throw new AppError(400, 'BAD_TEAM', 'Team not found', { teamId: 'Team not found' });
  const t = await Team.findOne({ _id: teamId, orgId }).select('name').lean<any>();
  if (!t) throw new AppError(400, 'BAD_TEAM', 'Team not found', { teamId: 'Team not found' });
  return t;
}
