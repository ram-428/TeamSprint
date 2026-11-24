import { z } from 'zod';
import { route, AppError, logActivity } from '@/server/api';
import { loadIssue, requirePerm } from '@/server/domain';
import { cleanAttachments, destroyAsset } from '@/server/cloudinary';
import { MAX_PER_ISSUE } from '@/lib/attachments';

/** Attach files (already uploaded to Cloudinary by the browser) to an issue. */
export const POST = route(async (req, { user, params }) => {
  const { issue, project } = await loadIssue(user, params.key);
  requirePerm(user, 'issue.edit_any', project, String(issue.reporterId) === user.id);
  const { attachments } = z.object({ attachments: z.array(z.any()).min(1) }).parse(await req.json());
  let add;
  try { add = cleanAttachments(attachments, String(issue.orgId), user.id); }
  catch { throw new AppError(400, 'BAD_ATTACHMENT', 'One of the files could not be attached'); }
  if ((issue.attachments?.length || 0) + add.length > MAX_PER_ISSUE) throw new AppError(400, 'TOO_MANY', `An issue can have up to ${MAX_PER_ISSUE} attachments`);
  issue.attachments = [...(issue.attachments || []), ...add] as any;
  await issue.save();
  await logActivity(user, issue, 'attached', { files: add.map((a) => a.name) });
  return { attachments: add };
});

export const DELETE = route(async (req, { user, params }) => {
  const { issue, project } = await loadIssue(user, params.key);
  const id = new URL(req.url).searchParams.get('id');
  const att = (issue.attachments || []).find((a: any) => a.id === id);
  if (!att) throw new AppError(404, 'NOT_FOUND', 'Attachment not found');
  const mine = att.uploadedBy === user.id;
  requirePerm(user, mine ? 'issue.edit_any' : 'issue.delete_any', project, String(issue.reporterId) === user.id);
  issue.attachments = (issue.attachments || []).filter((a: any) => a.id !== id) as any;
  await issue.save();
  await destroyAsset(att.publicId, att.resourceType);
  await logActivity(user, issue, 'detached', { file: att.name });
  return { done: true };
});
