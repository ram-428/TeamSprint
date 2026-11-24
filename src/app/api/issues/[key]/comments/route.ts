import { z } from 'zod';
import { route, notify, logActivity, AppError } from '@/server/api';
import { Comment, User } from '@/server/models';
import { loadIssue, requirePerm } from '@/server/domain';
import { can } from '@/server/rbac';

const schema = z.object({ body: z.string().trim().min(1, 'Write something first').max(10000), internal: z.boolean().optional() });

export const POST = route(async (req, { user, params }) => {
  const { issue, project } = await loadIssue(user, params.key);
  requirePerm(user, 'comment.add', project);
  const b = schema.parse(await req.json());
  // @mentions: "@Sara Dev" or "@sara.dev@acme.dev" — resolve against org users
  const users = await User.find({ orgId: user.orgId, status: 'active' }).select('name email').lean<any[]>();
  const mentions = users.filter((u) => b.body.toLowerCase().includes('@' + u.name.toLowerCase()) || b.body.toLowerCase().includes('@' + u.email.toLowerCase())).map((u) => String(u._id));
  const c = await Comment.create({ orgId: project.orgId, issueId: issue._id, authorId: user.id, body: b.body, internal: !!b.internal, mentions });
  await logActivity(user, issue, 'commented');
  await notify(mentions, user.id, 'mention', `${user.name} mentioned you on ${issue.key}`, issue.key);
  await notify([issue.assigneeId, issue.reporterId, ...(issue.watchers || [])].filter((x) => !mentions.includes(String(x))), user.id, 'comment', `${user.name} commented on ${issue.key}: ${issue.summary}`, issue.key);
  return c;
});

export const DELETE = route(async (req, { user, params }) => {
  const { project } = await loadIssue(user, params.key);
  const id = new URL(req.url).searchParams.get('id');
  const c = await Comment.findById(id);
  if (!c) throw new AppError(404, 'NOT_FOUND', 'Comment not found');
  if (String(c.authorId) !== user.id && !can(user, 'comment.delete_any', project)) throw new AppError(403, 'FORBIDDEN', 'You can only delete your own comments');
  await c.deleteOne();
  return { done: true };
});
