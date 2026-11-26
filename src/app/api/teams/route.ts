import { z } from 'zod';
import { route, AppError, audit } from '@/server/api';
import { Team } from '@/server/models';
import { listTeams, cleanMemberIds, teamColorSchema, teamNameSchema } from '@/server/teams';

/** All teams in the caller's organization (used by the Team picker and the Teams page). */
export const GET = route(async (_req, { user }) => listTeams(user));

const createSchema = z.object({
  name: teamNameSchema, description: z.string().trim().max(500).optional(), color: teamColorSchema.optional(),
  memberIds: z.array(z.string()).max(500).optional(), leadId: z.string().nullish(),
});

/** Any org member except guests may create a team, as in Jira. The creator is always a member. */
export const POST = route(async (req, { user }) => {
  if (!user.orgId) throw new AppError(403, 'FORBIDDEN', 'Join an organization first');
  if (user.role === 'guest') throw new AppError(403, 'FORBIDDEN', 'Guests cannot create teams');
  const d = createSchema.parse(await req.json());
  const exists = await Team.exists({ orgId: user.orgId, name: new RegExp(`^${d.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
  if (exists) throw new AppError(409, 'DUPLICATE', 'A team with that name already exists', { name: 'Already exists' });
  const memberIds = await cleanMemberIds(user.orgId, [...(d.memberIds || []), user.id]);
  const leadId = d.leadId && memberIds.some((m) => String(m) === d.leadId) ? d.leadId : user.id;
  const t = await Team.create({ orgId: user.orgId, name: d.name, description: d.description, color: d.color || '#7c5cff', memberIds, leadId, createdBy: user.id });
  await audit(user, 'team.created', d.name);
  return { _id: String(t._id), name: t.name };
});
