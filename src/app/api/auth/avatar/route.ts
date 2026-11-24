import { route, AppError, audit } from '@/server/api';
import { User } from '@/server/models';
import { dropUserCache } from '@/server/auth';
import { cloudinaryConfigured, uploadImage, destroyImage, avatarThumb } from '@/server/cloudinary';

const MAX = 2 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/** Upload / replace the signed-in user's profile photo. */
export const POST = route(async (req, { user }) => {
  if (user.impersonatedBy) throw new AppError(403, 'IMPERSONATING', 'Not available while viewing as another user');
  if (!cloudinaryConfigured()) throw new AppError(503, 'UPLOADS_DISABLED', 'Photo upload is not configured yet. Ask your administrator to set the Cloudinary keys.');
  const file = (await req.formData()).get('file');
  if (!(file instanceof File)) throw new AppError(400, 'NO_FILE', 'Choose an image to upload', { file: 'Choose an image' });
  if (!TYPES.includes(file.type)) throw new AppError(415, 'BAD_TYPE', 'Use a PNG, JPG, WebP or GIF image', { file: 'Use a PNG, JPG, WebP or GIF image' });
  if (file.size > MAX) throw new AppError(413, 'TOO_BIG', 'Image must be 2 MB or smaller', { file: 'Image must be 2 MB or smaller' });
  let up;
  try { up = await uploadImage(file, { folder: 'team-sprint/avatars', publicId: user.id }); }
  catch (e) { console.error('[cloudinary] upload failed', e); throw new AppError(502, 'UPLOAD_FAILED', 'Could not upload the image. Try again shortly.'); }
  const url = avatarThumb(up.url);
  await User.updateOne({ _id: user.id }, { avatarUrl: url });
  dropUserCache(user.id);
  await audit(user, 'auth.avatar_changed', user.email);
  return { avatarUrl: url };
});

export const DELETE = route(async (_req, { user }) => {
  if (user.impersonatedBy) throw new AppError(403, 'IMPERSONATING', 'Not available while viewing as another user');
  await User.updateOne({ _id: user.id }, { $unset: { avatarUrl: 1 } });
  dropUserCache(user.id);
  await destroyImage(`team-sprint/avatars/${user.id}`);
  return { avatarUrl: null };
});
