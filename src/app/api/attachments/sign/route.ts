import { z } from 'zod';
import { route, AppError } from '@/server/api';
import { cloudinaryConfigured, signIssueUpload } from '@/server/cloudinary';
import { checkFile } from '@/lib/attachments';

/** Hands the browser a short-lived signature so it can upload one allowed file directly to Cloudinary. */
export const POST = route(async (req, { user }) => {
  if (!user.orgId) throw new AppError(403, 'NO_ORG', 'Join an organization to attach files');
  if (user.impersonatedBy) throw new AppError(403, 'IMPERSONATING', 'Not available while viewing as another user');
  if (!cloudinaryConfigured()) throw new AppError(503, 'UPLOADS_DISABLED', 'File upload is not configured yet. Ask your administrator to set the Cloudinary keys.');
  const { name, size } = z.object({ name: z.string().min(1).max(200), size: z.number().int().min(1) }).parse(await req.json());
  const why = checkFile(name, size);
  if (why) throw new AppError(400, 'BAD_FILE', why);
  return signIssueUpload(user.orgId);
});
