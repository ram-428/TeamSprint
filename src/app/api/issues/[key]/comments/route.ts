import { z } from 'zod';
import mongoose from 'mongoose';
import { route, notify, logActivity, AppError } from '@/server/api';
import { Comment, User } from '@/server/models';
import { loadIssue, requirePerm } from '@/server/domain';
import { cleanAttachments, destroyAsset } from '@/server/cloudinary';
import { can } from '@/server/rbac';
import { MAX_PER_COMMENT } from '@/lib/attachments';
import type { AuthUser } from '@/server/auth';

const bodySchema = z.string().trim().max(10000);
const schema = z.object({ body: bodySchema.default(''), internal: z.boolean().optional(), attachments: z.array(z.any()).max(MAX_PER_COMMENT).optional() });
/** Edit: new text, plus the attachment list to keep (ids of existing ones) and any newly uploaded files. */
const patchSchema = z.object({ body: bodySchema, keepAttachmentIds: z.array(z.string()).max(MAX_PER_COMMENT).default([]), attachments: z.array(z.any()).max(MAX_PER_COMMENT).optional() });

/** @mentions: "@Sara Dev" or "@sara.dev@acme.dev", resolved against the org's active users. */
async function mentionsIn(user: AuthUser, body: string) {
  if (!body.includes('@')) return [];
  const users = await User.find({ orgId: user.orgId, status: 'active' }).select('name email').lean<any[]>();
  const b = body.toLowerCase();
  return users.filter((u) => b.includes('@' + u.name.toLowerCase()) || b.includes('@' + u.email.toLowerCase())).map((u) => String(u._id));
}

function clean(input: unknown, orgId: string, userId: string) {
  try { return cleanAttachments(input ?? [], orgId, userId); }
  catch { throw new AppError(400, 'BAD_ATTACHMENT', 'One of the files could not be attached'); }
}
const empty = () => new AppError(422, 'VALIDATION', 'Write something or attach a file', { body: 'Write something first' });

/** The comment, checked to belong to this issue (an id from another issue is "not found"). */
async function loadComment(req: Request, issueId: any) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id || !mongoose.isValidObjectId(id)) throw new AppError(404, 'NOT_FOUND', 'Comment not found');
  const c = await Comment.findOne({ _id: id, issueId });
  if (!c) throw new AppError(404, 'NOT_FOUND', 'Comment not found');
  return c;
}

export const POST = route(async (req, { user, params }) => {
  const { issue, project } = await loadIssue(user, params.key);
  requirePerm(user, 'comment.add', project);
  const b = schema.parse(await req.json());
  const attachments = clean(b.attachments, String(issue.orgId), user.id);
  if (!b.body && !attachments.length) throw empty();
  const mentions = await mentionsIn(user, b.body);
  const c = await Comment.create({ orgId: project.orgId, issueId: issue._id, authorId: user.id, body: b.body, internal: !!b.internal, mentions, attachments });
  await logActivity(user, issue, 'commented');
  await notify(mentions, user.id, 'mention', `${user.name} mentioned you on ${issue.key}`, issue.key);
  await notify([issue.assigneeId, issue.reporterId, ...(issue.watchers || [])].filter((x) => !mentions.includes(String(x))), user.id, 'comment', `${user.name} commented on ${issue.key}: ${issue.summary}`, issue.key);
  return c;
});

/** Authors edit their own comments (Jira "Edit own comments"), as long as they may still comment in the project. */
export const PATCH = route(async (req, { user, params }) => {
  const { issue, project } = await loadIssue(user, params.key);
  const c = await loadComment(req, issue._id);
  if (String(c.authorId) !== user.id) throw new AppError(403, 'FORBIDDEN', 'You can only edit your own comments');
  requirePerm(user, 'comment.add', project);
  const b = patchSchema.parse(await req.json());
  const keep = new Set(b.keepAttachmentIds);
  const kept = (c.attachments || []).filter((a: any) => keep.has(a.id));
  const removed = (c.attachments || []).filter((a: any) => !keep.has(a.id));
  const added = clean(b.attachments, String(issue.orgId), user.id);
  if (kept.length + added.length > MAX_PER_COMMENT) throw new AppError(400, 'TOO_MANY', `A comment can have up to ${MAX_PER_COMMENT} attachments`);
  if (!b.body && !kept.length && !added.length) throw empty();
  // Only people newly mentioned by this edit are notified.
  const before = new Set((c.mentions || []).map(String));
  const mentions = await mentionsIn(user, b.body);
  c.body = b.body; c.mentions = mentions as any; c.attachments = [...kept.map((a: any) => (a.toObject ? a.toObject() : a)), ...added] as any; c.editedAt = new Date();
  await c.save();
  await Promise.all(removed.map((a: any) => destroyAsset(a.publicId, a.resourceType)));
  await notify(mentions.filter((m) => !before.has(m)), user.id, 'mention', `${user.name} mentioned you on ${issue.key}`, issue.key);
  return c;
});

export const DELETE = route(async (req, { user, params }) => {
  const { issue, project } = await loadIssue(user, params.key);
  const c = await loadComment(req, issue._id);
  if (String(c.authorId) !== user.id && !can(user, 'comment.delete_any', project)) throw new AppError(403, 'FORBIDDEN', 'You can only delete your own comments');
  const files = c.attachments || [];
  await c.deleteOne();
  await Promise.all(files.map((a: any) => destroyAsset(a.publicId, a.resourceType)));
  return { done: true };
});
