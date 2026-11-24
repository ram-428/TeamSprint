import { z } from 'zod';
import { route, AppError, logActivity } from '@/server/api';
import { Worklog, Issue } from '@/server/models';
import { loadIssue, requirePerm } from '@/server/domain';
import { parseDuration } from '@/server/time';

const schema = z.object({ time: z.string(), description: z.string().max(500).optional(), startedAt: z.string().optional() });

export const POST = route(async (req, { user, params }) => {
  const { issue, project } = await loadIssue(user, params.key);
  requirePerm(user, 'worklog.add', project);
  const b = schema.parse(await req.json());
  const seconds = parseDuration(b.time);
  if (!seconds) throw new AppError(422, 'BAD_TIME', 'Use a format like 2h 30m or 1d', { time: 'Try "2h 30m"' });
  if (seconds > 7 * 28800) throw new AppError(422, 'BAD_TIME', 'That is more than a week of work in one entry', { time: 'Too large' });
  const w = await Worklog.create({ orgId: project.orgId, issueId: issue._id, userId: user.id, seconds, description: b.description, startedAt: b.startedAt ? new Date(b.startedAt) : new Date() });
  await Issue.updateOne({ _id: issue._id }, { $inc: { timeSpent: seconds } });
  await logActivity(user, issue, 'worklog', { seconds });
  return w;
});

export const DELETE = route(async (req, { user, params }) => {
  const { issue } = await loadIssue(user, params.key);
  const w = await Worklog.findById(new URL(req.url).searchParams.get('id'));
  if (!w) throw new AppError(404, 'NOT_FOUND', 'Entry not found');
  if (String(w.userId) !== user.id) throw new AppError(403, 'FORBIDDEN', 'You can only delete your own work logs');
  await Issue.updateOne({ _id: issue._id }, { $inc: { timeSpent: -w.seconds } });
  await w.deleteOne();
  return { done: true };
});
