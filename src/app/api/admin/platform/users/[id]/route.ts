import { z } from 'zod';
import { route, forbidden, AppError, audit, oid } from '@/server/api';
import { User } from '@/server/models';
import { hash } from '@/server/auth';

export const PATCH = route(async (req, { user, params }) => {
  if (user.platformRole !== 'super_admin') throw forbidden();
  const b = z.object({ action: z.enum(['suspend', 'activate', 'unlock', 'logout_all', 'reset_password']) }).parse(await req.json());
  const u = await User.findById(oid(params.id));
  if (!u) throw new AppError(404, 'NOT_FOUND', 'User not found');
  // Super Admins are managed only via `npm run create-super-admin` – never through the app.
  if (String(u._id) === user.id && ['suspend'].includes(b.action)) throw new AppError(400, 'SELF', 'You cannot do that to your own account');
  let result: any = { done: true };
  switch (b.action) {
    case 'suspend': u.status = 'suspended'; u.tokenVersion = (u.tokenVersion || 0) + 1; break;
    case 'activate': u.status = 'active'; break;
    case 'unlock': u.lockUntil = undefined; u.failed = 0; break;
    case 'logout_all': u.tokenVersion = (u.tokenVersion || 0) + 1; break;
    case 'reset_password': { const tmp = 'Reset-' + Math.random().toString(36).slice(2, 8) + '9X'; u.passwordHash = await hash(tmp); u.tokenVersion = (u.tokenVersion || 0) + 1; result = { temporaryPassword: tmp }; break; }
  }
  await u.save();
  await audit(user, `platform.user_${b.action}`, u.email);
  return result;
});
