import { route } from '@/server/api';
import { Org, User } from '@/server/models';
import { dropUserCache } from '@/server/auth';

export const GET = route(async (_req, { user }) => {
  const org = user.orgId ? await Org.findById(user.orgId).select('name slug plan').lean() : null;
  return { user, org };
});

export const PATCH = route(async (req, { user }) => {
  const b = await req.json();
  const patch: Record<string, unknown> = {};
  if (typeof b.name === 'string' && b.name.trim()) patch.name = b.name.trim().slice(0, 80);
  if (typeof b.title === 'string') patch.title = b.title.slice(0, 80);
  if (['dark', 'light', 'simple'].includes(b.theme)) patch.theme = b.theme;
  await User.updateOne({ _id: user.id }, patch);
  dropUserCache(user.id);
  return { done: true };
});
