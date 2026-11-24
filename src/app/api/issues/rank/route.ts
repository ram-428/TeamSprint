import { z } from 'zod';
import { route, AppError } from '@/server/api';
import { Issue } from '@/server/models';
import { loadIssue, applyIssueUpdate, requirePerm } from '@/server/domain';

/** Drag & drop endpoint: optionally transitions status / moves sprint, and re-ranks between two neighbours. */
const schema = z.object({
  key: z.string(), status: z.string().optional(), sprintId: z.string().nullable().optional(),
  aboveKey: z.string().nullish(), belowKey: z.string().nullish(), // neighbours in the final order (above = lower rank)
});

export const POST = route(async (req, { user, params: _ }) => {
  const b = schema.parse(await req.json());
  const { issue, project } = await loadIssue(user, b.key);
  requirePerm(user, 'issue.transition', project, String(issue.reporterId) === user.id || String(issue.assigneeId) === user.id);
  const patch: Record<string, any> = {};
  if (b.status && b.status !== issue.status) patch.status = b.status;
  if ('sprintId' in b && String(b.sprintId ?? '') !== String(issue.sprintId ?? '')) {
    requirePerm(user, 'issue.edit_any', project, String(issue.reporterId) === user.id);
    patch.sprintId = b.sprintId;
  }
  const above = b.aboveKey ? await Issue.findOne({ key: b.aboveKey, projectId: project._id }).select('rank').lean<any>() : null;
  const below = b.belowKey ? await Issue.findOne({ key: b.belowKey, projectId: project._id }).select('rank').lean<any>() : null;
  if (above && below) patch.rank = (above.rank + below.rank) / 2;
  else if (above) patch.rank = above.rank + 500;
  else if (below) patch.rank = below.rank - 500;
  if (!Object.keys(patch).length) return { done: true };
  if (patch.rank !== undefined && Number.isNaN(patch.rank)) throw new AppError(400, 'RANK', 'Bad rank');
  return applyIssueUpdate(user, issue, project, patch);
});
