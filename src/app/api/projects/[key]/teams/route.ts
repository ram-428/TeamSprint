import { z } from 'zod';
import { audit, notFound, route } from '@/server/api';
import { loadProject, requirePerm } from '@/server/domain';
import { Team } from '@/server/models';

const schema = z.object({
  teamId: z.string().regex(/^[0-9a-f]{24}$/i),
  linked: z.boolean(),
});

export const PATCH = route(async (req, { user, params }) => {
  const project = await loadProject(user, params.key);
  if (project.archived) throw notFound('Project not found');
  requirePerm(user, 'project.edit', project);
  const { teamId, linked } = schema.parse(await req.json());
  const result = await Team.updateOne(
    { _id: teamId, orgId: project.orgId },
    linked ? { $addToSet: { projectIds: project._id } } : { $pull: { projectIds: project._id } },
  );
  if (!result.matchedCount) throw notFound('Team not found');
  if (result.modifiedCount) {
    await audit(user, linked ? 'project.team_added' : 'project.team_removed', project.key, { teamId });
  }
  return { done: true };
});
