import { z } from 'zod';
import mongoose from 'mongoose';
import { route, AppError, audit, forbidden, notFound } from '@/server/api';
import { Team, Issue } from '@/server/models';
import { canManageTeam, cleanMemberIds, teamColorSchema, teamNameSchema } from '@/server/teams';
import type { AuthUser } from '@/server/auth';

async function load(user: AuthUser, id: string) {
  if (!user.orgId || !mongoose.isValidObjectId(id)) throw notFound('Team not found');
  const t = await Team.findOne({ _id: id, orgId: user.orgId });
  if (!t) throw notFound('Team not found');
  return t;
}

const patchSchema = z.object({
  name: teamNameSchema.optional(), description: z.string().trim().max(500).optional(), color: teamColorSchema.optional(),
  memberIds: z.array(z.string()).max(500).optional(), leadId: z.string().nullish(),
  join: z.boolean().optional(), // any non-guest may join/leave a team themselves
});

export const PATCH = route(async (req, { user, params }) => {
  const t = await load(user, params.id);
  const d = patchSchema.parse(await req.json());
  if (d.join !== undefined) {
    if (user.role === 'guest') throw forbidden();
    const set = new Set((t.memberIds || []).map(String));
    d.join ? set.add(user.id) : set.delete(user.id);
    t.memberIds = [...set] as any;
    if (!d.join && String(t.leadId) === user.id) t.leadId = undefined;
    await t.save();
    return { done: true };
  }
  if (!canManageTeam(user, t)) throw forbidden('Only the team lead, its creator or an org admin can edit this team');
  if (d.name && d.name.toLowerCase() !== String(t.name).toLowerCase()) {
    const dup = await Team.exists({ orgId: user.orgId, _id: { $ne: t._id }, name: new RegExp(`^${d.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (dup) throw new AppError(409, 'DUPLICATE', 'A team with that name already exists', { name: 'Already exists' });
  }
  if (d.name !== undefined) t.name = d.name;
  if (d.description !== undefined) t.description = d.description;
  if (d.color !== undefined) t.color = d.color;
  if (d.memberIds !== undefined) t.memberIds = (await cleanMemberIds(user.orgId!, d.memberIds)) as any;
  if (d.leadId !== undefined) {
    if (d.leadId && !(t.memberIds || []).map(String).includes(d.leadId)) throw new AppError(400, 'BAD_LEAD', 'The team lead must be a member of the team', { leadId: 'Must be a member' });
    t.leadId = d.leadId || undefined;
  } else if (t.leadId && !(t.memberIds || []).map(String).includes(String(t.leadId))) t.leadId = undefined;
  await t.save();
  await audit(user, 'team.updated', t.name);
  return { done: true };
});

/** Deleting a team only clears the Team field on its issues; the issues themselves are untouched. */
export const DELETE = route(async (_req, { user, params }) => {
  const t = await load(user, params.id);
  if (!canManageTeam(user, t)) throw forbidden('Only the team lead, its creator or an org admin can delete this team');
  await Issue.updateMany({ orgId: user.orgId, teamId: t._id }, { $unset: { teamId: 1 } });
  await t.deleteOne();
  await audit(user, 'team.deleted', t.name);
  return { done: true };
});
