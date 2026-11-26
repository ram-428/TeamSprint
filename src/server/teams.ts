import mongoose from 'mongoose';
import { z } from 'zod';
import { Team, User } from './models';
import { AppError } from './api';
import type { AuthUser } from './auth';

export const teamColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour');
export const teamNameSchema = z.string().trim().min(2, 'Name needs at least 2 characters').max(60, 'Keep the name under 60 characters');

export type TeamSummary = {
  _id: string; name: string; description?: string; color: string; leadId?: string; createdBy?: string;
  memberIds: string[]; memberCount: number; includesMe: boolean;
  members: { _id: string; name: string; color?: string; avatarUrl?: string }[];
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
  const users = await User.find({ _id: { $in: ids }, orgId: user.orgId, status: 'active' }).select('name color avatarUrl').lean<any[]>();
  const byId = new Map(users.map((u) => [String(u._id), { _id: String(u._id), name: u.name, color: u.color, avatarUrl: u.avatarUrl }]));
  return teams.map((t) => {
    const members = (t.memberIds || []).map(String).map((id: string) => byId.get(id)).filter(Boolean) as TeamSummary['members'];
    return {
      _id: String(t._id), name: t.name, description: t.description, color: t.color || '#7c5cff',
      leadId: t.leadId ? String(t.leadId) : undefined, createdBy: t.createdBy ? String(t.createdBy) : undefined,
      memberIds: members.map((m) => m._id), memberCount: members.length, includesMe: members.some((m) => m._id === user.id),
      members, canManage: canManageTeam(user, t),
    };
  });
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
